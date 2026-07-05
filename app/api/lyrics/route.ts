// Claude lyrics generation/revision — free, rate-limited by IP (~10/hr).
// Lyrics are NOT persisted here; they live in client draft state until
// /api/generate creates the song row.

import { NextRequest, NextResponse } from 'next/server';
import {
  extendLyrics,
  generateLyrics,
  reviseLyrics,
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
      const used = body.revisionsUsed ?? 0;
      if (used >= MAX_REVISIONS) {
        return NextResponse.json(
          { data: null, error: `Revision limit reached (${MAX_REVISIONS}).` },
          { status: 400 }
        );
      }
      const lyrics = await reviseLyrics(
        input,
        body.currentLyrics!,
        body.revisionRequest!
      );
      return NextResponse.json({ data: { lyrics }, error: null });
    }

    const lyrics = await generateLyrics(input);
    return NextResponse.json({ data: { lyrics }, error: null });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Lyrics generation failed.';
    console.error('lyrics route error:', err);
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
