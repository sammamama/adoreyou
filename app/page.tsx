// Server wrapper for the homepage: owns the canonical URL and JSON-LD
// structured data (Organization + Product). All UI lives in HomeClient.

import type { Metadata } from 'next';
import HomeClient from '@/components/HomeClient';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AdoreYou',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'AdoreYou custom song',
    description:
      'An original, one-of-a-kind song made from your memories — a personalized gift for birthdays, weddings, anniversaries, and more.',
    brand: { '@type': 'Brand', name: 'AdoreYou' },
    image: `${baseUrl}/logo.png`,
    offers: {
      '@type': 'Offer',
      price: '20',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: baseUrl,
    },
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  );
}
