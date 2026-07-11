// Branded 404 — unknown routes and notFound() calls (e.g. bad occasion slug).

import Button from '@/components/ui/Button';
import Wordmark from '@/components/Wordmark';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-32 text-center">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          This page is <span className="italic text-accent">missing</span>
        </h1>
        <p className="mt-4 max-w-sm text-ink/60">
          The page you&rsquo;re looking for doesn&rsquo;t exist — maybe the
          link got cut off along the way.
        </p>
        <Button href="/" className="mt-8">
          Back home
        </Button>
      </main>
    </div>
  );
}
