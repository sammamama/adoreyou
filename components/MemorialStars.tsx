'use client';

// Memorial gift page starfield — react-three-fiber + drei Stars on a fixed
// fullscreen transparent canvas over the black page. Slow drift + built-in
// twinkle (fade); somber by design, no burst. Loaded via next/dynamic
// (ssr: false) from GiftReveal — three is client-only and heavy.

import { Stars } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';

function DriftingStars() {
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.015;
    ref.current.rotation.x += delta * 0.005;
  });

  return (
    <group ref={ref}>
      <Stars
        radius={80}
        depth={50}
        count={4000}
        factor={4}
        saturation={0}
        fade
        speed={0.6}
      />
    </group>
  );
}

export default function MemorialStars() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-10">
      <Canvas camera={{ position: [0, 0, 1] }} gl={{ alpha: true }}>
        <DriftingStars />
      </Canvas>
    </div>
  );
}
