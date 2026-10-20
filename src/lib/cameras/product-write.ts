import { slugify } from '@/lib/lab/parse';
import { highlightsSchema } from './highlights';
import { SPEC_ROWS, type ProductSpecs, type SonyCamera } from './types';
import {
  PRICE_VND_MAX,
  formatPriceVnd,
  isCategory,
  isValidPlacement,
  rebuildSpecs,
  specKindFor,
  type Category,
  type SpecKind,
} from './taxonomy';

/**
 * What an administrator's save may change — the rules both product routes
 * share, decided without Next or Supabase so they run as plain functions
 * (`product-write.test.ts`).
 *
 * The body is untrusted even though the editor is trusted: the request is not a
 * trusted object. The id comes from the route (update) or is derived (create),
 * never read from the body; `price_formatted` and `specsMissing` are derived,
 * never read from it; `updated_at` / `updated_by` are stamped by the route from
 * the verified admin.
 *
 * **A value equal to what is stored is accepted as stored; only a change is
 * validated.** A row that carries a legacy value — a sub-category spelled
 * before the taxonomy existed, an empty SKU, a scraped `url` — must still be
 * saveable for its other fields, or one old value makes a product nobody can
 * touch.
 */

export const SKU_MAX = 64;
export const URL_MAX = 500;
const NAME_MAX = 200;
const FULL_NAME_MAX = 300;
const GALLERY_MAX = 100;
const FEATURE_LINES_MAX = 40;
/** Over five times the longest seeded line (93) — a cap on a paste, never on copy. */
const FEATURE_LINE_MAX = 500;

/** What a spec block cites when the product has no https page of its own. */
const DEFAULT_SPEC_SOURCE = 'https://www.sony.com.vn';

/** Every code these rules answer with, so the test can hold each to a message. */
export const PRODUCT_WRITE_ERRORS = [
  'badRequest',
  'nameRequired',
  'skuRequired',
  'invalidSku',
  'invalidPrice',
  'invalidUrl',
  'invalidImageUrl',
  'invalidPlacement',
  'notAllowedForCategory',
  'invalidHighlights',
  'skuTaken',
  'duplicateProduct',
  'saveFailed',
] as const;

type ValidationError = Exclude<(typeof PRODUCT_WRITE_ERRORS)[number], 'skuTaken' | 'duplicateProduct' | 'saveFailed'>;
type Fail = { ok: false; error: ValidationError; status: 400 | 403 };

/** The columns a save changes, by their `sony_cameras` names. */
export type PatchResult = { ok: true; update: Record<string, unknown> } | Fail;
export type CreateResult = { ok: true; product: SonyCamera } | Fail;

const fail = (error: ValidationError, status: 400 | 403 = 400): Fail => ({ ok: false, error, status });
const failed = (x: unknown): x is Fail =>
  typeof x === 'object' && x !== null && (x as { ok?: unknown }).ok === false;

type Body = Record<string, unknown>;
const isBody = (x: unknown): x is Body => typeof x === 'object' && x !== null && !Array.isArray(x);

const asLines = (x: unknown): string[] =>
  Array.isArray(x)
    ? x
        .filter((l): l is string => typeof l === 'string')
        .map((l) => l.trim().slice(0, FEATURE_LINE_MAX))
        .filter(Boolean)
        .slice(0, FEATURE_LINES_MAX)
    : [];

const asUrls = (x: unknown[]): string[] =>
  x
    .filter((u): u is string => typeof u === 'string')
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, GALLERY_MAX);

/**
 * Keeps only the fields this product kind actually has, and only strings or
 * null. An unknown key is dropped rather than stored: the seed and the DB have
 * to stay the same shape, because `pull:supabase` writes one back into the
 * other and a stray key would survive into the file the tests read.
 *
 * A body field that is absent leaves the stored value alone; a blank or `null`
 * one clears it. `specsMissing` is always recomputed, never read from the body.
 */
export function sanitizeSpecs(input: Record<string, unknown>, existing: ProductSpecs): ProductSpecs {
  const kind = existing.kind;
  const out: Record<string, unknown> = { ...existing };

  for (const field of SPEC_ROWS[kind]) {
    if (!(field in input)) continue;
    const raw = input[field];
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      out[field] = null;
      continue;
    }
    if (typeof raw !== 'string') continue;
    out[field] = raw.replace(/\b(Xấp xỉ|Khoảng)\s+/gi, '').trim().slice(0, 300);
  }

  if (typeof input.specsSource === 'string' && /^https?:\/\//.test(input.specsSource)) {
    out.specsSource = input.specsSource.trim().slice(0, URL_MAX);
  }

  out.specsMissing = SPEC_ROWS[kind].filter((f) => out[f] === null || out[f] === undefined).sort();
  return out as unknown as ProductSpecs;
}

