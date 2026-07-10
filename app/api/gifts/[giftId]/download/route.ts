// Gift-scoped MP3 download — same proxy trick as the song download route
// (Suno CDN is cross-origin, so <a download> needs a same-origin stream with
// a Content-Disposition attachment). Gated on the gift's access code so the
// recipient never needs the songId.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAccessCode } from '@/lib/access-code';
import { openObject } from '@/lib/storage';
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

  // Archived copy first (Suno's CDN expires ~1 week), Suno URL as fallback.
  let stream: ReadableStream;
  let contentLength: string | undefined;
  try {
    if (track.storageKey) {
      const object = await openObject(track.storageKey);
      stream = object.stream;
      contentLength = object.contentLength
        ? String(object.contentLength)
        : undefined;
    } else {
      const upstream = await fetch(track.audioUrl);
      if (!upstream.ok || !upstream.body) throw new Error(`${upstream.status}`);
      stream = upstream.body;
      contentLength = upstream.headers.get('content-length') ?? undefined;
    }
  } catch (err) {
    console.error(`download failed for gift ${giftId}:`, err);
    return NextResponse.json(
      { data: null, error: 'Download unavailable — try again shortly.' },
      { status: 502 }
    );
  }

  const filename = `a-song-for-${song.recipientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.mp3`;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...(contentLength ? { 'Content-Length': contentLength } : {}),
    },
  });
}
