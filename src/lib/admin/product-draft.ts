import { splitFeatures } from '@/lib/cameras/features';
import { SPEC_ROWS, type SonyCamera } from '@/lib/cameras/types';
import {
  specFieldsDropped,
  specKindFor,
  subCategory1Choices,
  subCategory2Choices,
  type Category,
  type SpecKind,
} from '@/lib/cameras/taxonomy';
import {
  draftToHighlights,
  highlightsToDraft,
  parseHighlights,
  type HighlightsDraft,
} from '@/lib/cameras/highlights';

/**
 * The product editor's draft, and what a save sends from it.
 *
 * Pure and outside the component so the rules can be executed in a test: the
 * suite runs in Node with no DOM, and every defect these functions fix was a
 * question of which fields a save carried, not of how the form looked.
 */

/** Where a product is filed — the three columns the catalogue filters by. */
export type Placement = { category: Category; subCategory1: string; subCategory2: string };

/** What the form edits. Text as typed — trimming happens when it is compared. */
export type DraftFields = Placement & {
  name: string;
  fullName: string;
  sku: string;
  /** Digits only, `''` for "no published figure" (stored as 0). */
  priceVnd: string;
  url: string;
  imageUrl: string;
  galleryUrls: string;
  en: string;
  vi: string;
  /**
   * The kind of sheet `specs` holds: the stored block's, or — for a product
   * with none — the one its placement names (`specKindFor`). `null` only for a
   * legacy audio first level the taxonomy does not know.
   */
  specKind: SpecKind | null;
  specs: Record<string, string>;
  source: string;
  hl: HighlightsDraft;
};

export type Draft = DraftFields & {
  /** The product this draft was built from, so a late answer — a save, a
      translation — can tell whether the editor is still on it. */
  id: string;
  /** The row's `updated_at` when it was opened, named on save as
      `expectedUpdatedAt`. `null` is a real version: never edited. */
  version: string | null;
  /** The fields as stored when the draft was opened or last saved. Never
      edited. `changes()` diffs against it, so a save carries only what the
      editor touched: resending every column was how a second tab's save
      silently reverted the first, and how a stored `highlights` value that
      fails `highlightsSchema` — an empty draft here, `null` through
      `draftToHighlights` — was erased by an unrelated price edit. */
  base: DraftFields;
};

