import { describe, expect, it } from 'vitest'
import { evaluate } from './evaluate'
import { EVAL_QUERIES } from './queries'

/**
 * The thresholds from the brief (§14.2), held as a regression gate on the
 * lexical ranker: a change to weights, stopwords or document builders that
 * loses a name lookup or drops recall below the bar fails here, naming the
 * queries it broke.
 */

const report = evaluate()

describe('the search evaluation set', () => {
  it('has at least thirty labelled queries, every kind of the brief represented', () => {
    expect(EVAL_QUERIES.length).toBeGreaterThanOrEqual(30)
    const types = new Set(EVAL_QUERIES.map((q) => q.type))
    for (const t of ['exact', 'alias', 'typo', 'vi-accent', 'vi-plain', 'problem', 'concept', 'none']) {
      expect(types.has(t as never), t).toBe(true)
    }
  })

  it('answers every exact name, id and alias first', () => {
    const misses = report.results.filter((r) => r.top1Ok === false)
    expect(
      misses.map((m) => `${m.query.q} → ${m.top[0]?.id ?? '(nothing)'}`),
      'exact top-1 misses',
    ).toEqual([])
    expect(report.exactTop1).toBe(1)
  })

  it('reaches Recall@5 ≥ 0.8', () => {
    const weak = report.results
      .filter((r) => r.recall !== null && r.recall < 1)
      .map((r) => `${r.query.q} (${r.recall?.toFixed(2)})`)
    expect(report.recallAt5, `partial: ${weak.join('; ')}`).toBeGreaterThanOrEqual(0.8)
  })

  it('returns nothing for a query with no answer, rather than forcing one', () => {
    const forced = report.results
      .filter((r) => r.emptyOk === false)
      .map((r) => `${r.query.q} → ${r.top.map((t) => t.id).join(', ')}`)
    expect(forced).toEqual([])
  })

  it('ranks the article that answers a problem above recipes that share its words', () => {
    /* The brief's own case: "ảnh trong nhà bị nhòe" is a shutter-speed
       question, and a recipe that says "trong nhà" is not the answer. */
    const r = report.results.find((x) => x.query.q === 'ảnh trong nhà bị nhòe')
    expect(r?.top[0]).toMatchObject({ id: 'iso-auto-min-ss', kind: 'article' })
  })
})
