import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { NextIntlClientProvider } from 'next-intl'
import { SiteHeader } from '@/components/site-header'
import { ArticleAdmin } from '@/components/lab/admin/article-admin'

/**
 * The article editor's route.
 *
 * `noindex`, and deliberately not gated here — the same call
 * `/[locale]/admin/page.tsx` makes and for the same reason: every write goes
 * through `/api/admin/articles`, which checks `requireAdmin()` itself, and a
 * page has never been an authorisation boundary. What this page renders to a
 * stranger is the "not an admin" panel, because the session check is a fetch
 * the component makes rather than something the render assumes.
 *
 * `/blog/admin` is a static segment, so Next matches it before `/blog/[id]`.
 * `RESERVED_IDS` in `lib/lab/parse.ts` refuses `admin` as an article id, which
 * is what stops an article being saved at a URL this route would shadow.
 */

export const metadata: Metadata = {
  title: 'Article Admin — Alpha Tech Blogs',
  robots: { index: false, follow: false },
}

export default async function BlogAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const messages = await getMessages()

  /* Explicit namespaces, not the whole catalogue. `labAdmin` is only read on
     this route, so it does not belong in the layout's provider where every
     visitor would carry it — the same arrangement the five product-admin
     routes have with `admin`, and what `messages.test.ts` checks per route. */
  const clientMessages = {
    auth: messages.auth,
    cameras: messages.cameras,
    labAdmin: messages.labAdmin,
    language: messages.language,
    nav: messages.nav,
    search: messages.search,
  }

  return (
    <NextIntlClientProvider messages={clientMessages}>
      <div className="min-h-screen-dynamic flex flex-col bg-void font-sans text-ink">
        {/* `SiteHeader` reads `useSearchParams()`; without a boundary of its
            own that bails the whole route to client rendering. Same fix as
            `/blog/[id]`. */}
        <Suspense>
          <SiteHeader />
        </Suspense>
        <ArticleAdmin />
      </div>
    </NextIntlClientProvider>
  )
}
