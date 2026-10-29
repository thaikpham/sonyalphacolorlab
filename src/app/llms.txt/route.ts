import { listRecipes } from '@/lib/recipes/source'
import { getSonyAudio } from '@/lib/audio/data'
import { getSonyCameras } from '@/lib/cameras/data'
import { getPublishedArticles, getPublishedKnowledge } from '@/lib/lab/data'
import { llmsTxt } from '@/lib/aio/llms'

/**
 * The whole site for AI assistants (llmstxt.org). Reads the same cached
 * published functions as `sitemap.ts`; a failed online read throws rather than
 * serving the seeds (AGENTS.md).
 */
export const revalidate = 3600

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function GET() {
  const [recipes, cameras, audio, articles, knowledge] = await Promise.all([
    listRecipes('en'),
    getSonyCameras(),
    getSonyAudio(),
    getPublishedArticles(),
    getPublishedKnowledge(),
  ])
  return new Response(llmsTxt({ site: SITE, knowledge, articles, recipes, cameras, audio }), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
