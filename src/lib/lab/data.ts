import 'server-only'
import { unstable_cache } from 'next/cache'
import { contentRead } from '@/lib/supabase/server'
import { contentOrOfflineSeed } from '@/lib/supabase/content-source'
import { IMMEDIATE } from '@/lib/catalogue-cache'
import { ARTICLES } from './articles'
import { devPublished, isDevStore } from './dev-store'
import { parseArchetype, parseBlocks, parseLevel, parseTopic } from './parse'
import type { Article } from './types'

/**
 * Where an article comes from.
 *
 * Exactly one source per environment, decided by configuration:
 *
 * - **Online** — `lab_articles` on the content project, published rows only.
 * - **Offline, development** — the file the editor writes, so publishing on a
 *   laptop puts the article on `/blog` immediately.
 * - **Offline, anywhere else** — the compiled catalogue in `articles.ts`.
 *
 * The middle state is the one the whole blog was stuck in. The admin editor
 * wrote `lab_articles` while every reading surface returned `ARTICLES`, so a
 * save succeeded, reported success, and changed nothing a reader could see —
 * not the feed, not the article route, not the sitemap. Two sources of truth
 * for one page, with no way to tell from the page which had answered.
 *
 * Reverting to the compiled array was the right call while the project was
 * returning `402` to everything, but it cannot be a *fallback*: the array is a
 * Git-time snapshot, so serving it on a failed read would put deleted and
 * unpublished articles back on the site silently. `contentOrOfflineSeed`
 * branches on configuration only, and an online failure throws.
 */

/**
 * The tag every write route invalidates.
 *
 * Separate from `CATALOGUE_TAG` on purpose: the product catalogue and the blog
 * are edited by different people at different rates, and sharing a tag would
 * mean one admin saving a lens spec throws away the blog's cache too.
 */
export const LAB_TAG = 'lab-articles'

/**
 * An hour, not the catalogue's sixty seconds.
 *
 * The catalogue's interval is short because nothing invalidates it — the
 * product editor writes straight to Supabase, so 60s *is* its save latency.
 * The article routes call `revalidateTag(LAB_TAG)` on every write, so a save
 * is visible immediately and this interval is only the backstop for a write
 * that happened outside the app.
 */
const LAB_TTL_SECONDS = 3600

/**
 * The columns a reader is allowed to see.
 *
 * `status` is absent because the filter below already pins it, and `updated_by`
 * is absent because it is an editor's email address and this query runs under
 * the anon key — which ships in the browser bundle. Same rule as
 * `sony_cameras` and the community tables: never `*`, and no address in a
 * public select list.
 */
const PUBLIC_COLUMNS = 'id, topic, level, archetype, read, title, dek, blocks, updated_at'

/**
 * One public row to an `Article`, or nothing.
 *
 * A row is untrusted input even when an administrator wrote it: `blocks` is
 * JSON that reaches a renderer, and the closed `Block` union the compiler
 * enforces for `articles.ts` cannot see it. `parseBlocks` is where that same
 * rule is applied at runtime, and a block it refuses is dropped rather than
 * rendered — for a reader, silently; the editor is told the count on save.
 *
 * A row missing an id or a title is refused outright. Unlike the admin list,
 * this is not a screen where such a row can be repaired, so rendering it would
 * put an untitled entry in the feed linking to a page that cannot exist.
 */
export function articleFromPublicRow(row: Record<string, unknown>): Article | null {
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  const title = typeof row.title === 'string' ? row.title.trim() : ''
  if (!id || !title) return null

  return {
    id,
    topic: parseTopic(row.topic) ?? 'setup',
    level: parseLevel(row.level) ?? 'newbie',
    archetype: parseArchetype(row.archetype) ?? 'explainer',
    read: typeof row.read === 'string' ? row.read : '',
    title,
    dek: typeof row.dek === 'string' ? row.dek : '',
    blocks: parseBlocks(row.blocks).blocks,
  }
}

async function readPublished(): Promise<readonly Article[]> {
  return contentOrOfflineSeed<readonly Article[]>(
    'articles.published',
    async () => {
      const { data, error } = await contentRead()
        .from('lab_articles')
        .select(PUBLIC_COLUMNS)
        /* Belt and braces with RLS, which also restricts `anon` to published
           rows. The filter is here as well because a policy is one migration
           away from being loosened, and a draft in the public feed is the one
           mistake in this module that cannot be taken back. */
        .eq('status', 'published')
        .order('updated_at', { ascending: false })

      if (error) throw new Error(`lab_articles: ${error.message}`)
      return (data ?? [])
        .map((row) => articleFromPublicRow(row as Record<string, unknown>))
        .filter((a): a is Article => a !== null)
    },
    /* Local development with no Supabase reads the same file the editor writes,
       so publishing an article offline puts it on `/blog` immediately. Without
       this the editor would save happily and the feed would keep showing the
       compiled articles, which reads as a broken save. */
    () => (isDevStore() ? devPublished() : ARTICLES),
  )
}

/**
 * Every published article, newest first.
 *
 * `unstable_cache` rather than `next: { revalidate }` for the reason
 * `catalogue-cache.ts` writes up at length: supabase-js sends an
 * `Authorization` header, which makes Next treat the fetch as uncacheable and
 * opts the whole route out of the data cache.
 */
export const getPublishedArticles = unstable_cache(readPublished, ['lab-articles'], {
  revalidate: LAB_TTL_SECONDS,
  tags: [LAB_TAG],
})

/* `IMMEDIATE` now lives in `catalogue-cache.ts`, because the product routes
   need the same profile and importing a blog module to save a lens spec is how
   a constant gets copied instead of shared. Re-exported so the article routes
   keep one import. */
export { IMMEDIATE }

/** One published article, or `undefined`. Reads the same cached list rather
    than issuing a second query — there are tens of articles, not thousands. */
export async function getPublishedArticle(id: string): Promise<Article | undefined> {
  const articles = await getPublishedArticles()
  return articles.find((a) => a.id === id)
}
