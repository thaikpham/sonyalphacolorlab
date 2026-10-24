import { getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';

/**
 * Skeleton matching the recipe grid's shape, so the layout does not jump when
 * content arrives. Marked aria-hidden and announced via role=status instead —
 * a screen reader gains nothing from twelve empty boxes.
 *
 * IT LIVES HERE, in the `(index)` route group, and the placement fixed two
 * things at once.
 *
 * It says "Loading recipes" and draws a grid of recipe cards, but at the
 * segment root it was the skeleton for EVERY page under `[locale]` — a reader
 * opening a camera's spec sheet or an article watched six recipe cards
 * pretend to load.
 *
 * The second thing is not cosmetic. A `loading.tsx` is a Suspense boundary, and
 * Next flushes the shell above it — `<html>`, the head, this markup — with
 * `200 OK` before the page body runs. So `/recipe/<unknown>`,
 * `/cameras/<unknown>` and `/blog/<unknown>` all reached `notFound()` with the
 * status line already on the wire: the reader saw the right screen once the
 * stream resolved, and a crawler recorded a dead URL as a live page. Three soft
 * 404s from one file in the wrong place.
 *
 * So: a loading boundary belongs above a route that CANNOT 404. This one is the
 * catalogue index — it always has a grid to show, even an empty one. Its
 * sibling `/colorlab/[situation]` refuses an unknown id, which is why the index
 * sits in a route group of its own: at `colorlab/` this file would have been
 * above that route too, and the first soft 404 back.
 */
export default async function Loading() {
  const t = await getTranslations('loading');
  return (
    <>
      <SiteHeader />
      {/* The page's own container and grid, class for class. This used to be
          a centred 86rem three-column block of 4/5 tiles standing in for a
          full-bleed one-to-six-column grid — the jump it exists to prevent.
          `colorlab-page.test.ts` pins the two together. */}
      <main className="mx-auto w-full max-w-[160rem] flex-1 inset-safe pt-8 pb-24 flex flex-col gap-6 animate-fade-in">
        {/* The placeholder bars carry the same white-5% film a real panel is
            made of, at a tag radius. No pulse: `.animate-fade-in` is the only
            animation left in the system. One bar at the h1's height: the hero
            is a single heading. */}
        <div className="hero-block">
          <div className="h-11 w-2/3 max-w-xl rounded-sm bg-glass" />
        </div>
        <p role="status" className="sr-only">
          {t('status')}
        </p>
        {/* Four filter rows at a chip's height: system, situation, style, tone. */}
        <div aria-hidden className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 w-full max-w-3xl rounded-sm bg-glass" />
          ))}
        </div>
        {/* `.surface` rather than a hand-rolled radius: it is the class the real
            recipe card uses, so the skeleton lands at the same 26px corner and
            elevation and nothing shifts when content arrives. The 210px photo
            and the body's padding and gaps are `RecipeCard`'s: a label, a
            title and one meta line. */}
        <ul aria-hidden className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="surface overflow-hidden">
              <div className="h-[210px] w-full bg-glass" />
              <div className="flex flex-col gap-2 px-5 pt-[19px] pb-[22px]">
                <div className="h-4 w-24 rounded-sm bg-glass" />
                <div className="h-6 w-3/4 rounded-sm bg-glass" />
                <div className="h-4 w-1/2 rounded-sm bg-glass" />
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
