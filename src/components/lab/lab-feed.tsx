import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ARTICLES, LEVELS, TOPICS, levelLabel, topicLabel } from '@/lib/lab/articles'
import type { LevelId, TopicId } from '@/lib/lab/types'

/**
 * The feed, its two filters, and the pinned card that leads into the setup
 * tool.
 *
 * Filter state lives in the URL rather than in component state, which is the
 * handoff's own production note ("make these real routes … with topic/level as
 * query params"). Three things fall out of that and none of them are free
 * otherwise: the whole feed renders on the server with no client JavaScript, a
 * filtered view is a link somebody can send, and the back button steps through
 * filter changes the way a reader expects.
 */

export type FeedFilter = {
  readonly topic: TopicId | 'all'
  readonly level: LevelId | 'all'
}

/** `undefined`, an unknown string and an array all mean "no filter". */
export function parseFilter(params: Record<string, string | string[] | undefined>): FeedFilter {
  const topic = typeof params.topic === 'string' ? params.topic : 'all'
  const level = typeof params.level === 'string' ? params.level : 'all'
  return {
    topic: TOPICS.some((t) => t.id === topic) ? (topic as TopicId) : 'all',
    level: LEVELS.some((l) => l.id === level) ? (level as LevelId) : 'all',
  }
}

/** AND across the two axes, as specified. */
function matches(
  article: (typeof ARTICLES)[number],
  { topic, level }: FeedFilter,
): boolean {
  return (
    (topic === 'all' || article.topic === topic) && (level === 'all' || article.level === level)
  )
}

/** A filter link that keeps the other axis where the reader left it. */
function filterHref(current: FeedFilter, patch: Partial<FeedFilter>) {
  const next = { ...current, ...patch }
  const query: Record<string, string> = {}
  if (next.topic !== 'all') query.topic = next.topic
  if (next.level !== 'all') query.level = next.level
  return { pathname: '/blog' as const, query }
}

