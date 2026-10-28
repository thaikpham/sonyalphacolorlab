import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The article page's two layouts, as source assertions (no DOM here). Below
 * lg the outline used to sit ABOVE the h1 — the rail wrapped over the article
 * — so a phone reader met the table of contents before the title.
 */
const view = readFileSync('src/components/lab/article-view.tsx', 'utf8');

describe('the article layout', () => {
  it('is one column below lg and two from lg, switched at the breakpoint, not by wrapping', () => {
    expect(view).not.toContain('flex-wrap-reverse');
    expect(view).toMatch(/className="flex flex-col lg:flex-row lg:items-start/);
    /* flex-basis on the main axis: in a column it would be a 32.5rem HEIGHT. */
    expect(view).toContain('lg:flex-1 lg:basis-[32.5rem]');
    expect(view).not.toMatch(/(?<!lg:)basis-\[32\.5rem\]/);
  });

  it('hides the rail below lg and keeps it sticky from lg', () => {
    expect(view).toMatch(/aria-label=\{t\('railLabel'\)\}\s+className="hidden lg:flex[^"]*lg:sticky lg:top-6/);
  });

  it('folds the outline under the dek below lg, closed, behind a 44px summary', () => {
    const dek = view.indexOf('{article.dek}');
    const fold = view.indexOf('<details');
    const firstBlock = view.indexOf('article.blocks.map(');
    expect(fold).toBeGreaterThan(dek);
    expect(fold).toBeLessThan(firstBlock);
    expect(view).not.toMatch(/<details[^>]*\sopen/);
    expect(view).toMatch(/<summary[^>]*min-h-\[var\(--layout-touch-target\)\]/);
    expect(view.slice(dek, fold)).toContain('lg:hidden');
  });

  it('renders the read-first links open in the phone block, before the fold', () => {
    const phone = view.indexOf('lg:hidden');
    const readFirst = view.indexOf("heading={tl('readFirst')}", phone);
    expect(readFirst).toBeGreaterThan(phone);
    expect(readFirst).toBeLessThan(view.indexOf('<details'));
  });

  it('draws the outline from one component in both places', () => {
    expect(view.match(/<OutlineList outline=\{outline\} \/>/g)).toHaveLength(2);
    expect(view.match(/outline\.map\(/g)).toHaveLength(1);
  });
});
