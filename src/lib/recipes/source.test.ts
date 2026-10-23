import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import recipesSeed from '../../../data/recipes.seed.json';
import type { Recipe } from '../camera/schema';
import { RECIPE_COLUMNS, toRow, type RecipeRow } from './row';

/**
 * The reader's online path, against a recording fake of the anon client.
 *
 * What it pins is what reaches PostgREST: named columns, never `*` — a column
 * outside the anon grant turns `*` into "permission denied" for the whole
 * catalogue — and no filter value the database would answer with an error.
 * `?look=foo` on an enum column is 22P02, which the reader reported as a
 * content outage and rendered as the error page.
 */

const ONLINE = {
  NEXT_PUBLIC_AUTH_SUPABASE_URL: 'https://control.supabase.co',
  NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY: 'control-anon',
  AUTH_SUPABASE_SECRET_KEY: 'control-secret',
  NEXT_PUBLIC_CONTENT_SUPABASE_URL: 'https://content.supabase.co',
  CONTENT_SUPABASE_ANON_KEY: 'content-anon',
  CONTENT_SUPABASE_SECRET_KEY: 'content-secret',
};
for (const [k, v] of Object.entries(ONLINE)) vi.stubEnv(k, v);
afterAll(() => vi.unstubAllEnvs());

const seed = recipesSeed as unknown as (Recipe & { legacyId: string | null })[];
const db = {
  rows: [] as RecipeRow[],
  selects: [] as { table: string; columns: string }[],
};

vi.mock('@/lib/supabase/server', () => ({
  contentRead: () => ({
    from: (table: string) => {
      let filtered = table === 'recipes' ? db.rows.slice() : [];
      const builder = {
        select(columns: string) {
          db.selects.push({ table, columns });
          return builder;
        },
        eq(column: string, value: unknown) {
          filtered = filtered.filter((r) => (r as Record<string, unknown>)[column] === value);
          return builder;
        },
        contains: () => builder,
        in: () => builder,
        order: () => builder,
        maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
        then<T>(resolve: (r: { data: unknown; error: null }) => T) {
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        },
      };
      return builder;
    },
  }),
  contentAdmin: () => {
    throw new Error('a reader never holds the secret key');
  },
  hasContentConfig: () => true,
  hasControlConfig: () => true,
}));

const { getRecipe, listRecipes, matchesQuery } = await import('./source');

beforeEach(() => {
  db.rows = seed.slice(0, 5).map((r) => toRow(r, r.legacyId));
  db.selects = [];
});

describe('what the reader asks PostgREST for', () => {
  it('names its columns', async () => {
    await listRecipes('en', {});
    await getRecipe(seed[0].slug, 'en');
    const recipeSelects = db.selects.filter((s) => s.table === 'recipes');
    expect(recipeSelects.length).toBe(2);
    for (const s of recipeSelects) expect(s.columns).toBe(RECIPE_COLUMNS);
  });

  it('never writes select(*) on a public path', () => {
    const source = readFileSync('src/lib/recipes/source.ts', 'utf8');
    expect(source).not.toMatch(/\.select\(\s*['"`]\*/);
  });

  it('names every column the row mapping carries, and nothing else', () => {
    const keys = Object.keys(toRow(seed[0], null)).sort();
    expect(RECIPE_COLUMNS.split(',').map((c) => c.trim()).sort()).toEqual(keys);
  });
});

describe('filters from a query string', () => {
  it('answers an unknown look with nothing, without asking the database', async () => {
    await expect(listRecipes('en', { look: 'foo' })).resolves.toEqual([]);
    expect(db.selects).toEqual([]);
  });

  it('answers a malformed tag with nothing, without asking the database', async () => {
    await expect(listRecipes('en', { tag: '{' })).resolves.toEqual([]);
    expect(db.selects).toEqual([]);
  });

  it('takes the first of a repeated parameter rather than throwing', async () => {
    /* `?q=a&q=b` arrives as an array, and `q.trim` threw. */
    const out = await listRecipes('en', { q: [seed[0].name, 'zzz'] as never });
    expect(out.map((r) => r.id)).toContain(seed[0].id);
  });
});

describe('free-text search', () => {
  it('folds đ, which NFD leaves whole', () => {
    const r = { ...seed[0], name: 'Đà Lạt Mist', tags: [] };
    expect(matchesQuery(r, 'da lat')).toBe(true);
    expect(matchesQuery({ ...r, name: 'Phố đêm' }, 'pho dem')).toBe(true);
  });
});

describe('photographs', () => {
  /* The catalogue carries none: a recipe's pictures are readers'
     contributions, which the gallery fetches from the control plane itself. */
  it('are not part of a recipe view', async () => {
    const recipe = seed[0];
    db.rows = [toRow(recipe, recipe.legacyId)];

    const view = await getRecipe(recipe.slug, 'en');
    expect(view?.id).toBe(recipe.id);
    expect(view).not.toHaveProperty('images');
  });
});
