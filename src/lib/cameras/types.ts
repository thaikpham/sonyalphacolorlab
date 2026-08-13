import type { LocalizedFeatures } from './features';
export type ProductCategory = 'all' | 'camera' | 'lens' | 'accessory' | 'audio';

/**
 * Core specs, per category.
 *
 * Values are stored as language-neutral strings — `"679 g"`, `"100–51200"`,
 * `"129,7 x 77,8 x 103,7 mm"` — not as Sony's Vietnamese prose ("Xấp xỉ 679 g")
 * and not as numbers. A number would force a unit into the type and lose the
 * ranges and qualifiers the source actually publishes; the prose would be a
 * user-visible string outside `messages/*.json`, which Rule 3 forbids. The
 * labels are translated, the values are not — the same split as the recipe
 * parameter tables, where `constants.ts` names live outside the catalogues.
 *
 * Every field is nullable on purpose. A spec the source does not state is
 * `null` and listed in `specsMissing`; it is never filled with a plausible
 * value. That is the same rule the recipe importers follow, and it exists
 * because a spec table that quietly invents one row is worse than one with a
 * visible gap.
 */

export interface SpecProvenance {
  /** The exact page the values were read from. */
  specsSource: string;
  /** Field names the source did not publish. Rendered as "—", never guessed. */
  specsMissing: string[];
}

export interface CameraSpecs extends SpecProvenance {
  kind: 'camera';
  /** Type and physical size, e.g. "Full-frame 35 mm (35,9 x 23,9 mm) Exmor R CMOS". */
  sensor: string | null;
  /** Effective pixels for stills, e.g. "33,0 MP". */
  effectivePixels: string | null;
  /** Native range, with the expanded range in parentheses if published. */
  isoRange: string | null;
  /** Point count and system, e.g. "759 điểm phase-detection". */
  autofocus: string | null;
  /** Headline mode only, e.g. "4K 60p". */
  video: string | null;
  /** In-body stabilisation. `null` means the source did not state it. */
  stabilization: string | null;
  /** `null` is meaningful here: several ZV and 1-inch bodies have no EVF. */
  viewfinder: string | null;
  lcd: string | null;
  mediaSlots: string | null;
  /** CIPA-rated frames, e.g. "580 ảnh (LCD)". */
  battery: string | null;
  /** With battery and card when the source says so. */
  weight: string | null;
  dimensions: string | null;
}

export interface LensSpecs extends SpecProvenance {
  kind: 'lens';
  /** Coverage the lens is designed for: "Full-frame" | "APS-C". */
  format: string | null;
  focalLength: string | null;
  maxAperture: string | null;
  minAperture: string | null;
  /** Elements and groups, e.g. "17 thành phần / 12 nhóm". */
  construction: string | null;
  angleOfView: string | null;
  minFocusDistance: string | null;
  maxMagnification: string | null;
  /** `null` for lenses that take no front filter (e.g. some ultra-wides). */
  filterDiameter: string | null;
  apertureBlades: string | null;
  /** Optical SteadyShot. `null` means the lens has none or none was stated. */
  stabilization: string | null;
  weight: string | null;
  dimensions: string | null;
}

/**
 * Accessories are too varied for a fixed shape — a shotgun mic, a mount
 * adapter, a grip and a battery share almost no fields. So the important rows
 * are a list the extractor fills from whatever the source publishes, with the
 * three fields they do tend to share pulled out.
 */
export interface AccessorySpecs extends SpecProvenance {
  kind: 'accessory';
  keySpecs: { label: string; value: string }[];
  compatibility: string | null;
  weight: string | null;
  dimensions: string | null;
}

/**
 * Headphones — over-ear, in-ear and the INZONE gaming line in one shape.
 *
 * One kind rather than three, because the FY26 comparison sheets put all of
 * them in the same table with the same rows; the three gaming-only rows
 * (`spatialSound`, `gameModes`, `includedAccessories`) are `null` on a
 * consumer model and land in `specsMissing` like any other unstated field.
 *
 * There is no `dimensions` row on purpose. The source publishes a case-and-buds
 * figure for in-ears and nothing at all for over-ears, so a shared row would be
 * empty for most of the catalogue and would not mean the same thing twice.
 */
