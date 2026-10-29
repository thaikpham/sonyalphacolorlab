import { getPublishedArticle, getPublishedKnowledgePage } from '@/lib/lab/data'
import { ARTICLE_LANG } from '@/lib/lab/articles'
import { articleMarkdown } from '@/lib/lab/markdown'

/**
 * The Markdown twin of a published page, for AI agents. Reached through the
 * rewrites in `next.config.ts` from `/vi/blog/<id>.md` and
 * `/vi/learn/<id>.md` — the canonical URL plus `.md`. Drafts and unknown ids
 * are 404s: the published readers return nothing for them. A failed online
 * read throws, as the pages do.
 */
export const revalidate = 3600

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const READERS = { article: getPublishedArticle, knowledge: getPublishedKnowledgePage } as const
const PREFIX = { article: 'blog', knowledge: 'learn' } as const

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await ctx.params
  if (kind !== 'article' && kind !== 'knowledge') return new Response('Not found', { status: 404 })
  const page = await READERS[kind](id)
  if (!page) return new Response('Not found', { status: 404 })
  const canonicalUrl = `${SITE}/${ARTICLE_LANG}/${PREFIX[kind]}/${id}`
  return new Response(articleMarkdown(page, { canonicalUrl }), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  })
}
