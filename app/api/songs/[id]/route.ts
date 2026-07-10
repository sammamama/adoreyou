// Song status polling (decision #4 — client polls, no Suno webhook).
//
// SECURITY (decision #9): while the song is unpaid, this route returns ONLY
// preview URLs pointing at our own clip proxy (/api/songs/[id]/preview/[track]).
// Full audio URLs — and even sunoTrackIds, since Suno CDN URLs are derivable
// from a track id — never appear in any pre-payment response.
//
// Preview approach: time-limited proxy with byte-range clipping (see the
// preview route for details) — simplest thing that works on Vercel; no ffmpeg.
//
// Step 8: post-payment responses additionally carry giftCredits,
// selectedTrackIndex, and the regen flags the song page needs. PATCH records
// the final pick after a regen render (regenPickPending) and re-computes
// which tracks are unlocked.

import { NextRequest, NextResponse } from 'next/server';
import type { Gift, Song } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendSongReadyEmail } from '@/lib/email';
import { archiveTracks, trackPlaybackUrl } from '@/lib/storage';
import { refundRegenLineItem } from '@/lib/stripe';
import { getGenerationStatus } from '@/lib/suno';
import type { StyleInputs, Track, Upsells } from '@/types';

// Regen-complete archiving and the self-heal pass move megabytes through
// this handler — allow more than the platform default.
export const maxDuration = 60;

// Every read/write in this file carries the song's gifts — serialize() needs
// them for the sent-gifts list and remaining-credit math.
const withGifts = { gifts: { orderBy: { createdAt: 'asc' as const } } };

