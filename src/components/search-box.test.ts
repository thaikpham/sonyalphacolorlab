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
const source = readFileSync('src/components/search-box.tsx', 'utf8');

describe('search form', () => {
  it('builds its action from the active locale', () => {
    expect(source).toContain('routing.defaultLocale');
    expect(source).toContain('action={action}');
  });

  it('never hardcodes the root path as the action', () => {
    expect(source).not.toContain('action="/"');
  });

  it('submits with GET so it works without JavaScript', () => {
    expect(source).toContain('method="get"');
  });

  it('carries the active filters through as hidden inputs', () => {
    // Otherwise searching silently clears whatever the reader had narrowed to.
    expect(source).toContain('type="hidden"');
  });
});
