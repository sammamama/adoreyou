// Create a gift (Step 8, decisions #5 + #15) — one credit = one recipient's
// personalized gift page (own message, own 4-digit code). Creator is verified
// by songId + email match, or by the JWT session cookie (Step 10 dashboard).
// Remaining credits = giftCredits minus gifts already created; copy-paste
// sharing of an existing gift stays free.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateAccessCode } from '@/lib/access-code';
import { sendGiftDeliveryEmail } from '@/lib/email';
import { getSessionEmail } from '@/lib/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface GiftRequestBody {
  songId?: string;
  email?: string; // creator's email — must match the song row
  senderName?: string;
  personalMessage?: string;
  recipientEmail?: string; // optional — creator may deliver the link manually
}

export async function POST(req: NextRequest) {
  let body: GiftRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const songId = body.songId;
  const email = body.email?.trim().toLowerCase();
  const senderName = body.senderName?.trim();
  const personalMessage = body.personalMessage?.trim();
  const recipientEmail = body.recipientEmail?.trim().toLowerCase() || undefined;

  if (!songId || !email || !senderName || !personalMessage) {
    return NextResponse.json(
      {
        data: null,
        error:
          'songId, your email, your name, and a personal message are required.',
      },
      { status: 400 }
    );
  }
  if (recipientEmail && !EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json(
      { data: null, error: 'That recipient email doesn’t look right.' },
      { status: 400 }
    );
  }

  const song = await prisma.song.findUnique({
    where: { id: songId },
    include: { gifts: true },
  });
  if (!song) {
    return NextResponse.json(
      { data: null, error: 'Song not found.' },
      { status: 404 }
    );
  }

  // Creator check — the email used at checkout (or the one Stripe captured),
  // typed in the modal or proven by the dashboard session cookie.
  const knownEmails = [song.email, song.stripeEmail]
    .filter((e): e is string => !!e)
    .map((e) => e.toLowerCase());
  const sessionEmail = await getSessionEmail();
  const isCreator =
    knownEmails.includes(email) ||
    (!!sessionEmail && knownEmails.includes(sessionEmail));
  if (!isCreator) {
    return NextResponse.json(
      { data: null, error: 'That email doesn’t match this song.' },
      { status: 403 }
    );
  }

  if (song.status !== 'paid' && song.status !== 'done') {
    return NextResponse.json(
      { data: null, error: 'Finish checkout before gifting this song.' },
      { status: 400 }
    );
  }

  const creditsRemaining = song.giftCredits - song.gifts.length;
  if (creditsRemaining <= 0) {
    return NextResponse.json(
      {
        data: null,
        error: 'No gift credits left — grab a pack to gift more people.',
      },
      { status: 402 }
    );
  }

  const accessCode = generateAccessCode(song.gifts.map((g) => g.accessCode));

  const gift = await prisma.gift.create({
    data: {
      songId: song.id,
      senderName,
      personalMessage,
      recipientEmail: recipientEmail ?? null,
      accessCode,
    },
  });

  // Delivery email is best-effort — the gift (and its credit) already exists;
  // the creator still gets the link + code to deliver manually.
  let emailSent = false;
  if (recipientEmail) {
    try {
      await sendGiftDeliveryEmail({
        to: recipientEmail,
        senderName,
        giftId: gift.id,
        accessCode,
        personalMessage,
        occasion: song.occasion,
      });
      await prisma.gift.update({
        where: { id: gift.id },
        data: { sentAt: new Date() },
      });
      emailSent = true;
    } catch (err) {
      console.error(`gift delivery email failed for gift ${gift.id}:`, err);
    }
  }

  return NextResponse.json({
    data: {
      id: gift.id,
      link: `/gift/${gift.id}`,
      accessCode,
      emailSent,
      giftCredits: creditsRemaining - 1,
    },
    error: null,
  });
}
