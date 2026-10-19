import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import imagesSeed from '../data/images.seed.json';
import { variantPaths } from './lib/recipe-image-manifest';

/**
 * The data scripts, pinned where they cannot be run: they download, or they
 * connect to a project. Each case is a failure that already shipped or nearly
 * did, and none of them errors anywhere when it happens.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('data/images.seed.json', () => {
  /* `migrate:images` rewrote the manifest with `<id>/NN.jpg` Storage paths,
     which `public/` does not serve: every recipe photograph broke at the next
     deploy, with the build green. */
  it.each(imagesSeed.map((e) => [e.storagePath]))('%s is a vendored path whose rungs exist', (path) => {
    expect(path).toMatch(/^[A-Z0-9-]+\/\d{2}-1024\.webp$/);
    for (const variant of variantPaths(path)) {
      expect(existsSync(join(process.cwd(), 'public', 'recipes', variant)), variant).toBe(true);
    }
  });
});

describe('vendor-recipe-images.ts', () => {
  const src = read('scripts/vendor-recipe-images.ts');

  /* It deleted public/recipes before downloading anything, then refused to
     write the seed and said the seed was unchanged — over a site whose files
     were already gone. */
  it('touches public/recipes only after the shrink guard', () => {
    const guard = src.indexOf('if (lost.length');
    expect(guard).toBeGreaterThan(-1);
    const touches = [...src.matchAll(/(rmSync|renameSync|writeFileSync)\(OUT_DIR/g)].map((m) => m.index);
    expect(touches.length).toBeGreaterThan(0);
    for (const at of touches) expect(at).toBeGreaterThan(guard);
    expect(src).not.toMatch(/join\(OUT_DIR, recipeImagePath/);
  });
});

describe('emit-seed.ts', () => {
  const src = read('scripts/emit-seed.ts');

  /* A throw between files left recipes.seed.json holding a recipe whose
     translation was never written. */
  it('writes every file after the last check', () => {
    const lastCheck = src.lastIndexOf('throw new Error');
    const writes = [...src.matchAll(/writeFileSync\(/g)].map((m) => m.index);
    expect(writes).toHaveLength(3);
    for (const at of writes) expect(at).toBeGreaterThan(lastCheck);
  });
});

describe('package.json', () => {
  /* JSON.parse keeps the last of two equal keys, so the first `//build`
     comment disappeared the moment any tool rewrote the file. */
  it('has no repeated key in scripts', () => {
    const body = read('package.json').match(/"scripts":\s*\{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
    const keys = [...body.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });
});
