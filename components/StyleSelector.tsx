'use client';

export const GENRES = [
  'Pop',
  'Acoustic',
  'R&B',
  'Country',
  'Folk',
  'Soft Rock',
  'Soul',
  'Hip-Hop',
] as const;

export default function StyleSelector({
  genre,
  onSelect,
}: {
  genre: string;
  onSelect: (genre: string) => void;
}) {
  return (
    <div>
      <p className="font-medium">Pick a genre</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {GENRES.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onSelect(g)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              genre === g
                ? 'border-accent bg-accent text-white'
                : 'border-ink/15 bg-white hover:border-ink/40'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
