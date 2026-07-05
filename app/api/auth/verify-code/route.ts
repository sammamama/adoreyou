// Verify a "Find My Songs" login code → set the 60-day JWT session cookie
// (Step 10, decision #1). Max 5 attempts per code — the attempt is counted
// atomically BEFORE comparing, so 5 wrong guesses kill the code even under
// parallel requests. On success every code for the email is deleted.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import {
  SESSION_COOKIE,
  hashLoginCode,
  sessionCookieOptions,
  signSessionToken,
} from '@/lib/session';

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();
  if (!email || !code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { data: null, error: 'Enter the 6-digit code from your email.' },
      { status: 400 }
    );
  }

  // Latest live code for this email — requesting a new code supersedes
  // older ones, but they stay valid until they expire.
  const record = await prisma.loginCode.findFirst({
    where: { email, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) {
    return NextResponse.json(
      { data: null, error: 'That code has expired — request a new one.' },
      { status: 400 }
    );
  }

  // Count the attempt first; zero rows updated means the code is spent.
  const counted = await prisma.loginCode.updateMany({
    where: { id: record.id, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) {
    return NextResponse.json(
      { data: null, error: 'Too many wrong guesses — request a new code.' },
      { status: 400 }
    );
  }

  const expected = Buffer.from(record.codeHash);
  const actual = Buffer.from(hashLoginCode(email, code));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const remaining = MAX_ATTEMPTS - (record.attempts + 1);
    return NextResponse.json(
      {
        data: null,
        error:
          remaining > 0
            ? `Wrong code — ${remaining} ${remaining === 1 ? 'try' : 'tries'} left.`
            : 'Too many wrong guesses — request a new code.',
      },
      { status: 400 }
    );
  }

  await prisma.loginCode.deleteMany({ where: { email } });

  const res = NextResponse.json({ data: { email }, error: null });
  res.cookies.set(SESSION_COOKIE, signSessionToken(email), sessionCookieOptions);
  return res;
}
