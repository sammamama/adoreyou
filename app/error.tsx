'use client';

// Global error boundary — anything unexpected lands here with a retry.
// Draft state lives in localStorage (decision #8), so nothing is lost.

import Button from '@/components/ui/Button';
import Wordmark from '@/components/Wordmark';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-32 text-center">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          Something went <span className="italic text-accent">wrong</span>
        </h1>
        <p className="mt-4 max-w-sm text-ink/60">
          An unexpected hiccup on our side — your song and answers are safe.
          Try again.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Button onClick={reset}>Try again</Button>
          <Button variant="ghost" href="/">
            Back home
          </Button>
        </div>
      </main>
    </div>
  );
}
