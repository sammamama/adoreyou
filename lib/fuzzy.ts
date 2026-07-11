// Subsequence fuzzy match: query chars must appear in order in target
// (not necessarily adjacent), so typos/missing letters still match.
// Returns null when query isn't a subsequence of target, otherwise a
// score where lower = better (fewer gaps, more consecutive matches).
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = target.toLowerCase();

  let ti = 0;
  let score = 0;
  let consecutive = 0;

  for (const qc of q) {
    const idx = t.indexOf(qc, ti);
    if (idx === -1) return null;
    score += idx - ti;
    consecutive = idx === ti ? consecutive + 1 : 0;
    score -= consecutive;
    ti = idx + 1;
  }

  return score;
}
