/**
 * The string primitives the unified search is built on: accent folding,
 * normalisation and a bounded edit distance. The scoring that used to live
 * here — `calculateMatchScore` and a hand-typed alias table — is gone; ranking
 * is `rank.ts` and camera aliases are derived from the catalogue in
 * `cameras/aliases.ts` (ADR 0003).
 */

export function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function normalizeSearchTerm(str: string): string {
  return removeAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Edit distance between two strings.
 *
 * Two rows rather than the full `b.length x a.length` matrix: each row depends
 * only on the one above it, so the rest is garbage the moment it is written.
 * This runs in the innermost loop of the near-miss tier in `rank.ts`, once per
 * candidate word per document on every keystroke — the matrix version
 * allocated an array of arrays for each of those.
 *
 * `maxDistance` lets a caller that only cares about near-misses stop early. Once
 * every cell in a row exceeds it the answer can no longer come back under it, so
 * the return is simply *some* value above `maxDistance`, not the true distance.
 */
export function levenshteinDistance(a: string, b: string, maxDistance = Infinity): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // One string cannot be reached from the other in fewer edits than the
  // difference in their lengths, so this rejects most pairs without any work.
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let prev = new Array<number>(a.length + 1);
  let curr = new Array<number>(a.length + 1);
  for (let j = 0; j <= a.length; j++) prev[j] = j;

  for (let i = 1; i <= b.length; i++) {
    curr[0] = i;
    const bCode = b.charCodeAt(i - 1);
    let rowMin = curr[0];
    for (let j = 1; j <= a.length; j++) {
      const cost = bCode === a.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(
        prev[j - 1] + cost, // substitution
        curr[j - 1] + 1,    // insertion
        prev[j] + 1,        // deletion
      );
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }

  return prev[a.length];
}
