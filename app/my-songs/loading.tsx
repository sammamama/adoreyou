// Instant shell while the server page reads the session + queries songs.

import Link from 'next/link';

export default function MySongsLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link href="/" className="font-serif text-2xl">
          Adore<span className="italic text-accent">You</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-32">
        <div className="mt-10 animate-pulse" aria-hidden>
          <div className="h-12 w-56 rounded-2xl bg-ink/10" />
          <div className="mt-3 h-4 w-40 rounded-full bg-ink/10" />
          <div className="mt-8 h-44 rounded-2xl bg-ink/5" />
          <div className="mt-6 h-44 rounded-2xl bg-ink/5" />
        </div>
        <span className="sr-only">Loading your songs…</span>
      </main>
    </div>
  );
}
