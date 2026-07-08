'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const CDN =
  'https://d8j0ntlcm91z4.cloudfront.net/user_2wz19UwQVw85l2M9dxCWfoUPw1S';

const EXAMPLES = [
  {
    occasion: "Mother's Day",
    caption: 'Mum hears her song for the first time.',
    videoUrl: `${CDN}/hf_20260708_141322_9437150d-3e91-4c1c-ba74-9885b8b6d96a.mp4`,
    posterUrl: `${CDN}/hf_20260708_141239_332c213d-5803-4d5a-97fc-acca4d03cdee_min.webp`,
  },
  {
    occasion: 'Birthday',
    caption: 'A song with her name in the chorus.',
    videoUrl: `${CDN}/hf_20260708_141600_59d12964-b43d-4064-9bbb-c015f69f7c38.mp4`,
    posterUrl: `${CDN}/hf_20260708_141520_8372a957-0f07-4c20-a0df-aa1c4d1031e8_min.webp`,
  },
  {
    occasion: 'Wedding',
    caption: 'A surprise song at the reception.',
    videoUrl: `${CDN}/hf_20260708_141834_2a676994-3f8c-42cd-a8c6-baac0118b959.mp4`,
    posterUrl: `${CDN}/hf_20260708_141752_9810cadb-d67d-4078-8eb8-b4f296a78667_min.webp`,
  },
  {
    occasion: 'Anniversary',
    caption: 'Forty years, three minutes.',
    videoUrl: `${CDN}/hf_20260708_142243_aea17fd0-5c54-4916-8838-8fa8ccd153fa.mp4`,
    posterUrl: `${CDN}/hf_20260708_142029_62174a52-840b-4155-9fb2-828cfd9b97dd_min.webp`,
  },
  {
    occasion: "Father's Day",
    caption: 'Dad pretends he’s not crying.',
    videoUrl: `${CDN}/hf_20260708_142544_fffc1983-e2fe-43d7-9f0d-262a01e55d2f.mp4`,
    posterUrl: `${CDN}/hf_20260708_142503_cdafc251-70b8-4963-bb99-ab7b9bcddd5a_min.webp`,
  },
  {
    occasion: 'Friendship',
    caption: 'The inside joke made it into the lyrics.',
    videoUrl: `${CDN}/hf_20260708_142840_ee9af0f5-0f3a-46d5-a2d8-7158462644dc.mp4`,
    posterUrl: `${CDN}/hf_20260708_142800_7fc5b8cd-78ec-4a57-adb9-3f0b88b26e02_min.webp`,
  },
];

function checkMotionEligible(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.matchMedia('(hover: none)').matches) return false; // mobile
  return true;
}

function ExampleCard({
  example,
}: {
  example: (typeof EXAMPLES)[number];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEligible, setVideoEligible] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
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

  // Video downloads nothing until in view (preload="none"), pauses offscreen
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (inView) video.play().catch(() => {});
    else video.pause();
  }, [inView, videoEligible]);

  return (
    <div ref={ref}>
      {videoEligible ? (
        <video
          ref={videoRef}
          src={example.videoUrl}
          poster={example.posterUrl}
          muted
          loop
          playsInline
          preload="none"
          className="aspect-square w-full rounded-2xl object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={example.posterUrl}
          alt=""
          loading="lazy"
          className="aspect-square w-full rounded-2xl object-cover"
        />
      )}
      <h3 className="mt-4 font-serif text-2xl">{example.occasion}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink/60">
        {example.caption}
      </p>
    </div>
  );
}

export default function ExamplesSection() {
  const reduced = useReducedMotion();

  const cardEntrance = (i: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    whileInView: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.6, ease, delay: (i % 3) * 0.07 },
  });

  return (
    <section id="examples" className="pb-24">
      <motion.h2
        {...cardEntrance(0)}
        className="font-serif text-3xl sm:text-4xl"
      >
        What it feels like to <span className="italic text-accent">receive one</span>
      </motion.h2>
      <motion.p
        {...cardEntrance(0)}
        className="mt-3 max-w-xl text-base leading-relaxed text-ink/60"
      >
        Real moments, real reactions &mdash; songs made from memories, landing
        exactly how they should.
      </motion.p>
      <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((example, i) => (
          <motion.div key={example.occasion} {...cardEntrance(i)}>
            <ExampleCard example={example} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
