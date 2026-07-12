import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import PricingSection from '@/components/PricingSection';

export const metadata: Metadata = {
  title: 'Pricing — AdoreYou',
  description:
    'One song, one price — $20 USD, shown in your local currency at checkout. Pay once, keep it forever. No subscriptions.',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pt-28 sm:pt-32">
        <PricingSection />
      </main>
    </div>
  );
}
