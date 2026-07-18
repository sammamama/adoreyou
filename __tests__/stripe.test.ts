// Unit tests for lib/stripe.ts — checkout session builders and the regen
// auto-refund. The `stripe` npm module is mocked; assertions run against the
// params our code sends to Stripe.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  sessionsRetrieve: vi.fn(),
  listLineItems: vi.fn(),
  refundsCreate: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: class MockStripe {
    checkout = {
      sessions: {
        create: mocks.sessionsCreate,
        retrieve: mocks.sessionsRetrieve,
        listLineItems: mocks.listLineItems,
      },
    };
    refunds = { create: mocks.refundsCreate };
  },
}));

async function loadLib() {
  return await import('@/lib/stripe');
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.NEXT_PUBLIC_APP_URL = 'https://adoreyou.app/';
  mocks.sessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://stripe/cs_1' });
});

describe('stripe()', () => {
  it('throws when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { stripe } = await loadLib();
    expect(() => stripe()).toThrow('STRIPE_SECRET_KEY is not set.');
  });
});

describe('createSongCheckoutSession', () => {
  it('base song only: single line item at base price', async () => {
    const { createSongCheckoutSession, PRICES } = await loadLib();
    await createSongCheckoutSession({
      songId: 'song_1',
      email: 'buyer@example.com',
      recipientName: 'Mia',
      verseCount: 2,
      keepEveryVersion: false,
      selectedTrackIndex: 0,
    });

    const params = mocks.sessionsCreate.mock.calls[0][0];
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items[0].price_data.unit_amount).toBe(PRICES.base);
    expect(params.mode).toBe('payment');
    expect(params.customer_email).toBe('buyer@example.com');
    expect(params.allow_promotion_codes).toBe(true);
    expect(params.metadata).toEqual({ type: 'song', songId: 'song_1' });
  });

  it('adds a line item per upsell with the server-side price', async () => {
    const { createSongCheckoutSession, PRICES } = await loadLib();
    await createSongCheckoutSession({
      songId: 'song_1',
      email: 'buyer@example.com',
      recipientName: 'Mia',
      verseCount: 4,
      keepEveryVersion: true,
      regenGenre: 'jazz',
      selectedTrackIndex: 0,
    });

    const items = mocks.sessionsCreate.mock.calls[0][0].line_items;
    const amounts = items.map(
      (i: { price_data: { unit_amount: number } }) => i.price_data.unit_amount
    );
    expect(amounts).toEqual([
      PRICES.base,
      PRICES.length[4],
      PRICES.keepEveryVersion,
      PRICES.regen,
    ]);
    expect(items[3].price_data.product_data.name).toBe(
      'Regenerate in a New Genre (jazz)'
    );
  });

  it('3-verse upsell uses the 3-verse price', async () => {
    const { createSongCheckoutSession, PRICES } = await loadLib();
    await createSongCheckoutSession({
      songId: 'song_1',
      email: 'buyer@example.com',
      recipientName: 'Mia',
      verseCount: 3,
      keepEveryVersion: false,
      selectedTrackIndex: 0,
    });

    const items = mocks.sessionsCreate.mock.calls[0][0].line_items;
    expect(items).toHaveLength(2);
    expect(items[1].price_data.unit_amount).toBe(PRICES.length[3]);
  });

  it('success/cancel URLs point at the app with no trailing slash', async () => {
    const { createSongCheckoutSession } = await loadLib();
    await createSongCheckoutSession({
      songId: 'song_1',
      email: 'buyer@example.com',
      recipientName: 'Mia',
      verseCount: 2,
      keepEveryVersion: false,
      selectedTrackIndex: 1,
    });

    const params = mocks.sessionsCreate.mock.calls[0][0];
    expect(params.success_url).toBe(
      'https://adoreyou.app/song/song_1?session_id={CHECKOUT_SESSION_ID}'
    );
    expect(params.cancel_url).toBe(
      'https://adoreyou.app/create/checkout?canceled=1&songId=song_1&track=1'
    );
  });
});

describe('createGiftPackSession', () => {
  it('uses the pack price and encodes credits in metadata', async () => {
    const { createGiftPackSession, GIFT_PACKS } = await loadLib();
    await createGiftPackSession('song_1', '3');

    const params = mocks.sessionsCreate.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(GIFT_PACKS['3'].amount);
    expect(params.metadata).toEqual({
      type: 'gift_pack',
      songId: 'song_1',
      credits: '3',
    });
  });

  it('singular product name for the 1-credit pack', async () => {
    const { createGiftPackSession } = await loadLib();
    await createGiftPackSession('song_1', '1');

    const params = mocks.sessionsCreate.mock.calls[0][0];
    expect(params.line_items[0].price_data.product_data.name).toBe('1 gift credit');
  });
});

describe('refundRegenLineItem', () => {
  it('refunds the regen line item amount with an idempotency key', async () => {
    mocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_1',
      payment_intent: 'pi_1',
    });
    mocks.listLineItems.mockResolvedValue({
      data: [
        { description: 'A song for Mia', amount_total: 2000 },
        { description: 'Regenerate in a New Genre (jazz)', amount_total: 1299 },
      ],
    });

    const { refundRegenLineItem } = await loadLib();
    await refundRegenLineItem('song_1', 'cs_1');

    expect(mocks.refundsCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_1', amount: 1299 },
      { idempotencyKey: 'refund-regen-song_1' }
    );
  });

  it('resolves an expanded payment_intent object to its id', async () => {
    mocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_1',
      payment_intent: { id: 'pi_2' },
    });
    mocks.listLineItems.mockResolvedValue({
      data: [{ description: 'Regenerate in a New Genre (pop)', amount_total: 1299 }],
    });

    const { refundRegenLineItem } = await loadLib();
    await refundRegenLineItem('song_1', 'cs_1');

    expect(mocks.refundsCreate.mock.calls[0][0].payment_intent).toBe('pi_2');
  });

  it('throws when the session has no payment intent', async () => {
    mocks.sessionsRetrieve.mockResolvedValue({ id: 'cs_1', payment_intent: null });

    const { refundRegenLineItem } = await loadLib();
    await expect(refundRegenLineItem('song_1', 'cs_1')).rejects.toThrow(
      'no payment intent to refund'
    );
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });

  it('throws when the session has no regen line item', async () => {
    mocks.sessionsRetrieve.mockResolvedValue({ id: 'cs_1', payment_intent: 'pi_1' });
    mocks.listLineItems.mockResolvedValue({
      data: [{ description: 'A song for Mia', amount_total: 2000 }],
    });

    const { refundRegenLineItem } = await loadLib();
    await expect(refundRegenLineItem('song_1', 'cs_1')).rejects.toThrow(
      'no regen line item to refund'
    );
    expect(mocks.refundsCreate).not.toHaveBeenCalled();
  });
});
