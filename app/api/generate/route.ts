// Phase 2 — render previews (pre-payment). Creates the song row
// (email: null, status: generating), kicks off Suno, returns songId for
// polling via GET /api/songs/[id]. Full audio URLs never leave the server.
// Rate limit: 1 free generation per IP/session (decision #9).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOccasion } from '@/lib/occasions';
import { startGeneration } from '@/lib/suno';
import type { PromptInputs, StyleInputs } from '@/types';

// In-memory, per-instance (same tradeoff as /api/lyrics): approximate on
// Vercel, exists to stop casual double-spends of a ~$0.10 render. Maps
// ip → songId so a repeat caller gets their existing song back instead of
// a dead end.
const generated = new Map<string, string>();

interface GenerateRequestBody {
  occasion?: string;
  promptInputs?: PromptInputs;
  styleInputs?: StyleInputs;
  lyrics?: string;
  verseCount?: 2 | 3 | 4;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const existing = generated.get(ip);
  if (existing) {
    return NextResponse.json(
      {
        data: { songId: existing },
        error: 'You already have a song generating — regenerations are paid.',
      },
      { status: 429 }
    );
  }

  let body: GenerateRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const { occasion, promptInputs, styleInputs, lyrics, verseCount } = body;
  if (
    !occasion ||
    !getOccasion(occasion) ||
    !lyrics?.trim() ||
    !styleInputs?.genre ||
    !promptInputs?.recipientName ||
    !promptInputs.relationship
  ) {
    return NextResponse.json(
      {
        data: null,
        error:
          'Missing inputs — occasion, lyrics, genre, recipient name, and relationship are required.',
      },
      { status: 400 }
    );
  }

  const occ = getOccasion(occasion)!;

  try {
    const song = await prisma.song.create({
      data: {
        email: null,
        recipientName: promptInputs.recipientName,
        occasion,
        promptInputs: JSON.parse(JSON.stringify(promptInputs)),
        styleInputs: JSON.parse(JSON.stringify(styleInputs)),
        lyrics,
        status: 'generating',
        upsells: { songLength: verseCount ?? 2, keepEveryVersion: false },
      },
    });

    let taskId: string;
    try {
      taskId = await startGeneration({
        lyrics,
        style: { mood: occ.defaultMood, ...styleInputs },
        title: `A song for ${promptInputs.recipientName}`,
      });
    } catch (err) {
      // Nothing was charged (decision #6) — mark failed so polling doesn't hang.
      await prisma.song.update({
        where: { id: song.id },
        data: { status: 'failed' },
      });
      throw err;
    }

    await prisma.song.update({
      where: { id: song.id },
      data: { sunoTaskId: taskId },
    });

    generated.set(ip, song.id);
    return NextResponse.json({ data: { songId: song.id }, error: null });
  } catch (err) {
    console.error('generate route error:', err);
    return NextResponse.json(
      { data: null, error: 'Song generation failed to start — try again.' },
      { status: 500 }
    );
  }
}
