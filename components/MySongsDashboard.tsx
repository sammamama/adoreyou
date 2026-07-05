'use client';

// Step 10 — returning creator. No session: email → 6-digit code (POST
// /api/auth/request-code, /api/auth/verify-code) → router.refresh() re-renders
// the server page with the new session cookie. With session: song cards with
// play, gift button (same GiftModal as Song Ready), sent gifts + remaining
// credits.

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import GiftModal, { CopyButton } from '@/components/GiftModal';
import SongPlayer from '@/components/SongPlayer';
import Button from '@/components/ui/Button';
import { getOccasion } from '@/lib/occasions';

const ease = [0.22, 1, 0.36, 1] as const;

export type DashboardGift = {
  id: string;
  link: string;
  accessCode: string;
  recipientEmail: string | null;
};

export type DashboardSong = {
  id: string;
  recipientName: string;
  occasion: string;
  createdAt: string; // ISO
  paid: boolean;
  genre: string | null;
  audioUrl: string | null;
  downloadUrl: string | null;
  giftCredits: number;
  gifts: DashboardGift[];
};

const inputClasses =
  'w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base outline-none transition-colors duration-200 placeholder:text-ink/30 focus:border-accent';

function LoginForm() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (url: string, body: object) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error ?? 'Something went wrong.');
    }
  };

  const requestCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await post('/api/auth/request-code', { email });
      setStep('code');
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await post('/api/auth/verify-code', { email, code });
      router.refresh(); // session cookie is set — server page now sees it
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease }}
      className="mx-auto mt-10 max-w-md"
    >
      <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
        Find my <span className="italic text-accent">songs</span>
      </h1>

      {step === 'email' ? (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim() && !busy) void requestCode();
          }}
        >
          <p className="text-sm text-ink/60">
            Enter the email you used at checkout — we&rsquo;ll send you a
            6-digit sign-in code.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Your email"
            className={inputClasses}
          />
          {error && (
            <p className="text-sm text-accent" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={!email.trim() || busy}
            className={!email.trim() || busy ? 'cursor-not-allowed opacity-40' : ''}
          >
            {busy ? 'Sending...' : 'Send my code'}
          </Button>
        </form>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length === 6 && !busy) void verifyCode();
          }}
        >
          <p className="text-sm text-ink/60">
            We sent a 6-digit code to <strong>{email}</strong>. It expires in
            10 minutes.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            aria-label="6-digit sign-in code"
            className={`${inputClasses} text-center font-mono text-2xl tracking-[0.5em]`}
          />
          {error && (
            <p className="text-sm text-accent" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={code.trim().length !== 6 || busy}
              className={
                code.trim().length !== 6 || busy ? 'cursor-not-allowed opacity-40' : ''
              }
            >
              {busy ? 'Checking...' : 'Sign in'}
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => void requestCode()}
            >
              Resend code
            </Button>
          </div>
        </form>
      )}
    </motion.div>
  );
}

function SongCard({
  song,
  index,
  onGift,
}: {
  song: DashboardSong;
  index: number;
  onGift: () => void;
}) {
  const reduced = useReducedMotion();
  const occasion = getOccasion(song.occasion);

  // window is client-only — the server render shows relative gift links.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ''
  );

  return (
    <motion.article
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease, delay: 0.07 * (index + 1) }}
      className="rounded-2xl border border-ink/10 bg-white p-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl">
          For <span className="italic text-accent">{song.recipientName}</span>
        </h2>
        {occasion && (
          <span
            className="shrink-0 rounded-full border px-3 py-0.5 text-xs font-medium"
            style={{
              color: occasion.theme.accent,
              borderColor: `${occasion.theme.accent}55`,
            }}
          >
            {occasion.name}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-ink/40">
        Created{' '}
        {new Date(song.createdAt).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>

      {song.paid && song.audioUrl ? (
        <div className="mt-4">
          <SongPlayer
            src={song.audioUrl}
            title={`A song for ${song.recipientName}`}
            subtitle={song.genre ?? undefined}
            downloadUrl={song.downloadUrl ?? undefined}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink/60">
          This song hasn&rsquo;t been unlocked yet —{' '}
          <Link
            href={`/song/${song.id}`}
            className="text-accent underline underline-offset-4"
          >
            finish it here
          </Link>
          .
        </p>
      )}

      {song.paid && (
        <div className="mt-5 border-t border-ink/10 pt-5">
          <div className="flex items-center gap-4">
            <Button onClick={onGift}>Gift this song</Button>
            <p className="text-sm text-ink/50">
              {song.giftCredits} gift{' '}
              {song.giftCredits === 1 ? 'credit' : 'credits'} remaining
            </p>
          </div>

          {song.gifts.length > 0 && (
            <ul className="mt-5 space-y-3">
              {song.gifts.map((gift) => {
                const giftUrl = `${origin}${gift.link}`;
                return (
                  <li
                    key={gift.id}
                    className="rounded-xl border border-ink/10 bg-bg p-4"
                  >
                    {gift.recipientEmail && (
                      <p className="mb-2 text-xs text-ink/50">
                        Sent to {gift.recipientEmail}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <a
                        href={gift.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate font-mono text-sm text-accent underline underline-offset-4"
                      >
                        {giftUrl}
                      </a>
                      <CopyButton value={giftUrl} label="gift link" />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="flex-1 font-mono text-lg tracking-[0.35em]">
                        {gift.accessCode}
                      </span>
                      <CopyButton value={gift.accessCode} label="access code" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </motion.article>
  );
}

export default function MySongsDashboard({
  email,
  songs,
}: {
  email: string | null;
  songs: DashboardSong[];
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [giftSongId, setGiftSongId] = useState<string | null>(null);

  if (!email) return <LoginForm />;

  const giftSong = songs.find((s) => s.id === giftSongId);

  return (
    <div className="mt-10">
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(10px)' }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease }}
      >
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          Your <span className="italic text-accent">songs</span>
        </h1>
        <p className="mt-2 text-sm text-ink/50">{email}</p>
      </motion.div>

      {songs.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease, delay: 0.07 }}
          className="mt-8 text-ink/60"
        >
          No songs on this email yet —{' '}
          <Link href="/" className="text-accent underline underline-offset-4">
            create your first one
          </Link>
          .
        </motion.p>
      ) : (
        <div className="mt-8 space-y-6">
          {songs.map((song, i) => (
            <SongCard
              key={song.id}
              song={song}
              index={i}
              onGift={() => setGiftSongId(song.id)}
            />
          ))}
        </div>
      )}

      {giftSong && (
        <GiftModal
          songId={giftSong.id}
          recipientName={giftSong.recipientName}
          giftCredits={giftSong.giftCredits}
          open={giftSongId !== null}
          onClose={() => setGiftSongId(null)}
          onCreated={() => router.refresh()}
        />
      )}
    </div>
  );
}
