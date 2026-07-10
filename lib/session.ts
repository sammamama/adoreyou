// Returning-creator session (Step 10, decision #1) — stateless signed JWT in
// an httpOnly cookie, payload { email }, 60-day expiry. No sessions table.
//
// HS256 is hand-rolled on node:crypto — the payload is one email field, not
// worth a JWT dependency.

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'adoreyou_session';
export const SESSION_MAX_AGE = 60 * 24 * 60 * 60; // 60 days, seconds

function secret(): string {
  const s = process.env.SESSION_JWT_SECRET;
  if (!s) throw new Error('SESSION_JWT_SECRET is not set.');
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

export function signSessionToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ email, iat: now, exp: now + SESSION_MAX_AGE })
  );
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

// Verified payload of a signed token, or null for missing/tampered/expired.
function verifyToken(
  token: string | undefined
): { email: string; purpose?: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (typeof payload.email !== 'string') return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Returns the session email, or null for a missing/tampered/expired token.
// Rejects purpose-claimed tokens (magic links) — an emailed token can't be
// pasted in as a session cookie.
export function verifySessionToken(token: string | undefined): string | null {
  const payload = verifyToken(token);
  return payload && payload.purpose === undefined ? payload.email : null;
}

// ---------------------------------------------------------------------------
// Magic sign-in link (song-ready email) — same HMAC shape with a `purpose`
// claim so the two token kinds can't be swapped. The link exchanges the
// token for a normal session cookie via /api/auth/magic.

export const MAGIC_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, seconds

export function signMagicToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ email, purpose: 'magic', iat: now, exp: now + MAGIC_MAX_AGE })
  );
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyMagicToken(token: string | undefined): string | null {
  const payload = verifyToken(token);
  return payload && payload.purpose === 'magic' ? payload.email : null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_MAX_AGE,
} as const;

// Server-side helper for pages/routes: session email from the request cookie.
export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

// Login-code hash stored in login_codes.codeHash (never the plain code).
// Bound to the email so a hash can't be replayed for another address.
export function hashLoginCode(email: string, code: string): string {
  return createHash('sha256').update(`${email}:${code}`).digest('hex');
}
