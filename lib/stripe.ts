// Stripe client + checkout session builders (decision #2 — per-song pricing,
// single session for base + all upsells; decision #15 — gift credit packs).
// All prices in AUD cents. The server is the price authority — clients only
// display these numbers, never send them.

import Stripe from 'stripe';

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set.');
    client = new Stripe(key);
  }
  return client;
}

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL is not set.');
  return url.replace(/\/$/, '');
}

export const PRICES = {
  base: 2999,
  length: { 2: 0, 3: 1499, 4: 2000 } as Record<2 | 3 | 4, number>,
  keepEveryVersion: 899,
  regen: 2000,
} as const;

export const GIFT_PACKS: Record<string, { credits: number; amount: number }> = {
  '1': { credits: 1, amount: 300 },
  '3': { credits: 3, amount: 500 },
  '10': { credits: 10, amount: 1500 },
};

export interface SongCheckoutInput {
  songId: string;
  email: string;
  recipientName: string;
  verseCount: 2 | 3 | 4;
  keepEveryVersion: boolean;
  regenGenre?: string;
}

// One Stripe Checkout session for the song: base + selected upsells as
// separate line items so a failed regen can be refunded by its exact amount.
export async function createSongCheckoutSession({
  songId,
  email,
  recipientName,
  verseCount,
  keepEveryVersion,
  regenGenre,
}: SongCheckoutInput): Promise<Stripe.Checkout.Session> {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: 'aud',
        unit_amount: PRICES.base,
        product_data: {
          name: `A song for ${recipientName}`,
          description: 'One-of-a-kind personalized song',
        },
      },
      quantity: 1,
    },
  ];

  if (verseCount !== 2) {
    lineItems.push({
      price_data: {
        currency: 'aud',
        unit_amount: PRICES.length[verseCount],
        product_data: { name: `${verseCount}-verse song` },
      },
      quantity: 1,
    });
  }

  if (keepEveryVersion) {
    lineItems.push({
      price_data: {
        currency: 'aud',
        unit_amount: PRICES.keepEveryVersion,
        product_data: { name: 'Keep Every Version' },
      },
      quantity: 1,
    });
  }

  if (regenGenre) {
    lineItems.push({
      price_data: {
        currency: 'aud',
        unit_amount: PRICES.regen,
        product_data: { name: `Regenerate in a New Genre (${regenGenre})` },
      },
      quantity: 1,
    });
  }

  return stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    line_items: lineItems,
    metadata: { type: 'song', songId },
    success_url: `${appUrl()}/song/${songId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/create/checkout?canceled=1`,
  });
}

// Gift credit pack session (decision #15) — bought post-purchase from the
// Song Ready page or dashboard.
export async function createGiftPackSession(
  songId: string,
  pack: keyof typeof GIFT_PACKS
): Promise<Stripe.Checkout.Session> {
  const { credits, amount } = GIFT_PACKS[pack];

  return stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'aud',
          unit_amount: amount,
          product_data: {
            name: `${credits} gift ${credits === 1 ? 'credit' : 'credits'}`,
            description: 'Each credit creates a personalized gift page',
          },
        },
        quantity: 1,
      },
    ],
    metadata: { type: 'gift_pack', songId, credits: String(credits) },
    success_url: `${appUrl()}/song/${songId}`,
    cancel_url: `${appUrl()}/song/${songId}`,
  });
}

// Auto-refund the regen line item when the regen render fails (decision #6).
// The idempotency key guards double-refunds even if callers race — Stripe
// dedupes the refund server-side.
export async function refundRegenLineItem(
  songId: string,
  paymentIntentId: string
): Promise<void> {
  await stripe().refunds.create(
    { payment_intent: paymentIntentId, amount: PRICES.regen },
    { idempotencyKey: `refund-regen-${songId}` }
  );
}

// Resolve a session's payment intent id — needed when refunding from the
// polling route, where only stripeSessionId is stored on the song row.
export async function getPaymentIntentId(
  sessionId: string
): Promise<string | null> {
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
}
