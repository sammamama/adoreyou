// Transactional email via Resend (song ready, gift delivery, login code).
//
// Design mirrors the app's blush-editorial system in email-safe form: warm
// blush background, ink text, occasion accent color, serif display headings
// with the signature italic word. Web fonts don't load reliably in Gmail, so
// Georgia stands in for Instrument Serif and Helvetica for Instrument Sans.
// Inline styles only — Gmail strips <style> in some clients.
//
// Send functions throw on failure (including missing EMAIL_API_KEY /
// EMAIL_FROM) — callers that must not fail on email errors (e.g. the Stripe
// webhook) catch and log.

import { Resend } from 'resend';
import { getOccasion } from '@/lib/occasions';
import { signMagicToken } from '@/lib/session';

const FALLBACK_ACCENT = '#E11D48'; // rose — base palette accent

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
}

function accentFor(occasionSlug: string): string {
  return getOccasion(occasionSlug)?.theme.accent ?? FALLBACK_ACCENT;
}

function occasionName(occasionSlug: string): string {
  return getOccasion(occasionSlug)?.name ?? occasionSlug;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function send(opts: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  fromName?: string;
}) {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Email not configured — set EMAIL_API_KEY and EMAIL_FROM.');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: `${opts.fromName ?? 'AdoreYou'} <${from}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Shared layout pieces

const SERIF = `Georgia, 'Times New Roman', serif`;
const SANS = `Helvetica, Arial, sans-serif`;

function button(href: string, label: string, accent: string): string {
  return `<a href="${href}" style="display: inline-block; background-color: ${accent}; color: #ffffff; font-family: ${SANS}; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 999px;">${label}</a>`;
}

function codeBlock(code: string, label: string): string {
  return `
    <div style="background-color: #1C1917; border-radius: 12px; padding: 20px 24px; text-align: center;">
      <div style="font-family: ${SANS}; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #a8a29e; margin-bottom: 8px;">${label}</div>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; letter-spacing: 12px; color: #ffffff; padding-left: 12px;">${code}</div>
    </div>`;
}

// Blush page background, white card, ink text, quiet footer.
function layout(content: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFF8F6; padding: 40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <img src="${appUrl()}/logo-mark.png" alt="AdoreYou" width="40" height="40" style="display: block; border-radius: 10px;" />
          </td>
        </tr>
        <tr>
          <td style="background-color: #ffffff; border-radius: 24px; padding: 48px 40px; color: #1C1917;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 8px; text-align: center; font-family: ${SANS}; font-size: 13px; color: #a8a29e;">
            Made with <span style="font-family: ${SERIF}; font-style: italic;">love</span> at AdoreYou
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function eyebrow(text: string, accent: string): string {
  return `<div style="font-family: ${SANS}; font-size: 13px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: ${accent}; margin-bottom: 16px;">${text}</div>`;
}

function heading(html: string): string {
  return `<h1 style="font-family: ${SERIF}; font-weight: normal; font-size: 34px; line-height: 1.2; margin: 0 0 16px;">${html}</h1>`;
}

function paragraph(html: string): string {
  return `<p style="font-family: ${SANS}; font-size: 16px; line-height: 1.6; color: #44403c; margin: 0 0 16px;">${html}</p>`;
}

// ---------------------------------------------------------------------------
// (a) Song ready — to the creator, sent when the song reaches `done`.
// `accountEmail` (the creator's identity email) turns the dashboard mention
// into a magic sign-in link — one click from the inbox to every song they've
// made, no code entry.

export async function sendSongReadyEmail(opts: {
  to: string[];
  songId: string;
  songTitle: string;
  recipientName: string;
  occasion: string; // slug
  accountEmail?: string | null;
}) {
  const accent = accentFor(opts.occasion);
  const songLink = `${appUrl()}/song/${opts.songId}`;
  const mySongsLink = opts.accountEmail
    ? `${appUrl()}/api/auth/magic?token=${signMagicToken(opts.accountEmail)}`
    : `${appUrl()}/my-songs`;
  const name = escapeHtml(opts.recipientName);
  const title = escapeHtml(opts.songTitle);

  const html = layout(`
    ${eyebrow(occasionName(opts.occasion), accent)}
    ${heading(`Your song is <em style="font-style: italic;">ready</em>`)}
    ${paragraph(`<strong>${title}</strong> — your ${escapeHtml(occasionName(opts.occasion).toLowerCase())} song for ${name} — is finished and waiting for you.`)}
    <div style="margin: 28px 0;">${button(songLink, 'Listen to your song', accent)}</div>
    ${paragraph(`You can download the MP3 anytime from <a href="${songLink}" style="color: ${accent};">your song page</a>, and every song you've made lives in <a href="${mySongsLink}" style="color: ${accent};">your songs</a> — this link signs you in, no code needed.`)}
    <hr style="border: none; border-top: 1px solid #f5f0ee; margin: 28px 0;" />
    ${heading(`Gift it to your <em style="font-style: italic;">person</em>`)}
    ${paragraph(`Every song includes one free gift — a beautiful reveal page made just for ${name}, protected by their own access code.`)}
    <div style="margin: 24px 0 8px;">${button(songLink, `Gift it to ${name}`, '#1C1917')}</div>
  `);

  const text = [
    `Your song is ready!`,
    ``,
    `${opts.songTitle} — your ${occasionName(opts.occasion)} song for ${opts.recipientName} — is finished.`,
    ``,
    `Listen and download: ${songLink}`,
    `All your songs (signs you in automatically): ${mySongsLink}`,
    ``,
    `Every song includes one free gift — create ${opts.recipientName}'s reveal page from your song page.`,
  ].join('\n');

  await send({
    to: opts.to,
    subject: `Your song for ${opts.recipientName} is ready`,
    html,
    text,
  });
}

// ---------------------------------------------------------------------------
// (b) Gift delivery — to the recipient, occasion-themed, forwardable.

export async function sendGiftDeliveryEmail(opts: {
  to: string;
  senderName: string;
  giftId: string;
  accessCode: string;
  personalMessage: string | null;
  occasion: string; // slug
}) {
  const accent = accentFor(opts.occasion);
  const giftLink = `${appUrl()}/gift/${opts.giftId}`;
  const sender = escapeHtml(opts.senderName);

  const quoteBlock = opts.personalMessage
    ? `<div style="border-left: 3px solid ${accent}; padding: 4px 0 4px 20px; margin: 24px 0;">
      <p style="font-family: ${SERIF}; font-style: italic; font-size: 20px; line-height: 1.5; color: #1C1917; margin: 0;">&ldquo;${escapeHtml(opts.personalMessage)}&rdquo;</p>
      <p style="font-family: ${SANS}; font-size: 14px; color: #a8a29e; margin: 8px 0 0;">— ${sender}</p>
    </div>`
    : '';

  const html = layout(`
    ${eyebrow('You have a gift', accent)}
    ${heading(`${sender} made you a <em style="font-style: italic;">song</em>`)}
    ${paragraph('They really appreciate you — so much that they wrote it into music.')}
    ${quoteBlock}
    <div style="margin: 28px 0;">${button(giftLink, 'Open your gift', accent)}</div>
    <div style="margin: 24px 0;">${codeBlock(opts.accessCode, 'Your access code')}</div>
    ${paragraph(`Open <a href="${giftLink}" style="color: ${accent};">${giftLink}</a> and enter the code above to hear your song.`)}
  `);

  const text = [
    `${opts.senderName} made you a song — they really appreciate you.`,
    ``,
    ...(opts.personalMessage
      ? [`"${opts.personalMessage}"`, `— ${opts.senderName}`, ``]
      : []),
    `Open your gift: ${giftLink}`,
    `Access code: ${opts.accessCode}`,
  ].join('\n');

  await send({
    to: [opts.to],
    subject: `${opts.senderName} made you a song`,
    html,
    text,
    fromName: `${opts.senderName} via AdoreYou`,
  });
}

// ---------------------------------------------------------------------------
// (b2) Gift sent confirmation — to the creator, sent when the delivery email
// goes out to the recipient. Includes the link + code so the creator can
// also share them directly.

export async function sendGiftSentEmail(opts: {
  to: string;
  recipientEmail: string;
  giftId: string;
  accessCode: string;
  occasion: string; // slug
}) {
  const accent = accentFor(opts.occasion);
  const giftLink = `${appUrl()}/gift/${opts.giftId}`;
  const recipient = escapeHtml(opts.recipientEmail);

  const html = layout(`
    ${eyebrow('Gift delivered', accent)}
    ${heading(`Your gift is on its <em style="font-style: italic;">way</em>`)}
    ${paragraph(`We just emailed your song to <strong>${recipient}</strong> with their access code.`)}
    ${paragraph(`Want to share it yourself too? Here's everything they received:`)}
    <div style="margin: 28px 0;">${button(giftLink, 'View the gift page', accent)}</div>
    <div style="margin: 24px 0;">${codeBlock(opts.accessCode, 'Their access code')}</div>
    ${paragraph(`If their email lands in spam, just send them <a href="${giftLink}" style="color: ${accent};">${giftLink}</a> and the code above.`)}
  `);

  const text = [
    `Your gift is on its way!`,
    ``,
    `We just emailed your song to ${opts.recipientEmail} with their access code.`,
    ``,
    `Gift page: ${giftLink}`,
    `Access code: ${opts.accessCode}`,
    ``,
    `If their email lands in spam, send them the link and code yourself.`,
  ].join('\n');

  await send({
    to: [opts.to],
    subject: `Your gift to ${opts.recipientEmail} is on its way`,
    html,
    text,
  });
}

// ---------------------------------------------------------------------------
// (c) Login code — 6-digit "Find My Songs" code (used by a later phase).

export async function sendLoginCodeEmail(opts: { to: string; code: string }) {
  const html = layout(`
    ${eyebrow('Find my songs', FALLBACK_ACCENT)}
    ${heading(`Your sign-in <em style="font-style: italic;">code</em>`)}
    ${paragraph('Enter this code to see your songs. It expires in 10 minutes.')}
    <div style="margin: 24px 0;">${codeBlock(opts.code, 'Sign-in code')}</div>
    ${paragraph(`Didn't request this? You can safely ignore this email.`)}
  `);

  const text = [
    `Your AdoreYou sign-in code: ${opts.code}`,
    ``,
    `It expires in 10 minutes. Didn't request this? Ignore this email.`,
  ].join('\n');

  await send({
    to: [opts.to],
    subject: `${opts.code} is your AdoreYou sign-in code`,
    html,
    text,
  });
}
