import { describe, expect, it } from 'vitest';
import { normaliseRecipe, slugifyRecipe } from './admin-store';
import recipesSeed from '../../../data/recipes.seed.json';
import { recipeSchema } from '../camera/schema';

/**
 * The pure halves of the recipe admin store.
 *
 * `nextRecipeId`, `uniqueRecipeSlug` and the three writes all reach a backend,
 * so they are covered by the route tests and by the boundary tests that assert
 * where they may be called from. What is tested here is what has no backend:
 * the slug rule and the validation seam, both of which decide what a URL and a
 * column will contain and neither of which the database can check.
 */

describe('slugifyRecipe', () => {
  it('folds Vietnamese diacritics rather than dropping the words', () => {
    /* A name is Vietnamese often enough that stripping non-ASCII would leave
       "công thức mùa hè" as "c-th-c-m-a-h" — a URL that says nothing. */
    expect(slugifyRecipe('Công Thức Mùa Hè')).toBe('cong-thuc-mua-he');
    expect(slugifyRecipe('Đường Phố Sài Gòn')).toBe('duong-pho-sai-gon');
  });

  it('produces the kebab-case the table and the schema both demand', () => {
    const re = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const name of ['Mojave Sun', '  Golden   Hour  ', 'FX3 — Night / Neon', '35mm f/1.4']) {
      const slug = slugifyRecipe(name);
      expect(slug, name).toMatch(re);
    }
  });

  it('never ends on a separator, even when truncation lands on one', () => {
    /* The 80-character cap can cut mid-word and leave a trailing hyphen, which
       the kebab-case CHECK constraint refuses. */
    const slug = slugifyRecipe(`${'a'.repeat(79)} bbbb`);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('returns empty for a name with nothing usable in it, so the caller falls back', () => {
    expect(slugifyRecipe('———')).toBe('');
    expect(slugifyRecipe('   ')).toBe('');
  });
});

describe('normaliseRecipe', () => {
  const seed = recipesSeed as unknown as Record<string, unknown>[];
  const pp = seed.find((r) => r.format === 'pp')!;
  const cl = seed.find((r) => r.format === 'cl')!;

  it('accepts a body that is already a valid recipe', () => {
    const out = normaliseRecipe(pp.id as string, pp);
    expect(out.ok).toBe(true);
  });

  it('takes the id from the caller, never from the body', () => {
    /* The route derives the id — from `nextRecipeId` on create, from the URL
       on update. A body that names a different one must not win, or an editor
       could overwrite any recipe by editing a field in their own browser. */
    const out = normaliseRecipe('SCL-PP-777', { ...pp, id: 'SCL-PP-001' });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.recipe.id).toBe('SCL-PP-777');
  });

  it('refuses an id whose segment disagrees with the format', () => {
    const out = normaliseRecipe('SCL-CL-001', pp);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.join(' ')).toMatch(/id/);
  });

  it('refuses a value outside the camera range and says which field', () => {
    const body = { ...pp, settings: { ...(pp.settings as object), blackLevel: 999 } };
    const out = normaliseRecipe(pp.id as string, body);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.join(' ')).toMatch(/blackLevel/);
  });

  it('refuses a white-balance shift off the 0.25 grid', () => {
    const body = {
      ...pp,
      whiteBalance: { mode: 'kelvin', kelvin: 7000, shift: { ab: { axis: 'B', amount: 3.1 } } },
    };
    const out = normaliseRecipe(pp.id as string, body);
    expect(out.ok).toBe(false);
  });

  it('refuses saturation on a monochrome Creative Look', () => {
    /* The camera greys the control out for BW/SE, so a recipe carrying a value
       there describes a setting the reader cannot reproduce. */
    const body = { ...cl, settings: { ...(cl.settings as object), look: 'BW', saturation: 3 } };
    const out = normaliseRecipe(cl.id as string, body);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.join(' ')).toMatch(/saturation/i);
  });

  it('reports every issue at once rather than the first', () => {
    /* The editor points at fields with these; one-at-a-time would make fixing
       a form a series of round trips. */
    const body = {
      ...pp,
      name: '',
      settings: { ...(pp.settings as object), blackLevel: 999, colorPhase: 999 },
    };
    const out = normaliseRecipe(pp.id as string, body);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.length).toBeGreaterThan(1);
  });
});

describe('the shipped catalogue', () => {
  it('still validates, so the dev store can seed from it', () => {
    /* `dev-store.ts` calls `recipeSchema.parse` on every seed row the first
       time the editor opens. A seed row that stopped validating would make the
       offline editor throw on load rather than show a list. */
    const seed = recipesSeed as unknown as unknown[];
    expect(seed.length).toBeGreaterThan(0);
    for (const row of seed) {
      const parsed = recipeSchema.safeParse(row);
      expect(parsed.success, JSON.stringify((row as { id?: string }).id)).toBe(true);
    }
  });
});
