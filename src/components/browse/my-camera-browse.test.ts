import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

/**
 * The browse page with a camera chosen (ADR 0006): the real offline
 * catalogue, the real evidence, and the cookie's raw value as the page passes
 * it in. `listRecipes` is spied on, not replaced, so the assertion about its
 * arguments is about the real cached read.
 */

const listRecipesSpy = vi.hoisted(() => vi.fn());
vi.mock('@/lib/recipes/source', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/recipes/source')>();
  listRecipesSpy.mockImplementation(real.listRecipes);
  return { ...real, listRecipes: listRecipesSpy };
});

/* The rendering half of the module; only `loadBrowse` is under test, and the
   Next client modules these import do not resolve under vitest. */
vi.mock('@/i18n/navigation', () => ({ Link: () => null }));
vi.mock('@/components/recipe-card', () => ({ RecipeCard: () => null }));
vi.mock('./browse-filters', () => ({ BrowseFilterRow: () => null }));
vi.mock('./situation-tiles', () => ({ SituationTiles: () => null }));

const { loadBrowse } = await import('./recipe-browse');
const { browseHref, colorlabSearch } = await import('@/lib/recipes/browse');
const { capabilitiesForModel } = await import('@/lib/cameras/capabilities/installable');

const browse = (cookie: string | undefined, sp: Record<string, string> = {}) => loadBrowse('en', null, sp, cookie);

describe('choosing a7 III', () => {
  it('removes every Creative Look recipe from the grid, the tiles and every count', async () => {
    const none = await browse(undefined);
    const a7iii = await browse('ILCE-7M3');
    expect(none.recipes.some((r) => r.format === 'cl')).toBe(true);

    expect(a7iii.camera).toMatchObject({ choice: 'ILCE-7M3', name: 'a7 III' });
    expect(a7iii.recipes.some((r) => r.format === 'cl')).toBe(false);
    expect(a7iii.all.some((r) => r.format === 'cl')).toBe(false);
    expect(a7iii.facets.formats.cl).toBe(0);
    /* What else goes is a Picture Profile outside the a7 III's confirmed lists. */
    const caps = capabilitiesForModel('ILCE-7M3');
    const installablePp = none.recipes.filter(
      (r) => r.format === 'pp' && caps.gammas!.includes(r.settings.gamma) && caps.colorModes!.includes(r.settings.colorMode),
    );
    expect(a7iii.recipes.map((r) => r.id)).toEqual(installablePp.map((r) => r.id));
    expect(a7iii.facets.formats.pp).toBe(installablePp.length);

    const ppOnly = none.recipes.filter((r) => r.format === 'pp');
    for (const [id, n] of Object.entries(a7iii.facets.situations)) {
      expect(n, id).toBeLessThanOrEqual(ppOnly.filter((r) => r.situations.includes(id as never)).length);
    }
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum(a7iii.facets.tones)).toBe(a7iii.recipes.length);
  });

  it('keeps narrowing with the other filters: ?format=cl leaves nothing', async () => {
    const model = await browse('ILCE-7M3', { format: 'cl' });
    expect(model.recipes).toEqual([]);
  });
});

describe('a camera with no data, or no camera', () => {
  it('shows the whole catalogue', async () => {
    const none = await browse(undefined);
    for (const cookie of ['unknown', 'ILCE-9M3', 'garbage value', 'ILCE-7M3%00', '']) {
      const model = await browse(cookie);
      expect(model.recipes.map((r) => r.id), cookie).toEqual(none.recipes.map((r) => r.id));
      expect(model.facets, cookie).toEqual(none.facets);
    }
    expect((await browse('ILCE-9M3')).camera).toMatchObject({ choice: 'ILCE-9M3', name: 'a9 III' });
    expect((await browse('garbage value')).camera).toBeNull();
  });
});

describe('the cookie', () => {
  it('never reaches the catalogue cache key', async () => {
    listRecipesSpy.mockClear();
    await browse('ILCE-7M3', { q: 'portrait', style: 'natural' });
    await browse('older-creative-style');
    expect(listRecipesSpy.mock.calls).toEqual([['en'], ['en']]);
  });

  it('never reaches a URL', async () => {
    const model = await browse('ILCE-7M3', { style: 'natural', tone: 'warm' });
    const href = browseHref(model.filters);
    expect(href).toBe('/colorlab?style=natural&tone=warm');
    expect(colorlabSearch(new URLSearchParams('camera=ILCE-7M3&q=x'), {})).toBe('q=x');

    const sources = [
      'src/components/browse/camera-picker.tsx',
      'src/components/browse/browse-filters.tsx',
      'src/components/browse/recipe-browse.tsx',
      'src/lib/cameras/my-camera-action.ts',
      'src/lib/recipes/browse.ts',
    ].map((f) => [f, readFileSync(f, 'utf8')] as const);
    for (const [file, src] of sources) {
      expect(src, file).not.toMatch(/[?&]camera=|searchParams\.set\('camera'|redirect\(|useRouter|router\.push/);
    }
  });

  it('is read by the browse pages, and not by the prerendered recipe page', () => {
    const index = readFileSync('src/app/[locale]/colorlab/(index)/page.tsx', 'utf8');
    const situation = readFileSync('src/app/[locale]/colorlab/[situation]/page.tsx', 'utf8');
    const recipe = readFileSync('src/app/[locale]/recipe/[slug]/page.tsx', 'utf8');
    for (const page of [index, situation]) expect(page).toContain('(await cookies()).get(MY_CAMERA_COOKIE)?.value');
    /* The recipe page is prerendered; `cookies()` there would render it per request. */
    expect(recipe).not.toMatch(/next\/headers|cookies\(\)/);
  });
});
