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
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: "What's a good gift for a friend?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: "A custom song made from your memories together is a personal, one-of-a-kind gift for a friend. AdoreYou turns your shared stories into an original song for $20 — something they can't get anywhere else.",
        },
      },
      {
        '@type': 'Question',
        name: 'What is the best birthday gift?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'An original song written about the person is a memorable birthday gift. AdoreYou creates a one-of-a-kind birthday song from your memories, ready to replay every year, starting at $20.',
        },
      },
      {
        '@type': 'Question',
        name: "What should I get for Mother's Day?",
        acceptedAnswer: {
          '@type': 'Answer',
          text: "A song made just for her is a Mother's Day gift she won't have heard before. AdoreYou turns your memories into an original song for $20 — a keepsake, not just a card.",
        },
      },
    ],
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