export interface HeadphoneSpecs extends SpecProvenance {
  kind: 'headphone';
  /** Wearing style as the sheet states it, e.g. "Tai nghe nhét tai dạng kín". */
  designType: string | null;
  /** Physical build notes: folding, detachable earpads, carry case. */
  design: string | null;
  /**
   * The ANC / ambient row.
   *
   * A tick in the source becomes "Chống ồn | Xuyên âm"; a dash becomes `null`,
   * not "Không có". The sheet's dash means the row was not claimed, and on
   * WF-C510 the same row carries the words "Xuyên âm" alone — transparency
   * without cancellation. Flattening those three states to a boolean would
   * invent a claim for one of them.
   */
  noiseCancelling: string | null;
  driver: string | null;
  frequencyResponse: string | null;
  /** Codec and processing badges: LDAC, Hi-Res, DSEE, 360 Reality Audio. */
  audioTech: string | null;
  processor: string | null;
  microphones: string | null;
  connectivity: string | null;
  /** Buds plus case where the source gives both, e.g. "8 giờ + 16 giờ". */
  battery: string | null;
  fastCharge: string | null;
  smartFeatures: string | null;
  spatialSound: string | null;
  gameModes: string | null;
  includedAccessories: string | null;
  weight: string | null;
}

/** Portable and karaoke speakers. The karaoke rows are `null` on a portable. */
export interface SpeakerSpecs extends SpecProvenance {
  kind: 'speaker';
  /** The ULT / MEGA BASS row, e.g. "TẮT ULT | BẬT ULT 1 | ULT 2". */
  bassBoost: string | null;
  /** Output with the room size the sheet pairs it with, e.g. "180W | 25m² - 45m²". */
  power: string | null;
  drivers: string | null;
  battery: string | null;
  fastCharge: string | null;
  connectivity: string | null;
  waterResistance: string | null;
  utilities: string | null;
  /** Bundled microphone, where one ships. */
  includedMic: string | null;
  /** Microphone and guitar inputs, e.g. "2 cổng Micro | 1 cổng Guitar". */
  micPorts: string | null;
  dimensions: string | null;
  weight: string | null;
}

export type ProductSpecs = CameraSpecs | LensSpecs | AccessorySpecs | HeadphoneSpecs | SpeakerSpecs;

/**
 * Row order for the spec tables, per category.
 *
 * It lives beside the types because it is the schema's reading order, and
 * because two surfaces render it — the catalogue modal and the dedicated
 * product route. They had drifted into separate hardcoded lists, so the route
 * silently dropped every field the modal had and labelled the rest with
 * Vietnamese strings inlined in JSX, outside `messages/*.json`. One list, one
 * set of translated labels.
 *
 * Each entry is a key of the matching specs object and a key under
 * `cameras.specs.*` in the message catalogues.
 */
export const SPEC_ROWS: Record<ProductSpecs['kind'], readonly string[]> = {
  camera: [
    'sensor', 'effectivePixels', 'isoRange', 'autofocus', 'video',
    'stabilization', 'viewfinder', 'lcd', 'mediaSlots', 'battery', 'weight', 'dimensions',
  ],
  lens: [
    'format', 'focalLength', 'maxAperture', 'minAperture', 'construction',
    'angleOfView', 'minFocusDistance', 'maxMagnification', 'filterDiameter',
    'apertureBlades', 'stabilization', 'weight', 'dimensions',
  ],
  accessory: ['compatibility', 'weight', 'dimensions'],
  headphone: [
    'designType', 'design', 'noiseCancelling', 'driver', 'frequencyResponse',
    'audioTech', 'processor', 'microphones', 'connectivity', 'battery',
    'fastCharge', 'smartFeatures', 'spatialSound', 'gameModes',
    'includedAccessories', 'weight',
  ],
  speaker: [
    'bassBoost', 'power', 'drivers', 'battery', 'fastCharge', 'connectivity',
    'waterResistance', 'utilities', 'includedMic', 'micPorts', 'dimensions', 'weight',
  ],
} as const;

/** Orderings the wiki catalogue offers. */
export type WikiSort = 'price-asc' | 'price-desc' | 'name' | 'sku';

