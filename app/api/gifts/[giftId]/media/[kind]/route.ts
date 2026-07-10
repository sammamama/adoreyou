// Sender media on the gift page (photo / voice note) — code-gated exactly
// like the download route: the URL only works with the gift's access code,
// and never before a scheduled gift's unwrap moment.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isCodeFormat, validateAccessCode } from '@/lib/access-code';
import { openObject } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ giftId: string; kind: string }> }
) {
  const { giftId, kind } = await params;
  if (kind !== 'photo' && kind !== 'voice') {
    return NextResponse.json(
      { data: null, error: 'Unknown media kind.' },
      { status: 404 }
    );
  }

  const code = req.nextUrl.searchParams.get('code')?.trim() ?? '';
  if (!isCodeFormat(code)) {
    return NextResponse.json(
      { data: null, error: 'Missing access code.' },
      { status: 401 }
    );
  }

  const gift = await prisma.gift.findUnique({ where: { id: giftId } });
  if (!gift || !validateAccessCode(code, gift.accessCode)) {
    return NextResponse.json(
      { data: null, error: 'Not found.' },
      { status: 404 }
    );
  }
  if (gift.deliverAt && gift.deliverAt.getTime() > Date.now()) {
    return NextResponse.json(
      { data: null, error: 'This gift isn’t ready to unwrap yet.' },
      { status: 403 }
    );
  }

  const key = kind === 'photo' ? gift.photoKey : gift.voiceKey;
  const mime = kind === 'photo' ? gift.photoMime : gift.voiceMime;
  if (!key || !mime) {
    return NextResponse.json(
      { data: null, error: 'Not found.' },
      { status: 404 }
    );
  }

  let object;
  try {
    object = await openObject(key);
  } catch (err) {
    console.error(`gift media read failed for ${key}:`, err);
    return NextResponse.json(
      { data: null, error: 'Media unavailable — try again shortly.' },
      { status: 502 }
    );
  }

  return new NextResponse(object.stream, {
    headers: {
      'Content-Type': mime,
      ...(object.contentLength
        ? { 'Content-Length': String(object.contentLength) }
        : {}),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
