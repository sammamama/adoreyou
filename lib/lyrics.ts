// Shared lyric-text helpers — safe on both server and client (the lyrics
// page normalizes streamed text after the stream completes).

// The prompt demands [Verse 1]-style labels, but if the model slips into
// markdown (**Chorus**, ## Chorus), rewrite those lines to the bracket form
// the gift reveal parser and the UI expect.
export function normalizeSectionLabels(lyrics: string): string {
  return lyrics
    .split('\n')
    .map((line) => {
      const t = line.trim();
      const md = t.match(/^\*\*(.+?)\*\*$/) ?? t.match(/^#{1,3}\s+(.+)$/);
      if (!md) return line;
      const label = md[1].trim().replace(/^\[|\]$/g, '');
      return `[${label}]`;
    })
    .join('\n');
}
