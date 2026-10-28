import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { RelatedLinks, refsUnavailable } from '@/components/content/related-links'
import { SourceList, formatIsoDay } from '@/components/content/source-list'
import { resolvePrerequisites, resolveRefs } from '@/lib/content/relations'
import { loadUniverse } from '@/lib/content/universe'
import { buildOutline } from '@/lib/lab/outline'
import { ARTICLE_LANG } from '@/lib/lab/articles'
import { checklistOrdinals } from '@/lib/lab/storage'
import type { Article, Block } from '@/lib/lab/types'
import type { Locale } from '@/lib/recipes/source'
import {
  ArticleEmbed,
  ArticleFigure,
  Callout,
  ComparisonTable,
  Heading,
  MenuPair,
  type MenuPairLabels,
  Paragraph,
  TldrCard,
} from './blocks'
import { Checklist } from './checklist'
import { CompareSlider } from './compare-slider'
import { EditLink } from './edit-link'

/**
 * One article or knowledge page, with the derived rail beside it.
 *
 * A Server Component: only two of the ten blocks need a client boundary, and
 * they open their own. The rail is the interesting half — its summary and its
 * per-section précis are computed from the body rather than authored, so a
 * rewritten section cannot leave a stale summary behind it.
 *
 * Both kinds render here (ADR 0001); they differ only in the line above the
 * title. A blog article leads back to the feed and names its topic and level;
 * a knowledge page names its place in `/learn`. Below the body both carry the
 * same footer — sources, review date, author — and the related links, which
 * are resolved now, against what is published now (ADR 0002).
 */

type BlockLabels = { readonly menu: MenuPairLabels; readonly tldr: string }

function renderBlock(
  block: Block,
  i: number,
  articleId: string,
  labels: BlockLabels,
  checklistOrdinal: number,
) {
  const menuLabels = labels.menu
  switch (block.t) {
    case 'tldr':
      return <TldrCard key={i} block={block} label={labels.tldr} />
    case 'h':
      return <Heading key={i} block={block} index={i} />
    case 'p':
      return <Paragraph key={i} block={block} />
    case 'menu':
      return <MenuPair key={i} block={block} labels={menuLabels} />
    case 'table':
      return <ComparisonTable key={i} block={block} />
    case 'callout':
      return <Callout key={i} block={block} />
    case 'compare':
      return <CompareSlider key={i} block={block} articleId={articleId} />
    case 'checklist':
      return <Checklist key={i} block={block} articleId={articleId} ordinal={checklistOrdinal} />
    case 'figure':
      return <ArticleFigure key={i} block={block} articleId={articleId} />
    case 'embed':
      return <ArticleEmbed key={i} block={block} />
    default: {
      /* A block type added to the union without a case here fails to
         compile, rather than rendering nothing in every article that holds
         one. */
      const unreachable: never = block
      return unreachable
    }
  }
}

/** The article's sections, numbered, each with its précis — the rail's list
    from lg up, the folded list under the dek below it. */
