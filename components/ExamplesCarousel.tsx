'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const CDN =
  'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S';

const EXAMPLES = [
  {
    occasion: "Mother's Day",
    story:
      'Maya turned her mum’s voicemails — "call me when you land" — into a chorus. Her mum made her play it four times over Sunday breakfast.',
    videoUrl: `${CDN}/hf_20260708_141322_9437150d-3e91-4c1c-ba74-9885b8b6d96a.mp4`,
    posterUrl: `${CDN}/hf_20260708_141239_332c213d-5803-4d5a-97fc-acca4d03cdee_min.webp`,
  },
  {
    occasion: 'Birthday',
    story:
      'Sam hid twenty years of inside jokes in a birthday song for Priya. She caught every single one by the second verse.',
    videoUrl: `${CDN}/hf_20260708_141600_59d12964-b43d-4064-9bbb-c015f69f7c38.mp4`,
    posterUrl: `${CDN}/hf_20260708_141520_8372a957-0f07-4c20-a0df-aa1c4d1031e8_min.webp`,
  },
  {
    occasion: 'Wedding',
    story:
      'Daniel wrote a song from the story of how they met, then played it as the first dance. Nobody’s mascara survived.',
    videoUrl: `${CDN}/hf_20260708_141834_2a676994-3f8c-42cd-a8c6-baac0118b959.mp4`,
    posterUrl: `${CDN}/hf_20260708_141752_9810cadb-d67d-4078-8eb8-b4f296a78667_min.webp`,
  },
  {
    occasion: 'Anniversary',
    story:
      'Carl made a song retelling the night he first asked Jen out. Forty years later, she still said yes to a dance.',
    videoUrl: `${CDN}/hf_20260708_142243_aea17fd0-5c54-4916-8838-8fa8ccd153fa.mp4`,
    posterUrl: `${CDN}/hf_20260708_142029_62174a52-840b-4155-9fb2-828cfd9b97dd_min.webp`,
  },
  {
    occasion: "Father's Day",
    story:
      'Leo put his dad’s worst dad jokes into a country song. Dad laughed, went quiet, then played it in the truck for a month.',
    videoUrl: `${CDN}/hf_20260708_142544_fffc1983-e2fe-43d7-9f0d-262a01e55d2f.mp4`,
    posterUrl: `${CDN}/hf_20260708_142503_cdafc251-70b8-4963-bb99-ab7b9bcddd5a_min.webp`,
  },
  {
    occasion: 'Friendship',
    story:
      'Ten years and three cities apart, Ana sent Rosa a song made from their old group-chat jokes. Rosa replied with a plane ticket.',
    videoUrl: `${CDN}/hf_20260708_142840_ee9af0f5-0f3a-46d5-a2d8-7158462644dc.mp4`,
    posterUrl: `${CDN}/hf_20260708_142800_7fc5b8cd-78ec-4a57-adb9-3f0b88b26e02_min.webp`,
  },
];

// Each example appears twice on the ring; angle and radius derive from the
// panel count so the ring always closes into a full seamless 360 circle,
// regardless of how many examples exist.
const PANELS = [...EXAMPLES, ...EXAMPLES];
const PANEL_ANGLE = 360 / PANELS.length;
// r = (w + gap) / (2 * tan(180deg / N)) — adjacent panels sit one gap apart
const RING_MULTIPLIER = 1 / (2 * Math.tan(Math.PI / PANELS.length));

const HOVER_PLAY_DELAY_MS = 100;

function SoundBadge({ on }: { on: boolean }) {
  return (
    <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {on ? (
          <>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        ) : (
          <>
            <line x1="22" x2="16" y1="9" y2="15" />
            <line x1="16" x2="22" y1="9" y2="15" />
          </>
        )}
      </svg>
    </span>
  );
}

function Panel({
  example,
  style,
  playing,
  onActivate,
  onDeactivate,
}: {
  example: (typeof EXAMPLES)[number];
  style: React.CSSProperties;
  playing: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const [touch, setTouch] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setTouch(window.matchMedia('(hover: none)').matches);
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  // Try unmuted playback; browsers block audio before any page gesture, so
  // fall back to muted with a badge — a click (gesture) unmutes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.muted = false;
      setMuted(false);
      video.play().catch(() => {
        video.muted = true;
        setMuted(true);
        video.play().catch(() => {});
      });
    } else {
      video.pause();
    }
  }, [playing]);

  const handleMouseEnter = () => {
    if (touch) return;
    hoverTimer.current = window.setTimeout(onActivate, HOVER_PLAY_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (touch) return;
    onDeactivate();
  };

  // Click is a real gesture: toggles playback on touch; on desktop it starts
  // playback immediately or unmutes a policy-muted video
  const handleClick = () => {
    if (!playing) {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      onActivate();
      return;
    }
    if (touch) {
      onDeactivate();
      return;
    }
    const video = videoRef.current;
    if (video && muted) {
      video.muted = false;
      setMuted(false);
    }
  };

  return (
    <div
      className="ring-panel group cursor-pointer"
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <video
        ref={videoRef}
        src={example.videoUrl}
        poster={example.posterUrl}
        muted
        loop
        playsInline
        preload="none"
        className="h-full w-full object-cover"
      />
      {/* Hover overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black/15 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      {/* Occasion name (always) + story (slides up on hover) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3.5 text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
        <h3 className="font-serif text-xl">{example.occasion}</h3>
        <p className="mt-1 max-h-0 translate-y-3 overflow-hidden text-xs leading-relaxed text-white/90 opacity-0 transition-all duration-300 ease-out group-hover:max-h-32 group-hover:translate-y-0 group-hover:opacity-100">
          {example.story}
        </p>
      </div>
      <SoundBadge on={playing && !muted} />
    </div>
  );
}

export default function ExamplesCarousel() {
  const reduced = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Stop playback when the ring scrolls offscreen
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setActiveIndex(null);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const entrance = {
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, ease, delay: 0.07 },
  };

  return (
    <motion.div
      {...entrance}
      className="relative left-1/2 my-10 w-screen -translate-x-1/2 overflow-hidden sm:my-12"
    >
      <div
        ref={sceneRef}
        className={`ring-scene${activeIndex !== null ? ' ring-paused' : ''}`}
        style={{ '--ring-mult': RING_MULTIPLIER } as React.CSSProperties}
      >
        <div className="ring-track">
          {PANELS.map((example, i) => (
            <Panel
              key={`${example.occasion}-${i}`}
              example={example}
              style={{
                transform: `rotateY(${i * PANEL_ANGLE}deg) translateZ(var(--ring-r))`,
              }}
              playing={activeIndex === i}
              onActivate={() => setActiveIndex(i)}
              onDeactivate={() =>
                setActiveIndex((current) => (current === i ? null : current))
              }
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
