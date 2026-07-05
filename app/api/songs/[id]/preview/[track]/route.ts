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

  const upstream = await fetch(target.audioUrl, {
    headers: { Range: `bytes=0-${PREVIEW_BYTES - 1}` },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { data: null, error: 'Preview unavailable — try again shortly.' },
      { status: 502 }
    );
  }

  // Truncate ourselves in case the CDN ignored the Range header (200 vs 206).
  const buffer = await upstream.arrayBuffer();
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
