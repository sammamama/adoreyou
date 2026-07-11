'use client';

// Step 6 — previews + preview upsells. Polls GET /api/songs/[id] while Suno
// renders (decision #4), then shows both 15s previews with the pick +
// Keep Every Version / Regenerate in New Genre upsells.

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CreateProgress from '@/components/CreateProgress';
import PreviewPicker, { type PreviewTrack } from '@/components/PreviewPicker';
import ProcessingView from '@/components/ProcessingView';
import Button from '@/components/ui/Button';
import Wordmark from '@/components/Wordmark';
import { useDraftStore } from '@/lib/store';

const ease = [0.22, 1, 0.36, 1] as const;
const POLL_INTERVAL = 5_000;

type SongData = {
  id: string;
  status: 'generating' | 'preview' | 'paid' | 'done' | 'failed';
  recipientName: string;
  occasion: string;
  tracks: PreviewTrack[];
};

export default function PreviewsPage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const songId = useDraftStore((s) => s.songId);
  const recipientName = useDraftStore((s) => s.recipientName);

  const [hydrated, setHydrated] = useState(false);
  const [song, setSong] = useState<SongData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  // Poll until the song leaves `generating`.
  useEffect(() => {
    if (!hydrated || !songId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch(`/api/songs/${songId}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json.error) {
          setError(json.error ?? 'Something went wrong.');
          return;
        }
        const data = json.data as SongData;
        setSong(data);
        if (data.status === 'generating') {
          timer = setTimeout(poll, POLL_INTERVAL);
        }
      } catch {
        // Network hiccup — keep polling.
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, songId]);

  const entrance = {
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, ease },
  };

  const ready =
    song &&
    (song.status === 'preview' ||
      song.status === 'paid' ||
      song.status === 'done');

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Wordmark />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        <CreateProgress current="preview" />
        <motion.div {...entrance}>
          <p className="text-sm text-ink/50">
            {recipientName ? `A song for ${recipientName}` : 'Your song'}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            {ready ? (
              <>
                Your song is <span className="italic text-accent">ready</span>
              </>
            ) : (
              <>
                Composing your{' '}
                <span className="italic text-accent">song</span>
              </>
            )}
          </h1>
        </motion.div>

        {hydrated && !songId && (
          <motion.div {...entrance} className="mt-10">
            <p className="text-ink/60">
              No song in progress — start by writing the lyrics.
            </p>
            <Button href="/create/lyrics" className="mt-6">
              Back to lyrics
            </Button>
          </motion.div>
        )}

        {hydrated && songId && (
          <div className="mt-10">
            {error ? (
              <div role="alert">
                <p className="text-ink/60">{error}</p>
                <Button href="/create/length" className="mt-6">
                  Try again
                </Button>
              </div>
            ) : song?.status === 'failed' ? (
              <div role="alert">
                <p className="text-ink/60">
                  Something went wrong while composing your song. Nothing was
                  charged — you can try again.
                </p>
                <Button href="/create/length" className="mt-6">
                  Try again
                </Button>
              </div>
            ) : ready ? (
              <PreviewPicker
                tracks={song.tracks}
                onContinue={() => router.push('/create/checkout')}
              />
            ) : (
              <ProcessingView
                recipientName={recipientName || undefined}
                discover
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
