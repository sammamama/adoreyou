import type { Metadata } from 'next';
import HowItWorks from '@/components/HowItWorks';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'How it works — AdoreYou',
  description:
    'Pick the occasion, share your memories, hear it sung, gift the reveal — how AdoreYou turns your stories into an original song.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorksPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pt-28 sm:pt-32">
        <HowItWorks />
      </main>
    </div>
  );
}
