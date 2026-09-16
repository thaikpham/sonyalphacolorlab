import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { ArticleView } from '@/components/lab/article-view'
import { SiteHeader } from '@/components/site-header'
import { getPublishedArticle, getPublishedArticles } from '@/lib/lab/data'
import { routing, type Locale } from '@/i18n/routing'

/**
 * Every article published at build time, in every locale, prerendered.
 *
 * This used to be the whole set, because the catalogue was a typed array and
 * could not grow after the build. It can now: an editor publishes an article
 * and it has to appear without a deploy. So this list is the warm start, not
 * the boundary — `dynamicParams` below is what admits the rest.
 *
 * `/blog/setup` and `/blog/admin` are static sibling segments, so Next matches
 * both before this dynamic one. `RESERVED_IDS` in `parse.ts` refuses either as
 * an article id at save time, which is where the editor can still do something
 * about it.
 */
export async function generateStaticParams() {
  const articles = await getPublishedArticles()
  return routing.locales.flatMap((locale) =>
    articles.map((article) => ({ locale, id: article.id })),
  )
}

/**
 * Unknown ids render on demand, and answer a real 404 while doing it.
 *
 * With `dynamicParams = false` the router refused an id outside
 * `generateStaticParams` before this page ran. That guarantee rested on the
 * catalogue being compile-time data, so an id absent from it could never
 * become valid later — which stopped being true the moment an editor could
 * publish. Keeping the flag would mean every new article 404'd until the next
 * deploy, which is the feature not working.
 *
 * Turning it on cost a correct status for a while. An unknown id ran the page,
 * hit `notFound()`, and by then Next had already flushed the
 * `[locale]/loading.tsx` shell with a 200: the reader saw the right screen once
 * the stream resolved, and a crawler recorded a dead URL as a live page. The
 * same soft 404 applied to `/cameras/[id]`, `/audio/[id]` and `/recipe/[slug]`,
 * because one `loading.tsx` at the segment root sat above all of them.
 *
 * That file now lives at `[locale]/colorlab/`, which is the one route its
 * skeleton was ever drawn for. Nothing streams above these pages any more, so
 * `notFound()` reaches the status line — verified against `next start`, where
 * all four unknown-id routes answer `404` and every real page still answers
 * `200`. `next-boundaries.test.ts` keeps the boundary from drifting back up.
 */
export const dynamicParams = true

/**
 * The backstop for a page whose article was edited after it was prerendered.
 *
 * The write routes call `revalidateTag(LAB_TAG)`, which expires the cached
 * article list immediately — this hour is only what catches a row changed in
 * Supabase directly, outside the app.
 */
export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const article = await getPublishedArticle(id)
  if (!article) return {}
  return { title: article.title, description: article.dek }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const article = await getPublishedArticle(id)
  if (!article) notFound()

  return (
    <>
      {/* The boundary is load-bearing on a statically generated route.
          `SiteHeader` reads `useSearchParams()`, and during static generation
          that bails the nearest Suspense boundary to client-side rendering —
          which, without one here, is the route's own `loading.tsx`. The whole
          page then re-rendered on the client after hydration: two copies of
          this tree in the DOM at once and a visible flash of the recipe
          skeleton. `/colorlab` never showed it because that route is dynamic.
          Containing the bailout to the header keeps the page prerendered. */}
      <Suspense>
        <SiteHeader />
      </Suspense>
      {/* Measured, not full-bleed — the same call the handoff makes for the
          setup tool. The feed is a full-width index, but an article is
          96ch of body plus a 320px rail, and in a 160rem container that pair
          sits in the left third of a wide monitor with nothing beside it. */}
      <main className="mx-auto min-h-screen-dynamic w-full max-w-[86rem] inset-safe pt-8 pb-24">
        <ArticleView article={article} />
      </main>
    </>
  )
}
