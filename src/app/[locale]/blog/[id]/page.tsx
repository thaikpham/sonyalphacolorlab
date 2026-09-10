import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { ArticleView } from '@/components/lab/article-view'
import { SiteHeader } from '@/components/site-header'
import { ARTICLES, getArticle } from '@/lib/lab/articles'
import { routing, type Locale } from '@/i18n/routing'

/**
 * Every article, in every locale, prerendered. The catalogue is a typed array
 * in `lib/lab/articles.ts` — nothing to fetch, so there is no reason for any
 * of these to be rendered on demand.
 *
 * `/blog/setup` is a static sibling segment, so Next matches it before this
 * dynamic one; no article may take `setup` as its id, and none does.
 */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    ARTICLES.map((article) => ({ locale, id: article.id })),
  )
}

/**
 * An id outside `generateStaticParams` is not an article — it is a typo or a
 * dead link, and it is answered by the router rather than by this page.
 *
 * That distinction is worth the line. With the default `dynamicParams: true`,
 * an unknown id runs this page, hits `notFound()`, and Next has already
 * flushed the `[locale]/loading.tsx` shell with a 200 by then: the reader sees
 * the correct not-found page once the stream resolves, but the response says
 * `200 OK` and carries a long `s-maxage`. That is a soft 404 — a crawler
 * records a dead URL as a live page and keeps it. Refusing unknown params here
 * makes the router answer `404` before any of that starts.
 *
 * It is available to this route because the catalogue is compile-time data, so
 * an id that is not in it can never become valid at runtime. `/cameras/[id]`
 * and `/recipe/[slug]` read from Supabase and cannot make the same promise —
 * they still return 200 for a dead URL, which is a separate, pre-existing bug
 * in the shared `loading.tsx` boundary and is not fixed here.
 */
export const dynamicParams = false

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const article = getArticle(id)
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

  const article = getArticle(id)
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
