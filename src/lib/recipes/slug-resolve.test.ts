import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPermanentMove } from './slug-aliases';
import { SLUG_MOVES, recipeIdOfSlug } from './slug-moves';

/**
 * The recipe route's lookup, in every state of the content plane.
 *
 * Each content migration that renames slugs is applied by hand, before or
 * after this code deploys. Today the catalogue holds the 2026-10-24 slug
 * (`pp-001-vivid-nostalgia-film`) and a card or `?id=` link may already say
 * `pp-001`; after 20261028000000 it holds `pp-001` and old links say either
 * earlier spelling. Every spelling finds the recipe, and the route is told
 * which slug to send the reader to — permanently only forwards.
 */

const catalogue = { slugs: new Set<string>(), asked: [] as string[] };

vi.mock('./source', () => ({
  getRecipe: vi.fn(async (slug: string) => {
    catalogue.asked.push(slug);
    return catalogue.slugs.has(slug) ? { id: recipeIdOfSlug(slug) ?? 'PP-001', slug } : null;
  }),
}));

const { resolveRecipeSlug } = await import('./slug-resolve');

const CODE = 'pp-001';
const NEW = 'pp-001-vivid-nostalgia-film';
const OLD = 'mojave-sun';
const [OCT24, OCT28] = SLUG_MOVES;

beforeEach(() => {
  catalogue.asked = [];
});

describe('resolveRecipeSlug', () => {
  it('finds a recipe the catalogue holds at its code, by any spelling', async () => {
    catalogue.slugs = new Set([CODE]);
    expect((await resolveRecipeSlug(CODE, 'en'))?.slug).toBe(CODE);
    expect(catalogue.asked).toEqual([CODE]);
    expect((await resolveRecipeSlug(NEW, 'vi'))?.slug).toBe(CODE);
    expect((await resolveRecipeSlug(OLD, 'vi'))?.slug).toBe(CODE);
  });

  it('finds a recipe the catalogue holds at its 2026-10-24 slug, by any spelling', async () => {
    catalogue.slugs = new Set([NEW]);
    expect((await resolveRecipeSlug(NEW, 'en'))?.slug).toBe(NEW);
    expect((await resolveRecipeSlug(CODE, 'en'))?.slug).toBe(NEW);
    expect((await resolveRecipeSlug(OLD, 'en'))?.slug).toBe(NEW);
  });

  it('finds a recipe the catalogue still holds at its first slug, by any spelling', async () => {
    catalogue.slugs = new Set([OLD]);
    for (const asked of [OLD, NEW, CODE]) expect((await resolveRecipeSlug(asked, 'en'))?.slug, asked).toBe(OLD);
  });

  it('asks for the slug as requested first, so a held slug costs one read', async () => {
    catalogue.slugs = new Set([OLD, NEW, CODE]);
    expect((await resolveRecipeSlug(OLD, 'en'))?.slug).toBe(OLD);
    expect(catalogue.asked).toEqual([OLD]);
  });

  it('tries the newest spelling next', async () => {
    catalogue.slugs = new Set();
    await resolveRecipeSlug(OLD, 'en');
    expect(catalogue.asked).toEqual([OLD, CODE, NEW]);
  });

  it('is null for a slug no spelling of which is published', async () => {
    catalogue.slugs = new Set([NEW]);
    expect(await resolveRecipeSlug('never-existed', 'en')).toBeNull();
    expect(catalogue.asked).toEqual(['never-existed']);
  });

  /* Every 2026-10-24 former and current slug, against the catalogue in both
     states it can be in from here: today's (the 2026-10-24 slugs) and after
     20261028000000 (the codes). The route redirects to the held slug when it
     differs, 308 only from older to newer. */
  it.each([
    ['today, at the 2026-10-24 slugs', 'middle'],
    ['after 20261028000000, at the codes', 'code'],
  ] as const)('resolves every earlier spelling and redirects it the right way: %s', async (_label, held) => {
    const recipes = Object.entries(OCT24.moves).map(([first, middle]) => ({ first, middle, code: OCT28.moves[middle] }));
    expect(recipes).toHaveLength(90);
    catalogue.slugs = new Set(recipes.map((r) => r[held]));
    for (const r of recipes) {
      const order = [r.first, r.middle, r.code];
      const stored = r[held];
      for (const asked of order) {
        const resolved = await resolveRecipeSlug(asked, 'en');
        expect(resolved?.slug, `${asked} with ${stored} held`).toBe(stored);
        expect(resolved?.recipe.id, asked).toBe(recipeIdOfSlug(r.code));
        const redirect = resolved!.slug === asked ? 'none' : isPermanentMove(asked, resolved!.slug) ? 308 : 307;
        const expected = asked === stored ? 'none' : order.indexOf(asked) < order.indexOf(stored) ? 308 : 307;
        expect(redirect, `${asked} -> ${stored}`).toBe(expected);
      }
    }
  });
});

describe('the recipe route', () => {
  const page = readFileSync('src/app/[locale]/recipe/[slug]/page.tsx', 'utf8');
  const og = readFileSync('src/app/[locale]/recipe/[slug]/opengraph-image.tsx', 'utf8');

  it('looks the slug up through the resolver, page and share card alike', () => {
    for (const src of [page, og]) {
      expect(src).toContain('resolveRecipeSlug(');
      expect(src).not.toMatch(/\bgetRecipe\(/);
    }
  });

  it('redirects to the held slug, permanently only from an older spelling, keeping the locale', () => {
    expect(page).toMatch(
      /if \(slug !== requested\) \{\s*const to = \{ href: `\/recipe\/\$\{slug\}`, locale \};\s*if \(isPermanentMove\(requested, slug\)\) permanentRedirect\(to\);\s*redirect\(to\);\s*\}/,
    );
    expect(page).toContain("import { Link, permanentRedirect, redirect } from '@/i18n/navigation';");
  });

  it('leaves slug redirects out of next.config.ts, where they would run before the migration', () => {
    /* A static rule would send every card link to a slug the database may
       not hold yet. Only the `?id=` map lives there. */
    const config = readFileSync('next.config.ts', 'utf8');
    expect(config).not.toContain('former-slugs');
    expect(config).not.toMatch(/source:\s*['"`]\/recipe\//);
  });
});
