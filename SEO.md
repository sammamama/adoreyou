# SEO Plan — adoreyou.app

Audit date: 2026-07-12. Current state: **no robots.txt, no sitemap, no structured data, no Search Console, ~5 indexable pages.** Google likely hasn't properly indexed the site at all yet.

---

## Phase 1 — Technical foundation ✅ implemented 2026-07-12

### 1.1 `app/robots.ts` ✅
Generates `/robots.txt`. Only `/api/` is disallowed — private pages use meta `noindex` instead, because a robots.txt block would (a) stop Google from ever seeing the noindex tag and (b) break gift link previews (Meta's preview crawler respects robots.txt).

### 1.2 `app/sitemap.ts` ✅
Lists the 5 public pages (home, how-it-works, pricing, terms, privacy). Add occasion landing pages here when built (Phase 3).

### 1.3 `noindex` private/thin pages ✅
- `/gift/[giftId]` — `robots` added in `generateMetadata` (OG tags kept for WhatsApp/iMessage previews; noindex doesn't affect link cards)
- `/song/*` — via new `app/song/layout.tsx`
- `/create/*` — via new `app/create/layout.tsx`
- `/my-songs` — added to page metadata

### 1.4 Canonical URLs ✅
`alternates: { canonical: ... }` on home, pricing, how-it-works, terms, privacy (relative, resolved via `metadataBase`). Homepage got a server wrapper (`app/page.tsx`) with UI moved to `components/HomeClient.tsx` to make metadata + JSON-LD possible.

### 1.5 Verify production env ⚠️ TODO (manual)
`metadataBase` reads `NEXT_PUBLIC_APP_URL`. Confirm it's set to `https://adoreyou.app` in the **Vercel project env** (local `.env` has it, but production uses Vercel's). Wrong value silently breaks OG image URLs, canonicals, robots/sitemap URLs.

### 1.6 Structured data (JSON-LD) ✅ partial
Organization + Product (with $20 USD offer) injected on the homepage via `app/page.tsx`. **FAQPage schema deferred**: the site has no visible FAQ section yet, and schema must match visible content (Google penalizes invisible FAQ markup). Add FAQPage when a real FAQ block ships (good fit for Phase 3 occasion pages).

### 1.7 Favicon + icons ✅
`app/icon.png` + `app/apple-icon.png` added (from `logo-mark.png`, 256×256). Next serves these automatically; Google shows favicons in mobile SERPs.

### 1.8 OG locale — not changed
`locale: 'en_AU'` left as-is; change to `en_US` if the target market is global/US (minor signal).

---

## Phase 2 — Get indexed (week 1, mostly waiting)

1. **Google Search Console**: add `adoreyou.app` as a Domain property (DNS TXT verification — you control the domain). This is the single most important step; without it you're blind.
2. Submit `sitemap.xml` in Search Console.
3. Use **URL Inspection → Request Indexing** on the homepage, /pricing, /how-it-works to skip the queue.
4. **Bing Webmaster Tools**: import from Search Console (one click). Bing also feeds DuckDuckGo and ChatGPT/Copilot answers.
5. Check `site:adoreyou.app` in Google after ~1 week to confirm pages appear.

---

## Phase 3 — Content that can actually rank (weeks 2–8)

The site currently has ~3 real pages of content. Google won't rank a 3-page site for competitive terms. The highest-leverage move:

### 3.1 Occasion landing pages (biggest opportunity)
Nine occasions already exist in `lib/occasions.ts`. Build a public, server-rendered landing page per occasion — e.g. `/songs/birthday`, `/songs/anniversary`, `/songs/memorial` — each targeting long-tail keywords:

- "personalized birthday song" / "custom birthday song gift"
- "custom anniversary song for husband/wife"
- "memorial song for funeral" / "custom tribute song"
- "father's day song from daughter", "mother's day custom song"

Each page needs: unique 500+ word copy (not templated boilerplate), an example song embed, FAQ block with FAQ schema, price, CTA into `/create/[occasion]`. These are 9 pages targeting keywords with real intent and much weaker competition than head terms.

### 3.2 Example/showcase pages
Public pages with playable example songs per occasion ("hear a real anniversary song"). Audio demos earn dwell time and links.

### 3.3 Blog (optional but compounding)
2–4 posts/month targeting question keywords: "unique 50th birthday gift ideas", "what to get someone who has everything", "sentimental wedding gifts". Each funnels to an occasion page. This is how Songfinch (the market leader) built most of its organic traffic.

---

## Phase 4 — Performance / Core Web Vitals (week 2)

- Homepage is one big `'use client'` component with motion animations. Content still server-renders, but check **LCP** — the hero h1 animates in from `opacity: 0`, which can delay LCP paint. Consider rendering hero text visible-by-default and animating only decoration.
- Run PageSpeed Insights on `/`, `/pricing`, `/how-it-works`; target green CWV on mobile.
- Fonts already use `display: swap` — good.
- Check the ExamplesCarousel videos: lazy-load, don't autoplay-download all on mobile.

---

## Phase 5 — Authority / backlinks (ongoing, months 2–6)

New domain starts at ~0 authority. Competitors (Songfinch DR ~70, Songlorious ~60) have years of links. Realistic link sources:

1. **Product directories**: Product Hunt launch, There's An AI For That, Futurepedia, AlternativeTo — easy first 10–20 links.
2. **Gift-guide outreach**: pitch to "unique gifts" listicles before Valentine's/Mother's Day/Christmas — these pages rank and update yearly.
3. **PR angle**: "AI turns your memories into a song" is press-friendly; pitch niche tech/gifting newsletters.
4. **Social proof loops**: TikTok/X content (already planned in content strategy doc) → viral moments → organic links. Reaction-video content historically drives Songfinch-style growth.
5. Do NOT buy links or use link farms — new domains get burned fast.

---

## Phase 6 — Measure & iterate (monthly)

- Search Console: track impressions → clicks → position per query; find keywords stuck at position 8–20 and strengthen those pages.
- Set up analytics if not present (Vercel Analytics or Plausible) to see organic landing pages.
- Refresh occasion pages before their seasonal peak (Mother's Day page updated in March, etc.).

---

## Realistic expectations

| Target | Timeline |
|---|---|
| Indexed, ranking #1 for "adoreyou" brand searches | 1–3 weeks after Phase 1–2 |
| Long-tail occasion terms ("custom memorial song") on page 1 | 3–6 months, needs Phase 3 pages + first links |
| Mid-competition terms ("personalized song gift") page 1 | 9–18 months, needs sustained content + 50+ quality referring domains |
| Head terms ("custom song", "song generator") | Likely never via SEO alone — Suno/Songfinch own these; win via brand + social instead |

Priority order if time is scarce: **1.1–1.3 → Phase 2 → 3.1 → Phase 5 directories.** Everything else is optimization on top.
