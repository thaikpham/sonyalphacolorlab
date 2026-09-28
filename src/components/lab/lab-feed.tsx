import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ARTICLE_LANG, LEVELS, TOPICS } from '@/lib/lab/articles'
import { topicsForLevel } from '@/lib/lab/curriculum'
import type { Article, LevelId, TopicId } from '@/lib/lab/types'

/**
 * The feed, its two filters, and the pinned card that leads into the setup
 * tool.
 *
 * The catalogue arrives as a prop rather than being imported. It used to be
 * the typed array in `lib/lab/articles.ts`; it now comes from Supabase via
 * `lib/lab/data.ts`, and the page above is the one place that knows which.
 * Keeping the fetch out of here is what lets this stay a plain Server
 * Component the tests can render with three fixtures.
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
function matches(article: Article, { topic, level }: FeedFilter): boolean {
  return (
    (topic === 'all' || article.topic === topic) && (level === 'all' || article.level === level)
  )
}

/**
 * A filter link. `hash` lands a topic choice on the results rather than back
 * at the top of the path: below `lg` the rail sits above the list, and an
 * opened stage is most of a phone screen tall.
 */
function filterHref(current: FeedFilter, patch: Partial<FeedFilter>, hash?: string) {
  const next = { ...current, ...patch }
  const query: Record<string, string> = {}
  if (next.topic !== 'all') query.topic = next.topic
  if (next.level !== 'all') query.level = next.level
  return { pathname: '/blog' as const, query, ...(hash ? { hash } : {}) }
}

/** The setup tool is the newbie `setup` topic's content until articles exist. */
const TOOL_FOR: Partial<Record<TopicId, '/blog/setup'>> = { setup: '/blog/setup' }

/** Stage numbers, printed as the outline rail prints section numbers. */
const stageNumber = (i: number) => String(i + 1).padStart(2, '0')

function ArticleRow({
  article,
  t,
}: {
  article: Article
  t: Awaited<ReturnType<typeof getTranslations<'lab'>>>
}) {
  return (
    <li>
      <hr className="seam" />
      <Link href={`/blog/${article.id}`} className="group block py-6">
        <p className="label">
          <span className="text-accent-400">{t(`topics.${article.topic}`)}</span>
          <span className="text-ink-faint">
            {' '}
            · <span lang={ARTICLE_LANG}>{article.read}</span>
          </span>
        </p>
        <h3 className="mt-2 text-title-3 font-semibold tracking-[-0.02em] leading-[1.3] text-ink transition-colors group-hover:text-accent-400 [text-wrap:pretty]">
          {article.title}
        </h3>
        <p className="mt-2 max-w-[70ch] text-body text-ink-muted [text-wrap:pretty]">
          {article.dek}
        </p>
      </Link>
    </li>
  )
}

type LabT = Awaited<ReturnType<typeof getTranslations<'lab'>>>

/**
 * The pinned setup tool, as a grid cell. It keeps the row's seam and rhythm
 * so it lines up with the articles beside it, and carries the one tinted
 * field in the list — pinned is the only thing here that is not an article.
 */
function PinnedTool({ t }: { t: LabT }) {
  return (
    <li>
      <hr className="seam" />
      <div className="py-6">
        <Link
          href="/blog/setup"
          className="group block rounded-lg bg-accent-900 px-5 py-4 shadow-[var(--elevation-spec)]"
        >
          <p className="label text-accent-300">
            {t('pinned')} · {t('tool')}
          </p>
          <h3 className="mt-2 text-title-3 font-semibold tracking-[-0.02em] leading-[1.3] text-ink transition-colors group-hover:text-accent-400 [text-wrap:pretty]">
            {t('pinnedTitle')}
          </h3>
          <p className="mt-2 text-body text-ink-muted [text-wrap:pretty]">{t('pinnedDek')}</p>
          <span className="mt-3 inline-flex min-h-[var(--layout-touch-target)] items-center gap-2 text-body-sm font-semibold text-accent-400">
            {t('pinnedCta')}
            <span aria-hidden>→</span>
          </span>
        </Link>
      </div>
    </li>
  )
}

