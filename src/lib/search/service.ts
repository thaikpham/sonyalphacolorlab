import 'server-only'
import { getSonyAudio } from '@/lib/audio/data'
import { getSonyCameras } from '@/lib/cameras/data'
import { splitFeatures } from '@/lib/cameras/features'
import type { SonyCamera } from '@/lib/cameras/types'
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
import {
  SCOPE_KINDS,
  type ParsedSearchRequest,
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

const productDocs = (list: readonly SonyCamera[]) =>
  list.map((p) => {
    const { en, vi } = splitFeatures(p.features)
    return productDoc({ ...p, featureText: [...en, ...vi] })
  })

const ADAPTERS: Readonly<Record<SearchKind, Adapter>> = {
  recipe: async (locale) =>
    (await listRecipes(locale)).map((r) =>
      recipeDoc({ ...r, look: r.format === 'cl' ? r.settings.look : undefined }),
    ),
  product: async () => {
    const [cameras, audio] = await Promise.all([getSonyCameras(), getSonyAudio()])
    return productDocs([...cameras, ...audio])
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
    reasonCodes: reasons,
    ...doc.display,
  }
}

export async function searchContent(req: ParsedSearchRequest): Promise<SearchResponse> {
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

  const offset = req.cursor ?? 0
  const page = ranked.slice(offset, offset + req.limit)
  const next = offset + req.limit

  return {
    query: req.q,
    scope: req.scope,
    hits: page.map((r) => toHit(r.doc, r.reasons)),
    counts,
    unavailable,
    nextCursor: next < ranked.length && next <= 200 ? String(next) : null,
  }
}
