import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The search form is a plain GET form, so its `action` is the only thing
 * deciding which locale the results land in.
 *
 * A hardcoded "/" silently drops a Vietnamese reader into the English site the
 * moment they search — but only when they have no locale cookie yet, i.e. when
 * they arrived via a shared /vi link. That is exactly the path least likely to
 * be caught by hand, so it is pinned here.
 */
/* Points at site-header, which owns the live form. It used to read the
   standalone search-box.tsx — which the redesign orphaned, so these assertions
   went on passing against a component that rendered nowhere while the real form
   had lost both the GET fallback and the locale-aware action. */
const source = readFileSync('src/components/site-header.tsx', 'utf8');

describe('search form', () => {
  it('builds its action from the active locale', () => {
    // Asserts the shape of the value, not the identifier it is bound to, so
    // inlining or renaming the expression does not fail this for no reason.
    expect(source).toMatch(/action=\{[^}]*routing\.defaultLocale/);
  });

  it('never hardcodes the root path as the action', () => {
    expect(source).not.toContain('action="/"');
  });

  it('submits with GET so it works without JavaScript', () => {
    expect(source).toContain('method="get"');
  });

  it('debounces live search instead of navigating per keystroke', () => {
    expect(source).toContain('clearTimeout');
  });

  it('carries the active filters through as hidden inputs', () => {
    // Otherwise searching silently clears whatever the reader had narrowed to.
    expect(source).toContain('type="hidden"');
  });
});

describe('the header search modes (ADR 0003)', () => {
  it('posts each mode to the page that answers it', () => {
    /* ColorLab to its own grid — not the launcher at `/` — the Wiki to its
       catalogue, and the editorial pages to /search. */
    expect(source).toMatch(/const base = isAll \? '\/search' : isWiki \? wikiBase : '\/colorlab'/);
  });

  it('searches everything on the blog, /learn and /search', () => {
    expect(source).toMatch(/const isAll = isBlog \|\| isSearchPage/);
    expect(source).toMatch(/\/api\/search\?q=\$\{encodeURIComponent\(q\)\}&scope=all/);
  });

  it('cancels a superseded request instead of only ignoring its answer', () => {
    expect(source).toContain('new AbortController()');
    expect(source).toMatch(/predictiveAbort\.current\?\.abort\(\)/);
  });

  it('does not navigate per keystroke where there is no grid behind the box', () => {
    expect(source).toMatch(/if \(isAll\) return;\s*\n\s*searchTimer\.current = setTimeout/);
  });

  it('keeps every visible string in the message catalogues', () => {
    /* `locale === 'vi' ? … : …` hides copy from the parity test (Rule 3). */
    expect(source).not.toMatch(/locale === 'vi' \?/);
  });

  it('offers no keyboard hint as copy', () => {
    expect(source).not.toMatch(/Press Enter|Nhấn Enter/);
  });
});
