/**
 * Display labels for catalogue values that are stored as data.
 *
 * `subCategory1`, `subCategory2` and `category` are the catalogue's own values,
 * and they stay the filter keys: a URL, a tally or a Supabase row keeps using
 * the stored string. Only what the reader sees is mapped. The seed mixes the
 * two languages — `Tai nghe` and `Máy ảnh Alpha` next to `Adapter` and
 * `Grip / Tripod` — so rendering the raw value put Vietnamese chips on `/en`
 * and English ones on `/vi`.
 *
 * The translated labels live in `messages/*.json` under `cameras.sub.*`
 * (Rule 3). Technical names — GM, G, SEL, DSC, Cinema Line, Vlog, Gaming,
 * Karaoke, APS-C — are never translated and are not listed: an unknown value
 * renders as stored. The two that are listed in `SUB_CATEGORY_SPELLING` are
 * technical too, and only have their spelling normalised.
 */

/** Stored value → key under `cameras.sub`. */
const SUB_CATEGORY_LABEL_KEY: Record<string, string> = {
  'Tai nghe': 'headphones',
  Loa: 'speakers',
  'Choàng đầu': 'overEar',
  'Nhét tai': 'inEar',
  'Di động': 'portable',
  'Máy ảnh Alpha': 'alphaCameras',
  Adapter: 'adapters',
  Audio: 'audio',
  Microphone: 'microphones',
  Power: 'power',
  Battery: 'batteries',
  'Grip / Tripod': 'gripsTripods',
  'Vlog Accessory': 'vlogAccessories',
  'Lens Mount': 'mountAdapters',
};

/** Technical names, the same in both locales, with their spelling fixed. */
const SUB_CATEGORY_SPELLING: Record<string, string> = {
  'Full Frame': 'Full-Frame',
  '1-Inch': '1-inch',
};

/** Singular product kind, for a badge on one product → key under `cameras`. */
export const PRODUCT_KIND_LABEL_KEY: Record<string, string> = {
  camera: 'kindCamera',
  lens: 'kindLens',
  accessory: 'kindAccessory',
  audio: 'catAudio',
};

/** A translator scoped to the `cameras` namespace. */
type CamerasT = (key: string) => string;

/** The reader-facing label for a stored sub-category value. */
export function subCategoryLabel(value: string, t: CamerasT): string {
  if (!value) return value;
  const key = SUB_CATEGORY_LABEL_KEY[value];
  if (key) return t(`sub.${key}`);
  return SUB_CATEGORY_SPELLING[value] ?? value;
}

/**
 * The price as the reader sees it.
 *
 * `priceFormatted` is stored text, and the two products the catalogue lists
 * without a figure carry `priceVnd: 0` with the Vietnamese "Liên hệ" — which
 * rendered as the price on `/en`. A zero price is a message, not data.
 */
export function priceLabel(
  product: { priceVnd: number; priceFormatted: string },
  t: CamerasT,
): string {
  return product.priceVnd > 0 ? product.priceFormatted : t('priceOnRequest');
}

/**
 * A product's official page, or `null` when the stored `url` is not one.
 *
 * Six camera rows hold a newline-joined list of image assets in `url` — a
 * scrape that kept the gallery where the link belonged — and the product page
 * drew it as "View on Sony Vietnam", which opened a PNG with the rest of the
 * list glued on. The row is the owner's to correct; the page only links what
 * is one http(s) URL, with no whitespace, that is not itself an image.
 */
export function officialUrl(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value || !/^https?:\/\/\S+$/.test(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  /* `/image/` is Sony's asset path on both hosts (`sony.com.vn/image/…`,
     `scene7.com/is/image/…`); an image extension is anybody's. */
  if (/\/image\//.test(parsed.pathname) || /\.(png|jpe?g|webp|gif)$/i.test(parsed.pathname)) return null;
  return value;
}

/**
 * The route that renders a product. Audio lives under `/audio`, and
 * `/cameras/<audio-id>` is a 404: the camera reader excludes the category.
 */
export function productPath(product: { id: string; category: string }): string {
  return product.category === 'audio' ? `/audio/${product.id}` : `/cameras/${product.id}`;
}

/**
 * Where leaving the compare page goes. One compare surface serves both
 * catalogues, so a reader who compared only headphones goes back to `/audio`
 * rather than being put in the camera catalogue.
 */
export function compareExitPath(products: readonly { category: string }[]): string {
  return products.length > 0 && products.every((p) => p.category === 'audio') ? '/audio' : '/cameras';
}
