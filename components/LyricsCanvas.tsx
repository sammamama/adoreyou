'use client';

import { useState } from 'react';

const MAX_REVISIONS = 5;

export default function LyricsCanvas({
  lyrics,
  onEdit,
  onRevise,
  revisionsUsed,
  revising,
}: {
  lyrics: string;
  onEdit: (lyrics: string) => void;
  onRevise: (request: string) => Promise<void>;
  revisionsUsed: number;
  revising: boolean;
}) {
  const [request, setRequest] = useState('');
  const remaining = MAX_REVISIONS - revisionsUsed;
  const canRevise = remaining > 0 && !revising;

  const submit = async () => {
    const trimmed = request.trim();
    if (!trimmed || !canRevise) return;
    setRequest('');
    await onRevise(trimmed);
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-white">
      {/* Editable canvas — direct edits are free and unlimited */}
      <textarea
        value={lyrics}
        onChange={(e) => onEdit(e.target.value)}
        rows={22}
        spellCheck={false}
        aria-label="Song lyrics"
        className="w-full resize-y rounded-t-2xl bg-transparent px-5 py-4 font-mono text-sm leading-relaxed focus:outline-2 focus:outline-offset-0 focus:outline-accent"
      />

      {/* Chat-style revision box */}
      <div className="border-t border-ink/10 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Ask for changes</p>
          <p className="text-sm text-ink/50" aria-live="polite">
            {remaining}/{MAX_REVISIONS} remaining
          </p>
        </div>
        {remaining > 0 ? (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              disabled={revising}
              placeholder='e.g. "make the chorus more emotional"'
              className="w-full rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm placeholder:text-ink/30 focus:outline-2 focus:outline-offset-0 focus:outline-accent disabled:opacity-50"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!canRevise || !request.trim()}
              className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {revising ? 'Revising...' : 'Send'}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/50">
            You&rsquo;ve used all {MAX_REVISIONS} AI revisions — you can still
            edit the lyrics directly above.
          </p>
        )}
      </div>
    </div>
  );
}
