// Magic sign-in from the song-ready email — exchanges the emailed token for
// the normal 60-day session cookie and lands on the dashboard. An invalid or
// expired token still redirects to /my-songs, where the OTP flow takes over.

import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSessionToken,
  verifyMagicToken,
} from '@/lib/session';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? undefined;
  const email = verifyMagicToken(token);

  const res = NextResponse.redirect(new URL('/my-songs', req.nextUrl.origin));
  if (email) {
    res.cookies.set(SESSION_COOKIE, signSessionToken(email), sessionCookieOptions);
  }
  return res;
}
