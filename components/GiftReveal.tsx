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
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getOccasion } from '@/lib/occasions';

// three/r3f are client-only and heavy — load only when a memorial gift needs them.
const MemorialStars = dynamic(() => import('@/components/MemorialStars'), {
  ssr: false,
});

const ease = [0.22, 1, 0.36, 1] as const;

type EntryData = {
  recipientName: string;
  occasion: string;
  senderName: string;
  locked?: boolean;
  unwrapsAt?: string | null;
};

type RevealData = EntryData & {
  personalMessage: string;
  lyrics: string;
  audioUrl: string;
  downloadUrl: string;
  photoUrl: string | null;
  voiceNoteUrl: string | null;
};

type Stage = 'loading' | 'locked' | 'entry' | 'envelope' | 'revealed' | 'missing';

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
// Confetti — @hiseb/confetti (confetti.js): celebration burst, then a gentle
// ambient fall. The library owns its canvas (fullscreen, auto-removed when
// particles finish) and picks its own festive hues. Imported dynamically —
// it touches `window` at module scope, which would crash SSR. Petals/stars
// below keep the custom canvas (bespoke sway/twinkle it doesn't do).

function ConfettiEffect({ burst }: { burst: boolean }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    let ambient: number | undefined;

    void import('@hiseb/confetti').then(({ default: confetti }) => {
      if (cancelled) return;

      if (burst) {
        confetti({
          position: { x: window.innerWidth / 2, y: window.innerHeight * 0.3 },
          count: 280,
          velocity: 250,
        });
      }

      // Ambient fall — small drops from random points along the top.
      ambient = window.setInterval(() => {
        confetti({
          position: { x: Math.random() * window.innerWidth, y: -20 },
          count: 6,
          velocity: 50,
          size: 0.9,
          fade: true,
        });
      }, 400);
    });

    return () => {
      cancelled = true;
      if (ambient) window.clearInterval(ambient);
    };
  }, [burst, reduced]);

  return null;
}

// ---------------------------------------------------------------------------
// Particles — petals on a custom canvas: burst on reveal, then drift and
// sway down. (Memorial stars live in MemorialStars; confetti in ConfettiEffect.)

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

