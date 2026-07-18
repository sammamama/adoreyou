'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CreateProgress from '@/components/CreateProgress';
import LyricsCanvas from '@/components/LyricsCanvas';
import Button from '@/components/ui/Button';
import Wordmark from '@/components/Wordmark';
import { normalizeSectionLabels } from '@/lib/lyrics';
import { useDraftStore } from '@/lib/store';

const ease = [0.22, 1, 0.36, 1] as const;

// Mirrors the server's per-IP fresh-generation cap in /api/lyrics.
const MAX_GENERATIONS = 3;

export default function LyricsPage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const occasion = useDraftStore((s) => s.occasion);
  const recipientName = useDraftStore((s) => s.recipientName);
  const pronunciation = useDraftStore((s) => s.pronunciation);
  const relationship = useDraftStore((s) => s.relationship);
  const promptAnswers = useDraftStore((s) => s.promptAnswers);
  const genre = useDraftStore((s) => s.genre);
  const language = useDraftStore((s) => s.language);
  const lyrics = useDraftStore((s) => s.lyrics);
  const generationsUsed = useDraftStore((s) => s.generationsUsed);
  const generatedLyrics = useDraftStore((s) => s.generatedLyrics);
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
    occasion &&
    recipientName &&
    relationship &&
    promptAnswers.length >= 4 &&
    genre;

  const callLyricsApi = async (revisionRequest?: string) => {
    setError(null);
    setLoading(revisionRequest ? 'revise' : 'generate');
    const before = lyrics; // restored if a revision stream fails midway
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occasion,
          genre,
          language,
          stream: true,
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

      // Pre-stream failures (rate limit, validation) still arrive as JSON.
      const contentType = res.headers.get('content-type') ?? '';
      if (!res.ok || contentType.includes('application/json')) {
        const json = await res.json();
        throw new Error(json.error ?? 'Something went wrong.');
      }

      // Render the song as it's written.
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        update({ lyrics: text });
      }
      text = text.trim();
      if (!text) throw new Error('Something went wrong — try again.');
      const normalized = normalizeSectionLabels(text);
      update({
        lyrics: normalized,
        generatedLyrics: normalized,
        ...(revisionRequest
          ? { revisionsUsed: revisionsUsed + 1 }
          : { generationsUsed: generationsUsed + 1 }),
      });
    } catch (err) {
      if (revisionRequest) update({ lyrics: before });
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Wordmark />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        <CreateProgress current="lyrics" />
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
                {genre
                  ? 'We need their story first — start by picking an occasion and answering a few prompts.'
                  : 'Pick how the song should sound first — genre, mood, tempo.'}
              </p>
              <Button
                href={genre ? '/#occasions' : '/create/style'}
                className="mt-6"
              >
                {genre ? 'Start your song' : 'Choose the style'}
              </Button>
            </motion.div>
          ) : (
            <>
              {/* Lyrics */}
              <motion.section {...entrance(0.07)} className="mt-10">
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
                ) : generationsUsed >= MAX_GENERATIONS ? (
                  /* All attempts spent — offer the last version back so an
                     erased canvas isn't a dead end. */
                  <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-8 text-center">
                    <p className="text-ink/60">
                      You&rsquo;ve used all {MAX_GENERATIONS} lyric
                      generations for this song.
                    </p>
                    {generatedLyrics && (
                      <Button
                        onClick={() => update({ lyrics: generatedLyrics })}
                        className="mt-5"
                      >
                        Restore my lyrics
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-8 text-center">
                    <p className="text-ink/60">
                      Ready to write a {genre.toLowerCase()} song from your
                      memories.
                    </p>
                    <Button
                      disabled={loading === 'generate'}
                      onClick={() => callLyricsApi()}
                      className={`mt-5 ${
                        loading !== 'generate'
                          ? ''
                          : 'cursor-not-allowed opacity-40'
                      }`}
                    >
                      {loading === 'generate'
                        ? 'Writing your song...'
                        : 'Generate lyrics'}
                    </Button>
                    {generationsUsed > 0 && (
                      <p className="mt-3 text-xs text-ink/40">
                        {MAX_GENERATIONS - generationsUsed} of{' '}
                        {MAX_GENERATIONS} generations left
                      </p>
                    )}
                  </div>
                )}
                {error && (
                  <p className="mt-3 text-sm text-accent" role="alert">
                    {error}
                  </p>
                )}
              </motion.section>

              {/* Navigation */}
              <motion.div
                {...entrance(0.21)}
                className="mt-12 flex items-center justify-between gap-4"
              >
                <button
                  type="button"
                  onClick={() => router.push('/create/language')}
                  className="rounded-full px-4 py-2 text-sm text-ink/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Back
                </button>
                {lyrics && (
                  <Button onClick={() => router.push('/create/length')}>
                    Create My Song
                  </Button>
                )}
              </motion.div>
            </>
          ))}
      </main>
    </div>
  );
}
