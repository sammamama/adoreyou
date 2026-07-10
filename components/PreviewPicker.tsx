'use client';

// Step 6 ready state — 15s preview players for both versions, pick the
// favorite (required), plus the two preview upsells (decision #14):
// Keep Every Version +$8.99, Regenerate in New Genre +$20.

import { motion, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import { GENRES } from '@/components/StyleSelector';
import Button from '@/components/ui/Button';
import { useDraftStore } from '@/lib/store';

const ease = [0.22, 1, 0.36, 1] as const;

export interface PreviewTrack {
  index: number;
  genre: string;
  kind: 'original' | 'regen';
  previewUrl: string;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M7 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Zm10 0a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export default function PreviewPicker({
  tracks,
  onContinue,
}: {
  tracks: PreviewTrack[];
  onContinue: () => void;
}) {
  const reduced = useReducedMotion();

  const selectedTrackId = useDraftStore((s) => s.selectedTrackId);
  const keepEveryVersion = useDraftStore((s) => s.keepEveryVersion);
  const regenGenre = useDraftStore((s) => s.regenGenre);
  const update = useDraftStore((s) => s.update);

  // Card can be open (toggled on) before a genre is picked — only the
  // picked genre persists; an open-but-empty card just blocks Continue.
  const [regenOpen, setRegenOpen] = useState(regenGenre !== null);

  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
  const [playing, setPlaying] = useState<number | null>(null);
  const [progress, setProgress] = useState<Record<number, number>>({});

  const togglePlay = (index: number) => {
    const audio = audioRefs.current[index];
    if (!audio) return;
    if (playing === index) {
      audio.pause();
      return;
    }
    // Only one preview plays at a time.
    Object.entries(audioRefs.current).forEach(([key, el]) => {
      if (Number(key) !== index) el?.pause();
    });
    void audio.play();
  };

  const entrance = (delay: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, ease, delay },
  });

  const regenIncomplete = regenOpen && !regenGenre;
  const canContinue = selectedTrackId !== null && !regenIncomplete;

  return (
    <div>
      {/* Preview players + pick */}
      <motion.section {...entrance(0)} className="space-y-4">
        <p className="text-sm text-ink/50">
          Two versions of your song — listen to both, then pick your favorite.
        </p>
        {tracks.map((track, i) => {
          const selected = selectedTrackId === track.index;
          const pct = progress[track.index] ?? 0;
          return (
            <div
              key={track.index}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => update({ selectedTrackId: track.index })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  update({ selectedTrackId: track.index });
                }
              }}
              className={`cursor-pointer rounded-2xl border p-6 transition-colors duration-200 ${
                selected
                  ? 'border-accent bg-white'
                  : 'border-ink/10 bg-white/50 hover:border-ink/30'
              }`}
            >
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay(track.index);
                  }}
                  aria-label={
                    playing === track.index
                      ? `Pause version ${i + 1}`
                      : `Play version ${i + 1} preview`
                  }
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors duration-200 hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {playing === track.index ? <PauseIcon /> : <PlayIcon />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-serif text-xl">
                      Version {i + 1}
                    </span>
                    <span className="text-sm text-ink/50">{track.genre}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-ink/40">15-second preview</p>
                </div>

                <div
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                    selected ? 'border-accent bg-accent' : 'border-ink/20'
                  }`}
                >
                  {selected && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>

              <audio
                ref={(el) => {
                  audioRefs.current[track.index] = el;
                }}
                src={track.previewUrl}
                preload="none"
                onPlay={() => setPlaying(track.index)}
                onPause={() =>
                  setPlaying((p) => (p === track.index ? null : p))
                }
                onTimeUpdate={(e) => {
                  const el = e.currentTarget;
                  const duration = Number.isFinite(el.duration)
                    ? el.duration
                    : 15;
                  setProgress((prev) => ({
                    ...prev,
                    [track.index]: Math.min(el.currentTime / duration, 1),
                  }));
                }}
                onEnded={() =>
                  setProgress((prev) => ({ ...prev, [track.index]: 0 }))
                }
              />
            </div>
          );
        })}
      </motion.section>

      {/* Upsells */}
      <motion.section {...entrance(0.07)} className="mt-12">
        <h2 className="font-serif text-2xl">
          Make it <span className="italic text-accent">more</span>
        </h2>

        <div className="mt-4 space-y-4">
          {/* Keep Every Version */}
          <button
            type="button"
            onClick={() => update({ keepEveryVersion: !keepEveryVersion })}
            aria-pressed={keepEveryVersion}
            className={`w-full rounded-2xl border p-6 text-left transition-colors duration-200 ${
              keepEveryVersion
                ? 'border-accent bg-white'
                : 'border-ink/10 bg-white/50 hover:border-ink/30'
            }`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-serif text-xl">Keep Every Version</span>
              <span
                className={`text-sm font-medium ${
                  keepEveryVersion ? 'text-accent' : 'text-ink/50'
                }`}
              >
                +$8.99 AUD
              </span>
            </div>
            <p className="mt-2 text-sm text-ink/60">
              Unlock every track we make for this song — both versions now, and
              every regenerated one too.
            </p>
          </button>

          {/* Regenerate in New Genre */}
          <div
            className={`rounded-2xl border transition-colors duration-200 ${
              regenOpen
                ? 'border-accent bg-white'
                : 'border-ink/10 bg-white/50 hover:border-ink/30'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                if (regenOpen) {
                  setRegenOpen(false);
                  update({ regenGenre: null });
                } else {
                  setRegenOpen(true);
                }
              }}
              aria-pressed={regenOpen}
              className="w-full p-6 text-left"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-serif text-xl">
                  Regenerate in a New Genre
                </span>
                <span
                  className={`text-sm font-medium ${
                    regenOpen ? 'text-accent' : 'text-ink/50'
                  }`}
                >
                  +$20.00 AUD
                </span>
              </div>
              <p className="mt-2 text-sm text-ink/60">
                Same lyrics, a whole new sound — we&rsquo;ll render a fresh pair
                after payment and you&rsquo;ll pick your final from all
                versions.
              </p>
            </button>

            {regenOpen && (
              <div className="px-6 pb-6">
                <p className="text-sm font-medium">Pick the new genre</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => update({ regenGenre: g })}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        regenGenre === g
                          ? 'border-accent bg-accent text-white'
                          : 'border-ink/15 bg-white hover:border-ink/40'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                {!regenGenre && (
                  <p className="mt-3 text-xs text-ink/40">
                    Pick a genre to add this — or tap the card again to remove
                    it.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* Continue */}
      <motion.div
        {...entrance(0.14)}
        className="mt-12 flex items-center justify-end gap-4"
      >
        {selectedTrackId === null && (
          <p className="text-sm text-ink/40">Pick your favorite to continue</p>
        )}
        {selectedTrackId !== null && regenIncomplete && (
          <p className="text-sm text-ink/40">
            Pick a genre for the regeneration
          </p>
        )}
        <Button
          disabled={!canContinue}
          onClick={onContinue}
          className={canContinue ? '' : 'cursor-not-allowed opacity-40'}
        >
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
