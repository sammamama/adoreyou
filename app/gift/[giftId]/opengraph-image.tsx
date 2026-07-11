// Occasion-themed OG image for gift links — the WhatsApp/iMessage preview is
// the first thing the recipient sees, so it gets the occasion accent. Falls
// back to generic branding when the gift can't be loaded.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getGiftMeta } from './gift-meta';

const logo = `data:image/png;base64,${readFileSync(
  join(process.cwd(), 'public', 'logo-mark.png')
).toString('base64')}`;

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Someone made you a song — AdoreYou';

export default async function Image({
  params,
}: {
  params: Promise<{ giftId: string }>;
}) {
  const { giftId } = await params;
  const gift = await getGiftMeta(giftId);

  const accent = gift?.occasion?.theme.accent ?? '#E11D48';
  const headline = gift
    ? `${gift.senderName} made you a song`
    : 'Someone made you a song';
  const occasionLabel = gift?.occasion?.name ?? 'A gift';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#FFF8F6',
          color: '#1C1917',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -220,
            left: 320,
            width: 560,
            height: 560,
            borderRadius: 9999,
            backgroundColor: accent,
            opacity: 0.12,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -260,
            right: -140,
            width: 520,
            height: 520,
            borderRadius: 9999,
            backgroundColor: accent,
            opacity: 0.08,
          }}
        />

        <div
          style={{
            fontSize: 26,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: accent,
          }}
        >
          {occasionLabel}
        </div>

        <div
          style={{
            marginTop: 36,
            fontSize: 78,
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            maxWidth: 1000,
          }}
        >
          {headline}
        </div>

        <div style={{ marginTop: 36, fontSize: 30, color: '#78716C' }}>
          Sealed with a 4-digit code — open it to hear your song.
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 32,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={44} height={44} style={{ borderRadius: 9999 }} />
          <span style={{ display: 'flex' }}>
            Adore<span style={{ color: accent }}>You</span>
          </span>
        </div>
      </div>
    ),
    size
  );
}