export const lines = (s?: string | null) =>
  (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** The digits of a typed or pasted price — `52.990.000 đ` is `52990000`. */
export const priceDigits = (s: string) => s.replace(/\D/g, '');

/** The draft's price as the number the route takes. `''` is 0, "Liên hệ". */
const priceOf = (s: string) => Number(priceDigits(s) || '0');

export function fieldsOf(p: SonyCamera): DraftFields {
  const f = splitFeatures(p.features);
  /* A product with no spec block still gets the rows of its kind, so the five
     accessories that shipped with `specs: null` can take a weight at all. */
  const specKind = p.specs?.kind ?? specKindFor(p.category, p.subCategory1);
  const specs: Record<string, string> = {};
  const row = (p.specs ?? {}) as unknown as Record<string, string | null>;
  if (specKind) for (const k of SPEC_ROWS[specKind]) specs[k] = row[k] ?? '';
  return {
    category: p.category,
    subCategory1: p.subCategory1 ?? '',
    subCategory2: p.subCategory2 ?? '',
    name: p.name ?? '',
    fullName: p.fullName ?? '',
    sku: p.sku ?? '',
    priceVnd: p.priceVnd > 0 ? String(Math.trunc(p.priceVnd)) : '',
    url: p.url ?? '',
    imageUrl: p.imageUrl ?? '',
    galleryUrls: (p.galleryUrls ?? []).join('\n'),
    en: f.en.join('\n'),
    vi: f.vi.join('\n'),
    specKind,
    specs,
    source: p.specs?.specsSource ?? '',
    hl: highlightsToDraft(parseHighlights(p.highlights)),
  };
}

export function asDraft(p: SonyCamera, version: string | null): Draft {
  const fields = fieldsOf(p);
  return { id: p.id, version, ...fields, base: fields };
}

/**
 * The stored row, with the seed's packaging where the database has none.
 *
 * The admin routes read the row with no seed fallback, because a write is
 * checked against it. The catalogue the page rendered fills a null `specs` or
 * `gallery_urls` from the seed, keyed by id — so a product whose database copy
 * has no spec block would open here with none, where it used to open with the
 * seed's full sheet and could save it. The fill is the same one
 * `productFromRow(row, seed)` makes, with the page's copy as the seed.
 */
export function withPackaging(stored: SonyCamera, loaded: SonyCamera | undefined): SonyCamera {
  return {
    ...stored,
    specs: stored.specs ?? loaded?.specs,
    galleryUrls: stored.galleryUrls ?? loaded?.galleryUrls,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const samePlacement = (a: Placement, b: Placement) =>
  a.category === b.category && a.subCategory1 === b.subCategory1 && a.subCategory2 === b.subCategory2;

/**
 * The placement one select change leads to.
 *
 * A first level the new category also has is kept (a camera and a lens are
 * both "Full Frame"); otherwise the category's first. A second level the new
 * first level does not offer is cleared rather than guessed — `''` is valid,
 * and filing a product under a line nobody picked would be the guess.
 */
export function choosePlacement(d: DraftFields, change: Partial<Placement>): Placement {
  const category = change.category ?? d.category;
  const sub1Choices = subCategory1Choices(category);
  const wantedSub1 = change.subCategory1 ?? d.subCategory1;
  const subCategory1 = sub1Choices.includes(wantedSub1) ? wantedSub1 : (sub1Choices[0] ?? '');
  const wantedSub2 = change.subCategory2 ?? d.subCategory2;
  const subCategory2 = subCategory2Choices(category, subCategory1).includes(wantedSub2) ? wantedSub2 : '';
  return { category, subCategory1, subCategory2 };
}

/** The spec kind the draft would hold once filed at `next`. */
function kindAt(d: Draft, next: Placement): SpecKind | null {
  if (samePlacement(next, d.base)) return d.base.specKind;
  return specKindFor(next.category, next.subCategory1) ?? d.specKind;
}

/**
 * The draft refiled at `next`, its sheet re-shaped when the kind changes.
 *
 * Rows the two kinds share keep what was typed (a camera's weight is still its
 * weight as a lens); the new kind's other rows start blank; the rest go — after
 * the editor has asked, see `placementDrops()`. Going back to the stored kind
 * before saving brings the stored values back: an undone move loses nothing.
 */
export function withPlacement(d: Draft, next: Placement): Draft {
  const specKind = kindAt(d, next);
  if (specKind === d.specKind) return { ...d, ...next };
  const specs: Record<string, string> = {};
  if (specKind) {
    for (const f of SPEC_ROWS[specKind]) {
      specs[f] = f in d.specs ? d.specs[f] : specKind === d.base.specKind ? (d.base.specs[f] ?? '') : '';
    }
  }
  return { ...d, ...next, specKind, specs };
}

/**
 * The filled values a move to `next` would discard — what the editor counts
 * before it asks. A blank is not a loss; an accessory's `keySpecs` is, when it
 * has any and stops being an accessory (the form does not edit them, so they
 * are read from the stored block).
 */
export function placementDrops(d: Draft, product: SonyCamera, next: Placement): string[] {
  const from = d.specKind;
  const to = kindAt(d, next);
  if (!from || !to || from === to) return [];
  const keySpecs = from === 'accessory' && product.specs?.kind === 'accessory' ? product.specs.keySpecs : [];
  return specFieldsDropped({ ...d.specs, keySpecs }, from, to);
}

/**
 * The locales a save would take from some feature lines to none.
 *
 * A save emptied `sony-np-fz100`'s English list — three lines in the seed, `[]`
 * in the database — and nothing asked. The editor confirms before any save this
 * names; emptying a list is allowed, never assumed.
 */
export function localesEmptied(d: Draft): ('en' | 'vi')[] {
  return (['en', 'vi'] as const).filter((l) => lines(d.base[l]).length > 0 && lines(d[l]).length === 0);
}

/**
 * Only the fields that differ from `base`, in the PATCH body's shape.
 *
 * Per column, with two blocks sent whole because each is one column: the
 * features (`{ en, vi }` is one jsonb) and the spec sheet. The sheet is whole
 * for a second reason — a row whose database copy has none shows the seed's
 * (or its kind's blank rows), and the route starts a block for it, so sending
 * one changed field would store that field alone and the public page would
 * lose the rest of the seed's sheet to it.
 *
 * The price goes as a number and never as text: the route derives the
 * catalogue's spelling. A placement goes field by field; the route checks the
 * three together against the taxonomy.
 */
export function changes(d: Draft, product: SonyCamera): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const b = d.base;

  const name = d.name.trim();
  if (name && name !== b.name.trim()) out.name = name;

  const fullName = d.fullName.trim();
  if (fullName && fullName !== b.fullName.trim()) out.fullName = fullName;

  if (d.category !== b.category) out.category = d.category;
  if (d.subCategory1 !== b.subCategory1) out.subCategory1 = d.subCategory1;
  if (d.subCategory2 !== b.subCategory2) out.subCategory2 = d.subCategory2;

  const sku = d.sku.trim();
  if (sku !== b.sku.trim()) out.sku = sku;

  const price = priceOf(d.priceVnd);
  if (price !== priceOf(b.priceVnd)) out.priceVnd = price;

  const url = d.url.trim();
  if (url !== b.url.trim()) out.url = url;

  const gallery = lines(d.galleryUrls);
  if (!same(gallery, lines(b.galleryUrls))) out.galleryUrls = gallery;

  /* The primary image falls back to the first gallery photograph, then to
     what is stored — so it is "changed" when that resolution moves. */
  const primary = d.imageUrl.trim() || gallery[0] || b.imageUrl.trim();
  if (primary && primary !== b.imageUrl.trim()) out.imageUrl = primary;

  const features = { en: lines(d.en), vi: lines(d.vi) };
  if (!same(features, { en: lines(b.en), vi: lines(b.vi) })) out.features = features;

  /* `kind` is the kind the draft's sheet holds. The route takes the kind from
     the placement and never from here, but a sheet re-shaped by a move has to
     travel with it, so a kind change alone is a change. */
  if (d.specKind) {
    const trimmed = (s: Record<string, string>) =>
      Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.trim()]));
    if (
      d.specKind !== b.specKind ||
      !same(trimmed(d.specs), trimmed(b.specs)) ||
      d.source.trim() !== b.source.trim()
    ) {
      out.specs = { ...d.specs, kind: d.specKind, specsSource: d.source };
    }
  }

  /* Highlights belong to a camera that stays one: the route refuses them on a
     product this save files anywhere else. */
  if (d.category === 'camera' && product.category === 'camera' && !same(d.hl, b.hl)) {
    out.highlights = draftToHighlights(d.hl);
  }

  return out;
}