/** A string field as sent: `undefined` when absent, `null` when malformed. */
function text(body: Body, key: string): string | undefined | null {
  if (!(key in body) || body[key] === undefined) return undefined;
  return typeof body[key] === 'string' ? (body[key] as string).trim() : null;
}

/** Trimmed at the ends only: `DSC-RX1RM3  AP2` ships with two inner spaces. */
function cleanSku(sku: string, category: Category): string | Fail {
  if (sku.length > SKU_MAX || /[\u0000-\u001f\u007f]/.test(sku)) return fail('invalidSku');
  if (!sku && category !== 'audio') return fail('skuRequired');
  return sku;
}

function cleanPrice(raw: unknown): number | Fail {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > PRICE_VND_MAX) {
    return fail('invalidPrice');
  }
  return raw;
}

/**
 * One http(s) link, or `''` — the catalogue's own "no page", which 20 audio
 * rows and 6 cameras hold and both surfaces test before linking. No whitespace
 * inside: six scraped rows once held a newline-joined list of image URLs here,
 * and the WHATWG parser strips the newlines silently, so `new URL()` alone would
 * call that list one valid link.
 */
function cleanUrl(url: string): string | Fail {
  if (!url) return '';
  if (url.length > URL_MAX || !/^https?:\/\/\S+$/i.test(url)) return fail('invalidUrl');
  try {
    new URL(url);
  } catch {
    return fail('invalidUrl');
  }
  return url;
}

/**
 * One photograph: an http(s) link, or a path on this site (`/logo.png` is the
 * create form's default). Not `//host` and not `/\host`, which a browser
 * resolves to another origin; nothing with whitespace inside, for the same
 * newline-joined lists `cleanUrl()` refuses. Every catalogue read serves these
 * columns, and no renderer turning one into a link is what keeps a
 * `javascript:` value harmless today — not something to depend on.
 */
function cleanImage(u: string): string | Fail {
  if (u.length > URL_MAX || /[\s\\]/.test(u)) return fail('invalidImageUrl');
  if (/^\/[^/]/.test(u)) return u;
  if (!/^https?:\/\/\S+$/i.test(u)) return fail('invalidImageUrl');
  try {
    new URL(u);
  } catch {
    return fail('invalidImageUrl');
  }
  return u;
}

/** The gallery as sent, each new entry held to `cleanImage()`; one already stored is accepted as stored. */
function cleanGallery(x: unknown[], stored: readonly string[] = []): string[] | Fail {
  const urls = asUrls(x);
  for (const u of urls) {
    if (stored.includes(u)) continue;
    const clean = cleanImage(u);
    if (failed(clean)) return clean;
  }
  return urls;
}

const specSourceFor = (url: string) => (/^https:\/\/\S+$/.test(url) ? url : DEFAULT_SPEC_SOURCE);

/**
 * The spec block a save leaves behind, or `undefined` for "do not write the
 * column".
 *
 * Same kind as stored → the body's values merged in. A different kind, or no
 * block at all → the stored block re-shaped for the kind the placement names
 * (`rebuildSpecs()` keeps the rows both kinds share) with the body's values
 * applied for that kind. That retires the old 409 `noSpecBlock`: five
 * accessories shipped with `specs: null` and could never take a weight. A
 * blockless product the save does not touch stays blockless.
 *
 * The body's own `kind` is never read — the placement decides it, so a request
 * cannot turn a camera into a speaker by naming one.
 */
function nextSpecs(
  current: ProductSpecs | undefined,
  kind: SpecKind | null,
  input: unknown,
  moved: boolean,
  url: string,
): ProductSpecs | undefined | Fail {
  const body = isBody(input) ? input : undefined;
  if (!kind) {
    /* A legacy audio first level the taxonomy does not know: keep what is
       stored, and refuse only an attempt to write a block of unknown shape. */
    if (body && !current) return fail('invalidPlacement');
    return body && current ? sanitizeSpecs(body, current) : undefined;
  }
  if (current && current.kind === kind) return body ? sanitizeSpecs(body, current) : undefined;
  if (!body && !(moved && current)) return undefined;
  const reshaped = rebuildSpecs(current, kind, specSourceFor(url));
  return body ? sanitizeSpecs(body, reshaped) : reshaped;
}

