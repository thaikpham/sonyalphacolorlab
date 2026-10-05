import { PILOT_DRAFTS } from '@/lib/lab/pilot-drafts'
import { prepare, rank, type PreparedDoc } from '../rank'
import { seedCorpus } from './corpus'
import { EVAL_QUERIES, type EvalQuery } from './queries'

/**
 * Runs the evaluation set through the production ranker and reports:
 *
 * - **exact top-1** — of the queries with a `top1`, the share answered first.
 * - **Recall@5** — per query with relevant ids, the share of them (capped at
 *   five) found in the first five hits; averaged.
 * - **MRR** — mean reciprocal rank of the first relevant hit.
 * - **no-answer clean** — of the `none` queries, the share returning nothing.
 *
 * Measured, not asserted here: `evaluation.test.ts` holds the thresholds.
 */

export type QueryResult = {
  readonly query: EvalQuery
  readonly top: readonly { id: string; kind: string; reasons: readonly string[] }[]
  readonly recall: number | null
  readonly reciprocalRank: number | null
  readonly top1Ok: boolean | null
  readonly emptyOk: boolean | null
}

export type EvalReport = {
  readonly results: readonly QueryResult[]
  readonly exactTop1: number
  readonly recallAt5: number
  readonly mrr: number
  readonly noAnswerClean: number
  readonly counts: { readonly queries: number; readonly withPilot: number }
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function evaluate(queries: readonly EvalQuery[] = EVAL_QUERIES): EvalReport {
  const corpora = new Map<string, PreparedDoc[]>()
  const corpus = (locale: 'en' | 'vi', pilot: boolean) => {
    const key = `${locale}:${pilot}`
    if (!corpora.has(key)) {
      const extra = pilot ? PILOT_DRAFTS.filter((d) => d.kind === 'knowledge') : []
      corpora.set(key, seedCorpus(locale, extra).map(prepare))
    }
    return corpora.get(key) as PreparedDoc[]
  }

  const results = queries.map((query): QueryResult => {
    const ranked = rank(query.q, corpus(query.locale, query.corpus === 'with-pilot'))
    const top = ranked.slice(0, 5).map((r) => ({ id: r.doc.id, kind: r.doc.kind, reasons: r.reasons }))
    const ids = top.map((t) => t.id)
    const relevant = query.relevant
    const firstRelevant = ranked.findIndex((r) => relevant.includes(r.doc.id))

    return {
      query,
      top,
      recall:
        relevant.length > 0
          ? relevant.filter((id) => ids.includes(id)).length / Math.min(relevant.length, 5)
          : null,
      reciprocalRank: relevant.length > 0 ? (firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0) : null,
      top1Ok: query.top1 ? ids[0] === query.top1 : null,
      emptyOk: query.type === 'none' ? ranked.length === 0 : null,
    }
  })

  const pick = <K extends 'recall' | 'reciprocalRank'>(k: K) =>
    results.map((r) => r[k]).filter((v): v is number => v !== null)
  const flags = (k: 'top1Ok' | 'emptyOk') =>
    results.map((r) => r[k]).filter((v): v is boolean => v !== null)

  return {
    results,
    exactTop1: mean(flags('top1Ok').map(Number)),
    recallAt5: mean(pick('recall')),
    mrr: mean(pick('reciprocalRank')),
    noAnswerClean: mean(flags('emptyOk').map(Number)),
    counts: {
      queries: queries.length,
      withPilot: queries.filter((q) => q.corpus === 'with-pilot').length,
    },
  }
}
