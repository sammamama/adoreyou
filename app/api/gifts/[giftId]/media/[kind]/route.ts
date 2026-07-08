// Sender media on the gift page (photo / voice note) — code-gated exactly
// like the download route: the URL only works with the gift's access code,
// and never before a scheduled gift's unwrap moment.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isCodeFormat, validateAccessCode } from '@/lib/access-code';

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

  const bytes = kind === 'photo' ? gift.photo : gift.voiceNote;
  const mime = kind === 'photo' ? gift.photoMime : gift.voiceMime;
  if (!bytes || !mime) {
    return NextResponse.json(
      { data: null, error: 'Not found.' },
      { status: 404 }
    );
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
