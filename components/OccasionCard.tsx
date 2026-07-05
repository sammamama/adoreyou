'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Occasion } from '@/types';

// One WebGL context per mounted MeshGradient — mount only while in view,
// animate only on hover/focus. Static CSS gradient fallback for
// mobile / prefers-reduced-motion / no WebGL.
let webglSupport: boolean | null = null;

function checkMeshEligible(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.matchMedia('(hover: none)').matches) return false; // mobile
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
  const [meshEligible, setMeshEligible] = useState(false);
  const [inView, setInView] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setMeshEligible(checkMeshEligible());
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
      {meshEligible && inView && (
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
      <div className="relative m-3 flex min-h-44 flex-col justify-end rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
        <h3 className="font-serif text-3xl text-white">{name}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/80">
          {description}
        </p>
        <span className="mt-4 text-sm font-medium text-white/90 transition-transform duration-300 group-hover:translate-x-1">
          Create their song &rarr;
        </span>
      </div>
    </Link>
  );
}
