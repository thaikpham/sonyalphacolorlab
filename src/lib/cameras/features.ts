/**
 * Per-product marketing bullets, in both locales.
 *
 * These are the one part of a product row that is genuinely translated. Spec
 * *values* are not: they stay language-neutral numbers plus the per-field
 * wordlist in `data/spec-values.en.json`, because "20 thành phần / 10 nhóm" is
 * a measurement and "Compact Super-Telephoto Zoom (654g)" is a sentence. Rule 3
 * in AGENTS.md draws the line there, not at "is it user-visible".
 *
 * Two shapes are read. `data/sony-cameras.seed.json` and anything the admin UI
 * writes hold `{ en, vi }`. Rows written before the admin UI may still hold a
 * flat `string[]`, which is English. Both stay valid indefinitely: a migration
 * that rewrote the flat arrays would have had to invent the Vietnamese, and not
 * inventing is the whole point of how this catalogue is built.
 */

export type LocalizedFeatures = string[] | { en: string[]; vi: string[] };

const clean = (xs: unknown): string[] =>
  Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];

/** Normalises either shape to `{ en, vi }`. A flat array is English. */
export function splitFeatures(features: LocalizedFeatures | undefined | null): {
  en: string[];
  vi: string[];
} {
  if (Array.isArray(features)) return { en: clean(features), vi: [] };
  if (features && typeof features === 'object') {
    return { en: clean(features.en), vi: clean(features.vi) };
  }
  return { en: [], vi: [] };
}

/**
 * The list to render for a locale.
 *
 * Vietnamese falls back to English when it is missing, rather than rendering
 * nothing. An untranslated bullet is a visible, fixable gap; an empty feature
 * list looks like a product with no features, which is a worse lie and one no
 * reader can tell is a bug.
 */
export function featureList(features: LocalizedFeatures | undefined | null, locale: string): string[] {
  const { en, vi } = splitFeatures(features);
  if (locale === 'vi') return vi.length > 0 ? vi : en;
  return en.length > 0 ? en : vi;
}

/**
 * True when the product still needs a Vietnamese pass — what the admin list flags.
 *
 * An empty `vi` is not the only way a row stays untranslated. A `vi` that is a
 * verbatim copy of `en` is non-empty, so it read as done, and so does a `vi`
 * with a different number of bullets, which cannot pair up line by line.
 *
 * A partial copy is not flagged. Rule 3 keeps technical terms in English, so
 * "240MP Pixel Shift Multi Shooting" is correct in both locales, and flagging
 * every identical bullet would keep finished products in the queue forever.
 * Bullets copied into an otherwise translated row need a human reviewer.
 */
export function needsTranslation(features: LocalizedFeatures | undefined | null): boolean {
  const { en, vi } = splitFeatures(features);
  if (en.length === 0) return false;
  if (vi.length !== en.length) return true;
  return vi.every((line, i) => line === en[i]);
}
