'use client';

// Step 7 — email + pay. Confirm-twice pattern (decision #13): user enters
// email, then sees "We'll send your song to X — correct?" before checkout.
// No OTP — just visual confirmation to catch typos. Order summary shows
// base + selected upsells; one Stripe Checkout session covers everything.

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Wordmark from '@/components/Wordmark';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { useDraftStore } from '@/lib/store';

const ease = [0.22, 1, 0.36, 1] as const;

// Display only — the server is the price authority.
const PRICES = {
  base: 2000,
  length: { 2: 0, 3: 999, 4: 1299 } as Record<2 | 3 | 4, number>,
  keepEveryVersion: 599,
  regen: 1299,
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function CheckoutPageInner() {
  const reduced = useReducedMotion();
  const router = useRouter();
  // Stripe sends the user back here with ?canceled=1 when they abandon
  // payment — nothing was charged, the order is intact. songId + track are
  // echoed back too so the order survives a lost or clobbered local draft.
  const searchParams = useSearchParams();
  const canceled = searchParams.has('canceled');
  const urlSongId = searchParams.get('songId');
  const urlTrack = searchParams.get('track');

  const songId = useDraftStore((s) => s.songId);
  const recipientName = useDraftStore((s) => s.recipientName);
  const verseCount = useDraftStore((s) => s.verseCount);
  const selectedTrackId = useDraftStore((s) => s.selectedTrackId);
  const keepEveryVersion = useDraftStore((s) => s.keepEveryVersion);
  const regenGenre = useDraftStore((s) => s.regenGenre);
  const update = useDraftStore((s) => s.update);

  const [hydrated, setHydrated] = useState(false);
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  // Returning from Stripe with a draft that doesn't match the order (lost
  // localStorage, stale draft from an older song) — trust the URL, restore
  // the order, and drop upsell flags the stale draft can't vouch for.
  useEffect(() => {
    if (!hydrated || !canceled || !urlSongId) return;
    if (songId === urlSongId) return;
    const track = Number(urlTrack);
    update({
      songId: urlSongId,
      selectedTrackId: Number.isInteger(track) ? track : null,
      keepEveryVersion: false,
      regenGenre: null,
    });
  }, [hydrated, canceled, urlSongId, urlTrack, songId, update]);

  // Browser-back from Stripe can restore this page from the bfcache mid
  // "Taking you to payment..." — reset so the user isn't stuck on a dead
  // spinner with a disabled button.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setLoading(false);
        setConfirming(false);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) setConfirming(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming, loading]);

  const entrance = (delay: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, ease, delay },
  });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const lines: { label: string; amount: number }[] = [
    { label: 'Your song', amount: PRICES.base },
    ...(verseCount !== 2
      ? [{ label: `${verseCount} verses`, amount: PRICES.length[verseCount] }]
      : []),
    ...(keepEveryVersion
      ? [{ label: 'Keep Every Version', amount: PRICES.keepEveryVersion }]
      : []),
    ...(regenGenre
      ? [
          {
            label: `Regenerate in a New Genre (${regenGenre})`,
            amount: PRICES.regen,
          },
        ]
      : []),
  ];
  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  const pay = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId,
          email: email.trim(),
          selectedTrackIndex: selectedTrackId,
          keepEveryVersion,
          regenGenre: regenGenre ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error || !json.data?.url) {
        // Draft outlived the purchase (e.g. paid in another tab) — the song
        // page is where this order lives now.
        if (json.error === 'This song is already paid for.') {
          router.push(`/song/${songId}`);
          return;
        }
        throw new Error(json.error ?? 'Something went wrong.');
      }
      window.location.assign(json.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  };

  const draftReady = songId !== null && selectedTrackId !== null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Wordmark />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        <motion.div {...entrance(0)}>
          <p className="text-sm text-ink/50">
            {recipientName ? `A song for ${recipientName}` : 'Your song'}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            Almost <span className="italic text-accent">theirs</span>
          </h1>
        </motion.div>

        {hydrated && !draftReady && (
          <motion.div {...entrance(0.07)} className="mt-10">
            <p className="text-ink/60">
              Pick your favorite version first — then we&rsquo;ll get it to
              you.
            </p>
            <Button href="/create/previews" className="mt-6">
              Back to previews
            </Button>
          </motion.div>
        )}

        {hydrated && draftReady && (
          <>
            {canceled && (
              <motion.p
                {...entrance(0.05)}
                className="mt-8 rounded-2xl border border-ink/10 bg-white/50 p-4 text-sm text-ink/60"
                role="status"
              >
                Payment didn&rsquo;t go through — you weren&rsquo;t charged.
                Your song is safe; pick up right where you left off.
              </motion.p>
            )}

            {/* Email — enter, then confirm in a modal before paying */}
            <motion.section {...entrance(0.07)} className="mt-10">
              <label
                htmlFor="email"
                className="block font-serif text-2xl"
              >
                Where should we <span className="italic text-accent">send</span>{' '}
                it?
              </label>
              <p className="mt-2 text-sm text-ink/60">
                We&rsquo;ll send your song here — no account needed.
              </p>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && emailValid) setConfirming(true);
                }}
                placeholder="you@example.com"
                className="mt-4 h-13 w-full rounded-full border border-ink/15 bg-white px-6 text-base outline-none transition-colors duration-200 focus:border-accent"
              />
            </motion.section>

            {/* Order summary */}
            <motion.section {...entrance(0.14)} className="mt-10">
              <h2 className="font-serif text-2xl">Your order</h2>
              <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-6">
                <ul className="space-y-3">
                  {lines.map((line) => (
                    <li
                      key={line.label}
                      className="flex items-baseline justify-between gap-4 text-sm"
                    >
                      <span className="text-ink/70">{line.label}</span>
                      <span>{usd(line.amount)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-baseline justify-between border-t border-ink/10 pt-4">
                  <span className="font-medium">Total</span>
                  <span className="font-serif text-2xl">
                    {usd(total)} <span className="text-sm text-ink/50">USD</span>
                  </span>
                </div>
                <p className="mt-3 text-xs text-ink/40">
                  Checkout shows the total in your local currency.
                </p>
              </div>
            </motion.section>

            <motion.div {...entrance(0.21)} className="mt-12">
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => router.push('/create/previews')}
                  className="rounded-full px-4 py-2 text-sm text-ink/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Back
                </button>
                <Button
                  disabled={!emailValid}
                  onClick={() => setConfirming(true)}
                  className={emailValid ? '' : 'cursor-not-allowed opacity-40'}
                >
                  Continue
                </Button>
              </div>
            </motion.div>

            {/* Confirm modal — email check + terms + pay */}
            <AnimatePresence>
              {confirming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
                  onClick={() => !loading && setConfirming(false)}
                >
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Confirm your email and pay"
                    initial={
                      reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }
                    }
                    animate={
                      reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
                    }
                    exit={
                      reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }
                    }
                    transition={{ duration: 0.4, ease }}
                    className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 className="font-serif text-3xl">
                      One last <span className="italic text-accent">check</span>
                    </h2>
                    <p className="mt-2 text-sm text-ink/60">
                      We&rsquo;ll send{' '}
                      {recipientName ? `${recipientName}'s` : 'your'} song to
                    </p>
                    <p className="mt-3 break-all rounded-xl border border-ink/10 bg-ink/3 px-4 py-3 font-medium">
                      {email.trim()}
                    </p>

                    <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-ink/60">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]"
                      />
                      <span>
                        I agree to the{' '}
                        <a
                          href="/terms"
                          target="_blank"
                          className="underline underline-offset-4 text-accent"
                        >
                          Terms of Service
                        </a>{' '}
                        and{' '}
                        <a
                          href="/privacy"
                          target="_blank"
                          className="underline underline-offset-4 text-accent"
                        >
                          Privacy Policy
                        </a>
                      </span>
                    </label>

                    {error && (
                      <p className="mt-4 text-sm text-accent" role="alert">
                        {error}
                      </p>
                    )}

                    <div className="mt-6 flex items-center gap-3">
                      <Button
                        disabled={loading || !agreed}
                        onClick={() => void pay()}
                        className={
                          loading || !agreed ? 'cursor-not-allowed opacity-40' : ''
                        }
                      >
                        {loading
                          ? 'Taking you to payment...'
                          : `Pay ${usd(total)} USD`}
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        disabled={loading}
                        onClick={() => setConfirming(false)}
                      >
                        Edit email
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  // useSearchParams requires a Suspense boundary in client pages.
  return (
    <Suspense>
      <CheckoutPageInner />
    </Suspense>
  );
}
