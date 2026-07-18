// Stripe client + checkout session builders (decision #2 — per-song pricing,
// single session for base + all upsells; decision #15 — gift credit packs).
// All prices in USD cents. The server is the price authority — clients only
// display these numbers, never send them. Checkout sessions enable Stripe
// Adaptive Pricing: buyers see and pay in their local currency, we settle
// in USD.

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
  base: 2000,
  length: { 2: 0, 3: 999, 4: 1299 } as Record<2 | 3 | 4, number>,
  keepEveryVersion: 599,
  regen: 1299,
} as const;

export const GIFT_PACKS: Record<string, { credits: number; amount: number }> = {
  '1': { credits: 1, amount: 199 },
  '3': { credits: 3, amount: 399 },
  '10': { credits: 10, amount: 999 },
};

export interface SongCheckoutInput {
  songId: string;
  email: string;
  recipientName: string;
  verseCount: 2 | 3 | 4;
  keepEveryVersion: boolean;
  regenGenre?: string;
  selectedTrackIndex: number;
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
  selectedTrackIndex,
}: SongCheckoutInput): Promise<Stripe.Checkout.Session> {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: 'usd',
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
        currency: 'usd',
        unit_amount: PRICES.length[verseCount],
        product_data: { name: `${verseCount}-verse song` },
      },
      quantity: 1,
    });
  }

  if (keepEveryVersion) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        unit_amount: PRICES.keepEveryVersion,
        product_data: { name: 'Keep Every Version' },
      },
      quantity: 1,
    });
  }

  if (regenGenre) {
    lineItems.push({
      price_data: {
        currency: 'usd',
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
    // Promo code box on the checkout page — used for 100%-off gift codes.
    allow_promotion_codes: true,
    // Buyers see and pay in their local currency (Stripe converts from USD).
    adaptive_pricing: { enabled: true },
    metadata: { type: 'song', songId },
    success_url: `${appUrl()}/song/${songId}?session_id={CHECKOUT_SESSION_ID}`,
    // songId + track ride along so the checkout page can restore the order
    // even if the local draft was lost or clobbered while the user was away.
    cancel_url: `${appUrl()}/create/checkout?canceled=1&songId=${songId}&track=${selectedTrackIndex}`,
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
          currency: 'usd',
          unit_amount: amount,
          product_data: {
            name: `${credits} gift ${credits === 1 ? 'credit' : 'credits'}`,
            description: 'Each credit creates a personalized gift page',
          },
        },
        quantity: 1,
      },
    ],
    // Buyers see and pay in their local currency (Stripe converts from USD).
    adaptive_pricing: { enabled: true },
    metadata: { type: 'gift_pack', songId, credits: String(credits) },
    success_url: `${appUrl()}/song/${songId}`,
    cancel_url: `${appUrl()}/song/${songId}`,
  });
}

// Auto-refund the regen line item when the regen render fails (decision #6).
// The refund amount is read from the session's own line items — with
// Adaptive Pricing the charge settles in the buyer's currency, so a fixed
// USD amount would refund the wrong number. The idempotency key guards
// double-refunds even if callers race — Stripe dedupes server-side.
export async function refundRegenLineItem(
  songId: string,
  sessionId: string
): Promise<void> {
  const s = stripe();
  const session = await s.checkout.sessions.retrieve(sessionId);
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) {
    throw new Error(`session ${sessionId} has no payment intent to refund`);
  }

  const items = await s.checkout.sessions.listLineItems(sessionId, {
    limit: 100,
  });
  const regen = items.data.find((i) =>
    i.description?.startsWith('Regenerate in a New Genre')
  );
  if (!regen) {
    throw new Error(`session ${sessionId} has no regen line item to refund`);
  }

  await s.refunds.create(
    { payment_intent: paymentIntentId, amount: regen.amount_total },
    { idempotencyKey: `refund-regen-${songId}` }
  );
}
