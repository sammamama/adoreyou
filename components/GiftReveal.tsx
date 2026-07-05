'use client';

// Step 9 — the recipient experience (decision #5: no auth, just the code).
// Occasion-themed entry with a large 4-digit PIN → envelope reveal animation
// with autoplay + occasion particles (confetti / petals / stars — memorial
// stays somber) → revealed page: scroll-synced lyrics, the sender's message,
// animated recipient name, audio visualizer, download.
//
// This is the theatrical side of the design system — the polish budget lives
// here. Page background stays light (light mode only); occasion color arrives
// as soft radial washes + particles, never a dark page.

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getOccasion } from '@/lib/occasions';

const ease = [0.22, 1, 0.36, 1] as const;

type EntryData = {
  recipientName: string;
  occasion: string;
  senderName: string;
};

type RevealData = EntryData & {
  personalMessage: string;
  lyrics: string;
  audioUrl: string;
  downloadUrl: string;
};

type Stage = 'loading' | 'entry' | 'envelope' | 'revealed' | 'missing';

type ParticleKind = 'confetti' | 'petals' | 'stars';

function particleKindFor(slug: string): ParticleKind {
  if (slug === 'memorial') return 'stars';
  if (['wedding', 'anniversary', 'mothers-day'].includes(slug)) return 'petals';
  return 'confetti';
}

// Occasion palette minus the near-blacks (those anchor mesh cards, not
// particles), plus the accent.
function particlePalette(slug: string): string[] {
  const occasion = getOccasion(slug);
  if (!occasion) return ['#E11D48'];
  return [...occasion.theme.colors, occasion.theme.accent].filter(
    (c) => !['#000000', '#1c1917'].includes(c.toLowerCase())
  );
}

// ---------------------------------------------------------------------------
// Particles — one canvas, three behaviors. Confetti bursts then keeps a
// gentle fall; petals drift and sway; stars (memorial) only float and
// twinkle — no burst, somber by design.

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  phase: number;
};

