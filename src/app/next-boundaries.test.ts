import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Where a Suspense boundary may sit, and why the answer is not "anywhere".
 *
 * A `loading.tsx` makes Next flush the shell above it — `<html>`, the head,
 * that markup — with `200 OK` before the page body runs. Any page beneath it
 * that calls `notFound()` therefore answers 200 with not-found content: the
 * reader sees the right screen once the stream resolves, and a crawler records
 * a dead URL as a live page.
 *
 * `[locale]/loading.tsx` did exactly that to four routes at once —
 * `/recipe/[slug]`, `/cameras/[id]`, `/audio/[id]` and `/blog/[id]` — while
 * drawing a recipe-grid skeleton over camera spec sheets and articles, which is
 * how one misplaced file produced a cosmetic bug and an SEO one from the same
 * line. It now sits at `[locale]/colorlab/`, above the only route it describes
 * and the only one of those that cannot 404.
 *
 * Measured rather than reasoned: against `next start`, `/vi/recipe/<unknown>`,
 * `/vi/cameras/<unknown>`, `/vi/audio/<unknown>` and `/vi/blog/<unknown>` all
 * answer 404, and `/vi`, `/vi/colorlab`, `/vi/cameras`, `/vi/blog` and every
 * real detail page still answer 200.
 *
 * A build cannot run in this suite, so what is asserted here is the structural
 * cause: no loading boundary above a route that has to be able to refuse.
 */

const APP = 'src/app';

/** Every `loading.tsx` in the tree, as a segment path. */
function loadingBoundaries(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return loadingBoundaries(p);
    return e.name === 'loading.tsx' ? [dir] : [];
  });
}

/** Every route file that refuses an unknown param. */
function refusingRoutes(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return refusingRoutes(p);
    if (e.name !== 'page.tsx') return [];
    const src = readFileSync(p, 'utf8');
    /* The call, not the import: several pages import `notFound` for a guard
       they no longer use, and a page that only mentions it in a comment is not
       a page that can refuse. */
    return /\bnotFound\(\)/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')) ? [dir] : [];
  });
}

describe('loading boundaries', () => {
  it('never sits above a route that can answer notFound()', () => {
    const boundaries = loadingBoundaries();
    const refusing = refusingRoutes();
    expect(refusing.length).toBeGreaterThan(0);

    const shadowed = refusing.flatMap((route) =>
      boundaries
        .filter((b) => route === b || route.startsWith(`${b}/`))
        .map((b) => `${b}/loading.tsx is above ${route}/page.tsx, which calls notFound()`),
    );

    expect(
      shadowed,
      'a loading.tsx flushes a 200 shell before the page runs, so every notFound() beneath it becomes a soft 404',
    ).toEqual([]);
  });

  it('keeps the recipe-grid skeleton on the recipe grid', () => {
    /* It says "Loading recipes" and draws recipe cards. At the segment root it
       was the skeleton for every page under `[locale]`. */
    expect(existsSync('src/app/[locale]/colorlab/loading.tsx')).toBe(true);
    expect(existsSync('src/app/[locale]/loading.tsx')).toBe(false);
  });
});

describe('search-param consumers', () => {
  /**
   * `useSearchParams()` bails its subtree out of server rendering, so it needs
   * a Suspense boundary or the build fails outright. Until the move above,
   * these borrowed the segment-root `loading.tsx` without owning one — so
   * putting that file where it belonged broke the build on
   * `/[locale]/cameras`. A component that reads the URL owns the boundary that
   * makes it legal.
   */
  const consumers = ['src/components/site-header.tsx', 'src/components/camera-wiki-view.tsx'];

  it.each(consumers)('%s wraps its own subtree in Suspense', (path) => {
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/useSearchParams\(\)/);
    expect(src).toMatch(/<Suspense/);
    expect(src).toMatch(/fallback=/);
  });
});
