// Gift-scoped MP3 download — same proxy trick as the song download route
// (Suno CDN is cross-origin, so <a download> needs a same-origin stream with
// a Content-Disposition attachment). Gated on the gift's access code so the
// recipient never needs the songId.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAccessCode } from '@/lib/access-code';
import type { Track } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ giftId: string }> }
) {
  const { giftId } = await params;
  const code = req.nextUrl.searchParams.get('code') ?? '';

  const gift = await prisma.gift.findUnique({
    where: { id: giftId },
    include: { song: true },
  });

  const song = gift?.song;
  const isPaid = song?.status === 'paid' || song?.status === 'done';
  const tracks = (song?.tracks ?? []) as unknown as Track[];
  const track =
    tracks.find((t) => t.sunoTrackId === song?.selectedTrackId && t.unlocked) ??
    tracks.find((t) => t.unlocked);

  if (
    !gift ||
    !song ||
    !isPaid ||
    !track ||
    !validateAccessCode(code, gift.accessCode)
  ) {
    return NextResponse.json(
      { data: null, error: 'Download not found.' },
      { status: 404 }
    );
  }

  const upstream = await fetch(track.audioUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { data: null, error: 'Download unavailable — try again shortly.' },
      { status: 502 }
    );
  }

  const filename = `a-song-for-${song.recipientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.mp3`;

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...(upstream.headers.get('content-length')
        ? { 'Content-Length': upstream.headers.get('content-length')! }
        : {}),
    },
  });
}
