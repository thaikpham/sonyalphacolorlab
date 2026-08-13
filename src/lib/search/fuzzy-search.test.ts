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
