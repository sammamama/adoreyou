'use client';

// Animated processing state while Suno renders the pair (~2-3 min).
// Waveform bars + rotating progress copy. Step 6 also gets the Spotify
// rising-artist widget below the waveform (discover prop).

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import DiscoverWidget from '@/components/DiscoverWidget';

const ease = [0.22, 1, 0.36, 1] as const;

const COPY = [
  'Composing your song...',
  'Finding the melody...',
  'Laying down the vocals...',
  'Weaving in their story...',
  'Almost there — final touches...',
];

// Fixed bar heights so the waveform has an organic silhouette.
const BARS = [
  0.35, 0.6, 0.85, 0.5, 0.95, 0.7, 0.45, 0.8, 1, 0.65, 0.4, 0.75, 0.9, 0.55,
  0.3, 0.7, 0.85, 0.5, 0.6, 0.4,
];

export default function ProcessingView({
  recipientName,
  discover = false,
}: {
  recipientName?: string;
  discover?: boolean;
}) {
  const reduced = useReducedMotion();
  const [copyIndex, setCopyIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setCopyIndex((i) => (i + 1) % COPY.length),
      8000
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease }}
      className="flex flex-col items-center py-16 text-center"
    >
      <div
        className="flex h-24 items-center gap-1.5"
        role="img"
        aria-label="Song is being composed"
      >
        {BARS.map((height, i) => (
          <span
            key={i}
            className="waveform-bar w-1.5 rounded-full bg-accent/70"
            style={{
              height: `${height * 96}px`,
              animationDelay: `${(i % 7) * 0.15}s`,
            }}
          />
        ))}
      </div>

      <p className="mt-10 font-serif text-2xl" aria-live="polite">
        {COPY[copyIndex]}
      </p>
      <p className="mt-3 max-w-sm text-sm text-ink/50">
        {recipientName
          ? `We're turning your memories of ${recipientName} into a song.`
          : "We're turning your memories into a song."}{' '}
        This usually takes 2–3 minutes — stay on this page.
      </p>

      {discover && <DiscoverWidget />}
    </motion.div>
  );
}
