'use client';

// Gift modal (Step 8, decisions #5 + #15). Personal message + recipient
// email → POST /api/gifts, which emails the recipient their gift. Success
// shows the gift link + code with copy buttons and a prefilled WhatsApp
// share. Out of credits → gift-pack Stripe checkout (packs already handled
// by the webhook).

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import DeliveryCalendar from '@/components/DeliveryCalendar';

// Sender name saved from the last gift sent on this device. Read lazily
// at state init — guarded for the server render, where the modal is closed
// and none of this markup exists anyway.
function savedSenderName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = JSON.parse(localStorage.getItem(SENDER_KEY) ?? '{}');
    return saved.name ?? '';
  } catch {
    return '';
  }
}

const ease = [0.22, 1, 0.36, 1] as const;

const SENDER_KEY = 'adoreyou-gift-sender';

const PACKS = [
  { pack: '1', credits: 1, price: '$1.99' },
  { pack: '3', credits: 3, price: '$3.99' },
  { pack: '10', credits: 10, price: '$9.99' },
];

type CreatedGift = {
  id: string;
  link: string;
  accessCode: string;
  emailSent: boolean;
  deliverAt: string | null;
};

const MAX_VOICE_SECONDS = 60;

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

// The full share message — what recipients need to open the gift. Copied as
// one block and prefilled into WhatsApp.
export function giftShareText(giftUrl: string, accessCode: string): string {
  return `I made you a song 🎁 Open it here: ${giftUrl}\nYour access code: ${accessCode}`;
}

