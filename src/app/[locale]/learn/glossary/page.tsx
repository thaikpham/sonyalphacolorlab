import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteHeader } from '@/components/site-header'
import { Link } from '@/i18n/navigation'
import { bilingualAlternates } from '@/i18n/alternates'
import { type Locale } from '@/i18n/routing'
import { pageTarget, knowledgeExplaining } from '@/lib/content/relations'
import { ARTICLE_LANG } from '@/lib/lab/articles'
import { getPublishedKnowledge } from '@/lib/lab/data'
import { buildGlossary } from '@/lib/learn/glossary'

export const viewport: Viewport = { themeColor: '#F9F8F5', colorScheme: 'light' }
export const revalidate = 3600


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'learn' })
  /* Genuinely bilingual — the explanations exist in both locales — so each
     locale is canonical for itself and the two are alternates (ADR 0004). */
  return {
    title: t('glossaryTitle'),
    description: t('glossaryDescription'),
    alternates: bilingualAlternates(locale, '/learn/glossary'),
  }
}

/**
 * Every colour parameter a recipe can set, with what it does — generated from
 * `explanations.ts` (see `lib/learn/glossary.ts`). Each entry carries a stable
 * anchor (`#pp-colorDepth`, `#pp-colorDepth-R`, `#wb-shiftAb`) that recipe
 * pages and search link to, and, where a published reference page explains
 * that concept, a link to it.
 */
export default async function GlossaryPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const [t, pages] = await Promise.all([getTranslations('learn'), getPublishedKnowledge()])
  const groups = buildGlossary(locale)

  return (
    <div className="theme-paper contents">
      <Suspense>
        <SiteHeader />
      </Suspense>
      <main className="mx-auto min-h-screen-dynamic w-full max-w-[86rem] inset-safe pt-8 pb-24">
        <nav aria-label={t('breadcrumb')} className="mb-6">
          <Link
            href="/learn"
            className="inline-flex min-h-[var(--layout-touch-target)] items-center gap-2 text-body-sm font-semibold text-ink-muted transition-colors hover:text-accent-400"
          >
            <span aria-hidden>←</span>
            <span>{t('title')}</span>
          </Link>
        </nav>

        <h1 className="text-display font-semibold tracking-[-0.02em] leading-[1.1] text-ink">
          {t('glossaryTitle')}
        </h1>

        <ul className="mt-6 flex flex-wrap gap-2">
          {groups.map((g) => (
            <li key={g.group}>
              <a href={`#${g.group}`} className="chip chip-action">
                {g.title}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col gap-14">
          {groups.map((g) => (
            <section key={g.group} id={g.group} aria-labelledby={`h-${g.group}`} className="scroll-mt-24">
              <h2
                id={`h-${g.group}`}
                className="text-title-2 font-semibold tracking-[-0.02em] text-ink"
              >
                {g.title}
              </h2>

              {g.overview.length > 0 ? (
                <div className="mt-4 flex max-w-[46rem] flex-col gap-4">
                  {g.overview.map((para) => (
                    <p key={para.slice(0, 40)} className="text-body-lg leading-[1.7] text-ink [text-wrap:pretty]">
                      {para}
                    </p>
                  ))}
                </div>
              ) : null}

              {g.looks ? (
                <div id="cl-look" className="mt-6 scroll-mt-24">
                  <h3 className="label">{t('looks')}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {g.looks.map((l) => (
                      <li key={l.code} className="chip">
                        <span className="font-semibold text-ink">{l.code}</span>
                        <span>{l.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <dl className="mt-6 max-w-[56rem]">
                {g.entries.map((e, i) => {
                  const explained = e.concept
                    ? knowledgeExplaining([e.concept], pages).map(pageTarget)
                    : []
                  return (
                    <div
                      key={e.id}
                      id={e.id}
                      className={`scroll-mt-24 rounded-sm px-4 py-4 ${e.parent ? 'pl-10' : ''} ${i % 2 === 1 ? 'row-tint' : ''}`}
                    >
                      <dt className="text-body font-semibold text-ink">
                        {e.parent ? <span className="meta mr-2">{e.parent}</span> : null}
                        {e.label}
                      </dt>
                      <dd className="mt-1 text-body text-ink-muted leading-[1.65] [text-wrap:pretty]">
                        {e.text}
                      </dd>
                      {/* One line, not a related-links block: the same page
                          often explains several neighbouring entries, and a
                          heading under each of them stuttered down the list. */}
                      {explained.length > 0 ? (
                        <dd className="mt-1.5 flex flex-wrap gap-x-4">
                          {explained.map((l) => (
                            <Link
                              key={l.id}
                              href={l.href}
                              lang={ARTICLE_LANG}
                              className="inline-flex min-h-[var(--layout-touch-target)] items-center gap-1.5 text-body-sm font-semibold text-accent-400"
                            >
                              <span aria-hidden>→</span>
                              {l.title}
                            </Link>
                          ))}
                        </dd>
                      ) : null}
                    </div>
                  )
                })}
              </dl>

              <div className="mt-6 max-w-[56rem]">
                <h3 className="label">{t('sources')}</h3>
                <ul className="mt-2 flex flex-col gap-1">
                  {g.sources.map((s) => (
                    <li key={s.url} className="text-body-sm">
                      <a
                        href={s.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="font-semibold text-accent-400 underline decoration-accent-400/40 underline-offset-2 hover:decoration-accent-400"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
