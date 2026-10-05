import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SiteHeader } from '@/components/site-header'
import { Link } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { searchContent } from '@/lib/search/service'
import {
  MAX_OFFSET,
  MAX_QUERY,
  SCOPE_KINDS,
  SEARCH_SCOPES,
  type SearchHit,
  type SearchKind,
  type SearchScope,
} from '@/lib/search/types'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'searchPage' })
  /* A results page is a view of other pages, not a page: never indexed, and
     never in the sitemap, but its links are followed (ADR 0004). */
  return { title: t('title'), description: t('description'), robots: { index: false, follow: true } }
}

/** The order groups appear in on "All". */
const GROUP_ORDER: readonly SearchKind[] = ['recipe', 'product', 'knowledge', 'article']
const SCOPE_FOR: Readonly<Record<SearchKind, SearchScope>> = {
  recipe: 'recipes',
  product: 'products',
  article: 'articles',
  knowledge: 'knowledge',
}
const PER_GROUP = 6
const PAGE_SIZE = 20

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

/**
 * `/search` — the full results page for the unified search (ADR 0003).
 *
 * Server-rendered from the service directly, so it works with JavaScript off:
 * the form is a plain GET form and every tab and "more" link is a URL. On
 * "All" the hits are grouped — recipes, products, reference, articles — and
 * each group links to its own scope; on a scope the list pages with an
 * offset cursor.
 *
 * Every state says what it is. A source that failed is named above the
 * results and its group is absent, never shown as "0". No results is its own
 * sentence. An empty box shows the box.
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const sp = await searchParams
  const q = one(sp.q).trim().slice(0, MAX_QUERY)
  const scope = (SEARCH_SCOPES as readonly string[]).includes(one(sp.scope))
    ? (one(sp.scope) as SearchScope)
    : 'all'
  const cursorRaw = Number(one(sp.cursor))
  const cursor = Number.isInteger(cursorRaw) && cursorRaw > 0 && cursorRaw <= MAX_OFFSET ? cursorRaw : 0

  const [t, ts] = await Promise.all([getTranslations('searchPage'), getTranslations('search')])

  /* "All" asks for every match so it can show the head of each group; a scope
     asks for one page. The service bounds both. */
  const result = q
    ? await searchContent({
        q,
        locale,
        scope,
        limit: scope === 'all' ? 200 : PAGE_SIZE,
        cursor: scope === 'all' ? undefined : cursor,
      })
    : null

  const total = result ? Object.values(result.counts).reduce((n, c) => n + (c ?? 0), 0) : 0
  const action = locale === routing.defaultLocale ? '/search' : `/${locale}/search`

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[86rem] flex-1 inset-safe pt-8 pb-24">
        <h1 className="text-display font-extrabold tracking-[-0.02em] leading-[1.1] text-ink">
          {t('title')}
        </h1>

        <form role="search" action={action} method="get" className="mt-6 flex flex-wrap gap-3">
          {scope !== 'all' ? <input type="hidden" name="scope" value={scope} /> : null}
          <label htmlFor="search-page-input" className="sr-only">
            {t('label')}
          </label>
          <input
            id="search-page-input"
            type="search"
            name="q"
            defaultValue={q}
            maxLength={MAX_QUERY}
            placeholder={t('placeholder')}
            autoComplete="off"
            autoFocus={!q}
            className="surface-sunken min-h-[var(--layout-touch-target)] min-w-0 flex-1 basis-72 px-4 text-body text-ink placeholder:text-ink-faint"
          />
          <button type="submit" className="btn-accent cursor-pointer">
            {t('submit')}
          </button>
        </form>

        {result ? (
          <>
            <nav aria-label={t('scopeLabel')} className="mt-6">
              <ul className="scroll-silent flex gap-2 overflow-x-auto">
                {SEARCH_SCOPES.map((s) => {
                  const on = s === scope
                  const count =
                    s === 'all' ? total : SCOPE_KINDS[s].reduce((n, k) => n + (result.counts[k] ?? 0), 0)
                  const known = s === 'all' || SCOPE_KINDS[s].every((k) => result.counts[k] !== undefined)
                  return (
                    <li key={s}>
                      <Link
                        href={{ pathname: '/search', query: s === 'all' ? { q } : { q, scope: s } }}
                        aria-current={on ? 'page' : undefined}
                        className={`chip chip-action whitespace-nowrap ${on ? 'surface-selected text-ink' : ''}`}
                      >
                        {t(`scopes.${s}`)}
                        {/* A count only where the scope was searched — on "All"
                            a failed kind keeps its tab but shows no number. */}
                        {scope === 'all' && known ? (
                          <span className="tabular-nums text-accent-400">{count}</span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {result.unavailable.length > 0 ? (
              <p role="status" className="surface-raised mt-6 px-5 py-4 text-body-sm text-ink">
                {t('unavailable', {
                  kinds: result.unavailable.map((k) => t(`groups.${k}`)).join(', '),
                })}
              </p>
            ) : null}

            {result.hits.length === 0 && cursor === 0 ? (
              <p className="mt-10 text-title-3 font-semibold text-ink">{t('noResults', { query: q })}</p>
            ) : scope === 'all' ? (
              <div className="mt-8 flex flex-col gap-10">
                <p className="meta">{t('resultCount', { count: total })}</p>
                {GROUP_ORDER.filter((k) => (result.counts[k] ?? 0) > 0).map((kind) => {
                  const hits = result.hits.filter((h) => h.kind === kind)
                  const count = result.counts[kind] ?? 0
                  return (
                    <section key={kind} aria-labelledby={`group-${kind}`}>
                      <h2
                        id={`group-${kind}`}
                        className="flex items-baseline gap-3 text-title-2 font-extrabold tracking-[-0.02em] text-ink"
                      >
                        <span>{t(`groups.${kind}`)}</span>
                        <span className="meta font-normal tracking-normal">{count}</span>
                      </h2>
                      <HitList hits={hits.slice(0, PER_GROUP)} kindLabel={(k) => ts(`kinds.${k}`)} />
                      {count > PER_GROUP ? (
                        <Link
                          href={{ pathname: '/search', query: { q, scope: SCOPE_FOR[kind] } }}
                          className="mt-2 inline-flex min-h-[var(--layout-touch-target)] items-center gap-2 text-body-sm font-semibold text-accent-400"
                        >
                          {t('moreInGroup', { count, group: t(`groups.${kind}`) })}
                          <span aria-hidden>→</span>
                        </Link>
                      ) : null}
                    </section>
                  )
                })}
              </div>
            ) : (
              <div className="mt-8">
                <p className="meta">{t('resultCount', { count: total })}</p>
                <HitList hits={result.hits} kindLabel={(k) => ts(`kinds.${k}`)} />
                {result.nextCursor ? (
                  <Link
                    href={{ pathname: '/search', query: { q, scope, cursor: result.nextCursor } }}
                    className="btn-glass mt-6"
                  >
                    {t('next')}
                  </Link>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </main>
    </>
  )
}

function HitList({
  hits,
  kindLabel,
}: {
  hits: readonly SearchHit[]
  kindLabel: (kind: SearchKind) => string
}) {
  return (
    <ul className="mt-3">
      {hits.map((hit, i) => (
        <li key={`${hit.kind}:${hit.id}`} className={i % 2 === 1 ? 'row-tint' : undefined}>
          <Link
            href={hit.url}
            className="group flex min-h-[var(--layout-touch-target)] flex-col gap-1 rounded-sm px-4 py-3"
          >
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                lang={hit.contentLanguage}
                className="text-body font-semibold text-ink transition-colors group-hover:text-accent-400"
              >
                {hit.title}
              </span>
              <span className="label">{kindLabel(hit.kind)}</span>
              {hit.price ? <span className="meta tabular-nums">{hit.price}</span> : null}
            </span>
            {hit.subtitle && hit.subtitle !== hit.snippet ? (
              <span className="meta">{hit.subtitle}</span>
            ) : null}
            {hit.snippet ? (
              <span
                lang={hit.contentLanguage}
                className="max-w-[80ch] text-body-sm text-ink-muted [text-wrap:pretty]"
              >
                {hit.snippet}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
