import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LabFeed, parseFilter } from '@/components/lab/lab-feed'
import { SiteHeader } from '@/components/site-header'
import type { Locale } from '@/i18n/routing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'lab' })
  return { title: t('feedTitle'), description: t('feedDescription') }
}

/**
 * The Alpha Tech Blogs feed.
 *
 * Filters arrive as search params, so this stays a Server Component with no
 * client boundary anywhere in the tree — the rail, the pinned card and every
 * row are links. Reading `searchParams` opts the route into dynamic
 * rendering, which is the price of a shareable filtered URL and is paid by
 * this route alone.
 */
export default async function BlogFeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const filter = parseFilter(await searchParams)

  return (
    /* The ecosystem bar, the same one Sony Wiki and ColorLab carry. It is what
       makes this a room inside the ecosystem rather than a separate site: the
       launcher, the account and the language toggle live there, and a reader
       who arrived from a shared article link can reach the other two apps
       without going back to `/`. It floats and auto-hides on scroll, so the
       feed below it needs no offset — only enough top padding that the first
       row does not start under a bar that has just slid back in. */
    <>
      <SiteHeader />
      <main className="min-h-screen-dynamic w-full">
        <LabFeed filter={filter} />
      </main>
    </>
  )
}
