import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The row of other recipes under a recipe page, narrowed to the reader's
 * camera (ADR 0006). The page computes every choice's row at build; this
 * island only looks the cookie up. Plain `.ts` with `createElement`: the
 * vitest include pattern is `src/**\/*.test.ts`.
 *
 * `renderToStaticMarkup` takes the server snapshot, which is what the static
 * HTML and the first client render hold. The cookie the browser reads after
 * hydration is stood in for by mocking the hook that reads it.
 */

const cookie = { choice: null as string | null, real: true };
vi.mock('./my-camera-warning', async (importOriginal) => {
  const real = await importOriginal<typeof import('./my-camera-warning')>();
  return { ...real, useMyCameraChoice: () => (cookie.real ? real.useMyCameraChoice() : cookie.choice) };
});

const { MoreForSituation } = await import('./more-for-situation');

const cards = Object.fromEntries(
  ['CL-001', 'CL-002', 'PP-001', 'CL-003', 'PP-002', 'CL-004', 'PP-003', 'PP-004'].map((id) => [
    id,
    createElement('a', { href: `/recipe/${id.toLowerCase()}` }, id),
  ]),
);
const rows = {
  row: ['CL-001', 'CL-002', 'PP-001', 'CL-003', 'PP-002', 'CL-004'],
  byChoice: {
    'ILCE-7M3': ['PP-001', 'PP-002', 'PP-003', 'PP-004'],
    'ILCE-NONE': [],
  },
};
const heading = createElement('h2', { id: 'more-for-situation' }, 'More for Everyday');
const render = () => renderToStaticMarkup(createElement(MoreForSituation, { heading, cards, rows }));
const shown = (html: string) => [...html.matchAll(/<li class="grid"><a [^>]*>([^<]*)<\/a><\/li>/g)].map((m) => m[1]);

beforeEach(() => {
  cookie.real = true;
  cookie.choice = null;
});

describe('the row for the reader’s camera', () => {
  it('server render: today’s six, under the heading, whatever the browser holds', () => {
    const html = render();
    expect(html).toMatch(/^<section aria-labelledby="more-for-situation" class="mt-16 flex flex-col gap-4"><h2 id="more-for-situation">/);
    expect(html).toContain('<ul class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">');
    expect(shown(html)).toEqual(rows.row);
  });

  it('no cookie, or one the map does not hold: today’s six', () => {
    cookie.real = false;
    for (const choice of [null, 'unknown', 'constructor', 'ILCE-7M4']) {
      cookie.choice = choice;
      expect(shown(render()), String(choice)).toEqual(rows.row);
    }
  });

  it('a7 III: its own row, the Creative Looks gone and the Picture Profiles after them filled in', () => {
    cookie.real = false;
    cookie.choice = 'ILCE-7M3';
    expect(shown(render())).toEqual(['PP-001', 'PP-002', 'PP-003', 'PP-004']);
  });

  it('a camera that can install none of them: no section at all', () => {
    cookie.real = false;
    cookie.choice = 'ILCE-NONE';
    expect(render()).toBe('');
  });
});

describe('the recipe page', () => {
  const page = readFileSync('src/app/[locale]/recipe/[slug]/page.tsx', 'utf8');

  it('reads three rows of candidates and works every choice’s row out at build', () => {
    expect(page).toContain('const more = moreForSituation(recipe, catalogue, MORE_FOR_SITUATION_CANDIDATES);');
    expect(page).toContain('const rows = more ? cameraRows(more.recipes, options, MORE_FOR_SITUATION_LIMIT) : null;');
    expect(page).toContain('rows={{ row: rows.row, byChoice: rows.byChoice }}');
  });

  it('renders the browse’s card for every id some row shows, and no other', () => {
    expect(page).toMatch(/\.filter\(\(r\) => rows\.shown\.includes\(r\.id\)\)/);
    expect(page).toContain('<RecipeCard key={r.id} recipe={r} situationLabels={situationLabels} />');
  });
});