function Particles({ colors, burst }: { colors: string[]; burst: boolean }) {
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
      vy: 0.6 + Math.random() * 0.7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.04,
      size: 7 + Math.random() * 8,
      color: pick(),
      phase: Math.random() * Math.PI * 2,
    });

    // Ambient layer — a light petal fall.
    for (let i = 0; i < 28; i++) particles.push(ambient(false));

    // Celebration burst from the upper center.
    if (burst) {
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
        p.vy += 0.06 * dt; // gravity
        p.vy = Math.min(p.vy, 1.6);
        p.x += (p.vx + Math.sin(now / 900 + p.phase) * 0.5) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        // Recycle at the bottom; wrap the sides.
        if (p.y > height + 24) Object.assign(p, ambient(true));
        if (p.x < -24) p.x = width + 20;
        if (p.x > width + 24) p.x = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.85;
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.65, p.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
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
  }, [burst, reduced, colors.join(',')]);

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
  dark,
}: {
  accent: string;
  disabled: boolean;
  failCount: number;
  onComplete: (code: string) => void;
  dark: boolean;
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
          className={`h-20 w-16 rounded-2xl border-2 border-ink/15 text-center font-serif text-4xl outline-none transition-all duration-200 focus:scale-105 disabled:opacity-50 sm:h-24 sm:w-19 sm:text-5xl ${dark ? 'bg-white/10' : 'bg-white'}`}
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
    <div aria-hidden className="flex h-10 items-end justify-center gap-1">
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

// Sealed-gift countdown — ticks to the unwrap moment, then hands the page
// over to the normal code entry.
function Countdown({
  until,
  accent,
  onDone,
}: {
  until: string;
  accent: string;
  onDone: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const target = new Date(until).getTime();
  const done = target - now <= 0;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  const total = Math.max(0, Math.floor((target - now) / 1000));
  const units = [
    { label: 'days', value: Math.floor(total / 86400) },
    { label: 'hours', value: Math.floor((total % 86400) / 3600) },
    { label: 'min', value: Math.floor((total % 3600) / 60) },
    { label: 'sec', value: total % 60 },
  ];

  return (
    <div className="flex items-start justify-center gap-4 sm:gap-6" role="timer">
      {units.map((u) => (
        <div key={u.label} className="w-16 text-center sm:w-20">
          <div
            className="font-serif text-4xl tabular-nums sm:text-5xl"
            style={{ color: accent }}
          >
            {String(u.value).padStart(2, '0')}
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-ink/40">
            {u.label}
          </div>
        </div>
      ))}
    </div>
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
    .map((raw) => {
      // Bracket form is canonical; **bold** matches older songs generated
      // before labels were normalized server-side.
      const isSection = /^\[.*\]$/.test(raw) || /^\*\*.+\*\*$/.test(raw);
      const text = isSection ? raw.replace(/^[[*]+|[\]*]+$/g, '') : raw;
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
        const data = json.data as EntryData;
        setEntry(data);
        setStage(data.locked ? 'locked' : 'entry');
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
    <div
      className={`relative flex min-h-screen flex-col overflow-hidden ${somber ? 'bg-black' : ''}`}
      // Memorial goes dark: overriding --ink flips every ink-derived utility
      // (text-ink/60, border-ink/10...) to warm white for this subtree.
      style={
        somber
          ? ({ '--ink': '#fafaf9', color: '#fafaf9' } as React.CSSProperties)
          : undefined
      }
    >
      {/* Occasion wash — soft; saturation stays in moments */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(900px 500px at 50% -10%, ${accent}${somber ? '14' : '22'}, transparent 65%), radial-gradient(700px 500px at 85% 100%, ${accent}${somber ? '0d' : '14'}, transparent 60%)`,
        }}
      />

      {/* Memorial starfield — behind every stage of the dark page */}
      {kind === 'stars' && entry && !reduced && <MemorialStars />}

      {/* Particles: gentle ambience once inside, full burst on reveal */}
      {(stage === 'revealed' || (stage === 'envelope' && opening)) &&
        entry &&
        kind !== 'stars' &&
        (kind === 'confetti' ? (
          <ConfettiEffect burst={!somber} />
        ) : (
          <Particles colors={palette} burst={!somber} />
        ))}

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

      <main
        className={`relative z-20 mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 ${
          stage === 'revealed' ? 'h-dvh overflow-hidden' : 'pb-20'
        }`}
      >
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

        {/* Sealed — scheduled gift, counting down to its moment */}
        {stage === 'locked' && entry && entry.unwrapsAt && (
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
              {entry.senderName} has something{' '}
              <span className="italic" style={{ color: accent }}>
                waiting for you
              </span>
            </motion.h1>
            <motion.p {...entrance(0.14)} className="mt-5 text-ink/60">
              It unwraps at just the right moment.
            </motion.p>
            <motion.div {...entrance(0.21)} className="mt-10">
              <Countdown
                until={entry.unwrapsAt}
                accent={accent}
                onDone={() => setStage('entry')}
              />
            </motion.div>
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
                dark={somber}
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
                    // The letter is white paper — its text stays dark even
                    // when the memorial page flips --ink to white.
                    style={
                      { '--ink': '#1c1917', color: '#1c1917' } as React.CSSProperties
                    }
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

        {/* Revealed — everything fits one viewport; only the lyrics box scrolls */}
        {stage === 'revealed' && reveal && (
          <div className="flex min-h-0 flex-1 flex-col pt-6">
            <motion.p
              {...entrance(0)}
              className="text-center text-sm font-medium uppercase tracking-[0.2em]"
              style={{ color: accent }}
            >
              {occasion?.name ?? 'A gift'} · from {reveal.senderName}
            </motion.p>

            {/* Recipient name — letter-by-letter */}
            <h1
              className="mt-3 text-center font-serif text-4xl leading-none sm:text-5xl"
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
              className="mt-1.5 text-center font-serif text-base italic text-ink/60"
            >
              this song is yours
            </motion.p>

            {/* Sender media — photo + voice note, before the song */}
            {(reveal.photoUrl || reveal.voiceNoteUrl) && (
              <motion.div
                {...entrance(0.45)}
                className="mx-auto mt-3 flex w-full max-w-xl items-center justify-center gap-4"
              >
                {reveal.photoUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={reveal.photoUrl}
                    alt={`A photo from ${reveal.senderName}`}
                    className="max-h-20 w-auto -rotate-1 rounded-xl border-4 border-white object-contain shadow-lg"
                  />
                )}
                {reveal.voiceNoteUrl && (
                  <div className={`min-w-0 flex-1 rounded-2xl border border-ink/10 p-3 backdrop-blur-sm ${somber ? 'bg-white/5' : 'bg-white/80'}`}>
                    <p className="text-xs font-medium text-ink/60">
                      A voice note from {reveal.senderName}
                    </p>
                    <audio
                      src={reveal.voiceNoteUrl}
                      controls
                      className="mt-1.5 h-9 w-full"
                    />
                  </div>
                )}
              </motion.div>
            )}

            {/* Personal message — compact so everything fits one screen */}
            <motion.blockquote
              {...entrance(0.5)}
              className="mx-auto mt-3 max-w-xl text-center"
            >
              <p className="font-serif text-base italic leading-relaxed sm:text-lg">
                &ldquo;{reveal.personalMessage}&rdquo;{' '}
                <span className="text-sm not-italic text-ink/50">
                  — {reveal.senderName}
                </span>
              </p>
            </motion.blockquote>

            {/* Player + scroll-synced lyrics — the lyrics box takes the
                remaining viewport and scrolls internally */}
            <motion.div
              {...entrance(0.55)}
              className={`mt-4 flex min-h-0 flex-1 flex-col rounded-3xl border border-ink/10 p-5 shadow-sm backdrop-blur-sm sm:p-6 ${somber ? 'bg-white/5' : 'bg-white/80'}`}
            >
              <Visualizer playing={playing} accent={accent} />

              <div className="mt-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? 'Pause the song' : 'Play the song'}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2"
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

                {/* Plain <a> — a Next Link would client-navigate/prefetch the
                    API download route instead of saving the file. */}
                <a
                  href={reveal.downloadUrl}
                  className="inline-flex shrink-0 items-center justify-center rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition-colors duration-200 hover:border-ink/40"
                >
                  Download
                </a>
              </div>

              <div
                ref={lyricsContainerRef}
                className="relative mt-4 min-h-0 flex-1 overflow-y-auto border-t border-ink/10 px-2 pt-4"
              >
                <div className="space-y-2.5 text-center">
                  {lines.map((line, i) =>
                    line.isSection ? (
                      <p
                        key={i}
                        ref={(el) => {
                          lineRefs.current[i] = el;
                        }}
                        className="pt-4 text-xs font-medium uppercase tracking-[0.2em] text-ink/30 first:pt-0"
                      >
                        {line.text.replace(/^\[|\]$/g, '')}
                      </p>
                    ) : (
                      <p
                        key={i}
                        ref={(el) => {
                          lineRefs.current[i] = el;
                        }}
                        className="font-serif text-base leading-relaxed transition-all duration-500 sm:text-lg"
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
            </motion.div>

            <motion.p
              {...entrance(0.7)}
              className="mt-2.5 pb-3 text-center text-xs text-ink/40"
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
