'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { useDraftStore } from '@/lib/store';
import type { Occasion } from '@/types';

const ease = [0.22, 1, 0.36, 1] as const;

const RELATIONSHIPS = [
  'Partner',
  'Parent',
  'Best Friend',
  'Sibling',
  'Child',
  'Grandparent',
  'Colleague',
  'Mentor',
  'Friend',
];

const MIN_ANSWERS = 4;

// Progress units: name+pronunciation (1) + relationship (1) + each required answer
const TOTAL_UNITS = 2 + MIN_ANSWERS;

const STEPS = ['name', 'relationship', 'memories'] as const;
type Step = (typeof STEPS)[number];

const inputClasses =
  'w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base placeholder:text-ink/30 focus:outline-2 focus:outline-offset-0 focus:outline-accent';

export default function PromptForm({ occasion }: { occasion: Occasion }) {
  const router = useRouter();
  const reduced = useReducedMotion();

  const recipientName = useDraftStore((s) => s.recipientName);
  const pronunciation = useDraftStore((s) => s.pronunciation);
  const relationship = useDraftStore((s) => s.relationship);
  const promptAnswers = useDraftStore((s) => s.promptAnswers);
  const update = useDraftStore((s) => s.update);
  const setPromptAnswer = useDraftStore((s) => s.setPromptAnswer);

  // Persisted draft lives in localStorage — render form only after hydration
  // to avoid SSR mismatch.
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>('name');
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState('');

  useEffect(() => {
    setHydrated(true);
    update({ occasion: occasion.slug });
  }, [occasion.slug, update]);

  const entrance = (delay: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, ease, delay },
  });

  const stepMotion = {
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: reduced ? { opacity: 0 } : { opacity: 0, y: -12 },
    transition: { duration: 0.4, ease },
  };

  const answerFor = (prompt: string) =>
    promptAnswers.find((a) => a.prompt === prompt)?.answer ?? '';

  // Count only answers to this occasion's prompts (occasion may have changed)
  const answeredCount = occasion.prompts.filter(
    (p) => answerFor(p) !== ''
  ).length;

  const nameDone = recipientName.trim() !== '' && pronunciation.trim() !== '';
  const relationshipDone = relationship !== '';
  const memoriesDone = answeredCount >= MIN_ANSWERS;

  const unitsDone =
    (nameDone ? 1 : 0) +
    (relationshipDone ? 1 : 0) +
    Math.min(answeredCount, MIN_ANSWERS);
  const progress = unitsDone / TOTAL_UNITS;

  const stepIndex = STEPS.indexOf(step);
  const canContinue =
    step === 'name' ? nameDone : step === 'relationship' ? relationshipDone : memoriesDone;

  const goNext = () => {
    if (step === 'name') setStep('relationship');
    else if (step === 'relationship') setStep('memories');
    else router.push('/create/lyrics');
  };

  const goBack = () => {
    if (step === 'relationship') setStep('name');
    else if (step === 'memories') setStep('relationship');
  };

  const openAnswerBox = (prompt: string) => {
    setOpenPrompt(prompt);
    setDraftAnswer(answerFor(prompt));
  };

  const saveAnswer = (prompt: string) => {
    setPromptAnswer(prompt, draftAnswer);
    setOpenPrompt(null);
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
            {occasion.name} song{' '}
            <Link href="/#occasions" className="underline hover:text-ink">
              (change occasion)
            </Link>
          </p>

          {/* Progress */}
          <div className="mt-4 flex items-center gap-3">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={TOTAL_UNITS}
              aria-valuenow={unitsDone}
              aria-label="Song creation progress"
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"
            >
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={false}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.5, ease }}
              />
            </div>
            <p className="shrink-0 text-xs text-ink/50">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
          </div>
        </motion.div>

        {hydrated && (
          <AnimatePresence mode="wait">
            {step === 'name' && (
              <motion.section key="name" {...stepMotion} className="mt-10">
                <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                  Who is this song{' '}
                  <span className="italic text-accent">for</span>?
                </h1>
                <label htmlFor="name" className="mt-8 block font-medium">
                  Their name
                </label>
                <input
                  id="name"
                  type="text"
                  value={recipientName}
                  onChange={(e) => update({ recipientName: e.target.value })}
                  placeholder="Alicia"
                  className={`mt-2 ${inputClasses}`}
                />
                <label
                  htmlFor="pronunciation"
                  className="mt-5 block font-medium"
                >
                  How is it pronounced?
                </label>
                <p className="mt-1 text-sm text-ink/50">
                  So the singer gets it right — e.g. &ldquo;a-lee-sha&rdquo;
                </p>
                <input
                  id="pronunciation"
                  type="text"
                  value={pronunciation}
                  onChange={(e) => update({ pronunciation: e.target.value })}
                  placeholder="a-lee-sha"
                  className={`mt-2 ${inputClasses}`}
                />
              </motion.section>
            )}

            {step === 'relationship' && (
              <motion.section
                key="relationship"
                {...stepMotion}
                className="mt-10"
              >
                <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                  {recipientName.trim()
                    ? `${recipientName.trim()} is your...`
                    : 'They are your...'}
                </h1>
                <div className="mt-8 flex flex-wrap gap-2">
                  {RELATIONSHIPS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => update({ relationship: r })}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        relationship === r
                          ? 'border-accent bg-accent text-white'
                          : 'border-ink/15 bg-white hover:border-ink/40'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </motion.section>
            )}

            {step === 'memories' && (
              <motion.section key="memories" {...stepMotion} className="mt-10">
                <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                  Share your <span className="italic text-accent">memories</span>
                </h1>
                <p className="mt-3 text-sm text-ink/50">
                  Tap a prompt and tell the story. Answer at least {MIN_ANSWERS}{' '}
                  — the more you share, the more personal the song.
                </p>
                <ul className="mt-6 space-y-3">
                  {occasion.prompts.map((prompt) => {
                    const answer = answerFor(prompt);
                    const isOpen = openPrompt === prompt;
                    return (
                      <li key={prompt}>
                        <div
                          className={`rounded-2xl border bg-white transition-colors duration-200 ${
                            answer || isOpen
                              ? 'border-accent/40'
                              : 'border-ink/10'
                          }`}
                        >
                          {isOpen ? (
                            <div className="p-4">
                              <p className="font-medium">{prompt}</p>
                              <textarea
                                autoFocus
                                value={draftAnswer}
                                onChange={(e) => setDraftAnswer(e.target.value)}
                                rows={4}
                                placeholder="Tell the story..."
                                className={`mt-3 resize-none ${inputClasses}`}
                              />
                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setOpenPrompt(null)}
                                  className="rounded-full px-4 py-2 text-sm text-ink/60 hover:text-ink"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveAnswer(prompt)}
                                  className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-rose-700"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAnswerBox(prompt)}
                              className="flex w-full items-start justify-between gap-4 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                              <span>
                                <span className="block font-medium">
                                  {prompt}
                                </span>
                                {answer && (
                                  <span className="mt-1 line-clamp-2 block text-sm text-ink/60">
                                    {answer}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`shrink-0 text-lg ${
                                  answer ? 'text-accent' : 'text-ink/30'
                                }`}
                                aria-hidden
                              >
                                {answer ? '✓' : '+'}
                              </span>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </motion.section>
            )}
          </AnimatePresence>
        )}

        {/* Navigation */}
        {hydrated && (
          <motion.div
            {...entrance(0.14)}
            className="mt-12 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-full px-4 py-2 text-sm text-ink/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Back
                </button>
              )}
              {step === 'memories' && (
                <p className="text-sm text-ink/50" aria-live="polite">
                  {answeredCount < MIN_ANSWERS
                    ? `${answeredCount} of ${MIN_ANSWERS} prompts answered`
                    : `${answeredCount} prompts answered`}
                </p>
              )}
            </div>
            <Button
              disabled={!canContinue}
              onClick={goNext}
              className={canContinue ? '' : 'cursor-not-allowed opacity-40'}
            >
              Continue
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
