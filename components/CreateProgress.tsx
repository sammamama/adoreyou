'use client';

// Flow-level progress dots for the create funnel — shown at the top of every
// /create page so users always know where they are and what's left.

const STEPS = [
  { key: 'story', label: 'Story' },
  { key: 'style', label: 'Style' },
  { key: 'lyrics', label: 'Lyrics' },
  { key: 'length', label: 'Length' },
  { key: 'preview', label: 'Preview' },
] as const;

export type CreateStep = (typeof STEPS)[number]['key'];

export default function CreateProgress({ current }: { current: CreateStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Song creation steps" className="mb-8">
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={step.key} className="flex items-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={`mx-2 h-px w-4 sm:w-8 ${
                    i <= currentIndex ? 'bg-accent' : 'bg-ink/15'
                  }`}
                />
              )}
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                    done
                      ? 'bg-accent'
                      : active
                        ? 'bg-accent ring-4 ring-accent/20'
                        : 'bg-ink/15'
                  }`}
                />
                <span
                  className={`text-xs ${
                    active
                      ? 'font-medium text-ink'
                      : done
                        ? 'text-ink/60'
                        : 'text-ink/40'
                  } ${active ? '' : 'hidden sm:inline'}`}
                >
                  {step.label}
                  {active && (
                    <span className="sr-only"> (current step)</span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
