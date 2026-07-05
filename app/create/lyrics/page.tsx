'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LyricsCanvas from '@/components/LyricsCanvas';
import StyleSelector from '@/components/StyleSelector';
import Button from '@/components/ui/Button';
import { useDraftStore } from '@/lib/store';

const ease = [0.22, 1, 0.36, 1] as const;

export default function LyricsPage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const occasion = useDraftStore((s) => s.occasion);
  const recipientName = useDraftStore((s) => s.recipientName);
  const pronunciation = useDraftStore((s) => s.pronunciation);
  const relationship = useDraftStore((s) => s.relationship);
  const promptAnswers = useDraftStore((s) => s.promptAnswers);
  const genre = useDraftStore((s) => s.genre);
  const lyrics = useDraftStore((s) => s.lyrics);
  const revisionsUsed = useDraftStore((s) => s.revisionsUsed);
  const update = useDraftStore((s) => s.update);

  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState<'generate' | 'revise' | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const draftReady =
    occasion && recipientName && relationship && promptAnswers.length >= 4;

  const callLyricsApi = async (revisionRequest?: string) => {
    setError(null);
    setLoading(revisionRequest ? 'revise' : 'generate');
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occasion,
          genre,
          promptInputs: {
            recipientName,
            pronunciation,
            relationship,
            answers: promptAnswers,
          },
          ...(revisionRequest
            ? { currentLyrics: lyrics, revisionRequest, revisionsUsed }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Something went wrong.');
      }
      update({
        lyrics: json.data.lyrics,
        ...(revisionRequest ? { revisionsUsed: revisionsUsed + 1 } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link href="/" className="font-serif text-2xl">
          Adore<span className="italic text-accent">You</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        <motion.div {...entrance(0)}>
          <p className="text-sm text-ink/50">
            {recipientName ? `A song for ${recipientName}` : 'Your song'}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            Shape their <span className="italic text-accent">song</span>
          </h1>
        </motion.div>

        {hydrated &&
          (!draftReady ? (
            <motion.div {...entrance(0.07)} className="mt-10">
              <p className="text-ink/60">
                We need their story first — start by picking an occasion and
                answering a few prompts.
              </p>
              <Button href="/#occasions" className="mt-6">
                Start your song
              </Button>
            </motion.div>
          ) : (
            <>
              {/* Genre */}
              <motion.section {...entrance(0.07)} className="mt-10">
                <StyleSelector
                  genre={genre}
                  onSelect={(g) => update({ genre: g })}
                />
              </motion.section>

              {/* Lyrics */}
              <motion.section {...entrance(0.14)} className="mt-10">
                {lyrics ? (
                  <>
                    <p className="mb-3 text-sm text-ink/50">
                      Edit anything directly — it&rsquo;s your song. Or ask for
                      changes below.
                    </p>
                    <LyricsCanvas
                      lyrics={lyrics}
                      onEdit={(l) => update({ lyrics: l })}
                      onRevise={(request) => callLyricsApi(request)}
                      revisionsUsed={revisionsUsed}
                      revising={loading === 'revise'}
                    />
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-8 text-center">
                    <p className="text-ink/60">
                      {genre
                        ? `Ready to write a ${genre.toLowerCase()} song from your memories.`
                        : 'Pick a genre, then we’ll write the first draft.'}
                    </p>
                    <Button
                      disabled={!genre || loading === 'generate'}
                      onClick={() => callLyricsApi()}
                      className={`mt-5 ${
                        genre && loading !== 'generate'
                          ? ''
                          : 'cursor-not-allowed opacity-40'
                      }`}
                    >
                      {loading === 'generate'
                        ? 'Writing your song...'
                        : 'Generate lyrics'}
                    </Button>
                  </div>
                )}
                {error && (
                  <p className="mt-3 text-sm text-accent" role="alert">
                    {error}
                  </p>
                )}
              </motion.section>

              {/* Continue */}
              {lyrics && (
                <motion.div
                  {...entrance(0.21)}
                  className="mt-12 flex justify-end"
                >
                  <Button onClick={() => router.push('/create/length')}>
                    Create My Song
                  </Button>
                </motion.div>
              )}
            </>
          ))}
      </main>
    </div>
  );
}
