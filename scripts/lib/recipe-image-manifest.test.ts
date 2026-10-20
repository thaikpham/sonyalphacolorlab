import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { RECIPE_IMAGE_WIDTHS } from '../../src/lib/recipes/images';
import { diffManifest, planVendoredSeed, removeVariants, variantPaths } from './recipe-image-manifest';

const entry = (recipeId: string, slot: number, alt?: string) => ({
  recipeId,
  storagePath: `${recipeId}/${String(slot).padStart(2, '0')}-1024.webp`,
  sort: slot,
  ...(alt ? { alt } : {}),
});

describe('variantPaths', () => {
  it('names one file per rung the loader asks for', () => {
    expect(variantPaths('SCL-CL-001/03-1024.webp')).toEqual(
      RECIPE_IMAGE_WIDTHS.map((w) => `SCL-CL-001/03-${w}.webp`),
    );
  });
});

describe('diffManifest', () => {
  it('splits the change into added and removed by path', () => {
    const { added, removed } = diffManifest([entry('R', 0), entry('R', 1)], [entry('R', 0), entry('R', 2)]);
    expect(added.map((e) => e.storagePath)).toEqual(['R/02-1024.webp']);
    expect(removed.map((e) => e.storagePath)).toEqual(['R/01-1024.webp']);
  });
});

describe('planVendoredSeed', () => {
  /* The guard is per photograph. Comparing recipe ids let a recipe that kept
     one legacy photograph lose the rest without a word. */
  it('counts a planned photograph that did not arrive as lost', () => {
    const previous = [entry('R', 0), entry('R', 1)];
    const planned = new Set(previous.map((e) => e.storagePath));
    const { lost } = planVendoredSeed(previous, planned, [entry('R', 0)]);
    expect(lost).toEqual(['R/01-1024.webp']);
  });

  /* An admin upload is in neither source library. Rebuilding from the sources
     alone deleted it and dropped it from the manifest. */
  it('keeps an entry neither source produces, alt and all', () => {
    const upload = entry('R', 3, 'A street');
    const previous = [entry('R', 0), upload];
    const { seed, kept, lost } = planVendoredSeed(previous, new Set(['R/00-1024.webp']), [entry('R', 0)]);
    expect(lost).toEqual([]);
    expect(kept).toEqual([upload]);
    expect(seed).toEqual([entry('R', 0), upload]);
  });

  it('orders the seed by recipe, then sort', () => {
    const { seed } = planVendoredSeed([], new Set(), [entry('S', 1), entry('R', 2), entry('S', 0)]);
    expect(seed.map((e) => e.storagePath)).toEqual(['R/02-1024.webp', 'S/00-1024.webp', 'S/01-1024.webp']);
  });
});

describe('removeVariants', () => {
  let root = '';
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  /* Leaving the manifest is not leaving the site: the files are committed and
     served from /recipes with a year-long immutable cache. */
  it('deletes every rung of a removed photograph and says which', () => {
    root = mkdtempSync(join(tmpdir(), 'recipe-images-'));
    mkdirSync(join(root, 'R'));
    for (const p of variantPaths('R/03-1024.webp')) writeFileSync(join(root, p), '');
    writeFileSync(join(root, 'R/00-1024.webp'), '');

    const deleted = removeVariants(root, [entry('R', 3)]);

    expect(deleted).toEqual(variantPaths('R/03-1024.webp'));
    for (const p of deleted) expect(existsSync(join(root, p))).toBe(false);
    expect(existsSync(join(root, 'R/00-1024.webp'))).toBe(true);
  });
});
