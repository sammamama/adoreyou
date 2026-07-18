'use client';

// Language step — between style and lyrics. English is the default; Hindi
// produces Hinglish (romanized Hindi) lyrics, Dutch produces Dutch lyrics.

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CreateProgress from '@/components/CreateProgress';
import { ChipGroup, LANGUAGES } from '@/components/StyleSelector';
import Button from '@/components/ui/Button';
import Wordmark from '@/components/Wordmark';
import { useDraftStore } from '@/lib/store';

const ease = [0.22, 1, 0.36, 1] as const;

const LANGUAGE_HINTS: Record<string, string> = {
  English: 'The classic — every word lands for everyone.',
  Hindi:
    'Written in Hinglish — Hindi the way you text it, so you can read every line before it’s sung.',
  Dutch: 'Volledig in het Nederlands geschreven en gezongen.',
};

export default function LanguagePage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const occasion = useDraftStore((s) => s.occasion);
  const recipientName = useDraftStore((s) => s.recipientName);
  const relationship = useDraftStore((s) => s.relationship);
  const promptAnswers = useDraftStore((s) => s.promptAnswers);
  const genre = useDraftStore((s) => s.genre);
  const language = useDraftStore((s) => s.language);
  const update = useDraftStore((s) => s.update);

  const [hydrated, setHydrated] = useState(false);

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

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Wordmark />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        <CreateProgress current="language" />
        <motion.div {...entrance(0)}>
          <p className="text-sm text-ink/50">
            {recipientName ? `A song for ${recipientName}` : 'Your song'}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            Which <span className="italic text-accent">language</span> should it
            sing in?
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
              <motion.section {...entrance(0.07)} className="mt-10">
                <ChipGroup
                  label="Pick a language"
                  options={LANGUAGES}
                  value={language}
                  onSelect={(l) => update({ language: l })}
                />
                {LANGUAGE_HINTS[language] && (
                  <p className="mt-3 text-sm text-ink/50">
                    {LANGUAGE_HINTS[language]}
                  </p>
                )}
              </motion.section>

              <motion.div
                {...entrance(0.14)}
                className="mt-12 flex items-center justify-between gap-4"
              >
                <button
                  type="button"
                  onClick={() => router.push('/create/style')}
                  className="rounded-full px-4 py-2 text-sm text-ink/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Back
                </button>
                <Button
                  disabled={!language}
                  onClick={() => router.push('/create/lyrics')}
                  className={!language ? 'cursor-not-allowed opacity-40' : ''}
                >
                  Write the lyrics
                </Button>
              </motion.div>
            </>
          ))}
      </main>
    </div>
  );
}
