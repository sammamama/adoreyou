// Create a gift (Step 8, decisions #5 + #15) — one credit = one recipient's
// personalized gift page (own message, own 4-digit code). Possession of the
// songId (unguessable cuid, delivered only to the creator) is treated as
// ownership — same model as the song route serving paid audio by id.
// Remaining credits = giftCredits minus gifts already created; copy-paste
// sharing of an existing gift stays free.
//
// Multipart FormData: text fields + optional photo / voice note (stored as
// bytea — no blob storage configured). deliverAt in the future defers the
// delivery email to the cron route and locks the reveal page until then.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateAccessCode } from '@/lib/access-code';
import { sendGiftDeliveryEmail } from '@/lib/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // Vercel body limit is 4.5MB total
const MAX_VOICE_BYTES = 2 * 1024 * 1024;
const MAX_SCHEDULE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year out

function field(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  return typeof v === 'string' ? v.trim() || undefined : undefined;
}

function fileField(form: FormData, name: string): File | null {
  const v = form.get(name);
  return v && typeof v !== 'string' && v.size > 0 ? v : null;
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid form body.' },
      { status: 400 }
    );
  }

  const songId = field(form, 'songId');
  const senderName = field(form, 'senderName');
  const personalMessage = field(form, 'personalMessage');
  const recipientEmail = field(form, 'recipientEmail')?.toLowerCase();

  if (!songId || !senderName || !personalMessage || !recipientEmail) {
    return NextResponse.json(
      {
        data: null,
        error:
          'songId, your name, a personal message, and their email are required.',
      },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json(
      { data: null, error: 'That recipient email doesn’t look right.' },
      { status: 400 }
    );
  }

  // Scheduled unwrap moment — optional; must be in the future, within a year.
  const deliverAtRaw = field(form, 'deliverAt');
  let deliverAt: Date | null = null;
  if (deliverAtRaw) {
    deliverAt = new Date(deliverAtRaw);
    if (Number.isNaN(deliverAt.getTime())) {
      return NextResponse.json(
        { data: null, error: 'That delivery time doesn’t look right.' },
        { status: 400 }
      );
    }
    if (deliverAt.getTime() <= Date.now()) {
      deliverAt = null; // "now" — treat as immediate
    } else if (deliverAt.getTime() > Date.now() + MAX_SCHEDULE_MS) {
      return NextResponse.json(
        { data: null, error: 'Pick a delivery time within the next year.' },
        { status: 400 }
      );
    }
  }

  // Optional media
  const photoFile = fileField(form, 'photo');
  if (photoFile) {
    if (!photoFile.type.startsWith('image/')) {
      return NextResponse.json(
        { data: null, error: 'The photo must be an image file.' },
        { status: 400 }
      );
    }
    if (photoFile.size > MAX_PHOTO_BYTES) {
      return NextResponse.json(
        { data: null, error: 'That photo is too large — keep it under 3MB.' },
        { status: 400 }
      );
    }
  }
  const voiceFile = fileField(form, 'voiceNote');
  if (voiceFile) {
    if (!voiceFile.type.startsWith('audio/')) {
      return NextResponse.json(
        { data: null, error: 'The voice note must be an audio file.' },
        { status: 400 }
      );
    }
    if (voiceFile.size > MAX_VOICE_BYTES) {
      return NextResponse.json(
        {
          data: null,
          error: 'That voice note is too large — keep it under 2MB.',
        },
        { status: 400 }
      );
    }
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
      recipientEmail,
      accessCode,
      deliverAt,
      photo: photoFile
        ? new Uint8Array(await photoFile.arrayBuffer())
        : null,
      photoMime: photoFile?.type ?? null,
      voiceNote: voiceFile
        ? new Uint8Array(await voiceFile.arrayBuffer())
        : null,
      voiceMime: voiceFile?.type ?? null,
    },
  });

  // Immediate gifts email now (best-effort — the gift and its credit already
  // exist, and the creator still gets the link + code to deliver manually).
  // Scheduled gifts are sent by /api/cron/deliver-gifts at deliverAt.
  let emailSent = false;
  if (!deliverAt) {
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
      deliverAt: deliverAt?.toISOString() ?? null,
      giftCredits: creditsRemaining - 1,
    },
    error: null,
  });
}
