import 'server-only'
import { getTranslations } from 'next-intl/server'
import { getSonyAudio } from '@/lib/audio/data'
import { getSonyCameras } from '@/lib/cameras/data'
import { getPublishedArticles, getPublishedKnowledge } from '@/lib/lab/data'
import { listRecipes } from '@/lib/recipes/source'
import {
  articleDoc,
  glossaryDocs,
  productDoc,
  recipeDoc,
  snippetFor,
  type SearchDoc,
} from './documents'
import { prepare, rank } from './rank'
import type { ParsedSearchRequest } from './request'
import {
  MAX_OFFSET,
  SCOPE_KINDS,
  type SearchHit,
  type SearchKind,
  type SearchResponse,
} from './types'

/**
 * The one search (ADR 0003). The header, `/api/search`, `/search` and the
 * ColorLab/Wiki predictive box all come through here.
 *
 * There is no index. Each adapter reads the function its own pages read —
 * `listRecipes`, `getSonyCameras`, `getSonyAudio`, the published-article read —
 * so search cannot disagree with the site: an unpublished article leaves the
 * results on the next request, because `revalidateTag(LAB_TAG)` empties the
 * same cache the article page reads, and nothing else holds a copy.
 *
 * Adapters settle independently. A source that throws is reported in
 * `unavailable` and contributes nothing — not the seed, not a stale copy, and
 * not an empty group that reads as "no matches".
 */

type Adapter = (locale: 'en' | 'vi') => Promise<readonly SearchDoc[]>

const ADAPTERS: Readonly<Record<SearchKind, Adapter>> = {
  recipe: async (locale) =>
    (await listRecipes(locale)).map((r) =>
      recipeDoc({ ...r, look: r.format === 'cl' ? r.settings.look : undefined }, locale),
    ),
  product: async (locale) => {
    const [cameras, audio, t] = await Promise.all([
      getSonyCameras(),
      getSonyAudio(),
      getTranslations({ locale, namespace: 'cameras' }),
    ])
    return [...cameras, ...audio].map((p) => productDoc(p, locale, t))
  },
  article: async () => (await getPublishedArticles()).map(articleDoc),
  /* Generated glossary entries need no read and cannot fail; the authored
     pages can, and if they do the whole kind is reported unavailable rather
     than served half — a glossary hit beside a silent gap reads as complete. */
  knowledge: async (locale) => [
    ...(await getPublishedKnowledge()).map(articleDoc),
    ...glossaryDocs(locale),
  ],
}

function toHit(doc: SearchDoc, reasons: SearchHit['reasonCodes']): SearchHit {
  return {
    id: doc.id,
    kind: doc.kind,
    title: doc.title,
    url: doc.url,
    snippet: snippetFor(doc),
    contentLanguage: doc.contentLanguage,
    snippetLanguage: doc.snippetLanguage ?? doc.contentLanguage,
    reasonCodes: reasons,
    ...doc.display,
  }
}

type Ranked = {
  readonly ranked: ReturnType<typeof rank>
  readonly counts: Partial<Record<SearchKind, number>>
  readonly unavailable: readonly SearchKind[]
}

/** Every adapter the scope names, settled, then one ranking over all of it. */
async function rankScope(req: Pick<ParsedSearchRequest, 'q' | 'locale' | 'scope'>): Promise<Ranked> {
  const kinds = SCOPE_KINDS[req.scope]
  const settled = await Promise.allSettled(kinds.map((k) => ADAPTERS[k](req.locale)))

  const unavailable: SearchKind[] = []
  const docs: SearchDoc[] = []
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') docs.push(...s.value)
    else {
      unavailable.push(kinds[i])
      console.error(
        `[search] ${kinds[i]} unavailable:`,
        s.reason instanceof Error ? s.reason.message : String(s.reason),
      )
    }
  })

  const ranked = rank(req.q, docs.map(prepare))
  const counts: Partial<Record<SearchKind, number>> = {}
  for (const k of kinds) if (!unavailable.includes(k)) counts[k] = 0
  for (const r of ranked) counts[r.doc.kind] = (counts[r.doc.kind] ?? 0) + 1
  return { ranked, counts, unavailable }
}

/** One page of the ranking, from an offset cursor. */
export async function searchContent(req: ParsedSearchRequest): Promise<SearchResponse> {
  const { ranked, counts, unavailable } = await rankScope(req)

  const offset = req.cursor ?? 0
  const page = ranked.slice(offset, offset + req.limit)
  const next = offset + req.limit

  return {
    query: req.q,
    scope: req.scope,
    hits: page.map((r) => toHit(r.doc, r.reasons)),
    counts,
    unavailable,
    nextCursor: next < ranked.length && next <= MAX_OFFSET ? String(next) : null,
  }
}

/**
 * The first `perKind` hits of each kind, in ranked order — what "All" on
 * `/search` shows. Taken from the whole ranking, not from a capped page of it:
 * the page could be all product titles, and a kind ranked below them would
 * show its count with no rows under it.
 */
export async function searchGroups(
  req: Pick<ParsedSearchRequest, 'q' | 'locale' | 'scope'>,
  perKind: number,
): Promise<SearchResponse> {
  const { ranked, counts, unavailable } = await rankScope(req)
  const taken: Partial<Record<SearchKind, number>> = {}
  const heads = ranked.filter((r) => {
    const n = taken[r.doc.kind] ?? 0
    taken[r.doc.kind] = n + 1
    return n < perKind
  })
  return {
    query: req.q,
    scope: req.scope,
    hits: heads.map((r) => toHit(r.doc, r.reasons)),
    counts,
    unavailable,
    nextCursor: null,
  }
}
