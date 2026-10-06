import { NextResponse } from 'next/server'
import { searchContent } from '@/lib/search/service'
import { searchRequestSchema } from '@/lib/search/types'

/**
 * `GET /api/search?q&locale&scope&limit&cursor` — the unified search (ADR 0003).
 *
 * Validated with Zod before any read: an unknown scope or locale is a 400, a
 * query is trimmed and bounded, `limit` is 1–20. An empty query is a 400 too —
 * the header never sends one, and answering it would mean scoring the whole
 * corpus against nothing.
 *
 * `no-store`, for the reason the predictive route already gives: a shared
 * cache holding this response would outlive the `revalidateTag` an unpublish
 * fires, and keep offering a page that has gone. The reads underneath stay in
 * the tagged Data Cache, so a request is a ranking pass, not a database query.
 *
 * Read-only and anonymous. It returns what the public pages already show —
 * titles, snippets, links — and never an address, a draft or a private URL,
 * because every adapter reads the published, anon-column paths.
 */
const CACHE_CONTROL = 'no-store'

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = searchRequestSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'badRequest', issues: parsed.error.issues.map((i) => i.path.join('.') || 'q') },
      { status: 400, headers: { 'Cache-Control': CACHE_CONTROL } },
    )
  }

  const result = await searchContent(parsed.data)
  return NextResponse.json(result, { headers: { 'Cache-Control': CACHE_CONTROL } })
}
