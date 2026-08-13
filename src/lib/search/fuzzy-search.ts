/**
 * Utility functions for accent-insensitive, multi-variant, and typo-tolerant fuzzy search.
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

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1,     // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

const COMMON_ALIASES: Record<string, string[]> = {
  a7m4: ['ilce7m4', 'a7iv', '7m4', 'alpha7iv', '7iv'],
  a7iv: ['ilce7m4', 'a7m4', '7m4', 'alpha7iv', '7iv'],
  '7m4': ['ilce7m4', 'a7m4', 'a7iv', 'alpha7iv', '7iv'],
  a7m3: ['ilce7m3', 'a7iii', '7m3', 'alpha7iii', '7iii'],
  a7iii: ['ilce7m3', 'a7m3', '7m3', 'alpha7iii', '7iii'],
  '7m3': ['ilce7m3', 'a7m3', 'a7iii', 'alpha7iii', '7iii'],
  a7r5: ['ilce7rm5', 'a7rv', '7r5', 'alpha7rv'],
  a7rv: ['ilce7rm5', 'a7r5', '7r5', 'alpha7rv'],
  a7c2: ['ilce7cm2', 'a7cii', 'alpha7cii'],
  a7cii: ['ilce7cm2', 'a7c2', 'alpha7cii'],
  fx3: ['ilmefx3', 'fx3'],
  fx30: ['ilmefx30', 'fx30'],
  zve10: ['zve10', 'zve10m2'],
  zve1: ['zve1'],
  kodak: ['kodac', 'kadok', 'kodachrome'],
  fuji: ['fujifilm', 'fujicolor'],
};

/**
 * Calculates a match score (0 to 120) between a search query and a list of target text fields.
 * Handles:
 * - Exact & substring matching
 * - Accent-insensitive matching (Vietnamese without accents)
 * - Multi-variant matching (ignoring spaces, dashes, punctuation e.g. a7iv -> a7 iv -> ilce-7m4)
 * - Typo tolerance via Levenshtein distance
 */
export function calculateMatchScore(query: string, fields: (string | undefined | null)[]): number {
  if (!query.trim()) return 0;

  const rawQuery = query.trim().toLowerCase();
  const noAccentQuery = removeAccents(rawQuery);
  const normQuery = normalizeSearchTerm(query);
  if (!normQuery) return 0;

  let maxScore = 0;
  const queryTokens = noAccentQuery.split(/\s+/).filter(Boolean);

  // Check alias list for expanded matches
  const aliasList = COMMON_ALIASES[normQuery] || [];

  for (const field of fields) {
    if (!field) continue;
    const rawField = field.toLowerCase();
    const noAccentField = removeAccents(rawField);
    const normField = normalizeSearchTerm(field);

    // 1. Direct exact or substring match
    if (rawField === rawQuery) {
      maxScore = Math.max(maxScore, 120);
    } else if (rawField.includes(rawQuery)) {
      maxScore = Math.max(maxScore, 100);
    } else if (noAccentField.includes(noAccentQuery)) {
      maxScore = Math.max(maxScore, 90);
    }

    // 2. Normalized match (ignores spaces, dashes, punctuation e.g. "a7m4" matches "ilce-7m4" or "alpha 7 iv")
    if (normField.includes(normQuery)) {
      maxScore = Math.max(maxScore, 85);
    } else if (normQuery.includes(normField) && normField.length >= 3) {
      maxScore = Math.max(maxScore, 75);
    }

    // 3. Alias match
    for (const alias of aliasList) {
      if (normField.includes(alias)) {
        maxScore = Math.max(maxScore, 95);
        break;
      }
    }

    // 4. Token match
    const fieldTokens = noAccentField.split(/[\s\-_\/]+/).filter(Boolean);
    let matchedTokens = 0;
    for (const qTok of queryTokens) {
      for (const fTok of fieldTokens) {
        if (fTok === qTok) {
          matchedTokens += 2;
          break;
        } else if (fTok.includes(qTok) || qTok.includes(fTok)) {
          matchedTokens += 1;
          break;
        } else if (qTok.length >= 3 && fTok.length >= 3) {
          const dist = levenshteinDistance(qTok, fTok);
          if (dist <= 1) {
            matchedTokens += 1;
            break;
          }
        }
      }
    }

    if (queryTokens.length > 0 && matchedTokens > 0) {
      const tokenScore = Math.min(80, Math.round((matchedTokens / (queryTokens.length * 2)) * 80));
      maxScore = Math.max(maxScore, tokenScore);
    }

    // 5. Whole-token Levenshtein typo match (e.g. "somiy" -> "sony", "kadok" -> "kodak")
    if (queryTokens.length === 1 && queryTokens[0].length >= 3) {
      for (const fTok of fieldTokens) {
        if (fTok.length >= 3 && Math.abs(fTok.length - queryTokens[0].length) <= 2) {
          const dist = levenshteinDistance(queryTokens[0], fTok);
          if (dist === 1) {
            maxScore = Math.max(maxScore, 65);
          } else if (dist <= 2 && (queryTokens[0].length >= 4 || fTok.length >= 4)) {
            maxScore = Math.max(maxScore, 50);
          }
        }
      }
    }
  }

  return maxScore;
}
