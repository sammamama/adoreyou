// Phase 3 — payment. Updates the song row (email, upsells, selectedTrackId),
// creates the Stripe Checkout session (base + all upsells in one session,
// decision #13 confirm-twice email already done client-side), returns the
// checkout URL. Also handles gift credit pack sessions (decision #15).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  createGiftPackSession,
  createSongCheckoutSession,
  GIFT_PACKS,
} from '@/lib/stripe';
import { sendSongReadyEmail } from '@/lib/email';
import { archiveTracks } from '@/lib/storage';
import type { Track, Upsells } from '@/types';

// The PAYMENT_BYPASS path archives tracks to S3 — allow more than the
// platform default.
export const maxDuration = 60;

interface CheckoutRequestBody {
  songId?: string;
  // Song purchase
  email?: string;
  selectedTrackIndex?: number;
  keepEveryVersion?: boolean;
  regenGenre?: string;
  // Gift credit pack purchase (post-payment, from Song Ready or dashboard)
  giftPack?: string;
}

export async function POST(req: NextRequest) {
  let body: CheckoutRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  if (!body.songId) {
    return NextResponse.json(
      { data: null, error: 'songId is required.' },
      { status: 400 }
    );
  }

  const song = await prisma.song.findUnique({ where: { id: body.songId } });
  if (!song) {
    return NextResponse.json(
      { data: null, error: 'Song not found.' },
      { status: 404 }
    );
  }

  try {
    // Gift credit pack — song must already be purchased.
    if (body.giftPack !== undefined) {
      if (!GIFT_PACKS[body.giftPack]) {
        return NextResponse.json(
          { data: null, error: 'Unknown gift pack.' },
          { status: 400 }
        );
      }
      if (song.status !== 'paid' && song.status !== 'done') {
        return NextResponse.json(
          { data: null, error: 'Buy the song before buying gift credits.' },
          { status: 400 }
        );
      }
      // DEV PAYMENT BYPASS — grant the pack's credits immediately (mirrors
      // the webhook's gift-pack handler).
      if (process.env.PAYMENT_BYPASS === '1') {
        await prisma.song.update({
          where: { id: song.id },
          data: {
            giftCredits: { increment: GIFT_PACKS[body.giftPack].credits },
          },
        });
        return NextResponse.json({
          data: { url: `/song/${song.id}` },
          error: null,
        });
      }
      const session = await createGiftPackSession(song.id, body.giftPack);
      return NextResponse.json({ data: { url: session.url }, error: null });
    }

    // Song purchase
    if (song.status !== 'preview') {
      return NextResponse.json(
        {
          data: null,
          error:
            song.status === 'paid' || song.status === 'done'
              ? 'This song is already paid for.'
              : 'Your song is still rendering — previews come first.',
        },
        { status: 400 }
      );
    }

    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { data: null, error: 'A valid email is required.' },
        { status: 400 }
      );
    }

    // Client picks by index — sunoTrackIds never leave the server pre-payment.
    const tracks = song.tracks as unknown as Track[];
    const selected = tracks[body.selectedTrackIndex ?? -1];
    if (!selected) {
      return NextResponse.json(
        { data: null, error: 'Pick your favorite version first.' },
        { status: 400 }
      );
    }

    const upsells: Upsells = {
      ...(song.upsells as unknown as Upsells),
      keepEveryVersion: body.keepEveryVersion === true,
      ...(body.regenGenre ? { regenGenre: body.regenGenre } : {}),
    };

    // DEV PAYMENT BYPASS — with PAYMENT_BYPASS=1, skip checkout and unlock the
    // song immediately (mirrors the webhook's unlock). Remove this block or
    // unset the flag to restore the real payment flow. Regen render is skipped.
    if (process.env.PAYMENT_BYPASS === '1') {
      // Mirrors the webhook: archive to S3 at payment before Suno expires.
      const tracksUnlocked = await archiveTracks(
        song.id,
        tracks.map((t) => ({
          ...t,
          unlocked:
            upsells.keepEveryVersion || t.sunoTrackId === selected.sunoTrackId,
        }))
      );
      await prisma.song.update({
        where: { id: song.id },
        data: {
          status: 'done',
          email,
          selectedTrackId: selected.sunoTrackId,
          upsells: JSON.parse(JSON.stringify(upsells)),
          tracks: JSON.parse(JSON.stringify(tracksUnlocked)),
        },
      });
      // Mirrors the webhook: song-ready email (best-effort — never fails
      // the checkout response).
      try {
        await sendSongReadyEmail({
          to: [email],
          songId: song.id,
          songTitle: `A song for ${song.recipientName}`,
          recipientName: song.recipientName,
          occasion: song.occasion,
          accountEmail: email,
        });
      } catch (err) {
        console.error(`song-ready email failed for song ${song.id}:`, err);
      }
      return NextResponse.json({
        data: { url: `/song/${song.id}` },
        error: null,
      });
    }

    const session = await createSongCheckoutSession({
      songId: song.id,
      email,
      recipientName: song.recipientName,
      verseCount: upsells.songLength,
      keepEveryVersion: upsells.keepEveryVersion,
      regenGenre: upsells.regenGenre,
    });

    await prisma.song.update({
      where: { id: song.id },
      data: {
        email,
        selectedTrackId: selected.sunoTrackId,
        upsells: JSON.parse(JSON.stringify(upsells)),
        stripeSessionId: session.id,
      },
    });

    return NextResponse.json({ data: { url: session.url }, error: null });
  } catch (err) {
    console.error('checkout route error:', err);
    return NextResponse.json(
      { data: null, error: 'Could not start checkout — try again.' },
      { status: 500 }
    );
  }
}