/**
 * The columns an update changes, or why it may not be saved.
 *
 * `canManage` is the signed-in role's category check — `canManageCategory()`
 * bound to the verified admin — asked of the category the product is in now
 * AND the one it is moving to, so a DI editor cannot file a camera under audio
 * and a PE editor cannot pull a lens into their list.
 *
 * Name, full name and primary image keep the route's old leniency: a blank one
 * is not sent rather than refused — the editor never sends one.
 */
export function productPatch(
  body: unknown,
  current: SonyCamera,
  canManage: (category: Category) => boolean,
): PatchResult {
  if (!isBody(body)) return fail('badRequest');
  if (!canManage(current.category)) return fail('notAllowedForCategory', 403);

  const update: Record<string, unknown> = {};

  const name = text(body, 'name');
  if (name) update.name = name.slice(0, NAME_MAX);
  const fullName = text(body, 'fullName');
  if (fullName) update.full_name = fullName.slice(0, FULL_NAME_MAX);
  const imageUrl = text(body, 'imageUrl');
  if (imageUrl) {
    const clean = imageUrl === current.imageUrl.trim() ? imageUrl : cleanImage(imageUrl);
    if (failed(clean)) return clean;
    update.image_url = clean;
  }
  if (Array.isArray(body.galleryUrls)) {
    const gallery = cleanGallery(body.galleryUrls, current.galleryUrls ?? []);
    if (failed(gallery)) return gallery;
    update.gallery_urls = gallery;
  }
  if (isBody(body.features)) {
    update.features = { en: asLines(body.features.en), vi: asLines(body.features.vi) };
  }

  /* Placement first: whether a SKU is required, which spec kind the block
     takes and whether highlights are allowed all depend on where it lands. */
  let category = current.category;
  if ('category' in body && body.category !== undefined) {
    if (!isCategory(body.category)) return fail('invalidPlacement');
    category = body.category;
  }
  const sub1 = text(body, 'subCategory1');
  const sub2 = text(body, 'subCategory2');
  if (sub1 === null || sub2 === null) return fail('badRequest');
  const subCategory1 = sub1 ?? current.subCategory1;
  const subCategory2 = sub2 ?? current.subCategory2;

  const moved =
    category !== current.category || subCategory1 !== current.subCategory1 || subCategory2 !== current.subCategory2;
  if (moved) {
    if (!isValidPlacement(category, subCategory1, subCategory2)) return fail('invalidPlacement');
    if (!canManage(category)) return fail('notAllowedForCategory', 403);
    if (category !== current.category) update.category = category;
    if (subCategory1 !== current.subCategory1) update.sub_category_1 = subCategory1;
    if (subCategory2 !== current.subCategory2) update.sub_category_2 = subCategory2;
  }

  const sku = text(body, 'sku');
  if (sku === null) return fail('badRequest');
  if (sku !== undefined && sku !== current.sku.trim()) {
    const clean = cleanSku(sku, category);
    if (failed(clean)) return clean;
    update.sku = clean;
  } else if (category !== current.category) {
    /* Moving out of audio, where a SKU is optional, into a category where it
       is not: the stored one has to qualify too. */
    const kept = cleanSku(current.sku, category);
    if (failed(kept)) return kept;
  }

  if ('priceVnd' in body && body.priceVnd !== current.priceVnd) {
    const price = cleanPrice(body.priceVnd);
    if (failed(price)) return price;
    update.price_vnd = price;
    /* Always derived — a body's `priceFormatted` is never read. */
    update.price_formatted = formatPriceVnd(price);
  }

  const rawUrl = text(body, 'url');
  if (rawUrl === null) return fail('badRequest');
  let url = current.url;
  if (rawUrl !== undefined && rawUrl !== current.url.trim()) {
    const clean = cleanUrl(rawUrl);
    if (failed(clean)) return clean;
    update.url = url = clean;
  }

  const kind = specKindFor(category, subCategory1) ?? (moved ? null : (current.specs?.kind ?? null));
  const specs = nextSpecs(current.specs, kind, body.specs, moved, url);
  if (failed(specs)) return specs;
  if (specs) update.specs = specs;

  /* `null` clears the column; anything else must pass `highlightsSchema`, and
     the product must be a camera once this save lands — the sales-talk block
     has no meaning on a lens or an accessory.

     A camera that moves out of the category loses them in the same write. The
     product page renders highlights whatever the category, so a camera refiled
     as a lens kept its sales points and camera core specs in place of its
     feature list — and the editor, which offers them only on a camera, could
     not remove them. The editor asks before a move that would do this. */
  if (body.highlights !== undefined) {
    if (body.highlights === null) update.highlights = null;
    else {
      const parsed = highlightsSchema.safeParse(body.highlights);
      if (!parsed.success || category !== 'camera') return fail('invalidHighlights');
      update.highlights = parsed.data;
    }
  } else if (current.category === 'camera' && category !== 'camera') {
    update.highlights = null;
  }

  return { ok: true, update };
}

