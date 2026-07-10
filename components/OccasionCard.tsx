'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Occasion } from '@/types';

// One WebGL context per mounted MeshGradient — mount only while in view,
// animate only on hover/focus. Static CSS gradient fallback for
// mobile / prefers-reduced-motion / no WebGL.
let webglSupport: boolean | null = null;

function checkMotionEligible(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.matchMedia('(hover: none)').matches) return false; // mobile
  return true;
}

function checkMeshEligible(): boolean {
  if (!checkMotionEligible()) return false;
  if (webglSupport === null) {
    const canvas = document.createElement('canvas');
    webglSupport = !!(
      canvas.getContext('webgl2') || canvas.getContext('webgl')
    );
  }
  return webglSupport;
}

export default function OccasionCard({ occasion }: { occasion: Occasion }) {
  const { slug, name, description, theme } = occasion;
  const ref = useRef<HTMLAnchorElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [meshEligible, setMeshEligible] = useState(false);
  const [videoEligible, setVideoEligible] = useState(false);
  const [inView, setInView] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setMeshEligible(checkMeshEligible());
    setVideoEligible(checkMotionEligible());
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Video downloads nothing until hovered (preload="none" + play on hover);
  // pauses on leave and offscreen
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (inView && active) video.play().catch(() => {});
    else video.pause();
  }, [inView, active, videoEligible]);

  const [c0, c1, c2, c3] = theme.colors;
  const fallbackGradient = {
    backgroundColor: c0,
    backgroundImage: `radial-gradient(at 20% 25%, ${c1} 0%, transparent 55%), radial-gradient(at 80% 30%, ${c2} 0%, transparent 55%), radial-gradient(at 50% 90%, ${c3} 0%, transparent 60%)`,
  };

  return (
    <Link
      ref={ref}
      href={`/create/${slug}`}
      className="group relative block overflow-hidden rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      <div aria-hidden className="absolute inset-0" style={fallbackGradient} />
      {!occasion.videoUrl && meshEligible && inView && (
        <MeshGradient
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          colors={theme.colors}
          distortion={0.8}
          swirl={0.1}
          grainMixer={0}
          grainOverlay={0}
          speed={active ? 1 : 0}
        />
      )}
      {occasion.videoUrl ? (
        <div className="relative flex flex-col p-3">
          {videoEligible ? (
            <video
              ref={videoRef}
              src={occasion.videoUrl}
              poster={occasion.posterUrl}
              muted
              loop
              playsInline
              preload="none"
              className="aspect-square w-full rounded-lg object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={occasion.posterUrl}
              alt=""
              loading="lazy"
              className="aspect-square w-full rounded-lg object-cover"
            />
          )}
          <div className="flex flex-col p-4 pb-3">
            <h3 className="font-serif text-3xl text-white">{name}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/80">
              {description}
            </p>
            <span className="mt-4 text-sm font-medium text-white/90 transition-transform duration-300 group-hover:translate-x-1">
              Create their song &rarr;
            </span>
          </div>
        </div>
      ) : (
        <div className="relative m-3 flex min-h-44 flex-col justify-end rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
          <h3 className="font-serif text-3xl text-white">{name}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">
            {description}
          </p>
          <span className="mt-4 text-sm font-medium text-white/90 transition-transform duration-300 group-hover:translate-x-1">
            Create their song &rarr;
          </span>
        </div>
      )}
    </Link>
  );
}
