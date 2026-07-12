'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import ExamplesCarousel from '@/components/ExamplesCarousel';
import HowItWorks from '@/components/HowItWorks';
import Navbar from '@/components/Navbar';
import OccasionCard from '@/components/OccasionCard';
import Button from '@/components/ui/Button';
import { fuzzyScore } from '@/lib/fuzzy';
import { OCCASIONS } from '@/lib/occasions';

const ease = [0.22, 1, 0.36, 1] as const;

export default function Home() {
  const reduced = useReducedMotion();
  const [query, setQuery] = useState('');

  const filteredOccasions = useMemo(() => {
    if (!query.trim()) return OCCASIONS;
    return OCCASIONS.map((o) => ({
      occasion: o,
      score: fuzzyScore(query, `${o.name} ${o.description}`),
    }))
      .filter((r): r is { occasion: typeof OCCASIONS[number]; score: number } => r.score !== null)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.occasion);
  }, [query]);

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
    <div className="flex flex-1 flex-col overflow-x-clip">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* Hero — top padding clears the fixed navbar */}
        <section className="pb-16 pt-28 text-center sm:pb-24 sm:pt-32">
          <motion.h1
            {...entrance(0)}
            className="mx-auto max-w-3xl font-serif text-5xl leading-tight tracking-tight sm:text-7xl"
          >
            Create a one-of-a-kind song for someone you{' '}
            <span className="italic text-accent">love</span>
          </motion.h1>

          {/* Receive-one examples — curved infinite carousel */}
          <ExamplesCarousel />
          <motion.div {...entrance(0.21)} className="mt-8">
            <Button href="#occasions">Create the Song</Button>
          </motion.div>
        </section>

        {/* How it works — above the occasions grid */}
        <HowItWorks />

        {/* Occasions */}
        <section id="occasions" className="scroll-mt-24 pb-24">
          <motion.h2
            {...cardEntrance(0)}
            className="font-serif text-3xl sm:text-4xl"
          >
            What&rsquo;s the <span className="italic text-accent">occasion</span>?
          </motion.h2>
          <motion.input
            {...cardEntrance(0.05)}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search occasions..."
            aria-label="Search occasions"
            className="mt-6 w-full max-w-sm rounded-xl border border-ink/15 bg-white px-4 py-3 text-base outline-none transition-colors duration-200 placeholder:text-ink/30 focus:border-accent"
          />
          {filteredOccasions.length === 0 ? (
            <p className="mt-8 text-ink/50">No occasions match &ldquo;{query}&rdquo;.</p>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOccasions.map((occasion, i) => (
                <motion.div key={occasion.slug} {...cardEntrance(i)}>
                  <OccasionCard occasion={occasion} />
                </motion.div>
              ))}
            </div>
          )}
        </section>

      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-ink/40">
        <span>AdoreYou — songs for the people you love</span>
        <span className="flex flex-wrap items-center gap-4">
          <Link
            href="/privacy"
            className="underline underline-offset-4 transition-colors duration-200 hover:text-ink/70"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="underline underline-offset-4 transition-colors duration-200 hover:text-ink/70"
          >
            Terms
          </Link>
          <Link
            href="/my-songs"
            className="underline underline-offset-4 transition-colors duration-200 hover:text-ink/70"
          >
            Find my songs
          </Link>
        </span>
      </footer>
    </div>
  );
}
