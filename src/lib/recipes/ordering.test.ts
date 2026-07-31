import { describe, expect, it } from 'vitest';
import { listRecipes, photosFirst } from './source';

/**
 * The grid draws a derived colour field when a recipe has no photograph, and
 * only 10 of the 83 recipes have one. Ordered by id that put a long run of
 * colour fields at the top of the default page, which reads as broken images
 * rather than as the deliberate fallback it is.
 *
 * The ordering is tested as a pure function rather than through `listRecipes`:
 * image URLs are built from `NEXT_PUBLIC_SUPABASE_URL`, which is unset under
 * vitest, so every recipe would come back with an empty `images` here and the
 * assertion would pass without proving anything.
 */
const view = (id: string, photos: number) => ({
  id,
  images: Array.from({ length: photos }, (_, i) => `${id}/${i}.jpg`),
});

describe('photosFirst', () => {
  it('puts every photographed recipe ahead of every unphotographed one', () => {
    const out = photosFirst([view('a', 0), view('b', 2), view('c', 0), view('d', 1)]);
    expect(out.map((v) => v.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('is a stable partition, so order inside each group is untouched', () => {
    // Deterministic pages matter: an unstable sort would reshuffle the grid on
    // every request even though nothing about the data changed.
    const input = [view('a', 0), view('b', 1), view('c', 0), view('d', 1), view('e', 0)];
    expect(photosFirst(input).map((v) => v.id)).toEqual(['b', 'd', 'a', 'c', 'e']);
    expect(photosFirst(photosFirst(input)).map((v) => v.id)).toEqual(['b', 'd', 'a', 'c', 'e']);
  });

  it('loses nothing — it reorders, it does not filter', () => {
    const input = [view('a', 0), view('b', 1), view('c', 0)];
    expect(photosFirst(input)).toHaveLength(3);
    expect(new Set(photosFirst(input).map((v) => v.id))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('does not mutate its input', () => {
    const input = [view('a', 0), view('b', 1)];
    photosFirst(input);
    expect(input.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('copes with every recipe having photos, or none of them', () => {
    expect(photosFirst([view('a', 1), view('b', 1)]).map((v) => v.id)).toEqual(['a', 'b']);
    expect(photosFirst([view('a', 0), view('b', 0)]).map((v) => v.id)).toEqual(['a', 'b']);
    expect(photosFirst([])).toEqual([]);
  });
});

describe('listRecipes still serves the whole catalogue', () => {
  it('returns both libraries, with unique ids', async () => {
    const all = await listRecipes('en');
    expect(new Set(all.map((v) => v.id)).size).toBe(all.length);
    expect(all.some((v) => v.id.startsWith('SCL-PP-'))).toBe(true);
    expect(all.some((v) => v.id.startsWith('SCL-CL-'))).toBe(true);
  });

  it('still honours a format filter', async () => {
    const cl = await listRecipes('en', { format: 'cl' });
    expect(cl.length).toBeGreaterThan(0);
    expect(cl.every((v) => v.id.startsWith('SCL-CL-'))).toBe(true);
  });
});