/** Whether a save would change anything. */
export const isDirty = (d: Draft | null, product: SonyCamera | null): boolean =>
  !!d && !!product && d.id === product.id && Object.keys(changes(d, product)).length > 0;

/** The PATCH body: the changes, and the version they were made against. */
export const saveBody = (d: Draft, product: SonyCamera) => ({
  ...changes(d, product),
  expectedUpdatedAt: d.version,
});

/**
 * The draft once a save has answered.
 *
 * `sent` is the draft as it was when Save was pressed. The inputs stay live
 * during the round trip, so the draft on screen may have moved on: rebuilding
 * it from the stored row dropped anything typed in the meantime, without a
 * word. Now only an untouched draft is rebuilt — from the row the server
 * stored, so a re-shaped spec block and a derived price come back as they
 * are; a newer one keeps its edits and takes the stored row as its new
 * baseline and version, so they read as unsaved — which they are.
 */
export function afterSave(
  current: Draft | null,
  sent: Draft,
  stored: SonyCamera,
  version: string | null,
): Draft | null {
  if (!current || current.id !== stored.id) return current;
  const { base: _b, version: _v, ...now } = current;
  const { base: _sb, version: _sv, ...then } = sent;
  if (same(now, then)) return asDraft(stored, version);
  return { ...current, version, base: fieldsOf(stored) };
}