async function serialize(song: Song & { gifts: Gift[] }) {
  const tracks = song.tracks as unknown as Track[];
  const upsells = song.upsells as unknown as Upsells;
  const isPaid = song.status === 'paid' || song.status === 'done';

  const responseTracks = await Promise.all(
    tracks.map(async (t, index) => ({
      index,
      genre: t.genre,
      kind: t.kind,
      previewUrl: `/api/songs/${song.id}/preview/${index}`,
      // Full audio only for paid + unlocked tracks — never before. Signed
      // storage URL once archived (Suno's CDN expires ~1 week).
      ...(isPaid && t.unlocked
        ? {
            audioUrl: await trackPlaybackUrl(t),
            downloadUrl: `/api/songs/${song.id}/download/${index}`,
          }
        : {}),
    }))
  );

  return {
    id: song.id,
    status: song.status,
    recipientName: song.recipientName,
    occasion: song.occasion,
    tracks: responseTracks,
    // Post-payment fields only — nothing here leaks pre-payment.
    ...(isPaid
      ? {
          selectedTrackIndex: tracks.findIndex(
            (t) => t.sunoTrackId === song.selectedTrackId
          ),
          // Remaining credits (decision #15) — giftCredits is the total
          // granted; each gift row consumed one.
          giftCredits: Math.max(0, song.giftCredits - song.gifts.length),
          gifts: song.gifts.map((g) => ({
            id: g.id,
            link: `/gift/${g.id}`,
            accessCode: g.accessCode,
            recipientEmail: g.recipientEmail,
          })),
          regenPending: upsells.regenPending === true,
          regenPickPending: upsells.regenPickPending === true,
          regenRefunded: upsells.regenRefunded === true,
        }
      : {}),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let song = await prisma.song.findUnique({
    where: { id },
    include: withGifts,
  });
  if (!song) {
    return NextResponse.json(
      { data: null, error: 'Song not found.' },
      { status: 404 }
    );
  }

  // Still rendering — check Suno and persist the result when ready.
  if (song.status === 'generating' && song.sunoTaskId) {
    try {
      const genre = (song.styleInputs as unknown as StyleInputs).genre;
      const result = await getGenerationStatus(song.sunoTaskId, genre);

      if (result.state === 'complete') {
        const tracks: Track[] = result.tracks.map((t) => ({
          ...t,
          kind: 'original',
          unlocked: false,
        }));
        song = await prisma.song.update({
          where: { id },
          data: {
            tracks: JSON.parse(JSON.stringify(tracks)),
            status: 'preview',
          },
          include: withGifts,
        });
      } else if (result.state === 'failed') {
        console.error(`suno generation failed for song ${id}:`, result.reason);
        song = await prisma.song.update({
          where: { id },
          data: { status: 'failed' },
          include: withGifts,
        });
      }
    } catch (err) {
      // Transient Suno/API hiccup — stay in generating, client keeps polling.
      console.error('song status poll error:', err);
    }
  }

  // Regen render in flight (paid via webhook) — poll it here too. On
  // complete: append the regen pair, status → done, final pick pending. On
  // failure: auto-refund the regen line item (decision #6, double-refund
  // guarded by the regenRefunded flag + Stripe idempotency key), base song
  // stays delivered.
  const upsells = song.upsells as unknown as Upsells;
  let becameDone = false;
  if (song.status === 'paid' && upsells.regenPending && song.sunoTaskId) {
    try {
      const result = await getGenerationStatus(
        song.sunoTaskId,
        upsells.regenGenre ?? (song.styleInputs as unknown as StyleInputs).genre
      );

      if (result.state === 'complete') {
        // Song is already paid — archive the fresh regen pair right away.
        const regenTracks: Track[] = await archiveTracks(
          id,
          result.tracks.map((t) => ({
            ...t,
            kind: 'regen' as const,
            unlocked: upsells.keepEveryVersion,
          }))
        );
        upsells.regenPending = false;
        upsells.regenPickPending = true;
        song = await prisma.song.update({
          where: { id },
          data: {
            tracks: JSON.parse(
              JSON.stringify([...(song.tracks as unknown as Track[]), ...regenTracks])
            ),
            upsells: JSON.parse(JSON.stringify(upsells)),
            status: 'done',
          },
          include: withGifts,
        });
        becameDone = true;
      } else if (result.state === 'failed') {
        console.error(`regen render failed for song ${id}:`, result.reason);
        if (!upsells.regenRefunded && song.stripeSessionId) {
          await refundRegenLineItem(id, song.stripeSessionId);
          upsells.regenRefunded = true;
        }
        upsells.regenPending = false;
        song = await prisma.song.update({
          where: { id },
          data: {
            upsells: JSON.parse(JSON.stringify(upsells)),
            status: 'done',
          },
          include: withGifts,
        });
        becameDone = true;
      }
    } catch (err) {
      // Transient Suno/Stripe hiccup — stay paid+pending, client keeps polling.
      console.error('regen status poll error:', err);
    }
  }

  // Regen purchases reach `done` here, not in the webhook — send the
  // song-ready email on that transition (decision #13: both addresses on a
  // mismatch). This transition happens exactly once (regenPending flips off
  // in the same update), so no duplicate sends. Email failure must not fail
  // the poll response.
  if (becameDone) {
    const to = [...new Set([song.email, song.stripeEmail].filter((e): e is string => !!e))];
    if (to.length > 0) {
      try {
        await sendSongReadyEmail({
          to,
          songId: song.id,
          songTitle: `A song for ${song.recipientName}`,
          recipientName: song.recipientName,
          occasion: song.occasion,
          accountEmail: song.email ?? song.stripeEmail,
        });
      } catch (err) {
        console.error(`song-ready email failed for song ${song.id}:`, err);
      }
    }
  }

  // Self-heal: a paid song with un-archived tracks (copy failed at payment
  // time, or storage creds were added later) retries here while the Suno
  // URLs are still alive. No-op when storage isn't configured.
  const isPaid = song.status === 'paid' || song.status === 'done';
  const currentTracks = song.tracks as unknown as Track[];
  if (isPaid && currentTracks.some((t) => !t.storageKey)) {
    const archived = await archiveTracks(song.id, currentTracks);
    if (archived.some((t, i) => t.storageKey !== currentTracks[i].storageKey)) {
      song = await prisma.song.update({
        where: { id },
        data: { tracks: JSON.parse(JSON.stringify(archived)) },
        include: withGifts,
      });
    }
  }

  return NextResponse.json({ data: await serialize(song), error: null });
}

// Final pick after a regen render — only valid while regenPickPending. Sets
// selectedTrackId and re-computes unlocks: the picked track, or everything
// if Keep Every Version was bought (decision #14).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { selectedTrackIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const song = await prisma.song.findUnique({ where: { id } });
  if (!song) {
    return NextResponse.json(
      { data: null, error: 'Song not found.' },
      { status: 404 }
    );
  }

  const upsells = song.upsells as unknown as Upsells;
  if (song.status !== 'done' || !upsells.regenPickPending) {
    return NextResponse.json(
      { data: null, error: 'This song is not waiting on a pick.' },
      { status: 400 }
    );
  }

  const tracks = song.tracks as unknown as Track[];
  const picked =
    typeof body.selectedTrackIndex === 'number'
      ? tracks[body.selectedTrackIndex]
      : undefined;
  if (!picked) {
    return NextResponse.json(
      { data: null, error: 'Pick one of your versions.' },
      { status: 400 }
    );
  }

  upsells.regenPickPending = false;
  const updatedTracks = tracks.map((t) => ({
    ...t,
    unlocked: upsells.keepEveryVersion || t.sunoTrackId === picked.sunoTrackId,
  }));

  const updated = await prisma.song.update({
    where: { id },
    data: {
      selectedTrackId: picked.sunoTrackId,
      tracks: JSON.parse(JSON.stringify(updatedTracks)),
      upsells: JSON.parse(JSON.stringify(upsells)),
    },
    include: withGifts,
  });

  return NextResponse.json({ data: await serialize(updated), error: null });
}
