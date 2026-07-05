// Step 9 — recipient gift page (public, protected by that gift's 4-digit
// code). All the theater lives in GiftReveal. Metadata is occasion-themed so
// the link preview in WhatsApp/iMessage already feels like a gift — names +
// occasion only, nothing the public GET doesn't already expose.

import type { Metadata } from 'next';
import GiftReveal from '@/components/GiftReveal';
import { getGiftMeta } from './gift-meta';

type Props = { params: Promise<{ giftId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { giftId } = await params;
  const gift = await getGiftMeta(giftId);

  if (!gift) {
    return {
      title: 'Someone made you a song — AdoreYou',
      description:
        'A one-of-a-kind song, made just for you. Enter your code to open it.',
    };
  }

  const title = `${gift.senderName} made you a song — AdoreYou`;
  const description =
    gift.occasion?.slug === 'memorial'
      ? `A song made in loving memory — from ${gift.senderName}, just for you. Enter your code to open it.`
      : gift.occasion
        ? `An original ${gift.occasion.name} song from ${gift.senderName}, made just for you. Enter your code to open it.`
        : `A one-of-a-kind song from ${gift.senderName}, made just for you. Enter your code to open it.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function GiftPage({ params }: Props) {
  const { giftId } = await params;
  return <GiftReveal giftId={giftId} />;
}
