import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteHeader } from '@/components/site-header'
import { Link } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { ARTICLE_LANG } from '@/lib/lab/articles'
import { getPublishedKnowledge } from '@/lib/lab/data'
import { KNOWLEDGE_SECTIONS } from '@/lib/lab/meta'
import { buildGlossary } from '@/lib/learn/glossary'

/* The paper room's ground for the browser chrome — the same exemption and
   the same value as `/blog`. Keep it in step with `:root:has(.theme-paper)`. */
export const viewport: Viewport = { themeColor: '#F9F8F5', colorScheme: 'light' }

/** The backstop. Publishing calls `revalidateTag(LAB_TAG)`, which is what
    actually refreshes this page. */
export const revalidate = 3600

const pathFor = (locale: string, rest: string) =>
  locale === routing.defaultLocale ? rest : `/${locale}${rest}`

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'learn' })
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: pathFor(locale, '/learn'),
      languages: Object.fromEntries(routing.locales.map((l) => [l, pathFor(l, '/learn')])),
    },
  }
}

/**
 * The reference hub (ADR 0001).
 *
 * Sections appear only when they hold a published page, so the hub never
 * shows an empty heading. The glossary is always here: it is generated from
 * the parameter explanations the recipe tables already carry, so the hub has
 * at least one complete group from the day it ships.
 */
export default async function LearnPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [t, pages] = await Promise.all([getTranslations('learn'), getPublishedKnowledge()])
  const glossary = buildGlossary(locale)
  const glossaryCount = glossary.reduce((n, g) => n + g.entries.length, 0)

  const sections = KNOWLEDGE_SECTIONS.map((section) => ({
    section,
    pages: pages
      .filter((p) => p.meta.section === section)
      .slice()
      .sort(
        (a, b) =>
          (a.meta.order ?? 999) - (b.meta.order ?? 999) || a.title.localeCompare(b.title, 'vi'),
      ),
  })).filter((s) => s.pages.length > 0)

  return (
    <div className="theme-paper contents">
      {/* See `/blog/[id]`: the header reads the URL, and on a statically
          generated route that bails the nearest boundary to the client. */}
      <Suspense>
        <SiteHeader />
      </Suspense>
      <main className="mx-auto min-h-screen-dynamic w-full max-w-[86rem] inset-safe pt-8 pb-24">
        <h1 className="text-display font-semibold tracking-[-0.02em] leading-[1.1] text-ink">
          {t('title')}
        </h1>

        <div className="mt-10 flex flex-col gap-12">
          {sections.map(({ section, pages: list }) => (
            <section key={section} id={section} aria-labelledby={`h-${section}`} className="scroll-mt-24">
              <h2
                id={`h-${section}`}
                className="flex items-baseline gap-3 text-title-2 font-semibold tracking-[-0.02em] text-ink"
              >
                <span>{t(`sections.${section}`)}</span>
                <span className="meta font-normal tracking-normal">
                  {t('pageCount', { count: list.length })}
                </span>
              </h2>
              <ul className="mt-4 grid gap-x-[clamp(2rem,3vw,3.5rem)] lg:grid-cols-2">
                {list.map((page) => (
                  <li key={page.id}>
                    <hr className="seam" />
                    <Link href={`/learn/${page.id}`} className="group block py-5" lang={ARTICLE_LANG}>
                      <h3 className="text-title-3 font-semibold tracking-[-0.02em] leading-[1.3] text-ink transition-colors group-hover:text-accent-400 [text-wrap:pretty]">
                        {page.title}
                      </h3>
                      {page.dek ? (
                        <p className="mt-2 max-w-[70ch] text-body text-ink-muted [text-wrap:pretty]">
                          {page.dek}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section id="glossary" aria-labelledby="h-glossary" className="scroll-mt-24">
            <h2
              id="h-glossary"
              className="flex items-baseline gap-3 text-title-2 font-semibold tracking-[-0.02em] text-ink"
            >
              <span>{t('sections.glossary')}</span>
              <span className="meta font-normal tracking-normal">
                {t('entryCount', { count: glossaryCount })}
              </span>
            </h2>
            <ul className="mt-4 grid gap-x-[clamp(2rem,3vw,3.5rem)] lg:grid-cols-3">
              {glossary.map((g) => (
                <li key={g.group}>
                  <hr className="seam" />
                  <Link href={`/learn/glossary#${g.group}`} className="group block py-5">
                    <h3 className="text-title-3 font-semibold tracking-[-0.02em] leading-[1.3] text-ink transition-colors group-hover:text-accent-400">
                      {g.title}
                    </h3>
                    <p className="meta mt-1">{t('entryCount', { count: g.entries.length })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
