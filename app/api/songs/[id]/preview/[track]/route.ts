// 30-second preview proxy for pre-payment listening.
//
// APPROACH (documented per decision #9): byte-range proxy clipping. We fetch
// the first ~480KB of the Suno MP3 (≈30s at Suno's ~128kbps CBR) via a Range
// request and stream that to the client as audio/mpeg. Browsers decode
// truncated MP3s cleanly — playback simply stops at the cut.
//
// Why this over real clipping: server-side transcode (ffmpeg) for exact 30s
// cuts, bitrate reduction, and audio watermarking doesn't fit Vercel's
// serverless runtime without a native binary layer. Byte-range clipping is
// zero-dependency, streams within function limits, and — the actual security
// property — the client never sees the Suno URL. The AGENTS.md "low-bitrate,
// watermarked" refinement needs a transcode step (future: background job or
// edge-compatible encoder).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { openObject } from '@/lib/storage';
import type { Track } from '@/types';

// ~30s of 128kbps MP3 (16KB/s * 30).
const PREVIEW_BYTES = 480_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; track: string }> }
) {
  const { id, track } = await params;
  const index = Number(track);

  const song = await prisma.song.findUnique({ where: { id } });
  const tracks = (song?.tracks ?? []) as unknown as Track[];
  const target = Number.isInteger(index) ? tracks[index] : undefined;

  if (!song || !target) {
    return NextResponse.json(
      { data: null, error: 'Preview not found.' },
      { status: 404 }
    );
  }

  const range = `bytes=0-${PREVIEW_BYTES - 1}`;

  // Archived copy first (paid songs outlive Suno's CDN), Suno URL otherwise
  // — pre-payment tracks are never archived, so previews hit Suno directly.
  let buffer: ArrayBuffer;
  try {
    if (target.storageKey) {
      const object = await openObject(target.storageKey, range);
      buffer = await new Response(object.stream).arrayBuffer();
    } else {
      const upstream = await fetch(target.audioUrl, {
        headers: { Range: range },
      });
      if (!upstream.ok || !upstream.body) throw new Error(`${upstream.status}`);
      buffer = await upstream.arrayBuffer();
    }
  } catch (err) {
    console.error(`preview failed for song ${id} track ${index}:`, err);
    return NextResponse.json(
      { data: null, error: 'Preview unavailable — try again shortly.' },
      { status: 502 }
    );
  }

  // Truncate ourselves in case the CDN ignored the Range header (200 vs 206).
  const clipped = buffer.slice(0, PREVIEW_BYTES);

  return new NextResponse(clipped, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(clipped.byteLength),
      'Cache-Control': 'private, max-age=300',
    },
  });
}
