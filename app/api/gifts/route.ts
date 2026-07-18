// Create a gift (Step 8, decisions #5 + #15) — one credit = one recipient's
// personalized gift page (own message, own 4-digit code). Possession of the
// songId (unguessable cuid, delivered only to the creator) is treated as
// ownership — same model as the song route serving paid audio by id.
// Remaining credits = giftCredits minus gifts already created; copy-paste
// sharing of an existing gift stays free.
//
// Multipart FormData: text fields + optional photo / voice note (uploaded to
// S3, keys stored on the gift row). deliverAt in the future defers the
// delivery email to the cron route and locks the reveal page until then.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateAccessCode } from '@/lib/access-code';
import { sendGiftDeliveryEmail, sendGiftSentEmail } from '@/lib/email';
import { putObject, storageConfigured } from '@/lib/storage';
import { randomUUID } from 'crypto';
import type { Track } from '@/types';

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
  // Optional — the reveal page and delivery email skip the quote when absent.
  const personalMessage = field(form, 'personalMessage') ?? null;
  const recipientEmail = field(form, 'recipientEmail')?.toLowerCase();

  if (!songId || !senderName || !recipientEmail) {
    return NextResponse.json(
      {
        data: null,
        error: 'songId, your name, and their email are required.',
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

  if ((photoFile || voiceFile) && !storageConfigured()) {
    return NextResponse.json(
      {
        data: null,
        error: 'Photo and voice note uploads aren’t available right now.',
      },
      { status: 503 }
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

  if (song.status !== 'paid' && song.status !== 'done') {
    return NextResponse.json(
      { data: null, error: 'Finish checkout before gifting this song.' },
      { status: 400 }
    );
  }

  // Optional track pick (Keep Every Version) — must be an unlocked track.
  // null = the song's selected track, resolved at reveal time.
  const trackIndexRaw = field(form, 'trackIndex');
  let trackIndex: number | null = null;
  if (trackIndexRaw !== undefined) {
    const idx = Number(trackIndexRaw);
    const tracks = song.tracks as unknown as Track[];
    if (!Number.isInteger(idx) || !tracks[idx]?.unlocked) {
      return NextResponse.json(
        { data: null, error: 'That song version isn’t available to gift.' },
        { status: 400 }
      );
    }
    trackIndex = idx;
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

  // Upload media to S3 before creating the row — a failed upload fails the
  // whole request (no credit consumed) rather than a gift missing its media.
  let photoKey: string | null = null;
  let voiceKey: string | null = null;
  try {
    if (photoFile) {
      photoKey = `gifts/${song.id}/${randomUUID()}-photo`;
      await putObject(
        photoKey,
        new Uint8Array(await photoFile.arrayBuffer()),
        photoFile.type
      );
    }
    if (voiceFile) {
      voiceKey = `gifts/${song.id}/${randomUUID()}-voice`;
      await putObject(
        voiceKey,
        new Uint8Array(await voiceFile.arrayBuffer()),
        voiceFile.type
      );
    }
  } catch (err) {
    console.error(`gift media upload failed for song ${song.id}:`, err);
    return NextResponse.json(
      {
        data: null,
        error: 'Couldn’t save your photo or voice note — try again.',
      },
      { status: 502 }
    );
  }

  // Credit re-check + create in one serializable transaction — parallel
  // requests can't both pass the remaining-credit check and over-spend.
  let gift;
  try {
    gift = await prisma.$transaction(
      async (tx) => {
        const gifts = await tx.gift.findMany({
          where: { songId: song.id },
          select: { accessCode: true },
        });
        if (song.giftCredits - gifts.length <= 0) {
          throw new Error('NO_CREDITS');
        }
        return tx.gift.create({
          data: {
            songId: song.id,
            senderName,
            personalMessage,
            trackIndex,
            recipientEmail,
            accessCode: generateAccessCode(gifts.map((g) => g.accessCode)),
            deliverAt,
            photoKey,
            photoMime: photoFile?.type ?? null,
            voiceKey,
            voiceMime: voiceFile?.type ?? null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_CREDITS') {
      return NextResponse.json(
        {
          data: null,
          error: 'No gift credits left — grab a pack to gift more people.',
        },
        { status: 402 }
      );
    }
    // P2034 — serialization conflict with a concurrent gift for this song.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2034'
    ) {
      return NextResponse.json(
        { data: null, error: 'Please try that again.' },
        { status: 409 }
      );
    }
    throw err;
  }
  const accessCode = gift.accessCode;

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
      // Confirmation to the creator — best-effort, never fails the request.
      if (song.email) {
        try {
          await sendGiftSentEmail({
            to: song.email,
            recipientEmail,
            giftId: gift.id,
            accessCode,
            occasion: song.occasion,
          });
        } catch (err) {
          console.error(`gift sent email failed for gift ${gift.id}:`, err);
        }
      }
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
