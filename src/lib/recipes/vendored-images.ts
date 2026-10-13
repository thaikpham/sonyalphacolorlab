import 'server-only';
import imagesSeed from '../../../data/images.seed.json';

/**
 * The photographs the last deploy serves out of `public/recipes`.
 *
 * `data/images.seed.json` is rewritten by `vendor:images` / `vendor:uploads`
 * and committed with the files it names, so it IS the deployed origin. Three
 * readers ask it the same question — the reader's gallery, the admin's "is
 * this live" badge, and the upload's slot allocation — and they read it here
 * so they cannot disagree about the answer.
 */

export type VendoredImage = { recipeId: string; storagePath: string; sort: number };

export const VENDORED_IMAGES: readonly VendoredImage[] = imagesSeed as VendoredImage[];

const VENDORED_PATHS = new Set(VENDORED_IMAGES.map((i) => i.storagePath));

export function isVendored(storagePath: string): boolean {
  return VENDORED_PATHS.has(storagePath);
}
