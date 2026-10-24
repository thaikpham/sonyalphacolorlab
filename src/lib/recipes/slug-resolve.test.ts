import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The recipe route's lookup, in both states of the content plane.
 *
 * The content migration that renames the slugs is applied by hand, before or
 * after this code deploys. Before it, the catalogue holds `mojave-sun` and a
 * card or `?id=` link may already say `pp-001-vivid-nostalgia-film`; after it,
 * the reverse. Either way the recipe answers, and the route is told which
 * slug to send the reader to.
 */

const catalogue = { slugs: new Set<string>(), asked: [] as string[] };

vi.mock('./source', () => ({
  getRecipe: vi.fn(async (slug: string) => {
    catalogue.asked.push(slug);
    return catalogue.slugs.has(slug) ? { id: 'PP-001', slug } : null;
  }),
}));

const { resolveRecipeSlug } = await import('./slug-resolve');

const NEW = 'pp-001-vivid-nostalgia-film';
const OLD = 'mojave-sun';

beforeEach(() => {
  catalogue.asked = [];
});

describe('resolveRecipeSlug', () => {
  it('finds a recipe the migrated catalogue holds, by either spelling', async () => {
    catalogue.slugs = new Set([NEW]);
    expect((await resolveRecipeSlug(NEW, 'en'))?.slug).toBe(NEW);
    expect(catalogue.asked).toEqual([NEW]);
    expect((await resolveRecipeSlug(OLD, 'vi'))?.slug).toBe(NEW);
  });

  it('finds a recipe the unmigrated catalogue holds, by either spelling', async () => {
    catalogue.slugs = new Set([OLD]);
    expect((await resolveRecipeSlug(OLD, 'en'))?.slug).toBe(OLD);
    expect((await resolveRecipeSlug(NEW, 'en'))?.slug).toBe(OLD);
  });

  it('asks for the slug as requested first, so a held slug costs one read', async () => {
    catalogue.slugs = new Set([OLD, NEW]);
    expect((await resolveRecipeSlug(OLD, 'en'))?.slug).toBe(OLD);
    expect(catalogue.asked).toEqual([OLD]);
  });

  it('is null for a slug no spelling of which is published', async () => {
    catalogue.slugs = new Set([NEW]);
    expect(await resolveRecipeSlug('never-existed', 'en')).toBeNull();
    expect(catalogue.asked).toEqual(['never-existed']);
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

  it('redirects to the held slug, permanently only from a former slug, keeping the locale', () => {
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
