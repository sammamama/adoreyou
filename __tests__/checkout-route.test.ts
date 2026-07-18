// Unit tests for app/api/checkout/route.ts — validation, gift pack flow, and
// the song purchase flow. Prisma and the Stripe session builders are mocked.

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  createSongCheckoutSession: vi.fn(),
  createGiftPackSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    song: { findUnique: mocks.findUnique, update: mocks.update },
  },
}));

vi.mock('@/lib/stripe', () => ({
  createSongCheckoutSession: mocks.createSongCheckoutSession,
  createGiftPackSession: mocks.createGiftPackSession,
  GIFT_PACKS: {
    '1': { credits: 1, amount: 199 },
    '3': { credits: 3, amount: 399 },
    '10': { credits: 10, amount: 999 },
  },
}));

import { POST } from '@/app/api/checkout/route';

function post(body: unknown): Promise<Response> {
  const req = new Request('http://localhost/api/checkout', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return POST(req as unknown as NextRequest);
}

const previewSong = {
  id: 'song_1',
  status: 'preview',
  recipientName: 'Mia',
  upsells: { songLength: 3, keepEveryVersion: false },
  tracks: [
    { sunoTrackId: 'trk_a', audioUrl: 'https://a', genre: 'pop', kind: 'original', unlocked: false },
    { sunoTrackId: 'trk_b', audioUrl: 'https://b', genre: 'pop', kind: 'original', unlocked: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createSongCheckoutSession.mockResolvedValue({
    id: 'cs_1',
    url: 'https://stripe/cs_1',
  });
  mocks.createGiftPackSession.mockResolvedValue({
    id: 'cs_2',
    url: 'https://stripe/cs_2',
  });
});

describe('POST /api/checkout — validation', () => {
  it('400 on invalid JSON', async () => {
    const res = await post('not json');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body.');
  });

  it('400 when songId is missing', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('songId is required.');
  });

  it('404 when the song does not exist', async () => {
    mocks.findUnique.mockResolvedValue(null);
    const res = await post({ songId: 'nope' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/checkout — gift packs', () => {
  it('400 on unknown pack', async () => {
    mocks.findUnique.mockResolvedValue({ ...previewSong, status: 'done' });
    const res = await post({ songId: 'song_1', giftPack: '99' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Unknown gift pack.');
  });

  it('400 when the song is not yet purchased', async () => {
    mocks.findUnique.mockResolvedValue(previewSong);
    const res = await post({ songId: 'song_1', giftPack: '3' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      'Buy the song before buying gift credits.'
    );
    expect(mocks.createGiftPackSession).not.toHaveBeenCalled();
  });

  it('returns the checkout URL for a paid song', async () => {
    mocks.findUnique.mockResolvedValue({ ...previewSong, status: 'paid' });
    const res = await post({ songId: 'song_1', giftPack: '3' });
    expect(res.status).toBe(200);
    expect((await res.json()).data.url).toBe('https://stripe/cs_2');
    expect(mocks.createGiftPackSession).toHaveBeenCalledWith('song_1', '3');
  });
});

describe('POST /api/checkout — song purchase', () => {
  const validBody = {
    songId: 'song_1',
    email: 'Buyer@Example.com ',
    selectedTrackIndex: 1,
  };

  it('400 when the song is already paid', async () => {
    mocks.findUnique.mockResolvedValue({ ...previewSong, status: 'paid' });
    const res = await post(validBody);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('This song is already paid for.');
  });

  it('400 while the song is still rendering', async () => {
    mocks.findUnique.mockResolvedValue({ ...previewSong, status: 'rendering' });
    const res = await post(validBody);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('still rendering');
  });

  it('400 on a missing or malformed email', async () => {
    mocks.findUnique.mockResolvedValue(previewSong);
    for (const email of [undefined, '', 'not-an-email', 'a@b']) {
      const res = await post({ ...validBody, email });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('A valid email is required.');
    }
  });

  it('400 when no track is selected', async () => {
    mocks.findUnique.mockResolvedValue(previewSong);
    const res = await post({ ...validBody, selectedTrackIndex: undefined });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Pick your favorite version first.');
  });

  it('creates the session and stores email, track, upsells, session id', async () => {
    mocks.findUnique.mockResolvedValue(previewSong);
    const res = await post({
      ...validBody,
      keepEveryVersion: true,
      regenGenre: 'jazz',
    });

    expect(res.status).toBe(200);
    expect((await res.json()).data.url).toBe('https://stripe/cs_1');

    // Email is normalized; verseCount comes from the stored upsells.
    expect(mocks.createSongCheckoutSession).toHaveBeenCalledWith({
      songId: 'song_1',
      email: 'buyer@example.com',
      recipientName: 'Mia',
      verseCount: 3,
      keepEveryVersion: true,
      regenGenre: 'jazz',
      selectedTrackIndex: 1,
    });

    const update = mocks.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'song_1' });
    expect(update.data.email).toBe('buyer@example.com');
    expect(update.data.selectedTrackId).toBe('trk_b');
    expect(update.data.stripeSessionId).toBe('cs_1');
    expect(update.data.upsells).toEqual({
      songLength: 3,
      keepEveryVersion: true,
      regenGenre: 'jazz',
    });
  });

  it('500 when Stripe fails', async () => {
    mocks.findUnique.mockResolvedValue(previewSong);
    mocks.createSongCheckoutSession.mockRejectedValue(new Error('stripe down'));
    const res = await post(validBody);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Could not start checkout — try again.');
  });
});