function Particles({
  kind,
  colors,
  burst,
}: {
  kind: ParticleKind;
  colors: string[];
  burst: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const pick = () => colors[Math.floor(Math.random() * colors.length)];
    const particles: Particle[] = [];

    const ambient = (fromTop: boolean): Particle => ({
      x: Math.random() * width,
      y: fromTop ? -20 - Math.random() * height * 0.3 : Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy:
        kind === 'stars'
          ? 0.08 + Math.random() * 0.15
          : 0.6 + Math.random() * (kind === 'petals' ? 0.7 : 1.1),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.04,
      size:
        kind === 'stars' ? 1.5 + Math.random() * 2.5 : 7 + Math.random() * 8,
      color: pick(),
      phase: Math.random() * Math.PI * 2,
    });

    // Ambient layer — stars get a sparse, slow field; the rest a light fall.
    const ambientCount = kind === 'stars' ? 40 : 28;
    for (let i = 0; i < ambientCount; i++) particles.push(ambient(false));

    // Celebration burst from the upper center (skipped for memorial stars).
    if (burst && kind !== 'stars') {
      for (let i = 0; i < 140; i++) {
        const angle = Math.PI * (0.15 + Math.random() * 0.7); // fan downward-out
        const speed = 4 + Math.random() * 9;
        particles.push({
          x: width / 2 + (Math.random() - 0.5) * 120,
          y: height * 0.3,
          vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
          vy: -Math.sin(angle) * speed,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          size: 7 + Math.random() * 8,
          color: pick(),
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 16.7, 3); // normalize to ~60fps steps
      last = now;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.vy += kind === 'stars' ? 0 : 0.06 * dt; // gravity
        p.vy = Math.min(p.vy, kind === 'petals' ? 1.6 : 3.2);
        p.x += (p.vx + Math.sin(now / 900 + p.phase) * (kind === 'stars' ? 0.1 : 0.5)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        // Recycle at the bottom; stars wrap around all edges.
        if (p.y > height + 24) Object.assign(p, ambient(true));
        if (p.x < -24) p.x = width + 20;
        if (p.x > width + 24) p.x = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;

        if (kind === 'stars') {
          const twinkle = 0.25 + 0.55 * Math.abs(Math.sin(now / 1200 + p.phase));
          ctx.globalAlpha = twinkle;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === 'petals') {
          ctx.globalAlpha = 0.85;
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.65, p.size * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = 0.9;
          ctx.rotate(p.rot);
          // scaleY by a sine fakes the 3D tumble of a confetto
          ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(now / 250 + p.phase)));
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, burst, reduced, colors.join(',')]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-10"
    />
  );
}

// ---------------------------------------------------------------------------
// PIN input — large, centered, tactile. Auto-advances, accepts paste,
// auto-submits on the 4th digit.

function PinInput({
  accent,
  disabled,
  failCount,
  onComplete,
}: {
  accent: string;
  disabled: boolean;
  failCount: number;
  onComplete: (code: string) => void;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // The parent remounts this component (key={failCount}) after a wrong code,
  // which clears the boxes — just put the cursor back for another try.
  useEffect(() => {
    if (failCount > 0) refs.current[0]?.focus();
  }, [failCount]);

  const commit = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== '')) onComplete(next.join(''));
  };

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) return;
    const next = [...digits];
    if (clean.length > 1) {
      // Paste — spread across the boxes.
      for (let i = 0; i < 4 - index; i++) next[index + i] = clean[i] ?? next[index + i];
      refs.current[Math.min(index + clean.length, 3)]?.focus();
    } else {
      next[index] = clean;
      refs.current[index + 1]?.focus();
    }
    commit(next);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        next[index - 1] = '';
        setDigits(next);
        refs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft') refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight') refs.current[index + 1]?.focus();
  };

  return (
    <motion.div
      animate={failCount > 0 ? { x: [0, -10, 10, -7, 7, -3, 0] } : undefined}
      transition={{ duration: 0.45 }}
      className="flex justify-center gap-3 sm:gap-4"
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Access code digit ${i + 1}`}
          className="h-20 w-16 rounded-2xl border-2 border-ink/15 bg-white text-center font-serif text-4xl outline-none transition-all duration-200 focus:scale-105 disabled:opacity-50 sm:h-24 sm:w-19 sm:text-5xl"
          style={digit ? { borderColor: accent } : undefined}
          onFocusCapture={(e) => (e.target.style.borderColor = accent)}
          onBlurCapture={(e) => {
            if (!digit) e.target.style.borderColor = '';
          }}
        />
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Audio visualizer — animated bars driven by rAF while playing. Simulated
// (no Web Audio) so it can't be broken by the audio CDN's missing CORS
// headers; deterministic sine stacks read as music well enough.

const BAR_COUNT = 28;

function Visualizer({ playing, accent }: { playing: boolean; accent: string }) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !playing) {
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.transform = 'scaleY(0.15)';
      });
      return;
    }
    let raf = 0;
    const draw = (now: number) => {
      const t = now / 1000;
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const v =
          0.5 * Math.abs(Math.sin(t * 2.1 + i * 0.9)) +
          0.3 * Math.abs(Math.sin(t * 3.7 + i * 0.35)) +
          0.2 * Math.abs(Math.sin(t * 1.3 + i * 1.7));
        bar.style.transform = `scaleY(${0.12 + v * 0.88})`;
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced]);

  return (
    <div aria-hidden className="flex h-16 items-end justify-center gap-1">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className="w-1.5 rounded-full transition-transform duration-75"
          style={{
            height: '100%',
            transform: 'scaleY(0.15)',
            transformOrigin: 'bottom',
            backgroundColor: accent,
            opacity: 0.4 + 0.6 * Math.abs(Math.sin(i * 0.7)),
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-6 w-6">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M7 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Zm10 0a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

type LyricLine = { text: string; isSection: boolean; singableIndex: number };

// Section labels ([Chorus], [Verse 1]...) become quiet headers; everything
// else participates in the time sync.
function parseLyrics(lyrics: string): LyricLine[] {
  let singableIndex = -1;
  return lyrics
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => {
      const isSection = /^\[.*\]$/.test(text);
      if (!isSection) singableIndex++;
      return { text, isSection, singableIndex: isSection ? -1 : singableIndex };
    });
}

export default function GiftReveal({ giftId }: { giftId: string }) {
  const reduced = useReducedMotion();

  const [stage, setStage] = useState<Stage>('loading');
  const [entry, setEntry] = useState<EntryData | null>(null);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [checking, setChecking] = useState(false);
  const [opening, setOpening] = useState(false);

  // Player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Lyrics sync
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const occasion = entry ? getOccasion(entry.occasion) : undefined;
  const accent = occasion?.theme.accent ?? '#E11D48';
  const kind = particleKindFor(entry?.occasion ?? '');
  const palette = useMemo(
    () => particlePalette(entry?.occasion ?? ''),
    [entry?.occasion]
  );
  const somber = entry?.occasion === 'memorial';

  // Entry data — occasion + names only, nothing sensitive.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/gifts/${giftId}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json.error) {
          setStage('missing');
          return;
        }
        setEntry(json.data as EntryData);
        setStage('entry');
      } catch {
        if (!cancelled) setStage('missing');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [giftId]);

  const submitCode = async (code: string) => {
    setChecking(true);
    setPinError(null);
    try {
      const res = await fetch(`/api/gifts/${giftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setPinError(json.error ?? 'Something went wrong — try again.');
        setFailCount((c) => c + 1);
        return;
      }
      setReveal(json.data as RevealData);
      setStage('envelope');
    } catch {
      setPinError('Something went wrong — check your connection and try again.');
      setFailCount((c) => c + 1);
    } finally {
      setChecking(false);
    }
  };

  // Envelope tap — the user gesture that lets the song autoplay.
  const openGift = () => {
    if (opening) return;
    setOpening(true);
    void audioRef.current?.play().catch(() => {
      // Autoplay blocked — the revealed page's play button takes over.
    });
    setTimeout(() => setStage('revealed'), reduced ? 100 : 1500);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const lines = useMemo(
    () => (reveal ? parseLyrics(reveal.lyrics) : []),
    [reveal]
  );
  const singableCount = useMemo(
    () => lines.filter((l) => !l.isSection).length,
    [lines]
  );

  // Scroll-synced lyrics: no per-line timing data exists, so map playback
  // progress linearly across the singable lines — close enough to feel alive.
  const activeSingable =
    duration > 0 && singableCount > 0
      ? Math.min(
          Math.floor((currentTime / duration) * singableCount),
          singableCount - 1
        )
      : -1;

  useEffect(() => {
    if (activeSingable < 0 || !playing) return;
    const overallIndex = lines.findIndex(
      (l) => !l.isSection && l.singableIndex === activeSingable
    );
    const el = lineRefs.current[overallIndex];
    const container = lyricsContainerRef.current;
    if (!el || !container) return;
    container.scrollTo({
      top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [activeSingable, playing, lines, reduced]);

  const entrance = (delay: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, ease, delay },
  });

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Occasion wash — soft, light-mode only; saturation stays in moments */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(900px 500px at 50% -10%, ${accent}${somber ? '14' : '22'}, transparent 65%), radial-gradient(700px 500px at 85% 100%, ${accent}${somber ? '0d' : '14'}, transparent 60%)`,
        }}
      />

      {/* Particles: gentle ambience once inside, full burst on reveal */}
      {(stage === 'revealed' || (stage === 'envelope' && opening)) && entry && (
        <Particles kind={kind} colors={palette} burst={!somber} />
      )}

      {/* The song — mounted from the envelope on so tap-to-open can play it */}
      {reveal && (
        <audio
          ref={audioRef}
          src={reveal.audioUrl}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />
      )}

      <main className="relative z-20 mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-20">
        {stage === 'loading' && (
          <div className="flex flex-1 items-center justify-center">
            <p className="font-serif text-2xl text-ink/40">
              Something special is on its way...
            </p>
          </div>
        )}

        {stage === 'missing' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h1 className="font-serif text-4xl">
              This gift got <span className="italic text-accent">lost</span>
            </h1>
            <p className="mt-4 max-w-sm text-ink/60">
              We couldn&rsquo;t find a gift at this link — double-check it with
              the person who sent it to you.
            </p>
          </div>
        )}

        {/* Entry — occasion-themed landing + PIN */}
        {stage === 'entry' && entry && (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <motion.p
              {...entrance(0)}
              className="text-sm font-medium uppercase tracking-[0.2em]"
              style={{ color: accent }}
            >
              {occasion?.name ?? 'A gift'}
            </motion.p>
            <motion.h1
              {...entrance(0.07)}
              className="mt-4 font-serif text-4xl leading-tight sm:text-6xl"
            >
              {entry.senderName} made something{' '}
              <span className="italic" style={{ color: accent }}>
                just for you
              </span>
            </motion.h1>
            <motion.p {...entrance(0.14)} className="mt-5 text-ink/60">
              {somber
                ? 'A song, kept safe behind your 4-digit code.'
                : 'It’s sealed with a 4-digit code — enter it to open your gift.'}
            </motion.p>

            <motion.div {...entrance(0.21)} className="mt-10 w-full">
              <PinInput
                key={failCount}
                accent={accent}
                disabled={checking}
                failCount={failCount}
                onComplete={(code) => void submitCode(code)}
              />
              <div className="mt-5 min-h-6" aria-live="polite">
                {checking && (
                  <p className="text-sm text-ink/50">Unlocking...</p>
                )}
                {!checking && pinError && (
                  <p className="text-sm" style={{ color: accent }} role="alert">
                    {pinError}
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Envelope — correct code, tap to open */}
        <AnimatePresence>
          {stage === 'envelope' && reveal && (
            <motion.div
              key="envelope"
              className="flex flex-1 flex-col items-center justify-center py-16"
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.15, filter: 'blur(8px)' }}
              transition={{ duration: 0.5, ease }}
            >
              <motion.p
                {...entrance(0)}
                className="mb-10 font-serif text-2xl text-ink/60"
              >
                {opening ? 'From ' + reveal.senderName + ', with love' : 'For you'}
              </motion.p>

              <motion.button
                type="button"
                onClick={openGift}
                aria-label="Open your gift"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.9 }}
                animate={
                  reduced
                    ? { opacity: 1 }
                    : opening
                      ? { opacity: 1, y: 0, scale: 1.05 }
                      : { opacity: 1, y: [0, -8, 0], scale: 1 }
                }
                transition={
                  opening
                    ? { duration: 0.6, ease }
                    : {
                        opacity: { duration: 0.6, ease },
                        y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 },
                      }
                }
                className="relative cursor-pointer"
                style={{ perspective: 800 }}
              >
                {/* Envelope body */}
                <div
                  className="relative h-44 w-72 max-w-[calc(100vw-4rem)] overflow-visible rounded-xl shadow-xl sm:h-52 sm:w-86"
                  style={{ backgroundColor: accent }}
                >
                  {/* Letter sliding out */}
                  <motion.div
                    initial={{ y: 0 }}
                    animate={opening && !reduced ? { y: -70 } : { y: 0 }}
                    transition={{ duration: 0.7, ease, delay: 0.45 }}
                    className="absolute inset-x-4 top-2 bottom-2 rounded-lg bg-white shadow-md"
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6">
                      <span className="font-serif text-lg italic text-ink/70">
                        a song for
                      </span>
                      <span className="font-serif text-2xl">
                        {reveal.recipientName}
                      </span>
                    </div>
                  </motion.div>

                  {/* Front pocket — hides the letter's lower half */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-xl"
                    style={{
                      backgroundColor: accent,
                      filter: 'brightness(1.12)',
                      clipPath: 'polygon(0 0, 50% 45%, 100% 0, 100% 100%, 0 100%)',
                    }}
                  />

                  {/* Flap — swings open */}
                  <motion.div
                    initial={{ rotateX: 0 }}
                    animate={opening && !reduced ? { rotateX: 180 } : { rotateX: 0 }}
                    transition={{ duration: 0.6, ease }}
                    className="absolute inset-x-0 top-0 h-1/2"
                    style={{
                      transformOrigin: 'top',
                      backgroundColor: accent,
                      filter: 'brightness(0.9)',
                      clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                      zIndex: opening ? 0 : 2,
                    }}
                  />
                </div>

                {!opening && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.6 }}
                    className="mt-8 text-sm font-medium uppercase tracking-[0.2em] text-ink/50"
                  >
                    Tap to open
                  </motion.p>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Revealed */}
        {stage === 'revealed' && reveal && (
          <div className="pt-16 sm:pt-20">
            <motion.p
              {...entrance(0)}
              className="text-center text-sm font-medium uppercase tracking-[0.2em]"
              style={{ color: accent }}
            >
              {occasion?.name ?? 'A gift'} · from {reveal.senderName}
            </motion.p>

            {/* Recipient name — letter-by-letter */}
            <h1
              className="mt-6 text-center font-serif text-6xl leading-none sm:text-7xl"
              aria-label={reveal.recipientName}
            >
              {reveal.recipientName.split('').map((ch, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="inline-block italic"
                  style={{ color: accent, whiteSpace: 'pre' }}
                  initial={
                    reduced
                      ? { opacity: 0 }
                      : { opacity: 0, y: 30, filter: 'blur(8px)' }
                  }
                  animate={
                    reduced
                      ? { opacity: 1 }
                      : { opacity: 1, y: 0, filter: 'blur(0px)' }
                  }
                  transition={{ duration: 0.5, ease, delay: 0.2 + i * 0.06 }}
                >
                  {ch}
                </motion.span>
              ))}
            </h1>
            <motion.p
              {...entrance(0.4)}
              className="mt-4 text-center font-serif text-xl italic text-ink/60"
            >
              this song is yours
            </motion.p>

            {/* Player + visualizer */}
            <motion.div
              {...entrance(0.5)}
              className="mt-10 rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8"
            >
              <Visualizer playing={playing} accent={accent} />

              <div className="mt-6 flex items-center gap-4">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? 'Pause the song' : 'Play the song'}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: accent, outlineColor: accent }}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>

                <div className="min-w-0 flex-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => seek(Number(e.target.value))}
                    aria-label="Seek within the song"
                    className="song-seek w-full"
                    style={{ accentColor: accent }}
                  />
                  <div className="mt-1 flex justify-between text-xs text-ink/40 tabular-nums">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {/* Plain <a> — a Next Link would client-navigate/prefetch the
                    API download route instead of saving the file. */}
                <a
                  href={reveal.downloadUrl}
                  className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border border-ink/15 px-7 text-base font-medium text-ink transition-colors duration-200 hover:border-ink/40 sm:w-auto"
                >
                  Download the song
                </a>
              </div>
            </motion.div>

            {/* Personal message */}
            <motion.blockquote
              {...entrance(0.6)}
              className="mx-auto mt-12 max-w-xl text-center"
            >
              <p className="font-serif text-2xl italic leading-relaxed sm:text-3xl">
                &ldquo;{reveal.personalMessage}&rdquo;
              </p>
              <footer className="mt-4 text-sm text-ink/50">
                — {reveal.senderName}
              </footer>
            </motion.blockquote>

            {/* Scroll-synced lyrics */}
            <motion.section {...entrance(0.7)} className="mt-14">
              <h2 className="text-center text-sm font-medium uppercase tracking-[0.2em] text-ink/40">
                The lyrics
              </h2>
              <div
                ref={lyricsContainerRef}
                className="relative mt-6 max-h-[55vh] overflow-y-auto rounded-3xl border border-ink/10 bg-white/60 px-6 py-10 backdrop-blur-sm sm:px-10"
              >
                <div className="space-y-3 text-center">
                  {lines.map((line, i) =>
                    line.isSection ? (
                      <p
                        key={i}
                        ref={(el) => {
                          lineRefs.current[i] = el;
                        }}
                        className="pt-5 text-xs font-medium uppercase tracking-[0.2em] text-ink/30 first:pt-0"
                      >
                        {line.text.replace(/^\[|\]$/g, '')}
                      </p>
                    ) : (
                      <p
                        key={i}
                        ref={(el) => {
                          lineRefs.current[i] = el;
                        }}
                        className="font-serif text-xl leading-relaxed transition-all duration-500 sm:text-2xl"
                        style={
                          line.singableIndex === activeSingable && playing
                            ? { color: accent, opacity: 1, transform: 'scale(1.04)' }
                            : { opacity: 0.45 }
                        }
                      >
                        {line.text}
                      </p>
                    )
                  )}
                </div>
              </div>
            </motion.section>

            <motion.p
              {...entrance(0.8)}
              className="mt-14 pb-4 text-center text-sm text-ink/40"
            >
              Made with <span className="font-serif italic">love</span> at{' '}
              <Link href="/" className="underline underline-offset-4" style={{ color: accent }}>
                AdoreYou
              </Link>
            </motion.p>
          </div>
        )}
      </main>
    </div>
  );
}
