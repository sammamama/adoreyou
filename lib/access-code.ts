// Gift access codes (decision #5 — per-gift 4-digit code). Crypto-random,
// generated unique among a song's existing gifts so two recipients of the
// same song never share a code.

import { randomInt, timingSafeEqual } from 'crypto';

export function isCodeFormat(input: string): boolean {
  return /^\d{4}$/.test(input);
}

export function generateAccessCode(existing: string[] = []): string {
  const taken = new Set(existing);
  if (taken.size >= 10_000) {
    throw new Error('No 4-digit codes left for this song.');
  }
  let code: string;
  do {
    code = String(randomInt(0, 10_000)).padStart(4, '0');
  } while (taken.has(code));
  return code;
}

// Constant-time compare — both sides are 4 ASCII digits after the format
// check, so lengths always match.
export function validateAccessCode(input: string, expected: string): boolean {
  if (!isCodeFormat(input) || !isCodeFormat(expected)) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}
