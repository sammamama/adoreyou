'use client';

// Pricing content (AGENTS.md prices, USD — Stripe Adaptive Pricing converts
// at checkout) — used by the standalone /pricing page. Base price card,
// add-on grid, gift credit packs footnote.

import { motion, useReducedMotion } from 'motion/react';
import Button from '@/components/ui/Button';

const ease = [0.22, 1, 0.36, 1] as const;

const INCLUDED = [
  'Original lyrics written from your memories',
  'A full studio-quality song',
  'Two versions to preview — keep your favorite',
  'MP3 download, yours forever',
  'A gift reveal page with its own access code',
];

const ADDONS = [
  { name: '3 verses', price: '+$9.99', note: 'an extra verse, a longer song' },
  { name: '4 verses', price: '+$12.99', note: 'the fullest version of their story' },
  { name: 'Keep every version', price: '+$5.99', note: 'unlock all the takes we render' },
  { name: 'New genre', price: '+$12.99', note: 'same lyrics, reimagined in a fresh style' },
];

export default function PricingSection() {
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
    <section id="pricing" className="scroll-mt-24 pb-24">
      <motion.h2
        {...cardEntrance(0)}
        className="text-center font-serif text-3xl sm:text-4xl"
      >
        One song, one <span className="italic text-accent">price</span>
      </motion.h2>
      <motion.p
        {...cardEntrance(1)}
        className="mx-auto mt-3 max-w-md text-center text-ink/60"
      >
        No subscriptions, no credits to juggle. Pay once, keep it forever.
      </motion.p>

      <motion.div
        {...cardEntrance(0)}
        className="mx-auto mt-10 max-w-lg rounded-3xl border border-ink/10 bg-white p-8 text-center sm:p-10"
      >
        <div className="font-serif text-6xl tracking-tight">
          $20
          <span className="ml-2 text-lg text-ink/40">USD</span>
        </div>
        <p className="mt-2 text-sm text-ink/40">
          Checkout shows your local currency automatically.
        </p>
        <ul className="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm text-ink/70">
          {INCLUDED.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="text-accent">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <Button href="/#occasions">Create the Song</Button>
        </div>
      </motion.div>

      <motion.div {...cardEntrance(1)} className="mx-auto mt-10 max-w-3xl">
        <h3 className="text-center font-serif text-2xl">
          Make it <span className="italic text-accent">yours</span>
        </h3>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ADDONS.map((addon) => (
            <div
              key={addon.name}
              className="flex items-baseline justify-between gap-4 rounded-2xl border border-ink/10 bg-white px-5 py-4"
            >
              <div>
                <div className="font-medium">{addon.name}</div>
                <div className="text-sm text-ink/50">{addon.note}</div>
              </div>
              <div className="shrink-0 font-serif text-lg">{addon.price}</div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-ink/50">
          Every song includes one free gift page. Gifting more people? Packs
          from <span className="text-ink">$1.99</span> — 1 for $1.99, 3 for
          $3.99, 10 for $9.99.
        </p>
      </motion.div>
    </section>
  );
}
