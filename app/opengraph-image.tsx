// Landing OG image — blush editorial card, rendered at build. Default font
// only (no network fetch at build), so the accent word is color, not italic.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

const logo = `data:image/png;base64,${readFileSync(
  join(process.cwd(), 'public', 'logo-mark.png')
).toString('base64')}`;

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt =
  'AdoreYou — create a one-of-a-kind song for someone you love';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#FFF8F6',
          color: '#1C1917',
          fontSize: 32,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -200,
            right: -160,
            width: 560,
            height: 560,
            borderRadius: 9999,
            backgroundColor: '#E11D48',
            opacity: 0.08,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -240,
            left: -120,
            width: 480,
            height: 480,
            borderRadius: 9999,
            backgroundColor: '#E11D48',
            opacity: 0.06,
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 40,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={56} height={56} style={{ borderRadius: 9999 }} />
          <span style={{ display: 'flex' }}>
            Adore<span style={{ color: '#E11D48' }}>You</span>
          </span>
        </div>

        <div
          style={{
            marginTop: 48,
            display: 'flex',
            flexDirection: 'column',
            fontSize: 76,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            maxWidth: 980,
          }}
        >
          <span>Create a one-of-a-kind song</span>
          <span style={{ display: 'flex' }}>
            for someone you&nbsp;
            <span style={{ color: '#E11D48' }}>love</span>
          </span>
        </div>

        <div style={{ marginTop: 40, fontSize: 30, color: '#78716C' }}>
          Their memories, written into an original song — a gift they&rsquo;ll
          never forget.
        </div>
      </div>
    ),
    size
  );
}
