/**
 * `data/images.seed.json` and the files under `public/recipes` it names, as the
 * two vendor scripts change them.
 *
 * `vendor:images` rebuilds the photographs from the two source libraries;
 * `vendor:uploads` adds the ones editors upload in `/admin/colorlab`. Both
 * write the same manifest, so both read the rungs and the path shape from
 * `src/lib/recipes/images.ts` — the module the admin and the loader read — and
 * neither keeps a copy that could drift from them.
 *
 * Out of the scripts so it can be tested: one downloads from the network and
 * the other connects to a project the moment it is imported.
 */

import { unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { RECIPE_IMAGE_WIDTHS, recipeImageStem } from '../../src/lib/recipes/images';

export type ManifestEntry = { recipeId: string; storagePath: string; sort: number; alt?: string };

/** Every file one manifest entry stands for, relative to `public/recipes`. */
export function variantPaths(storagePath: string): string[] {
  const stem = recipeImageStem(storagePath);
  return RECIPE_IMAGE_WIDTHS.map((width) => `${stem}-${width}.webp`);
}

export function diffManifest(
  current: readonly ManifestEntry[],
  next: readonly ManifestEntry[],
): { added: ManifestEntry[]; removed: ManifestEntry[] } {
  const currentPaths = new Set(current.map((e) => e.storagePath));
  const nextPaths = new Set(next.map((e) => e.storagePath));
  return {
    added: next.filter((e) => !currentPaths.has(e.storagePath)),
    removed: current.filter((e) => !nextPaths.has(e.storagePath)),
  };
}

/**
 * What `vendor:images` may write, and what it would lose.
 *
 * `planned` is every path the source libraries were asked for. A previous
 * entry outside it came from somewhere else — `vendor:uploads` — and is kept
 * as it stands; the sources are Git-tracked files, so a photograph does not
 * leave them by accident. A previous entry inside it that did not arrive is
 * lost, and the caller refuses to write. The comparison is per photograph:
 * per recipe, a recipe that kept one photograph could lose the rest unseen.
 */
export function planVendoredSeed(
  previous: readonly ManifestEntry[],
  planned: ReadonlySet<string>,
  produced: readonly ManifestEntry[],
): { seed: ManifestEntry[]; kept: ManifestEntry[]; lost: string[] } {
  const producedPaths = new Set(produced.map((e) => e.storagePath));
  const kept = previous.filter((e) => !planned.has(e.storagePath));
  const lost = previous
    .filter((e) => planned.has(e.storagePath) && !producedPaths.has(e.storagePath))
    .map((e) => e.storagePath);
  const seed = [...produced, ...kept].sort(
    (a, b) => a.recipeId.localeCompare(b.recipeId) || a.sort - b.sort,
  );
  return { seed, kept, lost };
}

/**
 * Deletes the files of entries that left the manifest; returns what it deleted.
 *
 * Leaving the manifest is not leaving the site: the files are committed and
 * served by direct URL with a year-long immutable cache. A photograph taken
 * down for rights reasons has to stop existing, not just stop being linked.
 */
export function removeVariants(root: string, removed: readonly ManifestEntry[]): string[] {
  const deleted: string[] = [];
  for (const entry of removed) {
    for (const path of variantPaths(entry.storagePath)) {
      try {
        unlinkSync(join(root, path));
        deleted.push(path);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
    }
  }
  return deleted;
}
