import { describe, expect, it } from 'vitest';

import { mergePulled, readPullArgs } from './catalogue-pull';

describe('readPullArgs', () => {
  /* Every other script previews with `--dry-run`. Here it used to pass the
     argument check, be read by nothing, and write both seed files. */
  it.each([['--dry'], ['--dry-run']])('treats %s as a preview', (flag) => {
    expect(readPullArgs(['--target', 'content', flag])).toEqual({ target: 'content', dry: true });
  });

  it('writes when neither is given', () => {
    expect(readPullArgs(['--target', 'content']).dry).toBe(false);
  });

  it('refuses a flag the pull does not implement', () => {
    expect(() => readPullArgs(['--target', 'content', '--overwrite'])).toThrow(/--overwrite/);
  });
});

describe('mergePulled', () => {
  const side = { points: [], keySpecs: [] };

  it('removes highlights the admin cleared', () => {
    /* The PATCH route writes null to clear them, and the reader takes a null
       column as "no highlights" with no seed fallback. Skipping the null kept
       the deleted highlights alive in every offline build. */
    const seed = [{ id: 'X', name: 'X', highlights: { en: side, vi: side } }];
    const { changed, edits } = mergePulled([{ id: 'X', name: 'X', highlights: null }], seed);
    expect(seed[0]).not.toHaveProperty('highlights');
    expect(changed).toEqual(new Set(seed));
    expect(edits).toEqual(['  - X.highlights']);
  });

  it('leaves other null columns alone, as productFromRow does', () => {
    const seed = [{ id: 'X', name: 'X', imageUrl: 'https://example.com/a.jpg' }];
    const { changed } = mergePulled([{ id: 'X', name: 'X', image_url: null }], seed);
    expect(seed[0].imageUrl).toBe('https://example.com/a.jpg');
    expect(changed.size).toBe(0);
  });

  it('copies an edited column back', () => {
    const seed = [{ id: 'X', name: 'Old' }];
    const { changed, edits } = mergePulled([{ id: 'X', name: 'New', updated_by: 'ed' }], seed);
    expect(seed[0].name).toBe('New');
    expect(changed.size).toBe(1);
    expect(edits).toEqual(['  ~ X.name (by ed)']);
  });

  it('reports a row no seed holds', () => {
    expect(mergePulled([{ id: 'Y' }], []).edits[0]).toMatch(/Y — in Supabase, not in any seed/);
  });
});
