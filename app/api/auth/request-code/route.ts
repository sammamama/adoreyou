// "Find My Songs" — email a 6-digit login code (Step 10, decision #1).
// Rules: 10-minute expiry, max 3 sends per email per 15 minutes. Only the
// hash is stored (lib/session.ts).

import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { prisma } from '@/lib/db';
import { sendLoginCodeEmail } from '@/lib/email';
import { hashLoginCode } from '@/lib/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;
const SEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { data: null, error: 'That email doesn’t look right.' },
      { status: 400 }
    );
  }

  const recentSends = await prisma.loginCode.count({
    where: { email, createdAt: { gt: new Date(Date.now() - SEND_WINDOW_MS) } },
  });
  if (recentSends >= MAX_SENDS_PER_WINDOW) {
    return NextResponse.json(
      {
        data: null,
        error: 'Too many codes requested — try again in a few minutes.',
      },
      { status: 429 }
    );
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const record = await prisma.loginCode.create({
    data: {
      email,
      codeHash: hashLoginCode(email, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  // If the email can't go out the code is useless — remove the row so it
  // doesn't count against the send limit, and tell the user.
  try {
    await sendLoginCodeEmail({ to: email, code });
  } catch (err) {
    console.error(`login code email failed for ${email}:`, err);
    await prisma.loginCode.delete({ where: { id: record.id } }).catch(() => {});
    return NextResponse.json(
      { data: null, error: 'Couldn’t send the code — try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { sent: true }, error: null });
}
