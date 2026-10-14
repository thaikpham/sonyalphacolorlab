import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The catalogue page and its loading skeleton — source assertions, as the
 * neighbouring route tests do.
 */

const page = readFileSync('src/app/[locale]/colorlab/page.tsx', 'utf8');
const loading = readFileSync('src/app/[locale]/colorlab/loading.tsx', 'utf8');

const classOf = (source: string, tag: string) =>
  source.match(new RegExp(`<${tag}\\b[^>]*className="([^"]+)"`))?.[1].split(/\s+/) ?? [];

describe('/colorlab', () => {
  /* `listRecipes` is `unstable_cache` keyed by its arguments, and the header
     pushes `?q=` after every typing pause — so "mojave" was up to six cache
     misses, each a recipes select plus a translations read, and any random
     `?q=` from anyone added an entry. The text match was already done in JS. */
  it('reads the catalogue without the query in the cache key and filters in the page', () => {
    const call = page.match(/listRecipes\(locale, \{[^}]*\}\)/)?.[0];
    expect(call).toBe('listRecipes(locale, { format, look: sp.look, tag: sp.tag })');
    expect(page).not.toMatch(/q: sp\.q/);
    expect(page).toMatch(/\.filter\(\(r\) => matchesQuery\(r, q\)\)/);
  });

  /* An eyebrow over the h1, and uppercase over four words. */
  it('has nothing over its h1', () => {
    const hero = page.slice(page.indexOf('<div className="hero-block'), page.indexOf('</div>', page.indexOf('<div className="hero-block')));
    expect(hero).not.toMatch(/<p\b/);
    expect(hero).not.toContain('Picture Profile &amp; Creative Look');
    expect(hero).toContain('<h1');
  });

  /* The empty state echoes the query. A pasted URL is one unbreakable token,
     and at 375px it pushed the page sideways. */
  it('wraps an echoed query instead of widening the page', () => {
    expect(page).toMatch(/<p className="[^"]*\bbreak-words\b[^"]*">\s*\{t\('emptyTitle'\)\}/);
  });
});

describe('/colorlab loading skeleton', () => {
  /* It was a centred 86rem three-column block with 4/5 tiles, standing in for
     a full-bleed one-to-six-column grid — the jump it exists to prevent. */
  it('has the page grid’s container and columns', () => {
    const pageMain = classOf(page, 'main');
    const skeletonMain = classOf(loading, 'main');
    for (const c of ['max-w-[160rem]', 'pt-8', 'inset-safe']) {
      expect(pageMain, c).toContain(c);
      expect(skeletonMain, c).toContain(c);
    }
    const grid = (s: string) => classOf(s, 'ul').filter((c) => /grid-cols|^gap-/.test(c));
    expect(grid(loading)).toEqual(grid(page));
  });

  it('sizes the tiles like a recipe card', () => {
    expect(loading).toContain('h-[210px]');
    expect(loading).not.toContain('aspect-[4/5]');
  });
});
