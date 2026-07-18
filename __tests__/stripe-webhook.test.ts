// Unit tests for app/api/webhooks/stripe/route.ts — signature verification,
// event-id idempotency, gift pack credits, song unlock, regen kickoff, and
// the auto-refund when a regen render fails to start.

import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  refundRegenLineItem: vi.fn(),
  stripeEventCreate: vi.fn(),
  songFindUnique: vi.fn(),
  songUpdate: vi.fn(),
  archiveTracks: vi.fn(),
  sendSongReadyEmail: vi.fn(),
  startGeneration: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: () => ({ webhooks: { constructEvent: mocks.constructEvent } }),
  refundRegenLineItem: mocks.refundRegenLineItem,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    stripeEvent: { create: mocks.stripeEventCreate },
    song: { findUnique: mocks.songFindUnique, update: mocks.songUpdate },
  },
}));

vi.mock('@/lib/storage', () => ({ archiveTracks: mocks.archiveTracks }));
vi.mock('@/lib/email', () => ({ sendSongReadyEmail: mocks.sendSongReadyEmail }));
vi.mock('@/lib/suno', () => ({ startGeneration: mocks.startGeneration }));

import { POST } from '@/app/api/webhooks/stripe/route';

function post(withSignature = true): Promise<Response> {
  const req = new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body: '{}',
    headers: withSignature ? { 'stripe-signature': 'sig_1' } : {},
  });
  return POST(req as unknown as NextRequest);
}

interface SessionOverrides {
  metadata?: Record<string, string>;
  customer_details?: { email: string | null };
  amount_total?: number;
}

function songEvent(overrides: SessionOverrides = {}) {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        amount_total: 2000,
        metadata: { type: 'song', songId: 'song_1' },
        customer_details: { email: 'Buyer@Example.com' },
        ...overrides,
      },
    },
  };
}

const baseSong = {
  id: 'song_1',
  status: 'preview',
  email: 'buyer@example.com',
  recipientName: 'Mia',
  occasion: 'birthday',
  lyrics: 'la la la',
  selectedTrackId: 'trk_a',
  styleInputs: { genre: 'pop' },
  upsells: { songLength: 2, keepEveryVersion: false },
  tracks: [
    { sunoTrackId: 'trk_a', audioUrl: 'https://a', genre: 'pop', kind: 'original', unlocked: false },
    { sunoTrackId: 'trk_b', audioUrl: 'https://b', genre: 'pop', kind: 'original', unlocked: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  mocks.constructEvent.mockReturnValue(songEvent());
  mocks.stripeEventCreate.mockResolvedValue({ id: 'evt_1' });
  // Deep-clone: the route mutates song.upsells in place, so a shared fixture
  // would leak state between tests.
  mocks.songFindUnique.mockImplementation(async () => structuredClone(baseSong));
  mocks.songUpdate.mockResolvedValue({});
  mocks.archiveTracks.mockImplementation(async (_id, tracks) => tracks);
  mocks.sendSongReadyEmail.mockResolvedValue(undefined);
  mocks.refundRegenLineItem.mockResolvedValue(undefined);
});

describe('signature verification', () => {
  it('400 when the signature header is missing', async () => {
    const res = await post(false);
    expect(res.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it('400 when the webhook secret is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await post();
    expect(res.status).toBe(400);
  });

  it('400 when signature verification fails', async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = await post();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid signature.');
  });
});

describe('idempotency and irrelevant events', () => {
  it('acknowledges non-checkout events without processing', async () => {
    mocks.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      data: { object: {} },
    });
    const res = await post();
    expect(res.status).toBe(200);
    expect(mocks.stripeEventCreate).not.toHaveBeenCalled();
    expect(mocks.songUpdate).not.toHaveBeenCalled();
  });

  it('acknowledges a replayed event id without reprocessing', async () => {
    mocks.stripeEventCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );
    const res = await post();
    expect(res.status).toBe(200);
    expect(mocks.songUpdate).not.toHaveBeenCalled();
  });

  it('skips a song that is already paid', async () => {
    mocks.songFindUnique.mockResolvedValue({ ...baseSong, status: 'paid' });
    const res = await post();
    expect(res.status).toBe(200);
    expect(mocks.songUpdate).not.toHaveBeenCalled();
  });

  it('acknowledges when the song no longer exists', async () => {
    mocks.songFindUnique.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(200);
    expect(mocks.songUpdate).not.toHaveBeenCalled();
  });
});

