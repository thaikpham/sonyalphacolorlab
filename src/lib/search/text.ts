import { normalizeSearchTerm, removeAccents } from './fuzzy-search'

/**
 * Text folding for the unified search (ADR 0003).
 *
 * Vietnamese is searched with or without diacritics, and with either
 * tone-mark placement — "nhòe" and "nhoè" are the same word typed by two
 * keyboards. Folding to unaccented lower-case ASCII handles both at once:
 * NFD splits each mark off its vowel wherever it was placed, and the marks go.
 * `đ` has no decomposition and is mapped by hand in `removeAccents`.
 */

/** Lower-case, unaccented, punctuation to spaces, single-spaced. */
export function fold(text: string): string {
  return removeAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Folded words, in order. */
export function words(text: string): string[] {
  const f = fold(text)
  return f ? f.split(' ') : []
}

/** Everything but letters and digits removed: `ILCE-7CM2` → `ilce7cm2`. */
export const squash = normalizeSearchTerm

/**
 * Words that carry no subject on their own, in both languages, folded.
 *
 * They are not removed from a query — "ISO Auto và Min. SS" still matches a
 * title that contains "và" — they are only left out of the count of words a
 * document has to contain. Without this, "ảnh trong nhà bị nhòe" demands a
 * page that literally contains "bị", and a recipe that happens to say "trong"
 * scores like one that answers the question.
 *
 * Kept short on purpose: folding merges words, so `co` is both "có" (has) and
 * "cò" (the shutter button), and every entry here is a word the ranking stops
 * insisting on.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  // Vietnamese
  'va', 'cua', 'la', 'bi', 'cho', 'voi', 'cac', 'nhung', 'mot', 'khi', 'thi', 'ma', 'de',
  'nay', 'da', 'duoc', 'the', 'nao', 'sao', 'gi', 'o', 've', 'tu', 'hay', 'hoac', 'rat',
  /* "ảnh" and "màu" are not function words, but on a site about photographs
     and colour they are in nearly every document, and requiring them makes a
     query like "màu ấm ban đêm" rank on the one word that says nothing. */
  'anh', 'mau',
  // English
  'a', 'an', 'and', 'or', 'of', 'the', 'to', 'in', 'on', 'for', 'with', 'is', 'my', 'how', 'what', 'why',
])

/** A query's words that must be found, falling back to all of them. */
export function meaningfulWords(query: string): string[] {
  const all = words(query)
  const kept = all.filter((w) => !STOPWORDS.has(w))
  return kept.length > 0 ? kept : all
}
