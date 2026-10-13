import { splitFeatures } from '@/lib/cameras/features';
import { SPEC_ROWS, type SonyCamera } from '@/lib/cameras/types';
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

/** What the form edits. Text as typed — trimming happens when it is compared. */
export type DraftFields = {
  name: string;
  fullName: string;
  imageUrl: string;
  galleryUrls: string;
  en: string;
  vi: string;
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

export function fieldsOf(p: SonyCamera): DraftFields {
  const f = splitFeatures(p.features);
  const specs: Record<string, string> = {};
  const row = (p.specs ?? {}) as unknown as Record<string, string | null>;
  if (p.specs) for (const k of SPEC_ROWS[p.specs.kind]) specs[k] = row[k] ?? '';
  return {
    name: p.name ?? '',
    fullName: p.fullName ?? '',
    imageUrl: p.imageUrl ?? '',
    galleryUrls: (p.galleryUrls ?? []).join('\n'),
    en: f.en.join('\n'),
    vi: f.vi.join('\n'),
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

/**
 * Only the fields that differ from `base`, in the PATCH body's shape.
 *
 * Per column, with two blocks sent whole because each is one column: the
 * features (`{ en, vi }` is one jsonb) and the spec sheet. The sheet is whole
 * for a second reason — a row whose database copy has none shows the seed's,
 * and the route starts a blank block for it, so sending one changed field
 * would store that field alone and the public page would lose the rest of
 * the seed's sheet to it.
 */
export function changes(d: Draft, product: SonyCamera): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const b = d.base;

  const name = d.name.trim();
  if (name && name !== b.name.trim()) out.name = name;

  const fullName = d.fullName.trim();
  if (fullName && fullName !== b.fullName.trim()) out.fullName = fullName;

  const gallery = lines(d.galleryUrls);
  if (!same(gallery, lines(b.galleryUrls))) out.galleryUrls = gallery;

  /* The primary image falls back to the first gallery photograph, then to
     what is stored — so it is "changed" when that resolution moves. */
  const primary = d.imageUrl.trim() || gallery[0] || b.imageUrl.trim();
  if (primary && primary !== b.imageUrl.trim()) out.imageUrl = primary;

  const features = { en: lines(d.en), vi: lines(d.vi) };
  if (!same(features, { en: lines(b.en), vi: lines(b.vi) })) out.features = features;

  /* `kind` lets the route start a spec block for a row whose database copy
     has none; it only accepts a kind the category allows. */
  if (product.specs) {
    const trimmed = (s: Record<string, string>) =>
      Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.trim()]));
    if (!same(trimmed(d.specs), trimmed(b.specs)) || d.source.trim() !== b.source.trim()) {
      out.specs = { ...d.specs, kind: product.specs.kind, specsSource: d.source };
    }
  }

  if (product.category === 'camera' && !same(d.hl, b.hl)) out.highlights = draftToHighlights(d.hl);

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
 * word. Now only an untouched draft is rebuilt; a newer one keeps its edits
 * and takes the stored row as its new baseline and version, so they read as
 * unsaved — which they are.
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
