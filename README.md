# AdoreYou 🎵

**Turn memories into one-of-a-kind songs — a gift they'll never forget.**

AdoreYou lets anyone create a fully personalized song for someone they love. Pick an occasion, answer guided story prompts about the person, and the app writes original lyrics with Claude, renders a full track with Suno, and delivers it as a beautiful, occasion-themed gift page sealed behind a 4-digit code.

No accounts. No passwords. Just a song, a code, and a reveal moment.

## How it works

1. **Pick an occasion** — Birthday, Wedding, Anniversary, Father's/Mother's Day, Graduation, Memorial, Friendship, or Thank You.
2. **Tell their story** — Hinge-style guided prompts ("The last time they made you laugh until it hurt...") pull out real memories. Answer at least 4.
3. **Shape the song** — Pick a genre, get AI-written lyrics in an editable canvas, and refine them with chat-style revision requests (or edit directly, free and unlimited).
4. **Hear it first** — Two versions render while you wait (with a "discover a rising local artist" Spotify widget to pass the time). Listen to 30-second previews *before* paying — full audio never leaves the server until checkout completes.
5. **Pay once, per song** — Stripe Checkout with optional upsells: extra verses, keep every version, regenerate in a new genre.
6. **Gift the reveal** — Every song includes a gift credit: a dedicated page with a personal message and its own 4-digit PIN. The recipient enters the code, an envelope opens, the song plays, lyrics scroll in sync, confetti falls (petals for weddings, stars for memorials).

Returning creators sign in with a 6-digit email code — a 60-day session, no password ever.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4, Instrument Serif/Sans, `motion` animations |
| Database | PostgreSQL (Neon) via Prisma |
| Lyrics | Anthropic Claude API |
| Audio | Suno API |
| Payments | Stripe Checkout + webhooks |
| Email | Resend |
| Client state | Zustand with localStorage persistence |
| Deploy | Vercel |

Design highlights: WebGL mesh-gradient occasion cards (static until hover, CSS fallback on mobile/reduced-motion), a light "blush editorial" palette for the creation funnel, and a theatrical occasion-themed world for the gift reveal.

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database ([Neon](https://neon.tech) free tier works)
- API keys: [Anthropic](https://console.anthropic.com), [Suno](https://sunoapi.org), [Stripe](https://dashboard.stripe.com) (test mode), [Resend](https://resend.com)

### Setup

```bash
git clone https://github.com/sammamama/adoreyou.git
cd adoreyou
npm install
```

Create `.env` in the project root:

```env
# Database
DATABASE_URL=postgresql://...

# Anthropic (lyrics)
ANTHROPIC_API_KEY=sk-ant-...

# Suno (audio rendering)
SUNO_API_KEY=
SUNO_API_BASE_URL=

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email (Resend)
EMAIL_API_KEY=re_...
EMAIL_FROM=songs@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_JWT_SECRET=any-long-random-string

# Spotify (optional — powers the "rising artist" widget on the wait screen;
# the widget simply hides if these are unset)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

Push the schema and run:

```bash
npx prisma migrate dev   # creates tables + generates the client
npm run dev              # http://localhost:3000
```

### Stripe webhooks locally

Payments unlock through a webhook, so forward events to your dev server:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET` and restart the dev server. Use card `4242 4242 4242 4242` to test checkout.

## Project structure

```
app/
  page.tsx                  landing — occasion cards
  create/[occasion]/        guided story prompts
  create/lyrics/            genre + lyrics canvas + AI revisions
  create/length/            song length upsell → starts generation
  create/previews/          30s previews, pick a favorite, upsells
  create/checkout/          email + order summary → Stripe
  song/[id]/                unlock + song ready (creator view)
  gift/[giftId]/            recipient reveal (PIN → envelope → song)
  my-songs/                 returning-creator dashboard
  api/                      lyrics, generate, songs, gifts, auth,
                            checkout, stripe webhook, discover
components/                 UI (players, gift reveal, modals, forms)
lib/                        claude, suno, stripe, spotify, occasions,
                            email, sessions, access codes, db
prisma/schema.prisma        songs, gifts, login codes
```

## A few implementation notes

- **Preview-before-pay** — generation starts pre-payment so rendering hides behind the upsell/preview flow. The API serves range-limited 30s preview streams; full audio URLs are never sent to the client until the Stripe webhook marks the song paid.
- **Failed regeneration auto-refunds** — if a post-payment re-render fails, exactly that line item is refunded via Stripe with an idempotency key guarding double refunds.
- **Email is identity** — no users table. Checkout email + a 6-digit OTP (hashed, 10-min expiry, 5 attempts) → stateless JWT cookie.
- **Drafts survive refresh** — the whole creation flow persists to localStorage and clears only after successful payment.

## License

All rights reserved.
