'use client';

// Gift modal (Step 8, decisions #5 + #15). Personal message + optional
// recipient email → POST /api/gifts. Success shows the gift link + code with
// copy buttons and a prefilled WhatsApp share. Out of credits → gift-pack
// Stripe checkout (packs already handled by the webhook).
//
// Creator identity = the email used at checkout (no accounts, decision #1) —
// asked once and remembered in localStorage for next time.

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';

// Sender identity saved from the last gift sent on this device. Read lazily
// at state init — guarded for the server render, where the modal is closed
// and none of this markup exists anyway.
function savedSender(): { name: string; email: string } {
  if (typeof window === 'undefined') return { name: '', email: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(SENDER_KEY) ?? '{}');
    return { name: saved.name ?? '', email: saved.email ?? '' };
  } catch {
    return { name: '', email: '' };
  }
}

const ease = [0.22, 1, 0.36, 1] as const;

const SENDER_KEY = 'adoreyou-gift-sender';

const PACKS = [
  { pack: '1', credits: 1, price: '$3' },
  { pack: '3', credits: 3, price: '$5' },
  { pack: '10', credits: 10, price: '$15' },
];

type CreatedGift = {
  id: string;
  link: string;
  accessCode: string;
  emailSent: boolean;
};

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the value is visible to copy by hand.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${label}`}
      className="shrink-0 rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 transition-colors duration-200 hover:border-ink/40"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

const inputClasses =
  'w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base outline-none transition-colors duration-200 placeholder:text-ink/30 focus:border-accent';

export default function GiftModal({
  songId,
  recipientName,
  giftCredits,
  open,
  onClose,
  onCreated,
}: {
  songId: string;
  recipientName: string;
  giftCredits: number;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const reduced = useReducedMotion();

  const [senderName, setSenderName] = useState(() => savedSender().name);
  const [email, setEmail] = useState(() => savedSender().email);
  const [personalMessage, setPersonalMessage] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedGift | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const outOfCredits = giftCredits <= 0;

  const create = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId,
          email,
          senderName,
          personalMessage,
          ...(recipientEmail.trim() ? { recipientEmail } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Something went wrong.');
      }
      localStorage.setItem(
        SENDER_KEY,
        JSON.stringify({ name: senderName.trim(), email: email.trim() })
      );
      setCreated(json.data as CreatedGift);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const buyPack = async (pack: string) => {
    setError(null);
    setBuyingPack(pack);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId, giftPack: pack }),
      });
      const json = await res.json();
      if (!res.ok || json.error || !json.data?.url) {
        throw new Error(json.error ?? 'Could not start checkout.');
      }
      window.location.assign(json.data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBuyingPack(null);
    }
  };

  const giftUrl = created
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${created.link}`
    : '';
  const whatsappText = created
    ? `I made you a song 🎁 Open it here: ${giftUrl}\nYour access code: ${created.accessCode}`
    : '';

  const canSubmit =
    senderName.trim() && email.trim() && personalMessage.trim() && !submitting;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Gift this song"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.4, ease }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success — link + code, copy, WhatsApp */}
            {created ? (
              <>
                <h2 className="font-serif text-3xl">
                  Their gift is <span className="italic text-accent">ready</span>
                </h2>
                <p className="mt-2 text-sm text-ink/60">
                  {created.emailSent
                    ? `We emailed ${recipientName}'s gift — here's everything again in case you want to deliver it yourself too.`
                    : `Send ${recipientName} the link and code below — the song reveals when they enter it.`}
                </p>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-bg px-4 py-3">
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">
                      {giftUrl}
                    </span>
                    <CopyButton value={giftUrl} label="gift link" />
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-bg px-4 py-3">
                    <span className="flex-1 font-mono text-2xl tracking-[0.4em]">
                      {created.accessCode}
                    </span>
                    <CopyButton value={created.accessCode} label="access code" />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-13 items-center gap-2 rounded-full bg-[#25D366] px-7 text-base font-medium text-white transition-opacity duration-200 hover:opacity-90"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2 1-2.3.3-.3.6-.4.8-.4h.6c.2 0 .4-.1.7.5.2.6.8 2 .9 2.1.1.2.1.3 0 .5-.1.2-.2.4-.3.5l-.5.6c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3 0 .2 0 .7-.2 1.3Z" />
                    </svg>
                    Share on WhatsApp
                  </a>
                  <Button variant="ghost" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </>
            ) : outOfCredits ? (
              /* Out of credits — buy a pack */
              <>
                <h2 className="font-serif text-3xl">
                  Gift more <span className="italic text-accent">people</span>
                </h2>
                <p className="mt-2 text-sm text-ink/60">
                  You&rsquo;ve used every gift credit. Each credit creates one
                  more personalized gift page — its own message, its own code.
                </p>

                <div className="mt-6 space-y-3">
                  {PACKS.map(({ pack, credits, price }) => (
                    <button
                      key={pack}
                      type="button"
                      disabled={buyingPack !== null}
                      onClick={() => void buyPack(pack)}
                      className="flex w-full items-baseline justify-between rounded-2xl border border-ink/10 bg-white p-5 text-left transition-colors duration-200 hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="font-serif text-xl">
                        {credits} gift{credits === 1 ? '' : 's'}
                      </span>
                      <span className="text-lg font-medium text-accent">
                        {buyingPack === pack ? 'Opening checkout...' : `${price} AUD`}
                      </span>
                    </button>
                  ))}
                </div>

                {error && (
                  <p className="mt-4 text-sm text-accent" role="alert">
                    {error}
                  </p>
                )}

                <div className="mt-6 flex justify-end">
                  <Button variant="ghost" onClick={onClose}>
                    Maybe later
                  </Button>
                </div>
              </>
            ) : (
              /* Create form */
              <>
                <h2 className="font-serif text-3xl">
                  Gift it to <span className="italic text-accent">{recipientName}</span>
                </h2>
                <p className="mt-2 text-sm text-ink/60">
                  A personal message and their own reveal page, sealed with a
                  4-digit code. {giftCredits} gift{' '}
                  {giftCredits === 1 ? 'credit' : 'credits'} remaining.
                </p>

                <form
                  className="mt-6 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (canSubmit) void create();
                  }}
                >
                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="gift-sender">
                      Your name
                    </label>
                    <input
                      id="gift-sender"
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="So they know who it's from"
                      className={inputClasses}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="gift-email">
                      Your email
                    </label>
                    <input
                      id="gift-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="The one you used at checkout"
                      className={inputClasses}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="gift-message">
                      Personal message
                    </label>
                    <textarea
                      id="gift-message"
                      value={personalMessage}
                      onChange={(e) => setPersonalMessage(e.target.value)}
                      rows={3}
                      placeholder={`What you'd write inside the card — ${recipientName} sees this on their gift page`}
                      className={`${inputClasses} resize-none`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="gift-recipient-email">
                      Their email <span className="font-normal text-ink/40">(optional)</span>
                    </label>
                    <input
                      id="gift-recipient-email"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="We'll deliver it beautifully — or skip and share it yourself"
                      className={inputClasses}
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-accent" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="ghost" type="button" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!canSubmit}
                      className={!canSubmit ? 'cursor-not-allowed opacity-40' : ''}
                    >
                      {submitting ? 'Wrapping it up...' : 'Create the gift'}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
