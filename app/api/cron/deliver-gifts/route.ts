// Scheduled gift delivery — invoked by Vercel Cron (vercel.json). Sends the
// delivery email for every gift whose deliverAt has arrived and which hasn't
// been sent yet. Failures stay unsent and retry on the next run.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendGiftDeliveryEmail, sendGiftSentEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized.' },
      { status: 401 }
    );
  }

  const due = await prisma.gift.findMany({
    where: {
      deliverAt: { lte: new Date() },
      sentAt: null,
      recipientEmail: { not: null },
    },
    include: { song: { select: { occasion: true, email: true } } },
  });

  let sent = 0;
  for (const gift of due) {
    try {
      await sendGiftDeliveryEmail({
        to: gift.recipientEmail!,
        senderName: gift.senderName,
        giftId: gift.id,
        accessCode: gift.accessCode,
        personalMessage: gift.personalMessage,
        occasion: gift.song.occasion,
      });
      await prisma.gift.update({
        where: { id: gift.id },
        data: { sentAt: new Date() },
      });
      sent++;
      // Confirmation to the creator — best-effort, never blocks the batch.
      if (gift.song.email) {
        try {
          await sendGiftSentEmail({
            to: gift.song.email,
            recipientEmail: gift.recipientEmail!,
            giftId: gift.id,
            accessCode: gift.accessCode,
            occasion: gift.song.occasion,
          });
        } catch (err) {
          console.error(`gift sent email failed for gift ${gift.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`scheduled delivery failed for gift ${gift.id}:`, err);
    }
  }

  return NextResponse.json({
    data: { due: due.length, sent },
    error: null,
  });
}