export async function LabFeed({ filter }: { filter: FeedFilter }) {
  const t = await getTranslations('lab')
  const visible = ARTICLES.filter((a) => matches(a, filter))

  /* Counts follow the level filter but ignore the topic filter — a topic row
     showing "0" because a different topic is selected would be telling the
     reader the topic is empty when it is not. */
  const countFor = (topic: TopicId | 'all') =>
    ARTICLES.filter((a) => matches(a, { topic, level: filter.level })).length

  /* The pinned tool is a setup topic at newbie level, so it hides under any
     filter that would exclude an article with those two properties. */
  const showPinned =
    (filter.topic === 'all' || filter.topic === 'setup') &&
    (filter.level === 'all' || filter.level === 'newbie')

  return (
    /* `max-w-[160rem] inset-safe` is the ecosystem's horizontal rhythm — the
       same wrapper `/colorlab` uses, and the width the floating header bar
       aligns to. The handoff asks for full-bleed and this still is one at any
       real screen size (160rem is 2560px); what it fixes is content running
       80px wider than the chrome above it, which read as the page escaping
       its own header. */
    <div className="mx-auto flex w-full max-w-[160rem] flex-wrap items-start gap-y-8 gap-x-[clamp(2rem,3.5vw,4rem)] inset-safe pb-24">
      <aside className="flex grow basis-[clamp(14.375rem,17vw,18.75rem)] flex-col gap-6 self-start py-6 lg:sticky lg:top-0 lg:grow-0">
        {/* No wordmark here any more — the ecosystem header above the feed
            carries it, and links to this same route. Two "Alpha Tech Blogs"
            stacked 60px apart read as a rendering fault, not as branding. The
            rail keeps the subline as its own label, which is what a reader
            needs at this position: what they are filtering. */}
        <p className="label">{t('brandSubline')}</p>

        <nav aria-label={t('topicFilter')}>
          {/* A rail below `lg`, a scrolling row above it. Eleven stacked rows
              is a full phone screen of filters before the reader reaches a
              single article — the same problem `.filter-scroll` exists to
              solve for the level pills, and `.scroll-area` is the system's
              silent scrollbar, so neither half of this needs new CSS. */}
          <ul className="scroll-area flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-x-visible lg:pb-0">
            {[{ id: 'all' as const, label: t('allTopics') }, ...TOPICS].map((topic) => {
              const on = filter.topic === topic.id
              return (
                <li key={topic.id}>
                  <Link
                    href={filterHref(filter, { topic: topic.id })}
                    aria-current={on ? 'true' : undefined}
                    className={
                      'flex min-h-[var(--layout-touch-target)] items-center gap-3 rounded-md px-3 py-2 text-body-sm whitespace-nowrap transition-colors ' +
                      'lg:w-full lg:justify-between ' +
                      (on
                        ? 'surface-selected font-semibold text-white'
                        : 'text-ink-muted hover:text-ink')
                    }
                  >
                    <span>{topic.label}</span>
                    <span
                      className={
                        'tabular-nums ' + (on ? 'text-white/70' : 'text-ink-faint')
                      }
                    >
                      {countFor(topic.id)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <nav aria-label={t('levelFilter')}>
          <p className="label mb-2">{t('levelFilter')}</p>
          <ul className="filter-scroll flex flex-wrap gap-2">
            {[{ id: 'all' as const, label: t('allLevels') }, ...LEVELS].map((level) => {
              const on = filter.level === level.id
              return (
                <li key={level.id}>
                  <Link
                    href={filterHref(filter, { level: level.id })}
                    aria-current={on ? 'true' : undefined}
                    className={
                      'chip chip-action tracking-[0.08em] uppercase ' +
                      (on ? 'surface-selected text-white' : '')
                    }
                  >
                    {level.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1 basis-[32.5rem] pt-6">
        {showPinned ? (
          <section className="surface-raised mb-8 rounded-xl p-7">
            <div className="flex flex-wrap gap-2">
              <span className="chip bg-accent-500 font-semibold uppercase tracking-[0.08em] text-white">
                {t('pinned')}
              </span>
              <span className="chip bg-accent-900 font-semibold uppercase tracking-[0.08em] text-white">
                {t('tool')}
              </span>
            </div>
            <h2 className="mt-4 text-title-1 font-extrabold tracking-[-0.02em] leading-[1.15] text-ink [text-wrap:pretty]">
              {t('pinnedTitle')}
            </h2>
            <p className="mt-3 max-w-[52ch] text-body-lg text-ink-muted [text-wrap:pretty]">
              {t('pinnedDek')}
            </p>
            <Link href="/blog/setup" className="btn-accent mt-6">
              {t('pinnedCta')}
            </Link>
          </section>
        ) : null}

        {visible.length > 0 ? (
          <ul>
            {visible.map((article) => (
              <li key={article.id}>
                <hr className="seam" />
                <Link href={`/blog/${article.id}`} className="block py-6 group">
                  <p className="label">
                    <span className="text-accent-400">{topicLabel(article.topic)}</span>
                    <span className="text-ink-faint">
                      {' '}
                      · {levelLabel(article.level)} · {article.read}
                    </span>
                  </p>
                  <h3 className="mt-2 text-title-2 font-extrabold tracking-[-0.02em] leading-[1.2] text-ink transition-colors group-hover:text-accent-400 [text-wrap:pretty]">
                    {article.title}
                  </h3>
                  <p className="mt-2 max-w-[78ch] text-body text-ink-muted [text-wrap:pretty]">
                    {article.dek}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="max-w-[52ch]">
            <hr className="seam" />
            <div className="py-14">
              <h2 className="text-title-2 font-extrabold tracking-[-0.02em] text-ink">
                {t('emptyTitle')}
              </h2>
              <p className="mt-3 text-body text-ink-muted">{t('emptyBody')}</p>
              <Link href="/blog" className="btn-glass mt-6">
                {t('emptyCta')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
