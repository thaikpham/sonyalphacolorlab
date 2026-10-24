import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import recipesSeed from '../../../data/recipes.seed.json';
import type { RecipeRecord } from './admin-types';

/**
 * The file-backed recipe store a laptop with no Supabase runs on.
 *
 * The file is hand-editable scratch, so it can be broken by hand. A read of a
 * broken file used to come back empty and the next save wrote that empty list
 * plus one row over it — every other local recipe gone, with no error.
 *
 * The store resolves its file from `process.cwd()` at import, so the suite
 * points that at a scratch directory before importing anything.
 */

const root = mkdtempSync(join(tmpdir(), 'colorlab-dev-store-'));
mkdirSync(join(root, 'data'));
const RECIPES = join(root, 'data', 'recipes.dev.json');

vi.spyOn(process, 'cwd').mockReturnValue(root);
vi.stubEnv('NODE_ENV', 'development');
vi.mock('@/lib/supabase/server', () => ({
  hasContentConfig: () => false,
  hasControlConfig: () => false,
  contentRead: () => {
    throw new Error('offline');
  },
  contentAdmin: () => {
    throw new Error('offline');
  },
}));

const devStore = await import('./dev-store');

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

const firstRecipe = (): RecipeRecord => {
  const r = (recipesSeed as unknown as RecipeRecord['recipe'][])[0];
  return { recipe: r, legacyId: null, updatedAt: '2026-10-08T00:00:00.000Z' };
};

describe('the recipe dev store', () => {
  it('refuses to save over a file it could not parse', () => {
    writeFileSync(RECIPES, '{bad json', 'utf8');

    expect(devStore.devListRecipes()).toEqual([]);
    expect(() => devStore.devUpsertRecipe(firstRecipe())).toThrow(/recipes\.dev\.json/);
    expect(readFileSync(RECIPES, 'utf8')).toBe('{bad json');
  });

  it('refuses a root that is not a list, too', () => {
    writeFileSync(RECIPES, '{"recipes": []}', 'utf8');

    expect(() => devStore.devUpsertRecipe(firstRecipe())).toThrow();
    expect(readFileSync(RECIPES, 'utf8')).toBe('{"recipes": []}');
  });

  it('gives an unsaved seed row the same version on every read', () => {
    /* The version is what a save names as `expectedUpdatedAt`. Stamped with
       the time of each read, a row nobody had saved yet was stale to every
       save, so the offline editor could not save at all until something else
       had written the file. */
    rmSync(RECIPES, { force: true });
    const id = firstRecipe().recipe.id;
    const first = devStore.devGetRecipe(id)?.updatedAt;
    const again = devStore.devGetRecipe(id)?.updatedAt;
    expect(first).toBeTruthy();
    expect(again).toBe(first);
  });

  it('still seeds and saves when there is no file yet', () => {
    rmSync(RECIPES, { force: true });

    devStore.devUpsertRecipe(firstRecipe());
    const saved = JSON.parse(readFileSync(RECIPES, 'utf8')) as unknown[];
    expect(saved.length).toBe((recipesSeed as unknown[]).length);
  });

  it('refuses to create over an id or a slug it already holds', () => {
    /* Create went through the upsert, so a second create handed the same id
       replaced the first recipe instead of losing the race. */
    rmSync(RECIPES, { force: true });
    const taken = firstRecipe();
    const count = (recipesSeed as unknown[]).length;

    expect(devStore.devInsertRecipe({ ...taken, recipe: { ...taken.recipe, name: 'Other' } })).toBe(false);
    const sameSlug = { ...taken.recipe, id: 'SCL-PP-998' } as RecipeRecord['recipe'];
    expect(devStore.devInsertRecipe({ ...taken, recipe: sameSlug })).toBe(false);
    expect(devStore.devGetRecipe(taken.recipe.id)?.recipe.name).toBe(taken.recipe.name);

    const fresh = { ...taken.recipe, id: 'SCL-PP-998', slug: 'brand-new' } as RecipeRecord['recipe'];
    expect(devStore.devInsertRecipe({ ...taken, recipe: fresh })).toBe(true);
    expect(devStore.devListRecipes()).toHaveLength(count + 1);
  });
});
