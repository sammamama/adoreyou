'use client';

// Style vocabulary + chip picker for the /create/style step. GENRES also
// feeds the regen-genre picker on the previews page.

export const GENRES = [
  'Pop',
  'Acoustic',
  'R&B',
  'Country',
  'Folk',
  'Soft Rock',
  'Soul',
  'Hip-Hop',
  'Jazz',
  'Indie',
  'Reggae',
  'Afrobeats',
  'Latin',
  'Gospel',
  'Lo-fi',
  'Bollywood',
] as const;

// Covers every occasion defaultMood so the occasion's mood can be preselected.
export const MOODS = [
  'Romantic',
  'Joyful',
  'Nostalgic',
  'Warm',
  'Tender',
  'Triumphant',
  'Bittersweet',
  'Playful',
  'Heartfelt',
  'Uplifting',
  'Peaceful',
  'Dreamy',
] as const;

export const TEMPOS = ['Slow', 'Steady', 'Upbeat'] as const;

// Lyric language for the /create/language step. "Hindi" produces Hinglish —
// romanized Hindi lyrics, the way people actually text.
export const LANGUAGES = ['English', 'Hindi', 'Dutch'] as const;

export const VOICES = ['Female', 'Male'] as const;

// One row of selectable chips. Optional groups deselect on second click.
export function ChipGroup({
  label,
  hint,
  options,
  value,
  onSelect,
  optional = false,
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  value: string;
  onSelect: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <div>
      <p className="font-medium">
        {label}
        {optional && (
          <span className="ml-2 text-sm font-normal text-ink/40">optional</span>
        )}
      </p>
      {hint && <p className="mt-1 text-sm text-ink/50">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected && optional ? '' : option)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected
                  ? 'border-accent bg-accent text-white'
                  : 'border-ink/15 bg-white hover:border-ink/40'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
