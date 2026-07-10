// Full-MP3 download proxy for paid, unlocked tracks. The Suno CDN is
// cross-origin, so an <a download> on the raw audioUrl can't force a save —
// this route streams the file with a Content-Disposition attachment instead.
// Locked tracks 404 (decision #9 — full audio never leaves for them).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { openObject } from '@/lib/storage';
import type { Track } from '@/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; track: string }> }
) {
  const { id, track } = await params;
  const index = Number(track);

  const song = await prisma.song.findUnique({ where: { id } });
  const tracks = (song?.tracks ?? []) as unknown as Track[];
  const target = Number.isInteger(index) ? tracks[index] : undefined;

  const isPaid = song?.status === 'paid' || song?.status === 'done';
  if (!song || !target || !isPaid || !target.unlocked) {
    return NextResponse.json(
      { data: null, error: 'Download not found.' },
      { status: 404 }
    );
  }

  // Archived copy first (Suno's CDN expires ~1 week), Suno URL as fallback.
  let stream: ReadableStream;
  let contentLength: string | undefined;
  try {
    if (target.storageKey) {
      const object = await openObject(target.storageKey);
      stream = object.stream;
      contentLength = object.contentLength
        ? String(object.contentLength)
        : undefined;
    } else {
      const upstream = await fetch(target.audioUrl);
      if (!upstream.ok || !upstream.body) throw new Error(`${upstream.status}`);
      stream = upstream.body;
      contentLength = upstream.headers.get('content-length') ?? undefined;
    }
  } catch (err) {
    console.error(`download failed for song ${id} track ${index}:`, err);
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