/**
 * The ordering used when the URL does not name one.
 *
 * Read by both surfaces that touch it — `camera-wiki-view.tsx`, which applies
 * the sort, and `site-header.tsx`, which draws the control — and by three
 * separate decisions in them: what to sort by, whether `?sort=` is worth
 * putting in the URL at all, and whether the filter bar counts as "active".
 *
 * It is a constant because those five places were five copies of the same
 * string literal, and they only work while all five agree. Change one and the
 * default is omitted from the URL under one name while being read back under
 * another, so picking the *other* ordering produces a URL with no `sort` param
 * and silently snaps back. Pinned by `wiki-sort.test.ts`.
 */
export const DEFAULT_WIKI_SORT: WikiSort = 'price-asc';

/**
 * Ordering for the catalogue, shared by the server list and the client grid.
 *
 * One comparator because there were two identical `switch` statements — in
 * `data.ts` and `camera-wiki-view.tsx` — and the grid re-sorts whatever the
 * server sent, so any disagreement between them shows up as the list quietly
 * reordering itself after hydration.
 *
 * **A product with no price sorts last in either direction.** Two lenses in the
 * catalogue publish no figure and render as "Liên hệ"; they carry `priceVnd: 0`,
 * which is not a price of zero but the absence of one. Cheapest-first is the
 * default ordering now, and treating those as the two cheapest items put a
 * cinema lens at the head of the catalogue reading as if it were the bargain of
 * the range. That is the same mistake `specsMissing` exists to prevent
 * everywhere else here: a gap in the source is never quietly given a plausible
 * value.
 */
export function compareCameras<T extends { priceVnd: number; name: string; sku: string }>(
  sortBy: WikiSort,
): (a: T, b: T) => number {
  const priced = (c: T) => c.priceVnd > 0;
  return (a, b) => {
    switch (sortBy) {
      case 'price-asc':
      case 'price-desc': {
        // Unpriced rows go to the bottom before direction is considered.
        if (priced(a) !== priced(b)) return priced(a) ? -1 : 1;
        return sortBy === 'price-asc' ? a.priceVnd - b.priceVnd : b.priceVnd - a.priceVnd;
      }
      case 'name':
        return a.name.localeCompare(b.name);
      case 'sku':
        return a.sku.localeCompare(b.sku);
    }
  };
}

/**
 * What a catalogue *listing* needs — every field except the heavy ones.
 *
 * The grid renders a name, a photo, a price and a badge, and filters on the
 * feature bullets. It never opens a spec table; a product opens its own route
 * for that. But `/cameras` is a Server Component handing the whole catalogue to
 * a Client Component, so every field of all 94 products was serialised into the
 * RSC payload and the HTML both — and `specs` alone is 45KB of that, about a
 * third, for thirteen strings per product that nothing on the page reads.
 *
 * Expressed as a type rather than a comment so the boundary is enforced: a
 * component handed `CameraCard[]` cannot reach for `.specs` and quietly put it
 * back on the wire.
 */
export type CameraCard = Omit<SonyCamera, 'specs' | 'galleryUrls'>;

/** Drops the fields a listing does not render. */
export function toCameraCard(c: SonyCamera): CameraCard {
  const { specs: _specs, galleryUrls: _galleryUrls, ...card } = c;
  return card;
}

export interface SonyCamera {
  id: string;
  sku: string;
  name: string;
  fullName: string;
  category: 'camera' | 'lens' | 'accessory' | 'audio';
  subCategory1: string;
  subCategory2: string;
  priceVnd: number;
  priceFormatted: string;
  /**
   * Official product page and photography.
   *
   * `''` is the absence of one, and both surfaces test truthiness before
   * rendering. The audio catalogue is extracted from Sony Vietnam's FY26
   * comparison sheets, which are print artwork: they publish a price and a
   * spec table but no URL, no SKU and no image asset. Those three are `''`
   * there and named in `specsMissing`, for the same reason a spec the source
   * does not state is `null` — a plausible-looking B&H URL assembled from a
   * guessed SKU renders a broken image and reads as sourced.
   */
  url: string;
  imageUrl: string;
  /** Additional product photography, where the catalogue carries more than one shot. */
  galleryUrls?: string[];
  /**
   * Marketing bullets. A flat array is English (the seed's shape); the admin UI
   * writes `{ en, vi }`. Always read through `featureList()` — indexing this
   * directly is what silently renders an object as `[object Object]`.
   */
  features: LocalizedFeatures;
  /** Absent until the product has been extracted from its official page. */
  specs?: ProductSpecs;
}
