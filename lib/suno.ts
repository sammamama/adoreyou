// Suno API wrapper + style prompt builder.
// Targets the sunoapi.org-compatible REST shape (POST /api/v1/generate,
// GET /api/v1/generate/record-info?taskId=). SUNO_API_BASE_URL makes the
// host swappable; keep all Suno HTTP calls in this file so a future
// Udio backend only replaces this module (decision #3).

import type { StyleInputs, Track } from '@/types';

const MODEL = 'V4_5';

function baseUrl(): string {
  const url = process.env.SUNO_API_BASE_URL;
  if (!url) throw new Error('SUNO_API_BASE_URL is not set.');
  return url.replace(/\/$/, '');
}

function headers(): HeadersInit {
  const key = process.env.SUNO_API_KEY;
  if (!key) throw new Error('SUNO_API_KEY is not set.');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

// Suno style field is a comma-separated descriptor string, not lyrics.
export function buildStylePrompt(style: StyleInputs): string {
  const parts = [style.genre];
  if (style.mood) parts.push(style.mood);
  if (style.tempo) parts.push(`${style.tempo} tempo`);
  parts.push('heartfelt vocals', 'polished production');
  return parts.join(', ');
}

export interface StartGenerationInput {
  lyrics: string;
  style: StyleInputs;
  title: string;
}

// Kicks off a render. Suno generates 2 tracks per task; returns the task id
// to poll with getGenerationStatus.
export async function startGeneration({
  lyrics,
  style,
  title,
}: StartGenerationInput): Promise<string> {
  const res = await fetch(`${baseUrl()}/api/v1/generate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      customMode: true,
      instrumental: false,
      model: MODEL,
      prompt: lyrics,
      style: buildStylePrompt(style),
      title: title.slice(0, 80),
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.code !== 200 || !json?.data?.taskId) {
    throw new Error(
      `Suno generate failed (${res.status}): ${json?.msg ?? 'unknown error'}`
    );
  }
  return json.data.taskId as string;
}

export type GenerationStatus =
  | { state: 'pending' }
  | { state: 'failed'; reason: string }
  | { state: 'complete'; tracks: Omit<Track, 'kind' | 'unlocked'>[] };

interface SunoTrackData {
  id: string;
  audioUrl?: string;
  sourceAudioUrl?: string;
  duration?: number;
}

export async function getGenerationStatus(
  taskId: string,
  genre: string
): Promise<GenerationStatus> {
  const res = await fetch(
    `${baseUrl()}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
    { headers: headers(), cache: 'no-store' }
  );

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.code !== 200) {
    throw new Error(
      `Suno status failed (${res.status}): ${json?.msg ?? 'unknown error'}`
    );
  }

  const status: string = json.data?.status ?? 'PENDING';
  if (
    status.includes('FAILED') ||
    status === 'SENSITIVE_WORD_ERROR' ||
    status === 'CREATE_TASK_FAILED'
  ) {
    return { state: 'failed', reason: json.data?.errorMessage ?? status };
  }
  if (status !== 'SUCCESS') return { state: 'pending' };

  const sunoData: SunoTrackData[] = json.data?.response?.sunoData ?? [];
  const tracks = sunoData
    .filter((t) => t.audioUrl || t.sourceAudioUrl)
    .map((t) => ({
      sunoTrackId: t.id,
      audioUrl: (t.audioUrl ?? t.sourceAudioUrl) as string,
      genre,
    }));

  if (tracks.length === 0) {
    return { state: 'failed', reason: 'Suno returned no audio tracks.' };
  }
  return { state: 'complete', tracks };
}
