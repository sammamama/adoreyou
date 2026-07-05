'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import OccasionCard from '@/components/OccasionCard';
import Button from '@/components/ui/Button';
import { OCCASIONS } from '@/lib/occasions';

const ease = [0.22, 1, 0.36, 1] as const;

export default function Home() {
  const reduced = useReducedMotion();

  // Standard entrance; reduced motion drops blur + y, keeps fade
  const entrance = (delay: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, ease, delay },
  });

  const cardEntrance = (i: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    whileInView: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.6, ease, delay: (i % 3) * 0.07 },
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <span className="font-serif text-2xl">
          Adore<span className="italic text-accent">You</span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* Hero */}
        <section className="py-16 text-center sm:py-24">
          <motion.h1
            {...entrance(0)}
            className="mx-auto max-w-3xl font-serif text-5xl leading-tight tracking-tight sm:text-7xl"
          >
            Create a one-of-a-kind song for someone you{' '}
            <span className="italic text-accent">love</span>
          </motion.h1>
          <motion.p
            {...entrance(0.07)}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink/60"
          >
            Share your memories, and we&rsquo;ll turn them into an original
            song — written for them, from you.
          </motion.p>
          <motion.div {...entrance(0.14)} className="mt-10">
            <Button href="#occasions">Create Your Song</Button>
          </motion.div>
        </section>

        {/* Occasions */}
        <section id="occasions" className="pb-24">
          <motion.h2
            {...cardEntrance(0)}
            className="font-serif text-3xl sm:text-4xl"
          >
            What&rsquo;s the <span className="italic text-accent">occasion</span>?
          </motion.h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {OCCASIONS.map((occasion, i) => (
              <motion.div key={occasion.slug} {...cardEntrance(i)}>
                <OccasionCard occasion={occasion} />
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-ink/40">
        <span>AdoreYou — songs for the people you love</span>
        <Link
          href="/my-songs"
          className="underline underline-offset-4 transition-colors duration-200 hover:text-ink/70"
        >
          Find my songs
        </Link>
      </footer>
    </div>
  );
}