/**
 * A new product, or why it may not be created. The same rules as an update;
 * every field is new, so every field is validated.
 *
 * The id is `sony-` and the SKU — or, for an audio product without one, the
 * name — slugged with its diacritics folded, not dropped: the id is a public
 * `/cameras/<id>` URL, and stripping every non-ASCII letter turned "Tai nghe
 * chống ồn" into `tai-nghe-ch-ng-n`.
 */
export function productCreate(body: unknown, canManage: (category: Category) => boolean): CreateResult {
  if (!isBody(body)) return fail('badRequest');

  const name = text(body, 'name');
  const sku = text(body, 'sku');
  const sub1 = text(body, 'subCategory1');
  const sub2 = text(body, 'subCategory2');
  const rawUrl = text(body, 'url');
  /* A field that is there but is not a string is a malformed request, not an
     empty one — `{"sku": 1}` must not become a product with no SKU. */
  if ([name, sku, sub1, sub2, rawUrl].includes(null)) return fail('badRequest');
  if (!name) return fail('nameRequired');

  if (!isCategory(body.category)) return fail('invalidPlacement');
  const category = body.category;
  if (!canManage(category)) return fail('notAllowedForCategory', 403);

  const subCategory1 = sub1 ?? '';
  const subCategory2 = sub2 ?? '';
  const kind = specKindFor(category, subCategory1);
  if (!kind || !isValidPlacement(category, subCategory1, subCategory2)) return fail('invalidPlacement');

  const cleanedSku = cleanSku(sku ?? '', category);
  if (failed(cleanedSku)) return cleanedSku;

  const priceVnd = cleanPrice(body.priceVnd ?? 0);
  if (failed(priceVnd)) return priceVnd;

  const url = cleanUrl(rawUrl ?? '');
  if (failed(url)) return url;

  const fullName = text(body, 'fullName');
  const image = text(body, 'imageUrl');
  const imageUrl = image ? cleanImage(image) : '/logo.png';
  if (failed(imageUrl)) return imageUrl;
  const galleryUrls = Array.isArray(body.galleryUrls)
    ? cleanGallery(body.galleryUrls)
    : [imageUrl].filter((u) => u !== '/logo.png');
  if (failed(galleryUrls)) return galleryUrls;
  const features = isBody(body.features)
    ? { en: asLines(body.features.en), vi: asLines(body.features.vi) }
    : { en: [], vi: [] };

  const blank = rebuildSpecs(null, kind, specSourceFor(url));
  const specs = isBody(body.specs) ? sanitizeSpecs(body.specs, blank) : blank;

  return {
    ok: true,
    product: {
      id: `sony-${slugify(cleanedSku || name) || Date.now()}`,
      sku: cleanedSku,
      name: name.slice(0, NAME_MAX),
      fullName: fullName ? fullName.slice(0, FULL_NAME_MAX) : name.slice(0, NAME_MAX),
      category,
      subCategory1,
      subCategory2,
      priceVnd,
      priceFormatted: formatPriceVnd(priceVnd),
      url,
      imageUrl,
      galleryUrls,
      features,
      specs,
    },
  };
}

/**
 * A failed write as the editor's error code.
 *
 * `23505` is a unique violation. On `sony_cameras` that is either the partial
 * index on a non-empty SKU — two products cannot share one — or, on a create,
 * the primary key: the id derived from this SKU or name is taken. Either is the
 * editor's to fix, and "could not save" gave them nothing to fix it with.
 */
export function writeErrorFor(error: { code?: string; message?: string; details?: string } | null): {
  error: 'skuTaken' | 'duplicateProduct' | 'saveFailed';
  status: 409 | 502;
} {
  if (error?.code === '23505') {
    const text = `${error.message ?? ''} ${error.details ?? ''}`;
    return /\bsku\b|_sku_/i.test(text)
      ? { error: 'skuTaken', status: 409 }
      : { error: 'duplicateProduct', status: 409 };
  }
  return { error: 'saveFailed', status: 502 };
}