describe('gift pack purchase', () => {
  it('increments gift credits by the pack size', async () => {
    mocks.constructEvent.mockReturnValue(
      songEvent({ metadata: { type: 'gift_pack', songId: 'song_1', credits: '3' } })
    );
    const res = await post();
    expect(res.status).toBe(200);
    expect(mocks.songUpdate).toHaveBeenCalledWith({
      where: { id: 'song_1' },
      data: { giftCredits: { increment: 3 } },
    });
    expect(mocks.archiveTracks).not.toHaveBeenCalled();
  });

  it('ignores a gift pack event with zero credits', async () => {
    mocks.constructEvent.mockReturnValue(
      songEvent({ metadata: { type: 'gift_pack', songId: 'song_1' } })
    );
    const res = await post();
    expect(res.status).toBe(200);
    expect(mocks.songUpdate).not.toHaveBeenCalled();
  });
});

describe('song purchase', () => {
  it('marks the song done, unlocks only the selected track, sends email', async () => {
    const res = await post();
    expect(res.status).toBe(200);

    const update = mocks.songUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'song_1' });
    expect(update.data.status).toBe('done');
    expect(update.data.amountPaid).toBe(2000);
    expect(
      update.data.tracks.map((t: { unlocked: boolean }) => t.unlocked)
    ).toEqual([true, false]);

    expect(mocks.startGeneration).not.toHaveBeenCalled();
    expect(mocks.sendSongReadyEmail).toHaveBeenCalledOnce();
    expect(mocks.sendSongReadyEmail.mock.calls[0][0].to).toEqual([
      'buyer@example.com',
    ]);
  });

  it('unlocks every track when Keep Every Version was bought', async () => {
    mocks.songFindUnique.mockResolvedValue(structuredClone({
      ...baseSong,
      upsells: { songLength: 2, keepEveryVersion: true },
    }));
    await post();

    const update = mocks.songUpdate.mock.calls[0][0];
    expect(
      update.data.tracks.every((t: { unlocked: boolean }) => t.unlocked)
    ).toBe(true);
  });

  it('stores stripeEmail and emails both addresses on a mismatch', async () => {
    mocks.constructEvent.mockReturnValue(
      songEvent({ customer_details: { email: 'Other@Example.com' } })
    );
    await post();

    const update = mocks.songUpdate.mock.calls[0][0];
    expect(update.data.stripeEmail).toBe('other@example.com');
    expect(mocks.sendSongReadyEmail.mock.calls[0][0].to).toEqual([
      'buyer@example.com',
      'other@example.com',
    ]);
  });

  it('does not 500 when the song-ready email fails', async () => {
    mocks.sendSongReadyEmail.mockRejectedValue(new Error('resend down'));
    const res = await post();
    expect(res.status).toBe(200);
  });
});

describe('regen purchase', () => {
  const regenSong = {
    ...baseSong,
    upsells: { songLength: 2, keepEveryVersion: false, regenGenre: 'jazz' },
  };

  it('starts the regen render and keeps the song at paid', async () => {
    mocks.songFindUnique.mockResolvedValue(structuredClone(regenSong));
    mocks.startGeneration.mockResolvedValue('task_1');
    const res = await post();
    expect(res.status).toBe(200);

    expect(mocks.startGeneration).toHaveBeenCalledWith({
      lyrics: 'la la la',
      style: expect.objectContaining({ genre: 'jazz' }),
      title: 'A song for Mia',
    });

    const update = mocks.songUpdate.mock.calls[0][0];
    expect(update.data.status).toBe('paid');
    expect(update.data.sunoTaskId).toBe('task_1');
    expect(update.data.upsells.regenPending).toBe(true);
    // No song-ready email until the regen resolves.
    expect(mocks.sendSongReadyEmail).not.toHaveBeenCalled();
  });

  it('auto-refunds the regen line item when the render fails to start', async () => {
    mocks.songFindUnique.mockResolvedValue(structuredClone(regenSong));
    mocks.startGeneration.mockRejectedValue(new Error('suno down'));
    const res = await post();
    expect(res.status).toBe(200);

    expect(mocks.refundRegenLineItem).toHaveBeenCalledWith('song_1', 'cs_1');

    const update = mocks.songUpdate.mock.calls[0][0];
    expect(update.data.status).toBe('done');
    expect(update.data.upsells.regenRefunded).toBe(true);
    expect(update.data.upsells.regenPending).toBeUndefined();
  });

  it('does not refund twice when the regen was already refunded', async () => {
    mocks.songFindUnique.mockResolvedValue(structuredClone({
      ...regenSong,
      upsells: { ...regenSong.upsells, regenRefunded: true },
    }));
    mocks.startGeneration.mockRejectedValue(new Error('suno down'));
    await post();
    expect(mocks.refundRegenLineItem).not.toHaveBeenCalled();
  });
});