export async function LabFeed({
  filter,
  articles,
}: {
  filter: FeedFilter
  articles: readonly Article[]
}) {
  const t: LabT = await getTranslations('lab')
  const visible = articles.filter((a) => matches(a, filter))
  const count = (level: LevelId | 'all', topic: TopicId | 'all') =>
    articles.filter((a) => matches(a, { level, topic })).length

  /* The pinned tool is a setup topic at newbie level, so it hides under any
     filter that would exclude an article with those two properties. */
  const showPinned =
    (filter.topic === 'all' || filter.topic === 'setup') &&
    (filter.level === 'all' || filter.level === 'newbie')

  const stageIndex = LEVELS.findIndex((l) => l.id === filter.level)
  const groups = LEVELS.map((level, i) => ({
    level,
    n: stageNumber(i),
    items: visible.filter((a) => a.level === level.id),
    /* The setup tool is a newbie `setup` entry, so it sits in that stage's
       grid as its first cell — the same width as an article beside it,
       not a banner the full width of the page above all of them. */
    pinned: showPinned && level.id === 'newbie',
  })).filter((g) => g.items.length > 0 || g.pinned)

  return (
    /* Full bleed at the ecosystem's rhythm — `max-w-[160rem]`, the width the
       floating header aligns to. A single column of titles at this width
       left most of a wide monitor empty, so the list below becomes a grid
       that adds columns as the room grows; each entry still keeps its own
       ~70ch measure. */
    <div className="mx-auto flex w-full max-w-[160rem] flex-wrap items-start gap-y-6 gap-x-[clamp(2rem,4vw,4rem)] inset-safe pb-24">
      {/* Full width, above both columns: below `lg` the path wraps above the
        list, and a page whose first screen is a syllabus with no title
        does not say what it is. */}
      <header className="basis-full pt-6">
        <h1 className="text-display font-semibold tracking-[-0.02em] leading-[1.1] text-ink">
          {t('feedHeading')}
        </h1>
      </header>

      <PathRail filter={filter} articles={articles} count={count} t={t} />

      <div className="min-w-0 flex-1 basis-[32.5rem]">
        {/* Where the reader is, in words, with the way back out. The rail
            says the same thing by highlight — this line is for the reader
            who arrived on a shared filtered link and the phone reader whose
            rail is a screen above. */}
        <div id="articles" className="flex min-h-[var(--layout-touch-target)] scroll-mt-4 flex-wrap items-center gap-x-3 gap-y-1">
          {stageIndex >= 0 ? (
            <>
              <p className="label">
                <span className="text-accent-400">
                  {t('stageLabel', { n: stageNumber(stageIndex) })}
                </span>
                {' · '}
                {t(`levels.${filter.level as LevelId}`)}
                {filter.topic !== 'all' ? <> › {t(`topics.${filter.topic}`)}</> : null}
              </p>
              <Link
                href="/blog"
                className="text-body-sm font-semibold text-ink-muted transition-colors hover:text-accent-400"
              >
                {t('clearFilter')}
              </Link>
            </>
          ) : (
            /* A topic with no stage only arrives by an older shared link —
               the path always pairs them now — but it still names itself. */
            <p className="label">
              {filter.topic !== 'all' ? t(`topics.${filter.topic}`) : t('allTopics')} ·{' '}
              {t('articleCount', { count: visible.length })}
              {filter.topic !== 'all' ? (
                <Link
                  href="/blog"
                  className="ml-3 text-body-sm font-semibold normal-case tracking-normal text-ink-muted transition-colors hover:text-accent-400"
                >
                  {t('clearFilter')}
                </Link>
              ) : null}
            </p>
          )}
        </div>

        {groups.length > 0 ? (
          groups.map((g) => (
            <section key={g.level.id} aria-labelledby={`stage-${g.level.id}`} className="mt-10">
              {/* One stage selected, the context line above already names it
                  — a second heading saying the same would be the stutter the
                  header wordmark once caused. */}
              <h2
                id={`stage-${g.level.id}`}
                className={
                  stageIndex >= 0
                    ? 'sr-only'
                    : 'flex items-baseline gap-3 text-title-2 font-semibold tracking-[-0.02em] text-ink'
                }
              >
                <span className="tabular-nums text-accent-400">{g.n}</span>
                <span>{t(`levels.${g.level.id}`)}</span>
                {g.items.length > 0 ? (
                  <span className="meta font-normal tracking-normal">
                    {t('articleCount', { count: g.items.length })}
                  </span>
                ) : null}
              </h2>
              <ul
                className={
                  'grid gap-x-[clamp(2rem,3vw,3.5rem)] xl:grid-cols-2 3xl:grid-cols-3 ' +
                  (stageIndex >= 0 ? '' : 'mt-4')
                }
              >
                {g.pinned ? <PinnedTool t={t} /> : null}
                {g.items.map((article) => (
                  <ArticleRow key={article.id} article={article} t={t} />
                ))}
              </ul>
            </section>
          ))
        ) : showPinned ? null : (
          <div className="mt-10 max-w-[52ch]">
            <hr className="seam" />
            <div className="py-14">
              <h2 className="text-title-2 font-semibold tracking-[-0.02em] text-ink">
                {stageIndex >= 0 && count(filter.level, 'all') === 0
                  ? t('stageEmptyTitle')
                  : t('emptyTitle')}
              </h2>
              <p className="mt-3 text-body text-ink-muted">
                {stageIndex >= 0 && count(filter.level, 'all') === 0
                  ? t('stageEmptyBody')
                  : t('emptyBody')}
              </p>
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

/**
 * The learning path. Three stages; the one in the URL is open and lists the
 * skills that stage is about — each topic with what it means AT this stage,
 * so "Lấy nét & AF" under Cơ bản and under Nâng cao are visibly different
 * lessons, not one filter shown twice.
 *
 * Opening a stage is a link, not a client toggle: the open stage IS the level
 * filter, so the list beside it follows, the URL can be shared, and the whole
 * feed stays a Server Component. Pressing the open stage closes it and walks
 * back out to every article.
 */
function PathRail({
  filter,
  articles,
  count,
  t,
}: {
  filter: FeedFilter
  articles: readonly Article[]
  count: (level: LevelId | 'all', topic: TopicId | 'all') => number
  t: LabT
}) {
  return (
    <nav
      aria-label={t('pathLabel')}
      className="flex grow basis-[clamp(18rem,25vw,23rem)] flex-col self-start lg:sticky lg:top-0 lg:py-4 lg:grow-0"
    >
      <p className="label">{t('pathLabel')}</p>

      <ol className="mt-4 flex flex-col gap-2">
        {LEVELS.map((level, i) => {
          const open = filter.level === level.id
          const total = count(level.id, 'all')
          return (
            <li key={level.id}>
              <Link
                href={filterHref(filter, { level: open ? 'all' : level.id, topic: 'all' })}
                aria-current={open ? 'true' : undefined}
                className={
                  'flex min-h-[var(--layout-touch-target)] gap-3 rounded-lg px-3 py-3 transition-colors ' +
                  (open ? 'surface-selected' : 'hover:bg-glass')
                }
              >
                <span
                  className={
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-body font-extrabold tabular-nums ' +
                    (open ? 'bg-accent-500 text-white' : 'bg-accent-900 text-accent-300')
                  }
                >
                  {stageNumber(i)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-body-lg font-semibold text-ink">
                      {t(`levels.${level.id}`)}
                    </span>
                    <span className={'meta shrink-0 ' + (total > 0 ? 'text-accent-400' : '')}>
                      {total > 0 ? t('articleCount', { count: total }) : t('comingSoon')}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-body-sm leading-[1.45] text-ink-muted [text-wrap:pretty]">
                    {t(`path.${level.id}.mindset`)}
                  </span>
                </span>
              </Link>

              {open ? <StageSkills level={level.id} filter={filter} articles={articles} count={count} t={t} /> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function StageSkills({
  level,
  filter,
  articles,
  count,
  t,
}: {
  level: LevelId
  filter: FeedFilter
  articles: readonly Article[]
  count: (level: LevelId | 'all', topic: TopicId | 'all') => number
  t: LabT
}) {
  const focus = (topic: TopicId) =>
    t.has(`path.${level}.focus.${topic}`) ? t(`path.${level}.focus.${topic}`) : null

  return (
    /* Full rail width, not indented under the stage's text column: the
       indent cost 56px, and at a 21rem rail that was the difference between
       two checkpoints a line and one. The open stage's tint above is what
       ties them to it. */
    <div className="animate-fade-in px-3 pb-2">
      <p className="label mt-3">{t('skillsLabel')}</p>
      {/* Checkpoints, not rows. A stage opened as a list of name + focus
          line was eight to ten two-line rows — taller than the viewport, so
          the sticky rail grew its own scrollbar beside the page's. As chips
          the whole stage fits in a few lines; the focus line is still one
          hover or one keyboard focus away.

          Where the card opens depends on the room. From `lg` the `li` is
          the anchor and the card opens under its own chip, over the article
          column beside the rail. Below `lg` the rail is the full screen
          width and a chip near the right edge would push a card off it, so
          the `ul` is the anchor and every card opens full width under the
          grid instead. */}
      <ul className="relative mt-2 flex flex-wrap gap-1.5">
        {topicsForLevel(level, articles).map((topic) => {
          const n = count(level, topic)
          const on = filter.topic === topic
          const tool = level === 'newbie' ? TOOL_FOR[topic] : undefined
          const status = n > 0 ? t('articleCount', { count: n }) : tool ? t('tool') : t('comingSoon')
          const tipId = `skill-${level}-${topic}`

          const chip =
            /* 44px under a finger; a mouse gets the tighter 36px, which is
               what lets two checkpoints share a line in a 23rem rail. */
            'chip min-h-[var(--layout-touch-target)] pointer-fine:min-h-9 gap-2 transition-colors ' +
            (on ? 'surface-selected text-ink font-semibold' : n > 0 || tool ? 'chip-action text-ink' : 'text-ink-faint')
          const content = (
            <>
              {/* The checkpoint mark: filled where there is something to
                  read, a pressed-in well where there is not yet. */}
              <span
                aria-hidden
                className={
                  'h-2 w-2 shrink-0 rounded-[3px] ' +
                  (n > 0 || tool ? 'bg-accent-500' : 'bg-sunken shadow-[var(--elevation-inset)]')
                }
              />
              <span className="whitespace-nowrap">{t(`topics.${topic}`)}</span>
              {n > 0 ? <span className="tabular-nums text-accent-400">{n}</span> : null}
            </>
          )

          return (
            <li key={topic} className="group lg:relative">
              {n > 0 ? (
                <Link
                  href={filterHref(filter, { topic: on ? 'all' : topic }, 'articles')}
                  aria-current={on ? 'true' : undefined}
                  aria-describedby={tipId}
                  className={chip}
                >
                  {content}
                </Link>
              ) : tool ? (
                <Link href={tool} aria-describedby={tipId} className={chip}>
                  {content}
                </Link>
              ) : (
                /* Focusable so a keyboard or a tap can open its card too;
                   not a link, because there is nothing to go to yet. */
                <span tabIndex={0} aria-describedby={tipId} className={`${chip} cursor-default`}>
                  {content}
                </span>
              )}

              <span
                id={tipId}
                role="tooltip"
                className="surface-raised pointer-events-none invisible absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 lg:right-auto lg:w-[18rem] rounded-md px-4 py-3 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-body-sm font-semibold text-ink">{t(`topics.${topic}`)}</span>
                  <span className={'meta shrink-0 ' + (n > 0 || tool ? 'text-accent-400' : '')}>
                    {status}
                  </span>
                </span>
                {focus(topic) ? (
                  <span className="mt-1 block text-body-sm leading-[1.45] text-ink-muted [text-wrap:pretty]">
                    {focus(topic)}
                  </span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