// One box per gift: link + code together, a single Copy for the whole message.
export function GiftShareBox({
  giftUrl,
  accessCode,
  sentTo,
}: {
  giftUrl: string;
  accessCode: string;
  sentTo?: string | null;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-bg p-4">
      {sentTo && <p className="mb-2 text-xs text-ink/50">Sent to {sentTo}</p>}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={giftUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate font-mono text-sm text-accent underline underline-offset-4"
          >
            {giftUrl}
          </a>
          <p className="mt-2 font-mono text-lg tracking-[0.35em]">
            {accessCode}
          </p>
        </div>
        <CopyButton
          value={giftShareText(giftUrl, accessCode)}
          label="gift link and code"
        />
      </div>
    </div>
  );
}

const inputClasses =
  'w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base outline-none transition-colors duration-200 placeholder:text-ink/30 focus:border-accent';

export type GiftableTrack = {
  index: number;
  label: string; // e.g. "Version 1 — Pop"
  selected: boolean; // the song's chosen final track
};

export default function GiftModal({
  songId,
  recipientName,
  giftCredits,
  open,
  onClose,
  onCreated,
  showPacks = false,
  tracks,
}: {
  songId: string;
  recipientName: string;
  giftCredits: number;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showPacks?: boolean; // open straight to the gift-pack screen
  // Unlocked versions (Keep Every Version) — a picker shows when there's a
  // real choice; omitted/single = the gift plays the song's selected track.
  tracks?: GiftableTrack[];
}) {
  const reduced = useReducedMotion();

  const [senderName, setSenderName] = useState(() => savedSenderName());
  const [personalMessage, setPersonalMessage] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [trackIndex, setTrackIndex] = useState<number | null>(
    () => tracks?.find((t) => t.selected)?.index ?? null
  );

  // Delivery moment — now, or a scheduled unwrap (email + page unlock).
  const [deliverMode, setDeliverMode] = useState<'now' | 'schedule'>('now');
  const [deliverAt, setDeliverAt] = useState('');

  // Optional photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Optional voice note (MediaRecorder)
  const [recording, setRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreview, setVoicePreview] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedGift | null>(null);

  const pickPhoto = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const clearVoice = () => {
    if (voicePreview) URL.revokeObjectURL(voicePreview);
    setVoiceBlob(null);
    setVoicePreview(null);
  };

  const stopRecording = () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const startRecording = async () => {
    setError(null);
    clearVoice();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone unavailable — check your browser permissions.');
      return;
    }
    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : undefined;
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || 'audio/webm',
      });
      setVoiceBlob(blob);
      setVoicePreview(URL.createObjectURL(blob));
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    stopTimerRef.current = setTimeout(stopRecording, MAX_VOICE_SECONDS * 1000);
  };

  // Mic never survives the modal closing.
  useEffect(() => {
    if (!open && recording) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const outOfCredits = giftCredits <= 0 || showPacks;

  const create = async () => {
    setError(null);
    setSubmitting(true);
    if (recording) stopRecording();
    try {
      const form = new FormData();
      form.set('songId', songId);
      form.set('senderName', senderName);
      form.set('personalMessage', personalMessage);
      form.set('recipientEmail', recipientEmail);
      if (tracks && tracks.length > 1 && trackIndex !== null) {
        form.set('trackIndex', String(trackIndex));
      }
      if (deliverMode === 'schedule' && deliverAt) {
        form.set('deliverAt', new Date(deliverAt).toISOString());
      }
      if (photoFile) form.set('photo', photoFile);
      if (voiceBlob) {
        form.set(
          'voiceNote',
          voiceBlob,
          voiceBlob.type.includes('mp4') ? 'voice-note.m4a' : 'voice-note.webm'
        );
      }

      const res = await fetch('/api/gifts', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Something went wrong.');
      }
      localStorage.setItem(
        SENDER_KEY,
        JSON.stringify({ name: senderName.trim() })
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
  const whatsappText = created ? giftShareText(giftUrl, created.accessCode) : '';

  const scheduleValid =
    deliverMode === 'now' ||
    (deliverAt !== '' && new Date(deliverAt).getTime() > Date.now());

  const canSubmit =
    senderName.trim() &&
    recipientEmail.trim() &&
    scheduleValid &&
    !submitting;

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
                  {created.deliverAt
                    ? `We'll email ${recipientName}'s gift on ${new Date(created.deliverAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })} — the page stays sealed until then.`
                    : created.emailSent
                      ? `We emailed ${recipientName}'s gift — here's everything again in case you want to deliver it yourself too.`
                      : `Send ${recipientName} the link and code below — the song reveals when they enter it.`}
                </p>

                <div className="mt-6">
                  <GiftShareBox
                    giftUrl={giftUrl}
                    accessCode={created.accessCode}
                  />
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
                  {giftCredits <= 0
                    ? 'You’ve used every gift credit. '
                    : ''}
                  Each credit creates one more personalized gift page — its
                  own message, its own code.
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
                        {buyingPack === pack ? 'Opening checkout...' : `${price} USD`}
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

                  {tracks && tracks.length > 1 && (
                    <div>
                      <p className="mb-1.5 text-sm font-medium">
                        Which version should they hear?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {tracks.map((t) => (
                          <button
                            key={t.index}
                            type="button"
                            onClick={() => setTrackIndex(t.index)}
                            aria-pressed={trackIndex === t.index}
                            className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${
                              trackIndex === t.index
                                ? 'border-accent bg-accent text-white'
                                : 'border-ink/15 bg-white hover:border-ink/40'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium" htmlFor="gift-message">
                      Personal message{' '}
                      <span className="font-normal text-ink/40">(optional)</span>
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
                      Their email
                    </label>
                    <input
                      id="gift-recipient-email"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="We'll deliver their gift beautifully by email"
                      className={inputClasses}
                    />
                  </div>

                  {/* Delivery moment */}
                  <div>
                    <p className="mb-1.5 text-sm font-medium">When should it arrive?</p>
                    <div className="flex gap-2">
                      {(['now', 'schedule'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setDeliverMode(mode)}
                          aria-pressed={deliverMode === mode}
                          className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${
                            deliverMode === mode
                              ? 'border-accent bg-accent text-white'
                              : 'border-ink/15 bg-white hover:border-ink/40'
                          }`}
                        >
                          {mode === 'now' ? 'Right now' : 'Pick the moment'}
                        </button>
                      ))}
                    </div>
                    {deliverMode === 'schedule' && (
                      <div className="mt-3">
                        <DeliveryCalendar
                          value={deliverAt}
                          onChange={setDeliverAt}
                        />
                        <p className="mt-1.5 text-xs text-ink/50">
                          The email arrives and the gift unwraps at this moment
                          — perfect for the morning of the big day.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Optional photo */}
                  <div>
                    <p className="mb-1.5 text-sm font-medium">
                      Add a photo{' '}
                      <span className="font-normal text-ink/40">(optional)</span>
                    </p>
                    {photoPreview ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoPreview}
                          alt="Photo preview"
                          className="h-16 w-16 rounded-xl border border-ink/10 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => pickPhoto(null)}
                          className="rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 hover:border-ink/40"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex cursor-pointer items-center rounded-full border border-ink/15 px-4 py-2 text-sm text-ink/60 transition-colors duration-200 hover:border-ink/40">
                        Choose a photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            pickPhoto(e.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                    )}
                    <p className="mt-1.5 text-xs text-ink/50">
                      Shown on their gift page, next to your message. Under 3MB.
                    </p>
                  </div>

                  {/* Optional voice note */}
                  <div>
                    <p className="mb-1.5 text-sm font-medium">
                      Record a voice note{' '}
                      <span className="font-normal text-ink/40">(optional)</span>
                    </p>
                    {voicePreview ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <audio src={voicePreview} controls className="h-10 max-w-full" />
                        <button
                          type="button"
                          onClick={clearVoice}
                          className="rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 hover:border-ink/40"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          recording ? stopRecording() : void startRecording()
                        }
                        aria-pressed={recording}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${
                          recording
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-ink/15 text-ink/60 hover:border-ink/40'
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`h-2 w-2 rounded-full ${recording ? 'animate-pulse bg-accent' : 'bg-ink/30'}`}
                        />
                        {recording ? 'Recording… tap to stop' : 'Record'}
                      </button>
                    )}
                    <p className="mt-1.5 text-xs text-ink/50">
                      Up to a minute — they hear it before the song plays.
                    </p>
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
