import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SetupGuide } from '@/components/lab/setup-guide'
import { SiteHeader } from '@/components/site-header'
import type { Locale } from '@/i18n/routing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'lab' })
  return { title: t('setupTitle'), description: t('setupLede') }
}

/**
 * The eight-step setup tool, reached from the pinned card on the feed.
 *
 * A separate route rather than a modal or a tab: it is the thing a reader is
 * sent a link to, and it is long enough that losing your place by closing an
 * overlay would be a real cost.
 */
export default async function SetupPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    /* Two bars on one page, and they do not fight: the ecosystem header is
       `sticky top-0 z-40` and hides itself on scroll down, the tool's own bar
       is `z-10` and stays. So while a reader is working down the eight steps
       the tool's bar is the only thing pinned, which is the one that carries
       the menu-version toggle and the progress. */
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
      <main className="min-h-screen-dynamic w-full">
        {/* A second boundary, and it is not decorative: without it this route
            prerenders with the recipe skeleton and a duplicate tree baked into
            the HTML on disk (two `main` elements, two CSR bailouts), which the
            reader sees as a flash of the wrong page before the tool appears.
            Verified by removing it and re-reading the prerendered
            `setup.html` under `.next/server/app`. */}
        <Suspense>
          <SetupGuide />
        </Suspense>
      </main>
    </>
  )
}
