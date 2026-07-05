'use client';

// "Discover a rising [city] artist" — fills the Step 6 wait while Suno
// renders. Fetches once from /api/discover (IP geo → city server-side),
// rotates through the returned tracks every ~30s. Anything missing — no
// Spotify creds, geo failed and no fallback results, network error — and
// the widget simply never appears.

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;
const ROTATE_MS = 30_000;

type DiscoverTrack = {
  artist: string;
  track: string;
  albumArt: string | null;
  spotifyUrl: string;
};

type DiscoverData = {
  city: string | null;
  tracks: DiscoverTrack[];
};

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.22c3.81-.87 7.08-.5 9.72 1.11.29.18.39.57.21.86Zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.69-1.65-6.78-2.13-9.96-1.17a.78.78 0 1 1-.45-1.5c3.63-1.1 8.15-.56 11.22 1.34.37.22.48.7.26 1.07Zm.11-2.83c-3.22-1.91-8.54-2.09-11.62-1.16a.94.94 0 1 1-.54-1.79c3.53-1.07 9.4-.86 13.11 1.34a.94.94 0 0 1-.95 1.61Z" />
    </svg>
  );
}

export default function DiscoverWidget() {
  const reduced = useReducedMotion();
  const [data, setData] = useState<DiscoverData | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/discover');
        const json = await res.json();
        if (cancelled || !res.ok || !json.data?.tracks?.length) return;
        setData(json.data as DiscoverData);
      } catch {
        // No widget this time — the waveform carries the wait alone.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data || data.tracks.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % data.tracks.length),
      ROTATE_MS
    );
    return () => clearInterval(timer);
  }, [data]);

  if (!data) return null;

  const track = data.tracks[index];

  return (
    <motion.aside
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease }}
      className="mt-12 w-full max-w-md"
      aria-label="Music discovery while you wait"
    >
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-ink/40">
        While you wait — a rising{' '}
        {data.city ? `${data.city} artist` : 'artist'}
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-white/70 p-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease }}
            className="flex items-center gap-4 text-left"
          >
            {track.albumArt ? (
              // Rotating remote Spotify CDN art — not worth next/image config
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.albumArt}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-ink/30">
                <SpotifyIcon />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-lg leading-snug">
                {track.track}
              </p>
              <p className="truncate text-sm text-ink/50">{track.artist}</p>
            </div>

            <a
              href={track.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition-colors duration-200 hover:border-ink/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={`Listen to ${track.track} by ${track.artist} on Spotify`}
            >
              <SpotifyIcon />
            </a>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
