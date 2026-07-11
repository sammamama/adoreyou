// Claude lyrics generation/revision — free, rate-limited by IP (~10/hr).
// Lyrics are NOT persisted here; they live in client draft state until
// /api/generate creates the song row.

import { NextRequest, NextResponse } from 'next/server';
import {
  extendLyrics,
  generateLyrics,
  generateLyricsStream,
  reviseLyrics,
  reviseLyricsStream,
  type LyricsInput,
} from '@/lib/claude';
import { getOccasion } from '@/lib/occasions';

const MAX_REVISIONS = 5;
const RATE_LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// In-memory sliding window. On Vercel this is per-instance (instances are
// stateless and recycled), so the cap is approximate — acceptable since it
// only exists to cap Claude spend. Swap for a DB/KV counter if abuse shows up.
const hits = new Map<string, number[]>();

// Server-side revision counter (same per-instance caveat) — the client sends
// revisionsUsed for its own UI, but the enforced count lives here.
const revisions = new Map<string, number[]>();

function recentRevisions(ip: string): number[] {
  const now = Date.now();
  const recent = (revisions.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  revisions.set(ip, recent);
  return recent;
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

interface LyricsRequestBody {
  occasion?: string;
  promptInputs?: {
    recipientName?: string;
    pronunciation?: string;
    relationship?: string;
    answers?: { prompt: string; answer: string }[];
  };
  genre?: string;
  // Revision fields
  currentLyrics?: string;
  revisionRequest?: string;
  revisionsUsed?: number;
  // Length extension (Step 5) — doesn't count against the revision limit
  extendToVerses?: 3 | 4;
  // Stream raw text chunks instead of a JSON payload (lyrics page)
  stream?: boolean;
}

// Raw text chunks; errors before the first byte still surface as JSON — the
// client branches on Content-Type.
function streamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json(
      { data: null, error: 'Too many requests — try again in an hour.' },
      { status: 429 }
    );
  }

  let body: LyricsRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const { occasion, promptInputs, genre } = body;
  if (
    !occasion ||
    !getOccasion(occasion) ||
    !genre ||
    !promptInputs?.recipientName ||
    !promptInputs.relationship ||
    !promptInputs.answers ||
    promptInputs.answers.length < 4
  ) {
    return NextResponse.json(
      {
        data: null,
        error:
          'Missing inputs — occasion, genre, recipient name, relationship, and at least 4 answered prompts are required.',
      },
      { status: 400 }
    );
  }

  const input: LyricsInput = {
    occasion,
    genre,
    promptInputs: {
      recipientName: promptInputs.recipientName,
      pronunciation: promptInputs.pronunciation,
      relationship: promptInputs.relationship,
      answers: promptInputs.answers,
    },
  };

  const isExtension =
    Boolean(body.currentLyrics) &&
    (body.extendToVerses === 3 || body.extendToVerses === 4);
  const isRevision =
    !isExtension && Boolean(body.currentLyrics && body.revisionRequest);

  try {
    if (isExtension) {
      const lyrics = await extendLyrics(
        input,
        body.currentLyrics!,
        body.extendToVerses!
      );
      return NextResponse.json({ data: { lyrics }, error: null });
    }

    if (isRevision) {
      // Enforced server-side per IP — the client's revisionsUsed counter is
      // display-only and can't be reset to dodge the limit.
      const used = Math.max(body.revisionsUsed ?? 0, recentRevisions(ip).length);
      if (used >= MAX_REVISIONS) {
        return NextResponse.json(
          { data: null, error: `Revision limit reached (${MAX_REVISIONS}).` },
          { status: 400 }
        );
      }
      revisions.set(ip, [...recentRevisions(ip), Date.now()]);
      if (body.stream) {
        return streamResponse(
          reviseLyricsStream(input, body.currentLyrics!, body.revisionRequest!)
        );
      }
      const lyrics = await reviseLyrics(
        input,
        body.currentLyrics!,
        body.revisionRequest!
      );
      return NextResponse.json({ data: { lyrics }, error: null });
    }

    if (body.stream) {
      return streamResponse(generateLyricsStream(input));
    }
    const lyrics = await generateLyrics(input);
    return NextResponse.json({ data: { lyrics }, error: null });
  } catch (err) {
    console.error('lyrics route error:', err);
    return NextResponse.json(
      { data: null, error: 'Lyrics generation failed — try again.' },
      { status: 500 }
    );
  }
}
