'use client';

// Style step — genre (required) + mood/tempo/voice (optional), between the
// occasion prompts and lyrics. Mood preselects from the occasion's
// defaultMood; everything feeds styleInputs at generation time.

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CreateProgress from '@/components/CreateProgress';
import {
  ChipGroup,
  GENRES,
  MOODS,
  TEMPOS,
  VOICES,
} from '@/components/StyleSelector';
import Button from '@/components/ui/Button';
import Wordmark from '@/components/Wordmark';
import { getOccasion } from '@/lib/occasions';
import { useDraftStore } from '@/lib/store';

const ease = [0.22, 1, 0.36, 1] as const;

export default function StylePage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const occasion = useDraftStore((s) => s.occasion);
  const recipientName = useDraftStore((s) => s.recipientName);
  const relationship = useDraftStore((s) => s.relationship);
  const promptAnswers = useDraftStore((s) => s.promptAnswers);
  const genre = useDraftStore((s) => s.genre);
  const mood = useDraftStore((s) => s.mood);
  const tempo = useDraftStore((s) => s.tempo);
  const voice = useDraftStore((s) => s.voice);
  const update = useDraftStore((s) => s.update);

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  // Preselect the occasion's mood once — the user can change or clear it.
  useEffect(() => {
    if (!hydrated || mood || !occasion) return;
    const defaultMood = getOccasion(occasion)?.defaultMood;
    const match = MOODS.find((m) => m.toLowerCase() === defaultMood);
    if (match) update({ mood: match });
  }, [hydrated, mood, occasion, update]);

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

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Wordmark />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        <CreateProgress current="style" />
        <motion.div {...entrance(0)}>
          <p className="text-sm text-ink/50">
            {recipientName ? `A song for ${recipientName}` : 'Your song'}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            How should it <span className="italic text-accent">sound</span>?
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
              <motion.section {...entrance(0.07)} className="mt-10">
                <ChipGroup
                  label="Pick a genre"
                  options={GENRES}
                  value={genre}
                  onSelect={(g) => update({ genre: g })}
                />
              </motion.section>

              <motion.section {...entrance(0.14)} className="mt-10">
                <ChipGroup
                  label="Mood"
                  hint="We picked one to match the occasion — change it if it doesn't feel right."
                  options={MOODS}
                  value={mood}
                  onSelect={(m) => update({ mood: m })}
                  optional
                />
              </motion.section>

              <motion.section {...entrance(0.21)} className="mt-10">
                <ChipGroup
                  label="Tempo"
                  options={TEMPOS}
                  value={tempo}
                  onSelect={(t) => update({ tempo: t })}
                  optional
                />
              </motion.section>

              <motion.section {...entrance(0.28)} className="mt-10">
                <ChipGroup
                  label="Voice"
                  options={VOICES}
                  value={voice}
                  onSelect={(v) => update({ voice: v })}
                  optional
                />
              </motion.section>

              <motion.div {...entrance(0.35)} className="mt-12 flex justify-end">
                <Button
                  disabled={!genre}
                  onClick={() => router.push('/create/lyrics')}
                  className={!genre ? 'cursor-not-allowed opacity-40' : ''}
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
