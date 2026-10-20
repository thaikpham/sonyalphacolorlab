import { SPEC_ROWS, type ProductSpecs, type SonyCamera } from './types';

/**
 * The Wiki catalogue's taxonomy — the single source of truth for where a
 * product may be filed and what shape its spec block takes.
 *
 * Source: the catalogue itself, `data/sony-cameras.seed.json` and
 * `data/sony-audio.seed.json`. These are not labels but **filter keys**: the
 * public wiki matches `subCategory1 === chip` character for character, so a
 * product saved as "Mirrorless Full-Frame" sits beside the "Full Frame" chip and
 * never appears under it. `taxonomy.test.ts` reads both seeds and fails if any
 * shipped row is a placement this file does not accept, or carries a spec block
 * of a different kind from the one `specKindFor()` names — so this list cannot
 * drift from the data.
 *
 * Adding a sub-category touches this file only. The create route, the update
 * route and the admin editor's selects all read it; the reader-facing label is
 * `subCategoryLabel()` in `display.ts`, which renders an unknown value as stored.
 *
 * Every value here is the catalogue's own spelling, mixed languages included
 * ("Tai nghe" beside "Grip / Tripod"). Do not normalise it: shipping rows,
 * shared URLs and the public chips carry these exact strings.
 */

export type Category = SonyCamera['category'];
export type SpecKind = ProductSpecs['kind'];

export const CATEGORIES: readonly Category[] = ['camera', 'lens', 'accessory', 'audio'];

/** The first level, per category, in the order the editor offers it. */
const SUB_CATEGORY_1: Record<Category, readonly string[]> = {
  camera: ['Full Frame', 'APS-C', '1-Inch'],
  lens: ['Full Frame', 'APS-C', 'Adapter'],
  accessory: ['Audio', 'Power', 'Grip / Tripod', 'Adapter'],
  audio: ['Tai nghe', 'Loa'],
};

/**
 * The second level, per category.
 *
 * The DI categories mix freely — a 1-Inch body is DSC or Vlog, an APS-C one
 * Alpha, Cinema Line or Vlog — so their second level is not narrowed by the
 * first. Audio's is: a speaker is never "Choàng đầu". That pairing lives in
 * `AUDIO_SUB_CATEGORY_2` below, and the audio entry here is their union.
 */
const SUB_CATEGORY_2: Record<Category, readonly string[]> = {
  camera: ['Máy ảnh Alpha', 'Cinema Line', 'Vlog', 'DSC'],
  lens: ['G', 'GM', 'SEL'],
  accessory: ['Microphone', 'Battery', 'Vlog Accessory', 'Lens Mount'],
  audio: ['Choàng đầu', 'Nhét tai', 'Gaming', 'Di động', 'Karaoke'],
};

/**
 * Audio's first level decides both its second level and its spec kind — the
 * FY26 sheets publish headphones and speakers as two different tables.
 */
const AUDIO: Record<string, { sub2: readonly string[]; kind: SpecKind }> = {
  'Tai nghe': { sub2: ['Choàng đầu', 'Nhét tai', 'Gaming'], kind: 'headphone' },
  Loa: { sub2: ['Di động', 'Karaoke'], kind: 'speaker' },
};

/** The highest price the editor accepts, in đồng. The dearest product is ~3.5×10⁸. */
export const PRICE_VND_MAX = 100_000_000_000;

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

export function subCategory1Choices(category: Category): readonly string[] {
  return SUB_CATEGORY_1[category] ?? [];
}

export function subCategory2Choices(category: Category, subCategory1: string): readonly string[] {
  if (category === 'audio') return AUDIO[subCategory1]?.sub2 ?? [];
  return SUB_CATEGORY_2[category] ?? [];
}

/**
 * Whether a product may be filed here. The second level may be `''` — the
 * column's default, and what a product filed before it was chosen holds — but a
 * non-empty one must belong to the first.
 */
export function isValidPlacement(category: string, subCategory1: string, subCategory2: string): boolean {
  if (!isCategory(category)) return false;
  if (!subCategory1Choices(category).includes(subCategory1)) return false;
  return subCategory2 === '' || subCategory2Choices(category, subCategory1).includes(subCategory2);
}

/**
 * The spec block a product filed here carries — the key into `SPEC_ROWS`.
 *
 * `null` for an audio first level the taxonomy does not know. The create route
 * used to look for "loa" inside the string and call everything else a
 * headphone; a value that is not in the taxonomy has no kind, and saying so is
 * the caller's cue to refuse it.
 */
export function specKindFor(category: Category, subCategory1: string): SpecKind | null {
  if (category === 'audio') return AUDIO[subCategory1]?.kind ?? null;
  return category;
}

/**
 * The price as the catalogue writes it: Vietnamese digit grouping and ` đ`, or
 * "Liên hệ" for a product with no published figure.
 *
 * Derived, never typed: every seeded row has exactly this shape, and the create
 * route's `₫` was the first of a second spelling. The grouping is done here
 * rather than by `toLocaleString('vi-VN')`, which depends on the ICU data the
 * runtime happens to ship.
 */
export function formatPriceVnd(priceVnd: number): string {
  if (!(priceVnd > 0)) return 'Liên hệ';
  const digits = String(Math.trunc(priceVnd));
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`;
}

/**
 * A spec block re-shaped for `kind`.
 *
 * Keeps every value the new kind also has a row for (a camera's `weight` is
 * still its weight as a lens), drops the rest, sets the new kind's other rows to
 * `null`, and recomputes `specsMissing` from what is actually null — the
 * invariant `specs.test.ts` enforces. `specsSource` is kept; `fallbackSource`
 * is used only when there was no block, or no source on it.
 *
 * `null` in gives an all-gaps block: every row declared missing, nothing
 * invented. That is what lets the five accessories that shipped with
 * `specs: null` take a weight on their first save.
 */
export function rebuildSpecs(
  existing: ProductSpecs | null | undefined,
  kind: SpecKind,
  fallbackSource = '',
): ProductSpecs {
  const old = (existing ?? {}) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { kind };

  if (kind === 'accessory') {
    out.keySpecs =
      existing?.kind === 'accessory' && Array.isArray(existing.keySpecs)
        ? existing.keySpecs.map((s) => ({ ...s }))
        : [];
  }

  for (const field of SPEC_ROWS[kind]) {
    const value = old[field];
    out[field] = typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  const source = typeof old.specsSource === 'string' ? old.specsSource.trim() : '';
  out.specsSource = source || fallbackSource;
  out.specsMissing = SPEC_ROWS[kind].filter((f) => out[f] === null).sort();
  return out as unknown as ProductSpecs;
}

/**
 * The filled fields a move from `from` to `to` would discard — what the editor
 * counts before it asks. A blank is not a loss; `keySpecs` is, when there are
 * any and the product stops being an accessory.
 */
export function specFieldsDropped(values: Record<string, unknown>, from: SpecKind, to: SpecKind): string[] {
  if (from === to) return [];
  const kept = new Set(SPEC_ROWS[to]);
  const lost = SPEC_ROWS[from].filter((f) => {
    const v = values[f];
    return !kept.has(f) && typeof v === 'string' && v.trim() !== '';
  });
  if (from === 'accessory' && Array.isArray(values.keySpecs) && values.keySpecs.length > 0) {
    lost.push('keySpecs');
  }
  return lost;
}
