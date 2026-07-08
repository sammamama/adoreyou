'use client';

import { useState } from 'react';

const MAX_REVISIONS = 5;

// A line is a section heading if it's [Verse 1]-style (or a stray **bold**
// from an older draft). Headings render bold without the wrapper characters.
function headingLabel(line: string): string | null {
  const t = line.trim();
  const m = t.match(/^\[(.+)\]$/) ?? t.match(/^\*\*(.+?)\*\*$/);
  return m ? m[1].trim() : null;
}

// Read-only lyric rendering — section headings bold, lines as written.
export function LyricsView({ lyrics }: { lyrics: string }) {
  return (
    <div className="whitespace-pre-wrap font-serif leading-relaxed">
      {lyrics.split('\n').map((line, i) => {
        const label = headingLabel(line);
        return label ? (
          <p key={i} className="mt-4 font-sans text-sm font-bold first:mt-0">
            {label}
          </p>
        ) : (
          <p key={i} className="min-h-[1em]">
            {line}
          </p>
        );
      })}
    </div>
  );
}

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
  const [editing, setEditing] = useState(false);
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
      {/* Canvas — rendered view by default; Edit switches to the raw text */}
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
        <p className="text-sm font-medium">
          {editing ? 'Editing — changes save as you type' : 'Your lyrics'}
        </p>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 transition-colors duration-200 hover:border-ink/40"
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      {editing ? (
        <textarea
          value={lyrics}
          onChange={(e) => onEdit(e.target.value)}
          rows={22}
          spellCheck={false}
          aria-label="Song lyrics"
          className="w-full resize-y bg-transparent px-5 py-4 font-mono text-sm leading-relaxed focus:outline-2 focus:outline-offset-0 focus:outline-accent"
        />
      ) : (
        <div className="max-h-[32rem] overflow-y-auto px-5 py-4">
          <LyricsView lyrics={lyrics} />
        </div>
      )}

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