function OutlineList({ outline }: { outline: ReturnType<typeof buildOutline> }) {
  return (
    <ul lang={ARTICLE_LANG} className="mt-1">
      {outline.map((entry) => (
        <li key={entry.id}>
          <hr className="seam" />
          <a
            href={`#${entry.id}`}
            className="flex min-h-[var(--layout-touch-target)] gap-2.5 rounded-sm px-2 py-3 transition-colors hover:bg-glass"
          >
            <span className="text-label font-bold tabular-nums text-accent-400">{entry.n}</span>
            <span className="min-w-0">
              <span className="block text-body-sm font-semibold leading-[1.35] text-ink">{entry.text}</span>
              {entry.precis ? <span className="meta mt-1 block leading-[1.45]">{entry.precis}</span> : null}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export async function ArticleView({ article }: { article: Article }) {
  const [t, tl, locale] = await Promise.all([
    getTranslations('lab'),
    getTranslations('learn'),
    getLocale(),
  ])
  const labels = { menu: { old: t('menuOld'), new: t('menuNew') }, tldr: t('summary') }
  const outline = buildOutline(article.blocks)
  const ordinals = checklistOrdinals(article.blocks)
  const { universe, unavailable } = await loadUniverse(locale as Locale)
  const prerequisites = resolvePrerequisites(article.meta.prerequisites, universe)
  const related = resolveRefs(article.meta.related, universe)
  const knowledge = article.kind === 'knowledge'
  const section = article.meta.section

  return (
    /* One column below `lg`: the article alone, with its outline folded
       under the dek, so a phone reader meets the title first and the
       contents one tap away rather than a screen of outline above the h1.
       Two columns from `lg`: the rail beside the text, sticky. The switch is
       the breakpoint, not wherever the two columns stop fitting. */
    <div className="flex flex-col lg:flex-row lg:items-start gap-y-8 gap-x-[clamp(2rem,3.5vw,4rem)]">
      {/* 46rem is the measure, not a layout width: at the 18px body it holds
          roughly 70 characters of Vietnamese a line, which is where long
          technical prose stops costing the reader their place. */}
      <article className="lab-article min-w-0 max-w-[46rem] lg:flex-1 lg:basis-[32.5rem]">
        {knowledge ? (
          /* Learn › section. The section is the hub's own anchor, so the
             trail is two links a reader can actually take. */
          <nav aria-label={tl('breadcrumb')} className="mb-6">
            <ol className="flex flex-wrap items-center gap-x-2 text-body-sm font-semibold text-ink-muted">
              <li>
                <Link
                  href="/learn"
                  className="inline-flex min-h-[var(--layout-touch-target)] items-center transition-colors hover:text-accent-400"
                >
                  {tl('title')}
                </Link>
              </li>
              {section ? (
                <li className="flex items-center gap-2">
                  <span aria-hidden className="text-ink-faint">›</span>
                  <Link
                    href={`/learn#${section}`}
                    className="inline-flex min-h-[var(--layout-touch-target)] items-center transition-colors hover:text-accent-400"
                  >
                    {tl(`sections.${section}`)}
                  </Link>
                </li>
              ) : null}
            </ol>
          </nav>
        ) : (
          <Link
            href="/blog"
            className="mb-6 inline-flex min-h-[var(--layout-touch-target)] items-center gap-2 text-body-sm font-semibold text-ink-muted transition-colors hover:text-accent-400"
          >
            <span aria-hidden>←</span>
            <span>{t('backToFeed')}</span>
          </Link>
        )}

        {/* Not `.label`: topic, level and read time run past the three words
            its uppercase allows. */}
        <p className="mb-3 text-label font-semibold text-ink-faint">
          <span className="text-accent-400">
            {knowledge && section ? tl(`sections.${section}`) : t(`topics.${article.topic}`)}
          </span>
          <span className="text-ink-faint">
            {' '}
            {knowledge ? null : <>· {t(`levels.${article.level}`)} </>}
            {article.read ? (
              <>
                · <span lang={ARTICLE_LANG}>{article.read}</span>
              </>
            ) : null}
          </span>
          <EditLink
            href={`/${knowledge ? 'learn' : 'blog'}/${article.id}/edit`}
            label={t('edit')}
          />
        </p>

        {/* The body is authored in Vietnamese on every locale (`types.ts`).
            `lang` tells a screen reader to switch voice for it, and a reader
            on another locale is told up front rather than left to find out. */}
        {locale !== ARTICLE_LANG ? (
          <p className="meta mb-3">{t('articleInVietnamese')}</p>
        ) : null}

        <div lang={ARTICLE_LANG}>
          <h1 className="text-display font-semibold tracking-[-0.02em] leading-[1.15] text-ink [text-wrap:pretty]">
            {article.title}
          </h1>
          <p className="mt-4 text-title-3 font-normal leading-[1.5] text-ink-muted [text-wrap:pretty]">
            {article.dek}
          </p>
          {/* Below `lg`, where the rail is hidden: "read first" open, and the
              outline folded behind its label. Navigation in the reader's UI
              language, so `lang` goes back to the page's. */}
          {prerequisites.length > 0 || outline.length > 0 ? (
            <nav aria-label={t('railLabel')} lang={locale} className="mt-8 flex flex-col gap-5 lg:hidden">
              {prerequisites.length > 0 ? (
                <RelatedLinks links={prerequisites} heading={tl('readFirst')} lang={ARTICLE_LANG} />
              ) : null}
              {outline.length > 0 ? (
                <details className="group">
                  <summary className="label flex min-h-[var(--layout-touch-target)] cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    {knowledge ? tl('inThisPage') : t('inThisArticle')}
                    <span aria-hidden className="text-ink-faint group-open:rotate-180">▾</span>
                  </summary>
                  <OutlineList outline={outline} />
                </details>
              ) : null}
            </nav>
          ) : null}
          <hr className="seam mt-8 mb-8" />

          {article.blocks.map((block, i) => renderBlock(block, i, article.id, labels, ordinals[i]))}
        </div>

        <footer className="mt-3 flex flex-col gap-6 pt-5">
          <hr className="seam" />
          <SourceList sources={article.meta.sources} lang={ARTICLE_LANG} />
          {article.meta.reviewedAt || article.meta.authorName ? (
            <p className="meta">
              {article.meta.authorName ? (
                <span lang={ARTICLE_LANG}>{tl('byAuthor', { name: article.meta.authorName })}</span>
              ) : null}
              {article.meta.authorName && article.meta.reviewedAt ? ' · ' : null}
              {article.meta.reviewedAt
                ? tl('reviewedOn', { date: formatIsoDay(article.meta.reviewedAt, locale) })
                : null}
            </p>
          ) : null}
          <p className="meta">{t('firmwareDisclaimer')}</p>
          <RelatedLinks
            links={related}
            unavailable={refsUnavailable(article.meta.related, unavailable)}
            lang={ARTICLE_LANG}
          />
        </footer>
      </article>

      {/* The rail, from `lg` only; below it the phone block under the dek
          does its job. `top-6` matches the article column's own top edge, so
          the two columns start on the same line rather than the rail hanging
          a gap below it. */}
      <nav
        aria-label={t('railLabel')}
        className="hidden lg:flex lg:sticky lg:top-6 shrink-0 basis-[clamp(15rem,19vw,20rem)] flex-col gap-5"
      >
        {/* In the rail, above the contents: it is navigation, not part of
            what the author wrote. The rail is the lg+ home of "read first";
            the phone block under the dek is the other. */}
        {prerequisites.length > 0 ? (
          <RelatedLinks links={prerequisites} heading={tl('readFirst')} lang={ARTICLE_LANG} />
        ) : null}

        {outline.length > 0 ? (
          <div>
            <p className="label">{knowledge ? tl('inThisPage') : t('inThisArticle')}</p>
            <OutlineList outline={outline} />
          </div>
        ) : null}
      </nav>
    </div>
  )
}
