// Shared gift lookup for the gift page's generateMetadata + OG image —
// occasion + names only, the same public surface as GET /api/gifts/[giftId].
// React cache dedupes the query when both run for one request. Any failure
// (bad id, DB down) → null, and callers fall back to generic branding.

import { cache } from 'react';
import { prisma } from '@/lib/db';
import { getOccasion } from '@/lib/occasions';
import type { Occasion } from '@/types';

export interface GiftMeta {
  recipientName: string;
  senderName: string;
  occasion: Occasion | undefined;
}

export const getGiftMeta = cache(
  async (giftId: string): Promise<GiftMeta | null> => {
    try {
      const gift = await prisma.gift.findUnique({
        where: { id: giftId },
        include: { song: { select: { recipientName: true, occasion: true } } },
      });
      if (!gift) return null;
      return {
        recipientName: gift.song.recipientName,
        senderName: gift.senderName,
        occasion: getOccasion(gift.song.occasion),
      };
    } catch {
      return null;
    }
  }
);
