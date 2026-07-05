// Step 10 — returning-creator dashboard. Server component: reads the session
// cookie (60-day JWT, decision #1) and queries this creator's songs directly;
// no session → the client component renders the email + code login. Full
// audio URLs only appear here for paid songs, matching the session email.

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSessionEmail } from '@/lib/session';
import MySongsDashboard, {
  type DashboardSong,
} from '@/components/MySongsDashboard';
import type { Track } from '@/types';

export const metadata = { title: 'Your songs — AdoreYou' };

async function songsFor(email: string): Promise<DashboardSong[]> {
  const songs = await prisma.song.findMany({
    where: { OR: [{ email }, { stripeEmail: email }] },
    include: { gifts: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  return songs.map((song) => {
    const tracks = song.tracks as unknown as Track[];
    const paid = song.status === 'paid' || song.status === 'done';
    const selected = paid
      ? (tracks.find(
          (t) => t.sunoTrackId === song.selectedTrackId && t.unlocked
        ) ?? tracks.find((t) => t.unlocked))
      : undefined;

    return {
      id: song.id,
      recipientName: song.recipientName,
      occasion: song.occasion,
      createdAt: song.createdAt.toISOString(),
      paid,
      genre: selected?.genre ?? null,
      audioUrl: selected?.audioUrl ?? null,
      downloadUrl: selected
        ? `/api/songs/${song.id}/download/${tracks.indexOf(selected)}`
        : null,
      giftCredits: Math.max(0, song.giftCredits - song.gifts.length),
      gifts: song.gifts.map((g) => ({
        id: g.id,
        link: `/gift/${g.id}`,
        accessCode: g.accessCode,
        recipientEmail: g.recipientEmail,
      })),
    };
  });
}

export default async function MySongsPage() {
  const email = await getSessionEmail();
  const songs = email ? await songsFor(email) : [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link href="/" className="font-serif text-2xl">
          Adore<span className="italic text-accent">You</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        <MySongsDashboard email={email} songs={songs} />
      </main>
    </div>
  );
}
