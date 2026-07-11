'use client';

// Step 5 — song length upsell. Picking 3/4 verses extends lyrics via Claude
// (doesn't count against the revision limit) with a quick review before
// confirm. Confirm triggers Suno generation (pre-payment, decision #9).

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CreateProgress from '@/components/CreateProgress';
import { LyricsView } from '@/components/LyricsCanvas';
import Button from '@/components/ui/Button';
import Wordmark from '@/components/Wordmark';
import { useDraftStore } from '@/lib/store';

const ease = [0.22, 1, 0.36, 1] as const;

const OPTIONS: { verses: 2 | 3 | 4; label: string; price: string; blurb: string }[] = [
  {
    verses: 2,
    label: '2 verses',
    price: 'Included',
    blurb: 'The standard song — two verses, chorus, and bridge.',
  },
  {
    verses: 3,
    label: '3 verses',
    price: '+$9.99 USD',
    blurb: 'An extra verse for one more memory, a longer track.',
  },
  {
    verses: 4,
    label: '4 verses',
    price: '+$12.99 USD',
    blurb: 'Two extra verses — the fullest telling of their story.',
  },
];

export default function LengthPage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const occasion = useDraftStore((s) => s.occasion);
  const recipientName = useDraftStore((s) => s.recipientName);
  const pronunciation = useDraftStore((s) => s.pronunciation);
  const relationship = useDraftStore((s) => s.relationship);
  const promptAnswers = useDraftStore((s) => s.promptAnswers);
  const genre = useDraftStore((s) => s.genre);
  const mood = useDraftStore((s) => s.mood);
  const tempo = useDraftStore((s) => s.tempo);
  const voice = useDraftStore((s) => s.voice);
  const lyrics = useDraftStore((s) => s.lyrics);
  const verseCount = useDraftStore((s) => s.verseCount);
  const update = useDraftStore((s) => s.update);

  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState<'extend' | 'generate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Extended lyrics awaiting review; keyed to the verse count they were
  // written for so changing the selection invalidates them.
  const [extended, setExtended] = useState<{
    lyrics: string;
    forVerses: 3 | 4;
  } | null>(null);

  useEffect(() => setHydrated(true), []);

  const entrance = (delay: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, ease, delay },
  });

  const draftReady = occasion && recipientName && relationship && lyrics;
  const needsExtension =
    verseCount !== 2 && extended?.forVerses !== verseCount;

  const requestBase = {
    occasion,
    genre,
    promptInputs: {
      recipientName,
      pronunciation,
      relationship,
      answers: promptAnswers,
    },
  };

  const extend = async () => {
    if (verseCount === 2) return;
    setError(null);
    setLoading('extend');
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBase,
          currentLyrics: lyrics,
          extendToVerses: verseCount,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Something went wrong.');
      }
      setExtended({ lyrics: json.data.lyrics, forVerses: verseCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(null);
    }
  };

  const generate = async (finalLyrics: string, verses: 2 | 3 | 4) => {
    setError(null);
    setLoading('generate');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occasion,
          promptInputs: requestBase.promptInputs,
          // Empty optionals stay out so the occasion's default mood applies.
          styleInputs: {
            genre,
            ...(mood ? { mood: mood.toLowerCase() } : {}),
            ...(tempo ? { tempo: tempo.toLowerCase() } : {}),
            ...(voice ? { voice: voice.toLowerCase() } : {}),
          },
          lyrics: finalLyrics,
          verseCount: verses,
        }),
      });
      const json = await res.json();
      // 429 with a songId = this visitor already has a generation — resume it.
      if (!json.data?.songId) {
        throw new Error(json.error ?? 'Something went wrong.');
      }
      update({ lyrics: finalLyrics, verseCount: verses, songId: json.data.songId });
      router.push('/create/previews');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(null);
    }
  };

  const confirm = () => {
    if (verseCount === 2) {
      void generate(lyrics, 2);
    } else if (needsExtension) {
      void extend();
    } else {
      void generate(extended!.lyrics, verseCount);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Wordmark />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        <CreateProgress current="length" />
        <motion.div {...entrance(0)}>
          <p className="text-sm text-ink/50">
            {recipientName ? `A song for ${recipientName}` : 'Your song'}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            How <span className="italic text-accent">long</span> should it be?
          </h1>
        </motion.div>

        {hydrated &&
          (!draftReady ? (
            <motion.div {...entrance(0.07)} className="mt-10">
              <p className="text-ink/60">
                Your song isn&rsquo;t ready yet — write the lyrics first.
              </p>
              <Button href="/create/lyrics" className="mt-6">
                Back to lyrics
              </Button>
            </motion.div>
          ) : (
            <>
              <motion.div {...entrance(0.07)} className="mt-10 space-y-4">
                {OPTIONS.map((opt) => {
                  const selected = verseCount === opt.verses;
                  return (
                    <button
                      key={opt.verses}
                      type="button"
                      onClick={() => {
                        update({ verseCount: opt.verses });
                        setError(null);
                      }}
                      aria-pressed={selected}
                      className={`w-full rounded-2xl border p-6 text-left transition-colors duration-200 ${
                        selected
                          ? 'border-accent bg-white'
                          : 'border-ink/10 bg-white/50 hover:border-ink/30'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-serif text-2xl">{opt.label}</span>
                        <span
                          className={`text-sm font-medium ${
                            selected ? 'text-accent' : 'text-ink/50'
                          }`}
                        >
                          {opt.price}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-ink/60">{opt.blurb}</p>
                    </button>
                  );
                })}
              </motion.div>

              {/* Quick review of extended lyrics */}
              {extended && extended.forVerses === verseCount && (
                <motion.section
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease }}
                  className="mt-10"
                >
                  <p className="mb-3 text-sm text-ink/50">
                    Here&rsquo;s your extended song — a quick look before we
                    compose it.
                  </p>
                  <div className="max-h-80 overflow-y-auto rounded-2xl border border-ink/10 bg-white p-6">
                    <LyricsView lyrics={extended.lyrics} />
                  </div>
                </motion.section>
              )}

              {error && (
                <p className="mt-4 text-sm text-accent" role="alert">
                  {error}
                </p>
              )}

              <motion.div
                {...entrance(0.14)}
                className="mt-12 flex items-center justify-end gap-4"
              >
                {verseCount !== 2 && (
                  <Button
                    variant="ghost"
                    disabled={loading !== null}
                    onClick={() => {
                      update({ verseCount: 2 });
                      void generate(lyrics, 2);
                    }}
                  >
                    Skip
                  </Button>
                )}
                <Button
                  disabled={loading !== null}
                  onClick={confirm}
                  className={loading ? 'cursor-not-allowed opacity-40' : ''}
                >
                  {loading === 'extend'
                    ? 'Extending your song...'
                    : loading === 'generate'
                      ? 'Starting your song...'
                      : needsExtension
                        ? 'Extend my song'
                        : 'Create my song'}
                </Button>
              </motion.div>
            </>
          ))}
      </main>
    </div>
  );
}
