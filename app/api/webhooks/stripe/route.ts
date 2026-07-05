// Phase 4 — unlock, triggered by Stripe webhook. Raw body + signature verify
// (convention: req.text(), never req.json()). Idempotent on replay via the
// stripe_events insert-first guard.
//
// checkout.session.completed (song): status → paid, unlock tracks per
// upsells, kick off the regen render if purchased. status → done when no
// regen is pending. If the regen render fails to start, auto-refund the
// regen line item (decision #6).
// checkout.session.completed (gift pack): increment songs.giftCredits.

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { sendSongReadyEmail } from '@/lib/email';
import { getOccasion } from '@/lib/occasions';
import { refundRegenLineItem, stripe } from '@/lib/stripe';
import { startGeneration } from '@/lib/suno';
import type { StyleInputs, Track, Upsells } from '@/types';

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json(
      { data: null, error: 'Missing webhook signature.' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error('stripe webhook signature verification failed:', err);
    return NextResponse.json(
      { data: null, error: 'Invalid signature.' },
      { status: 400 }
    );
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ data: { received: true }, error: null });
  }

  // Insert-first idempotency guard — a replayed event id hits the unique
  // constraint and is acknowledged without reprocessing.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return NextResponse.json({ data: { received: true }, error: null });
    }
    throw err;
  }

  const session = event.data.object;
  const { type, songId } = session.metadata ?? {};

  if (!songId) {
    console.error(`stripe session ${session.id} has no songId metadata`);
    return NextResponse.json({ data: { received: true }, error: null });
  }

  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song) {
    console.error(`stripe session ${session.id}: song ${songId} not found`);
    return NextResponse.json({ data: { received: true }, error: null });
  }

  if (type === 'gift_pack') {
    const credits = Number(session.metadata?.credits ?? 0);
    if (credits > 0) {
      await prisma.song.update({
        where: { id: songId },
        data: { giftCredits: { increment: credits } },
      });
    }
    return NextResponse.json({ data: { received: true }, error: null });
  }

  // Song purchase — belt-and-braces guard on top of the event-id check.
  if (song.status === 'paid' || song.status === 'done') {
    return NextResponse.json({ data: { received: true }, error: null });
  }

  const upsells = song.upsells as unknown as Upsells;

  // Unlock: the chosen track, or everything if Keep Every Version was bought.
  const tracks = (song.tracks as unknown as Track[]).map((t) => ({
    ...t,
    unlocked: upsells.keepEveryVersion || t.sunoTrackId === song.selectedTrackId,
  }));

  // Decision #13 — if the email was changed on Stripe's page, store both.
  const stripeEmail = session.customer_details?.email?.toLowerCase() ?? null;
  const emailFields =
    stripeEmail && stripeEmail !== song.email ? { stripeEmail } : {};

  // Regen purchased → render the new pair now; song stays `paid` until the
  // polling route sees the regen task finish (decision #4 — no Suno webhook).
  let status: 'paid' | 'done' = 'done';
  let sunoTaskId: string | undefined;
  if (upsells.regenGenre) {
    const styleInputs = song.styleInputs as unknown as StyleInputs;
    try {
      sunoTaskId = await startGeneration({
        lyrics: song.lyrics,
        style: {
          mood: getOccasion(song.occasion)?.defaultMood,
          ...styleInputs,
          genre: upsells.regenGenre,
        },
        title: `A song for ${song.recipientName}`,
      });
      upsells.regenPending = true;
      status = 'paid';
    } catch (err) {
      console.error(`regen render failed to start for song ${songId}:`, err);
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
      if (paymentIntentId && !upsells.regenRefunded) {
        await refundRegenLineItem(songId, paymentIntentId);
        upsells.regenRefunded = true;
      }
    }
  }

  await prisma.song.update({
    where: { id: songId },
    data: {
      status,
      amountPaid: session.amount_total,
      upsells: JSON.parse(JSON.stringify(upsells)),
      tracks: JSON.parse(JSON.stringify(tracks)),
      ...(sunoTaskId ? { sunoTaskId } : {}),
      ...emailFields,
    },
  });

  // Song-ready email when the song lands at `done` (regen purchases reach
  // `done` later, via the polling route). Decision #13 — on an email
  // mismatch, send to both addresses. Email failure must not 500 the
  // webhook: the event id is already recorded, so a Stripe retry would be
  // swallowed by the idempotency guard, not reprocessed.
  if (status === 'done') {
    const to = [...new Set([song.email, stripeEmail].filter((e): e is string => !!e))];
    if (to.length > 0) {
      try {
        await sendSongReadyEmail({
          to,
          songId,
          songTitle: `A song for ${song.recipientName}`,
          recipientName: song.recipientName,
          occasion: song.occasion,
        });
      } catch (err) {
        console.error(`song-ready email failed for song ${songId}:`, err);
      }
    }
  }

  return NextResponse.json({ data: { received: true }, error: null });
}
