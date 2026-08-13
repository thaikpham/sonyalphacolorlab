import type { LocalizedFeatures } from './features';
export type ProductCategory = 'all' | 'camera' | 'lens' | 'accessory';

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

export type ProductSpecs = CameraSpecs | LensSpecs | AccessorySpecs;

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
} as const;

export interface SonyCamera {
  id: string;
  sku: string;
  name: string;
  fullName: string;
  category: 'camera' | 'lens' | 'accessory';
  subCategory1: string;
  subCategory2: string;
  priceVnd: number;
  priceFormatted: string;
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
