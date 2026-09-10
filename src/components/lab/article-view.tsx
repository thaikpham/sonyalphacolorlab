import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { buildOutline, buildSummary } from '@/lib/lab/outline'
import { levelLabel, topicLabel } from '@/lib/lab/articles'
import type { Article, Block } from '@/lib/lab/types'
import {
  ArticleFigure,
  Callout,
  ComparisonTable,
  Heading,
  MenuPair,
  Paragraph,
  TldrCard,
} from './blocks'
import { Checklist } from './checklist'
import { CompareSlider } from './compare-slider'

/**
 * One article, with the derived rail beside it.
 *
 * A Server Component: only two of the nine blocks need a client boundary, and
 * they open their own. The rail is the interesting half — its summary and its
 * per-section précis are computed from the body rather than authored, so a
 * rewritten section cannot leave a stale summary behind it.
 */

function renderBlock(block: Block, i: number, articleId: string) {
  switch (block.t) {
    case 'tldr':
      return <TldrCard key={i} block={block} />
    case 'h':
      return <Heading key={i} block={block} index={i} />
    case 'p':
      return <Paragraph key={i} block={block} />
    case 'menu':
      return <MenuPair key={i} block={block} />
    case 'table':
      return <ComparisonTable key={i} block={block} />
    case 'callout':
      return <Callout key={i} block={block} />
    case 'compare':
      return <CompareSlider key={i} block={block} />
    case 'checklist':
      return <Checklist key={i} block={block} articleId={articleId} blockIndex={i} />
    case 'figure':
      return <ArticleFigure key={i} block={block} />
  }
}

export async function ArticleView({ article }: { article: Article }) {
  const t = await getTranslations('lab')
  const outline = buildOutline(article.blocks)
  const summary = buildSummary(article)

  return (
    /* `wrap-reverse` is deliberate and is the handoff's call: when the viewport
       is too narrow for two columns the rail moves ABOVE the article rather
       than below it, so a phone reader gets the summary and the contents
       before four screens of body copy instead of after them.

       `items-end`, not `items-start`, and that is not a typo. `wrap-reverse`
       swaps cross-start and cross-end, so `flex-start` resolves to the visual
       BOTTOM of the line — the handoff's spec pairs `wrap-reverse` with
       `align-items:flex-start` and lands the rail 1,464px down the page,
       level with the end of the article and below the fold on every screen.
       Under `wrap-reverse` the visual top is `flex-end`. */
    <div className="flex flex-wrap-reverse items-end gap-y-8 gap-x-[clamp(2rem,3.5vw,4rem)]">
      <article className="min-w-0 max-w-[96ch] flex-1 basis-[32.5rem]">
        <Link href="/blog" className="btn-glass mb-6 gap-2 text-label">
          <span aria-hidden className="text-accent-400">
            ←
          </span>
          <span>{t('backToFeed')}</span>
        </Link>

        <p className="label mb-3">
          <span className="text-accent-400">{topicLabel(article.topic)}</span>
          <span className="text-ink-faint"> · {levelLabel(article.level)} · {article.read}</span>
        </p>

        <h1 className="text-display font-extrabold tracking-[-0.02em] leading-[1.1] text-ink [text-wrap:pretty]">
          {article.title}
        </h1>
        <p className="mt-4 mb-8 text-body-lg text-ink-muted [text-wrap:pretty]">{article.dek}</p>

        {article.blocks.map((block, i) => renderBlock(block, i, article.id))}

        <footer className="mt-3 pt-5">
          <hr className="seam mb-5" />
          <p className="meta">{t('firmwareDisclaimer')}</p>
        </footer>
      </article>

      {/* `self-end` is the visual TOP here — see the container above. `top-6`
          matches the article column's own top edge, so the two columns start
          on the same line rather than the rail hanging a gap below it.
          `grow` until `lg`, where the two-column layout takes over: once the
          rail is on its own line it should fill it, not sit in a 240px
          gutter with the rest of a phone screen empty beside it. */}
      <nav
        aria-label={t('railLabel')}
        className="flex grow basis-[clamp(15rem,19vw,20rem)] flex-col gap-5 self-end lg:sticky lg:top-6 lg:grow-0"
      >
        <aside className="surface px-5 py-[18px]">
          <p className="label text-accent-400">{t('summary')}</p>
          <ul className="mt-2">
            {summary.map((line) => (
              <li key={line} className="flex gap-2 py-1">
                <span aria-hidden className="text-ink-faint">
                  —
                </span>
                <span className="text-body-sm leading-normal text-ink">{line}</span>
              </li>
            ))}
          </ul>
        </aside>

        {outline.length > 0 ? (
          <div>
            <p className="label">{t('inThisArticle')}</p>
            <ul className="mt-1">
              {outline.map((entry) => (
                <li key={entry.id}>
                  <hr className="seam" />
                  <a
                    href={`#${entry.id}`}
                    className="flex min-h-[var(--layout-touch-target)] gap-2.5 rounded-sm px-2 py-3 transition-colors hover:bg-glass"
                  >
                    <span className="text-label font-bold tabular-nums text-accent-400">
                      {entry.n}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-body-sm font-semibold leading-[1.35] text-ink">
                        {entry.text}
                      </span>
                      {entry.precis ? (
                        <span className="meta mt-1 block leading-[1.45]">{entry.precis}</span>
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </nav>
    </div>
  )
}
