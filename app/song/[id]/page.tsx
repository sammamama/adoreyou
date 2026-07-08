'use client';

// Step 8 — unlock / Song Ready (creator view). Stripe redirects here after
// payment; the base song is already rendered so the page unlocks as soon as
// the webhook lands (brief "confirming payment" poll covers webhook lag).
//
// If Regenerate in a New Genre was purchased: processing state while the new
// pair renders (polling, decision #4) → previews of all versions → final
// pick (PATCH /api/songs/[id]). Keep Every Version leaves everything
// unlocked regardless of the pick (decision #14).

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import GiftModal, { GiftShareBox } from '@/components/GiftModal';
import ProcessingView from '@/components/ProcessingView';
import SongPlayer from '@/components/SongPlayer';
import Button from '@/components/ui/Button';
import { getOccasion } from '@/lib/occasions';
import { useDraftStore } from '@/lib/store';

const ease = [0.22, 1, 0.36, 1] as const;
const POLL_INTERVAL = 5_000;

type SongTrack = {
  index: number;
  genre: string;
  kind: 'original' | 'regen';
  previewUrl: string;
  audioUrl?: string;
  downloadUrl?: string;
};

type SentGift = {
  id: string;
  link: string;
  accessCode: string;
  recipientEmail: string | null;
};

type SongData = {
  id: string;
  status: 'generating' | 'preview' | 'paid' | 'done' | 'failed';
  recipientName: string;
  occasion: string;
  tracks: SongTrack[];
  selectedTrackIndex?: number;
  giftCredits?: number;
  gifts?: SentGift[];
  regenPending?: boolean;
  regenPickPending?: boolean;
  regenRefunded?: boolean;
};

const isPaid = (song: SongData) =>
  song.status === 'paid' || song.status === 'done';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M7 5a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Zm10 0a1 1 0 0 1 1 1v12a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

