/**
 * Recipe names: `PP-NNN-Mood Words` for a Picture Profile, `CL-NNN-Mood Words`
 * for a Creative Look.
 *
 * The number is the recipe's own (`SCL-PP-048` → `PP-048`); the words are two
 * or three Title Case English words from the closed vocabulary below, saying
 * the tone and mood of the colour. No diacritics, no place, no photographer.
 * The whole string is the `name` column and, like every recipe name, is never
 * translated (Rule 3).
 *
 * The place an original was imagined for, and every recipe's former name,
 * stay findable through the slug, which does not change.
 *
 * Client-safe: plain data, no JSON import, no server read.
 */

import type { ToneId } from './taxonomy';

/**
 * Closed on purpose: adding a word is a change to this file and to
 * `names.test.ts`, never something a name slips in by itself.
 */
export const NAME_VOCABULARY: ReadonlySet<string> = new Set([
  // Temperature and hue
  'Warm', 'Cool', 'Neutral', 'Golden', 'Amber', 'Orange', 'Teal', 'Cyan',
  'Violet', 'Jade', 'Green', 'Rosy', 'Silver', 'Sepia', 'Mono',
  // Tonality
  'Soft', 'Hard', 'Matte', 'Deep', 'Punchy', 'Airy', 'Crisp', 'Flat', 'Faded',
  'Dense', 'Bright', 'Dark',
  // Saturation
  'Vivid', 'Muted', 'Pastel', 'Rich', 'Clean', 'Natural',
  // Subject, time, process
  'Portrait', 'Street', 'Night', 'Film', 'Cinema', 'Noir', 'Daylight', 'Dusk',
  'Tungsten', 'Indoor', 'Range', 'Log', 'HLG', 'Pop', 'Studio', 'Table',
  'Coast', 'Nature', 'Festival', 'Autumn', 'Monsoon', 'Overcast', 'Velvet',
  'Cream', 'Slide', 'Standard', 'Instant', 'Product', 'Stream', 'Landscape',
  'Nostalgia', 'Tropical', 'Base',
]);

const WORD = '(?:[A-Z][a-z]+|HLG)';

/** `PP-048-Soft Clean Portrait`: format, three digits, two or three words. */
export const RECIPE_NAME_RE = new RegExp(`^(PP|CL)-(\\d{3})-(${WORD}(?: ${WORD}){1,2})$`);

/**
 * A temperature word in a name must agree with the recipe's tone in the
 * browse taxonomy — which is why Daylight Cinema is "Vivid", not "Warm":
 * 3700K with A5 nets out neutral.
 */
export const TONE_WORDS: Readonly<Record<ToneId, readonly string[]>> = {
  warm: ['Warm', 'Golden', 'Amber'],
  cool: ['Cool'],
  mono: ['Mono', 'Sepia'],
  neutral: ['Neutral'],
};

export function parseRecipeName(
  name: string,
): { format: 'pp' | 'cl'; number: string; words: string[] } | null {
  const m = RECIPE_NAME_RE.exec(name);
  if (!m) return null;
  return { format: m[1] === 'PP' ? 'pp' : 'cl', number: m[2], words: m[3].split(' ') };
}

/**
 * The new name of every recipe whose source is not ours — the ten kept legacy
 * Picture Profiles and the 37 Sony Asia Creative Looks — keyed by recipe id.
 * `scripts/emit-seed.ts` applies it after migration and import. Their settings
 * never change here; the photographer stays in `sony-asia-credits.json` and
 * the gallery's credit line. The originals carry their names in
 * `src/lib/originals/`.
 */
export const RECIPE_NAMES: Readonly<Record<string, string>> = {
  'SCL-PP-001': 'PP-001-Vivid Nostalgia Film',
  'SCL-PP-002': 'PP-002-Jade Soft Film',
  'SCL-PP-009': 'PP-009-Teal Muted Street',
  'SCL-PP-015': 'PP-015-Warm Faded Slide',
  'SCL-PP-025': 'PP-025-Vivid Deep Cinema',
  'SCL-PP-027': 'PP-027-Vivid Daylight Cinema',
  'SCL-PP-044': 'PP-044-Matte Vivid Film',
  'SCL-PP-045': 'PP-045-Clean Neutral Stream',
  'SCL-PP-046': 'PP-046-Clean Soft Stream',
  'SCL-PP-047': 'PP-047-Range Neutral Stream',

  'SCL-CL-001': 'CL-001-Film Hard Faded',
  'SCL-CL-002': 'CL-002-Film Warm Muted',
  'SCL-CL-003': 'CL-003-Vivid Crisp Neutral',
  'SCL-CL-004': 'CL-004-Vivid Soft Faded',
  'SCL-CL-005': 'CL-005-Vivid Warm Crisp',
  'SCL-CL-006': 'CL-006-Vivid Bright Crisp',
  'SCL-CL-007': 'CL-007-Vivid Natural Daylight',
  'SCL-CL-008': 'CL-008-Vivid Cool Natural',
  'SCL-CL-009': 'CL-009-Flat Cool Standard',
  'SCL-CL-010': 'CL-010-Soft Natural Standard',
  'SCL-CL-011': 'CL-011-Natural Standard Daylight',
  'SCL-CL-012': 'CL-012-Soft Warm Rich',
  'SCL-CL-013': 'CL-013-Airy Warm Pastel',
  'SCL-CL-014': 'CL-014-Airy Warm Rich',
  'SCL-CL-015': 'CL-015-Airy Faded Soft',
  'SCL-CL-016': 'CL-016-Airy Matte Natural',
  'SCL-CL-017': 'CL-017-Sepia Soft Deep',
  'SCL-CL-018': 'CL-018-Sepia Flat Crisp',
  'SCL-CL-019': 'CL-019-Portrait Soft Warm',
  'SCL-CL-020': 'CL-020-Instant Faded Natural',
  'SCL-CL-021': 'CL-021-Instant Soft Violet',
  'SCL-CL-022': 'CL-022-Instant Cool Soft',
  'SCL-CL-023': 'CL-023-Instant Warm Faded',
  'SCL-CL-024': 'CL-024-Instant Warm Punchy',
  'SCL-CL-025': 'CL-025-Film Warm Bright',
  'SCL-CL-026': 'CL-026-Film Warm Soft',
  'SCL-CL-027': 'CL-027-Film Deep Muted',
  'SCL-CL-028': 'CL-028-Film Warm Deep',
  'SCL-CL-029': 'CL-029-Film Flat Rich',
  'SCL-CL-030': 'CL-030-Film Soft Faded',
  'SCL-CL-031': 'CL-031-Film Hard Muted',
  'SCL-CL-032': 'CL-032-Film Warm Faded',
  'SCL-CL-033': 'CL-033-Film Natural Daylight',
  'SCL-CL-034': 'CL-034-Film Natural Neutral',
  'SCL-CL-035': 'CL-035-Film Deep Crisp',
  'SCL-CL-036': 'CL-036-Film Warm Natural',
  'SCL-CL-037': 'CL-037-Film Soft Rich',
};
