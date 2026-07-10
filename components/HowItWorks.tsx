'use client';

// How-it-works steps — shared by the landing page (above the occasions
// grid) and the standalone /how-it-works page.

import { motion, useReducedMotion } from 'motion/react';

const ease = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    title: 'Pick the occasion',
    body: 'Birthday, wedding, memorial, or just because — choose the moment the song is for.',
  },
  {
    title: 'Share your memories',
    body: 'Guided prompts pull out the stories only you two share. We turn them into lyrics you can edit and refine.',
  },
  {
    title: 'Hear it sung',
    body: 'A few minutes later, two full versions of your song. Preview both, pick your favorite.',
  },
  {
    title: 'Gift the reveal',
    body: 'Download your MP3 and send a personal reveal page, unlocked with their own 4-digit code.',
  },
];

export default function HowItWorks() {
  const reduced = useReducedMotion();

  const cardEntrance = (i: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    whileInView: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.6, ease, delay: (i % 4) * 0.07 },
  });

  return (
    <section id="how-it-works" className="scroll-mt-24 pb-24">
      <motion.h2
        {...cardEntrance(0)}
        className="font-serif text-3xl sm:text-4xl"
      >
        How it <span className="italic text-accent">works</span>
      </motion.h2>
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            {...cardEntrance(i)}
            className="rounded-3xl border border-ink/10 bg-white p-6"
          >
            <span className="font-serif text-4xl italic text-accent/40">
              {i + 1}
            </span>
            <h3 className="mt-3 font-serif text-xl">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              {step.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
