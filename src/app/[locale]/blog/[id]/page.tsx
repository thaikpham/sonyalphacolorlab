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
 * Unknown ids now render on demand, and this is a real loss that had to be
 * accepted rather than a default left in place.
 *
 * With `dynamicParams = false`, an id outside `generateStaticParams` was
 * answered `404` by the router before this page ran. With it true, an unknown
 * id runs the page, hits `notFound()`, and Next has already flushed the
 * `[locale]/loading.tsx` shell with a 200 by then: the reader sees the correct
 * not-found page once the stream resolves, but the response says `200 OK`.
 * That is a soft 404, and a crawler records a dead URL as a live page.
 *
 * The old guarantee rested on the catalogue being compile-time data, so an id
 * absent from it could never become valid later. That stopped being true the
 * moment an editor could publish: keeping the flag would mean every new
 * article 404'd until the next deploy, which is the feature not working. The
 * soft-404 behaviour is now the same as `/cameras/[id]` and `/recipe/[slug]`,
 * which read from Supabase and have always had it — one shared bug in the
 * `loading.tsx` boundary rather than a new one here.
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
