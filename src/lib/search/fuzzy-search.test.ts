import { describe, expect, it } from 'vitest';
import { calculateMatchScore, levenshteinDistance, normalizeSearchTerm, removeAccents } from './fuzzy-search';

describe('fuzzy-search utilities', () => {
  it('correctly removes Vietnamese accents', () => {
    expect(removeAccents('Máy ảnh Sony Alpha')).toBe('May anh Sony Alpha');
    expect(removeAccents('Ống kính G Master')).toBe('Ong kinh G Master');
  });

  it('correctly normalizes search terms by stripping non-alphanumerics', () => {
    expect(normalizeSearchTerm('ILCE-7M4')).toBe('ilce7m4');
    expect(normalizeSearchTerm('A7 IV')).toBe('a7iv');
    expect(normalizeSearchTerm('FX-3')).toBe('fx3');
  });

  it('calculates Levenshtein distance', () => {
    expect(levenshteinDistance('sony', 'somiy')).toBe(2);
    expect(levenshteinDistance('kodak', 'kadok')).toBe(2);
    expect(levenshteinDistance('a7iv', 'a7iv')).toBe(0);
  });

  /**
   * The two-row rewrite exists for speed, so what needs pinning is that it did
   * not buy that speed with different answers. A reference implementation of
   * the textbook full-matrix version is checked against it across every pair of
   * a small vocabulary, including the empty string and unequal lengths.
   */
  it('agrees with a full-matrix reference on every pair', () => {
    const reference = (a: string, b: string): number => {
      const m: number[][] = [];
      for (let i = 0; i <= b.length; i++) m[i] = [i];
      for (let j = 0; j <= a.length; j++) m[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          m[i][j] =
            b.charAt(i - 1) === a.charAt(j - 1)
              ? m[i - 1][j - 1]
              : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
        }
      }
      return m[b.length][a.length];
    };

    const words = ['', 'a', 'sony', 'somiy', 'kodak', 'kadok', 'ilce7m4', 'a7iv', 'telephoto', 'gm'];
    for (const a of words) {
      for (const b of words) {
        expect(levenshteinDistance(a, b), `distance("${a}", "${b}")`).toBe(reference(a, b));
      }
    }
  });

  it('reports over the cap rather than the true distance when bounded', () => {
    /* The early exit is why the token loop is cheap: it abandons a comparison
       as soon as no cell can come back under the cap. Callers only ever ask
       `<= 1` or `<= 2`, so the contract is "some value above the cap", and the
       exact answer is deliberately not promised. */
    expect(levenshteinDistance('telephoto', 'gm', 1)).toBeGreaterThan(1);
    expect(levenshteinDistance('sony', 'somiy', 2)).toBe(2); // still under the cap
    expect(levenshteinDistance('sony', 'sonu', 1)).toBe(1);
    expect(levenshteinDistance('sony', 'sony', 0)).toBe(0);
  });

  it('scores exact and normalized multi-variant matches higher than non-matches', () => {
    const exactScore = calculateMatchScore('ILCE-7M4', ['Sony Alpha 7 IV', 'ILCE-7M4']);
    const normScore = calculateMatchScore('a7m4', ['Sony Alpha 7 IV', 'ILCE-7M4']);
    const typoScore = calculateMatchScore('somiy', ['Sony Alpha 7 IV', 'ILCE-7M4']);
    const noMatchScore = calculateMatchScore('canon', ['Sony Alpha 7 IV', 'ILCE-7M4']);

    expect(exactScore).toBeGreaterThan(90);
    expect(normScore).toBeGreaterThan(70);
    expect(typoScore).toBeGreaterThan(40);
    expect(noMatchScore).toBe(0);
  });
});
