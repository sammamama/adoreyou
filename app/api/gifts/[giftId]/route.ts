// Recipient gift API (Step 9, decision #5 — no auth, just the code).
//
// GET  — public entry-screen data: occasion + names only. Never the message,
//        code, lyrics, or any audio.
// POST — validate the 4-digit access code. Correct → the full reveal payload
//        (message, lyrics, audio). Wrong → gentle 401; failed attempts are
//        rate-limited per gift + IP.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isCodeFormat, validateAccessCode } from '@/lib/access-code';
import { trackPlaybackUrl } from '@/lib/storage';
import type { Track } from '@/types';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory sliding window of FAILED attempts, keyed by gift + IP. Same
// per-instance caveat as the lyrics rate limit — approximate on Vercel, and
// that's fine: 5 guesses per window makes a 4-digit code impractical to
// brute-force in any one instance's lifetime.
const failures = new Map<string, number[]>();

function recentFailures(key: string): number[] {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, recent);
  return recent;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ giftId: string }> }
) {
  const { giftId } = await params;

  const gift = await prisma.gift.findUnique({
    where: { id: giftId },
    include: { song: true },
  });
  if (!gift) {
    return NextResponse.json(
      { data: null, error: 'Gift not found.' },
      { status: 404 }
    );
  }

  // Scheduled gifts stay sealed until their moment — the entry screen shows
  // a countdown instead of the code pad.
  const locked = !!gift.deliverAt && gift.deliverAt.getTime() > Date.now();

  return NextResponse.json({
    data: {
      recipientName: gift.song.recipientName,
      occasion: gift.song.occasion,
      senderName: gift.senderName,
      locked,
      unwrapsAt: locked ? gift.deliverAt!.toISOString() : null,
    },
    error: null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ giftId: string }> }
) {
  const { giftId } = await params;
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const key = `${giftId}:${ip}`;

  if (recentFailures(key).length >= MAX_FAILURES) {
    return NextResponse.json(
      {
        data: null,
        error: 'Too many attempts — take a breath and try again in a bit.',
      },
      { status: 429 }
    );
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const code = body.code?.trim() ?? '';
  if (!isCodeFormat(code)) {
    return NextResponse.json(
      { data: null, error: 'Enter the 4-digit code.' },
      { status: 400 }
    );
  }

  const gift = await prisma.gift.findUnique({
    where: { id: giftId },
    include: { song: true },
  });
  if (!gift) {
    return NextResponse.json(
      { data: null, error: 'Gift not found.' },
      { status: 404 }
    );
  }

  // Server-enforced countdown — the right code doesn't open a sealed gift.
  if (gift.deliverAt && gift.deliverAt.getTime() > Date.now()) {
    return NextResponse.json(
      {
        data: null,
        error: 'This gift isn’t ready to unwrap yet — come back at its moment.',
      },
      { status: 403 }
    );
  }

  if (!validateAccessCode(code, gift.accessCode)) {
    failures.set(key, [...recentFailures(key), Date.now()]);
    return NextResponse.json(
      { data: null, error: 'That’s not quite it — check the code and try again.' },
      { status: 401 }
    );
  }

  const song = gift.song;
  const isPaid = song.status === 'paid' || song.status === 'done';
  const tracks = song.tracks as unknown as Track[];
  // Sender's per-gift version pick first (Keep Every Version), then the
  // song's selected track, then any unlocked track.
  const picked =
    gift.trackIndex !== null && tracks[gift.trackIndex]?.unlocked
      ? tracks[gift.trackIndex]
      : undefined;
  const track =
    picked ??
    tracks.find((t) => t.sunoTrackId === song.selectedTrackId && t.unlocked) ??
    tracks.find((t) => t.unlocked);
  if (!isPaid || !track) {
    return NextResponse.json(
      { data: null, error: 'This gift isn’t quite ready yet — try again soon.' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    data: {
      recipientName: song.recipientName,
      occasion: song.occasion,
      senderName: gift.senderName,
      personalMessage: gift.personalMessage,
      lyrics: song.lyrics,
      // Signed storage URL once archived — Suno's CDN expires, gift pages
      // get opened weeks later.
      audioUrl: await trackPlaybackUrl(track),
      // Gift-scoped download — the recipient never needs the songId.
      downloadUrl: `/api/gifts/${gift.id}/download?code=${code}`,
      // Sender media — code-gated routes, only offered when present
      // (mime set ⇔ key set).
      photoUrl: gift.photoMime
        ? `/api/gifts/${gift.id}/media/photo?code=${code}`
        : null,
      voiceNoteUrl: gift.voiceMime
        ? `/api/gifts/${gift.id}/media/voice?code=${code}`
        : null,
    },
    error: null,
  });
}
