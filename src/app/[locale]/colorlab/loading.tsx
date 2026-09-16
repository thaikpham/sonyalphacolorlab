import { SiteHeader } from '@/components/site-header';

/**
 * Skeleton matching the recipe grid's shape, so the layout does not jump when
 * content arrives. Marked aria-hidden and announced via role=status instead —
 * a screen reader gains nothing from twelve empty boxes.
 *
 * IT LIVES HERE, not at `[locale]/`, and the move fixed two things at once.
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
 * catalogue — it always has a grid to show, even an empty one. The detail
 * routes have no boundary above them now and answer a real 404, which costs
 * them a skeleton they were never drawn for.
 */
export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[86rem] flex-1 inset-safe pb-24 animate-fade-in">
        {/* The placeholder bars carry the same white-5% film a real panel is
            made of, at a tag radius. No pulse: `.animate-fade-in` is the only
            animation left in the system. */}
        <div className="py-12">
          <div className="h-3 w-48 rounded-sm bg-glass" />
          <div className="mt-6 h-12 w-2/3 max-w-xl rounded-sm bg-glass" />
          <div className="mt-4 h-4 w-full max-w-lg rounded-sm bg-glass" />
        </div>
        <p role="status" className="sr-only">
          Loading recipes
        </p>
        {/* `.surface` rather than a hand-rolled radius: it is the class the real
            recipe card uses, so the skeleton lands at the same 26px corner and
            elevation and nothing shifts when content arrives. It also retires a
            radius token that no longer exists — that arbitrary value resolved to
            nothing, so every card here was rendering with square corners. */}
        <ul aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="surface aspect-[4/5]" />
          ))}
        </ul>
      </main>
    </>
  );
}