// Final pick after the regen pair lands — all versions playable (full audio
// where unlocked, 30s previews otherwise), pick one, confirm via PATCH.
function FinalPick({
  song,
  onPicked,
}: {
  song: SongData;
  onPicked: (updated: SongData) => void;
}) {
  const reduced = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(
    song.selectedTrackIndex ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
  const [playing, setPlaying] = useState<number | null>(null);

  const allUnlocked = song.tracks.every((t) => t.audioUrl);

  const togglePlay = (index: number) => {
    const audio = audioRefs.current[index];
    if (!audio) return;
    if (playing === index) {
      audio.pause();
      return;
    }
    Object.entries(audioRefs.current).forEach(([key, el]) => {
      if (Number(key) !== index) el?.pause();
    });
    void audio.play();
  };

  const confirm = async () => {
    if (picked === null) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/songs/${song.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedTrackIndex: picked }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Something went wrong.');
      }
      onPicked(json.data as SongData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease }}
    >
      <p className="text-sm text-ink/50">
        {allUnlocked
          ? 'Every version is yours — pick the one that leads.'
          : 'Your new versions are here — listen to everything, then pick your final song.'}
      </p>

      <div className="mt-4 space-y-4" role="radiogroup" aria-label="Pick your final song">
        {song.tracks.map((track) => {
          const selected = picked === track.index;
          return (
            <div
              key={track.index}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => setPicked(track.index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPicked(track.index);
                }
              }}
              className={`cursor-pointer rounded-2xl border p-6 transition-colors duration-200 ${
                selected
                  ? 'border-accent bg-white'
                  : 'border-ink/10 bg-white/50 hover:border-ink/30'
              }`}
            >
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay(track.index);
                  }}
                  aria-label={
                    playing === track.index
                      ? `Pause version ${track.index + 1}`
                      : `Play version ${track.index + 1}`
                  }
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors duration-200 hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {playing === track.index ? <PauseIcon /> : <PlayIcon />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-serif text-xl">
                      Version {track.index + 1}
                    </span>
                    <span className="text-sm text-ink/50">
                      {track.genre}
                      {track.kind === 'regen' ? ' · new' : ''}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-ink/40">
                    {track.audioUrl ? 'Full song' : '30-second preview'}
                  </p>
                </div>

                <div
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                    selected ? 'border-accent bg-accent' : 'border-ink/20'
                  }`}
                >
                  {selected && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>

              <audio
                ref={(el) => {
                  audioRefs.current[track.index] = el;
                }}
                src={track.audioUrl ?? track.previewUrl}
                preload="none"
                onPlay={() => setPlaying(track.index)}
                onPause={() =>
                  setPlaying((p) => (p === track.index ? null : p))
                }
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-sm text-accent" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-end gap-4">
        {picked === null && (
          <p className="text-sm text-ink/40">Pick your final song</p>
        )}
        <Button
          disabled={picked === null || saving}
          onClick={() => void confirm()}
          className={
            picked === null || saving ? 'cursor-not-allowed opacity-40' : ''
          }
        >
          {saving ? 'Saving...' : 'This is the one'}
        </Button>
      </div>
    </motion.div>
  );
}

function SongPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const fromCheckout = searchParams.has('session_id');
  const reduced = useReducedMotion();

  const draftSongId = useDraftStore((s) => s.songId);
  const clearDraft = useDraftStore((s) => s.clearDraft);

  const [song, setSong] = useState<SongData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [buyPacksOpen, setBuyPacksOpen] = useState(false);

  // One-shot refetch after a gift is created — picks up the new gift row and
  // the decremented credit count.
  const refreshSong = async () => {
    try {
      const res = await fetch(`/api/songs/${id}`);
      const json = await res.json();
      if (res.ok && !json.error) setSong(json.data as SongData);
    } catch {
      // The modal already shows the new gift's link + code — stale list is fine.
    }
  };

  // Fetch + poll: while confirming payment (webhook lag) or while the regen
  // pair renders. Stops once the song is done (or pick is pending).
  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch(`/api/songs/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json.error) {
          setError(json.error ?? 'Something went wrong.');
          return;
        }
        const data = json.data as SongData;
        setSong(data);

        const awaitingWebhook = fromCheckout && !isPaid(data);
        if (awaitingWebhook || data.regenPending) {
          timer = setTimeout(poll, POLL_INTERVAL);
        }
      } catch {
        // Network hiccup — keep polling.
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, fromCheckout]);

  // Decision #8 — clear the draft once this song is paid for.
  useEffect(() => {
    if (song && isPaid(song) && draftSongId === song.id) clearDraft();
  }, [song, draftSongId, clearDraft]);

  const entrance = (delay: number) => ({
    initial: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 20, filter: 'blur(10px)' },
    animate: reduced
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.6, ease, delay },
  });

  const occasion = song ? getOccasion(song.occasion) : undefined;
  const paid = song ? isPaid(song) : false;

  const selectedTrack =
    song && paid
      ? (song.tracks.find(
          (t) => t.index === song.selectedTrackIndex && t.audioUrl
        ) ?? song.tracks.find((t) => t.audioUrl))
      : undefined;
  const otherUnlocked =
    song && paid
      ? song.tracks.filter(
          (t) => t.audioUrl && t.index !== selectedTrack?.index
        )
      : [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link href="/" className="font-serif text-2xl">
          Adore<span className="italic text-accent">You</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        {error && (
          <motion.div {...entrance(0)} className="mt-10" role="alert">
            <p className="text-ink/60">{error}</p>
            <Button href="/" className="mt-6">
              Back home
            </Button>
          </motion.div>
        )}

        {/* First fetch in flight — skeleton keeps the layout steady */}
        {!error && !song && (
          <div className="mt-10 animate-pulse" aria-hidden>
            <div className="h-4 w-40 rounded-full bg-ink/10" />
            <div className="mt-4 h-12 w-3/4 rounded-2xl bg-ink/10" />
            <div className="mt-10 h-40 rounded-2xl bg-ink/5" />
            <div className="mt-6 h-24 rounded-2xl bg-ink/5" />
          </div>
        )}

        {!error && song && (
          <>
            <motion.div {...entrance(0)}>
              <p className="flex items-center gap-2 text-sm text-ink/50">
                A song for {song.recipientName}
                {occasion && (
                  <span
                    className="rounded-full border px-3 py-0.5 text-xs font-medium"
                    style={{
                      color: occasion.theme.accent,
                      borderColor: `${occasion.theme.accent}55`,
                    }}
                  >
                    {occasion.name}
                  </span>
                )}
              </p>
              <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
                {!paid ? (
                  <>
                    Almost <span className="italic text-accent">there</span>
                  </>
                ) : song.regenPending ? (
                  <>
                    A new <span className="italic text-accent">sound</span> is
                    coming
                  </>
                ) : song.regenPickPending ? (
                  <>
                    Pick your <span className="italic text-accent">final</span>{' '}
                    song
                  </>
                ) : (
                  <>
                    It&rsquo;s <span className="italic text-accent">theirs</span>{' '}
                    now
                  </>
                )}
              </h1>
            </motion.div>

            <div className="mt-10">
              {/* Webhook lag right after Stripe, or someone landing early. */}
              {!paid &&
                (song.status === 'failed' ? (
                  <motion.div {...entrance(0.07)} role="alert">
                    <p className="text-ink/60">
                      Something went wrong while composing this song. Nothing
                      was charged.
                    </p>
                    <Button href="/create/length" className="mt-6">
                      Try again
                    </Button>
                  </motion.div>
                ) : fromCheckout ? (
                  <motion.div
                    {...entrance(0.07)}
                    className="flex flex-col items-center py-16 text-center"
                  >
                    <p className="font-serif text-2xl">
                      Confirming your payment...
                    </p>
                    <p className="mt-3 max-w-sm text-sm text-ink/50">
                      This only takes a few seconds — your song unlocks the
                      moment it clears.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div {...entrance(0.07)}>
                    <p className="text-ink/60">
                      This song hasn&rsquo;t been unlocked yet — finish
                      checkout to hear the full version.
                    </p>
                    <Button href="/create/previews" className="mt-6">
                      Back to previews
                    </Button>
                  </motion.div>
                ))}

              {/* Regen pair rendering — base song is already unlocked. */}
              {paid && song.regenPending && (
                <motion.div {...entrance(0.07)}>
                  {selectedTrack && (
                    <SongPlayer
                      src={selectedTrack.audioUrl!}
                      title={`For ${song.recipientName}`}
                      subtitle={selectedTrack.genre}
                      downloadUrl={selectedTrack.downloadUrl}
                    />
                  )}
                  <div className="mt-6 rounded-2xl border border-ink/10 bg-white/50">
                    <ProcessingView recipientName={song.recipientName} />
                  </div>
                </motion.div>
              )}

              {/* Regen pair landed — final pick from all versions. */}
              {paid && !song.regenPending && song.regenPickPending && (
                <FinalPick song={song} onPicked={setSong} />
              )}

              {/* Song Ready */}
              {paid && !song.regenPending && !song.regenPickPending && (
                <>
                  {song.regenRefunded && (
                    <motion.p
                      {...entrance(0.07)}
                      className="mb-6 rounded-2xl border border-ink/10 bg-white/50 p-4 text-sm text-ink/60"
                      role="status"
                    >
                      The new-genre render didn&rsquo;t work out, so we
                      refunded that part of your order. Your song is safe and
                      fully yours.
                    </motion.p>
                  )}

                  {selectedTrack && (
                    <motion.div {...entrance(0.07)}>
                      <SongPlayer
                        src={selectedTrack.audioUrl!}
                        title={`For ${song.recipientName}`}
                        subtitle={selectedTrack.genre}
                        downloadUrl={selectedTrack.downloadUrl}
                      />
                    </motion.div>
                  )}

                  {otherUnlocked.length > 0 && (
                    <motion.section {...entrance(0.14)} className="mt-10">
                      <h2 className="font-serif text-2xl">
                        Every <span className="italic text-accent">version</span>
                      </h2>
                      <div className="mt-4 space-y-4">
                        {otherUnlocked.map((track, i) => (
                          <SongPlayer
                            key={track.index}
                            src={track.audioUrl!}
                            title={`Version ${i + 2}`}
                            subtitle={track.genre}
                            downloadUrl={track.downloadUrl}
                          />
                        ))}
                      </div>
                    </motion.section>
                  )}

                  {/* Gift section (Step 8) */}
                  <motion.section {...entrance(0.21)} className="mt-12">
                    <h2 className="font-serif text-2xl">
                      Now, the <span className="italic text-accent">gift</span>
                    </h2>
                    <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-6">
                      <p className="text-sm text-ink/60">
                        Wrap it in a personal message and its own reveal page —
                        they enter a 4-digit code and the song plays.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-4">
                        <Button onClick={() => setGiftOpen(true)}>
                          Gift this song
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setBuyPacksOpen(true)}
                        >
                          Buy more gifts
                        </Button>
                        <p className="text-sm text-ink/50">
                          {song.giftCredits ?? 0} gift{' '}
                          {song.giftCredits === 1 ? 'credit' : 'credits'}{' '}
                          remaining
                        </p>
                      </div>

                      {(song.gifts?.length ?? 0) > 0 && (
                        <div className="mt-6 border-t border-ink/10 pt-5">
                          <h3 className="text-sm font-medium text-ink/70">
                            Gifts you&rsquo;ve sent
                          </h3>
                          <ul className="mt-3 space-y-3">
                            {song.gifts!.map((gift) => (
                              <li key={gift.id}>
                                <GiftShareBox
                                  giftUrl={`${window.location.origin}${gift.link}`}
                                  accessCode={gift.accessCode}
                                  sentTo={gift.recipientEmail}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.section>

                  <GiftModal
                    songId={song.id}
                    recipientName={song.recipientName}
                    giftCredits={song.giftCredits ?? 0}
                    open={giftOpen || buyPacksOpen}
                    showPacks={buyPacksOpen}
                    onClose={() => {
                      setGiftOpen(false);
                      setBuyPacksOpen(false);
                    }}
                    onCreated={() => void refreshSong()}
                  />
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function SongPage() {
  // useSearchParams requires a Suspense boundary in client pages.
  return (
    <Suspense>
      <SongPageInner />
    </Suspense>
  );
}
