import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import seed from '../../data/recipes.seed.json';
import viMessages from '../../messages/vi.json';
import type { RecipeView } from '@/lib/recipes/source';

/**
 * The JSON-LD blocks, rendered. Plain `.ts` with `createElement`, because the
 * vitest include pattern is `src/**\/*.test.ts`.
 */

vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));

const { RecipeStructuredData, SiteStructuredData } = await import('./structured-data');

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const recipe = (seed as unknown as RecipeView[]).find((r) => r.slug === 'pp-001')!;

/** Every `<script type="application/ld+json">` body, parsed. */
const blocks = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1]) as Record<string, unknown>,
  );

describe('serialise', () => {
  /* The only thing between admin-editable strings — recipe names and
     descriptions, article and source titles — and a raw script body. A bare
     JSON.stringify in its place would have left every other test green. */
  it('keeps a name containing </script> inside the block, and intact', () => {
    const name = '</script><script>alert(1)</script>';
    const html = renderToStaticMarkup(
      createElement(RecipeStructuredData, { recipe: { ...recipe, name }, locale: 'en', url: 'x' }),
    );
    /* Two blocks — the work and its breadcrumb — and nothing the name opened. */
    expect(html.match(/<script\b/g)).toHaveLength(2);
    expect(html).not.toContain('<script>alert');
    expect(blocks(html)[0].name).toBe(name);
  });
});

describe('SiteStructuredData', () => {
  /* The description was an English literal declared `inLanguage: vi`. */
  it('describes the site in the page language', () => {
    const description = viMessages.home.metaDescription;
    const [site] = blocks(renderToStaticMarkup(createElement(SiteStructuredData, { locale: 'vi', description })));
    expect(site).toMatchObject({ inLanguage: 'vi', description });
  });
});

describe('RecipeStructuredData', () => {
  const html = renderToStaticMarkup(
    createElement(RecipeStructuredData, { recipe, locale: 'vi', url: `${SITE}/vi/recipe/${recipe.slug}` }),
  );
  const [work, crumbs] = blocks(html);

  /* The root is the four-app launcher now; the parent the page's own back link
     returns to is the catalogue. */
  it('roots the breadcrumb at the catalogue, not the launcher', () => {
    const items = crumbs.itemListElement as { item: string }[];
    expect(items[0].item).toBe(`${SITE}/vi/colorlab`);
  });

  it('declares no English literal as the page language', () => {
    expect(work).not.toHaveProperty('about');
  });
});
