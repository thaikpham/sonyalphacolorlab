/**
 * Lexical ranking over `SearchDoc`s (ADR 0003).
 *
 * Tiered and explainable. A hit's place comes from the strongest field it
 * matched, in this order — exact name or id, alias, title, summary, tag,
 * heading, body, near miss — and the reasons travel with it. The number is an
 * internal ordering, never shown, and never presented as a confidence: two
 * results 50 points apart are "this one matched the title, that one the body",
 * not "this one is 12% more accurate".
 *
 * Matching is on folded words (no case, no diacritics, either tone-mark
 * placement). A multi-word query must find at least half of its meaningful
 * words in one field to count there, and all of them to score that field's
 * full weight. The last word of a query may match a word it is the start of,
 * which is what makes the header's type-ahead useful mid-word.
 */

import { levenshteinDistance } from './fuzzy-search'
import type { SearchDoc } from './documents'
import { fold, meaningfulWords, squash, words } from './text'
import type { ReasonCode } from './types'

type Field = {
  readonly words: ReadonlySet<string>
  readonly list: readonly string[]
}

export type PreparedDoc = {
  readonly doc: SearchDoc
  readonly exact: ReadonlySet<string>
  readonly aliases: readonly string[]
  readonly titleFold: string
  readonly tagFolds: readonly string[]
  readonly title: Field
  readonly summary: Field
  readonly tags: Field
  readonly headings: Field
  readonly body: Field
}

function field(text: string): Field {
  const list = words(text)
  return { words: new Set(list), list }
}

export function prepare(doc: SearchDoc): PreparedDoc {
  return {
    doc,
    exact: new Set(doc.exact),
    aliases: doc.aliases,
    titleFold: fold(doc.titleText),
    tagFolds: doc.tags.map(fold),
    title: field(doc.titleText),
    summary: field(doc.summary),
    tags: field(doc.tags.join(' ')),
    headings: field(doc.headings.join(' ')),
    body: field(doc.body),
  }
}

/** Weights per tier. Spaced so a weaker field can never overtake a stronger one. */
const W = {
  exact: 1000,
  alias: 900,
  aliasPrefix: 650,
  titlePhrase: 700,
  title: 600,
  tagPhrase: 520,
  summary: 420,
  tag: 380,
  heading: 300,
  body: 220,
  spread: 260,
  fuzzy: 150,
} as const

type Query = {
  readonly squashed: string
  readonly folded: string
  /** Meaningful words — stopwords dropped unless that would leave nothing. */
  readonly words: readonly string[]
  /** Whether the last word may be a prefix (the reader may still be typing). */
  readonly prefixLast: boolean
}

export function parseQuery(raw: string): Query | null {
  const squashed = squash(raw)
  if (!squashed) return null
  return {
    squashed,
    folded: fold(raw),
    words: meaningfulWords(raw),
    prefixLast: !/\s$/.test(raw),
  }
}

function has(f: Field, word: string, prefix: boolean): boolean {
  if (f.words.has(word)) return true
  if (!prefix || word.length < 2) return false
  return f.list.some((w) => w.startsWith(word))
}

/** Which of the query's words a field contains. */
function found(q: Query, f: Field): boolean[] {
  return q.words.map((w, i) => has(f, w, q.prefixLast && i === q.words.length - 1))
}

const fraction = (hits: readonly boolean[]) =>
  hits.length === 0 ? 0 : hits.filter(Boolean).length / hits.length

/** Partial coverage counts only on a multi-word query, and only from half up. */
function weightFor(cov: number, full: number, multi: boolean): number {
  if (cov === 1) return full
  if (multi && cov >= 0.5) return Math.round(full * 0.75 * cov)
  return 0
}

export type Scored = { readonly score: number; readonly reasons: readonly ReasonCode[] }

export function scoreDoc(q: Query, p: PreparedDoc): Scored | null {
  const multi = q.words.length > 1
  const tiers: [ReasonCode, number][] = []

  if (p.exact.has(q.squashed)) tiers.push(['exact', W.exact])
  if (p.aliases.includes(q.squashed)) tiers.push(['alias', W.alias])
  else if (q.squashed.length >= 2 && q.prefixLast && p.aliases.some((a) => a.startsWith(q.squashed))) {
    tiers.push(['alias', W.aliasPrefix])
  }

  if (q.folded && (p.titleFold === q.folded || ` ${p.titleFold} `.includes(` ${q.folded} `))) {
    tiers.push(['title', W.titlePhrase + (p.titleFold.startsWith(q.folded) ? 30 : 0)])
  }
  if (q.folded && p.tagFolds.some((t) => t === q.folded)) tiers.push(['tag', W.tagPhrase])

  const fields: [ReasonCode, Field, number][] = [
    ['title', p.title, W.title],
    ['summary', p.summary, W.summary],
    ['tag', p.tags, W.tag],
    ['heading', p.headings, W.heading],
    ['body', p.body, W.body],
  ]
  const union = q.words.map(() => false)
  for (const [reason, f, full] of fields) {
    const hits = found(q, f)
    hits.forEach((h, i) => {
      if (h) union[i] = true
    })
    const w = weightFor(fraction(hits), full, multi)
    if (w > 0) tiers.push([reason, w])
  }

  /* Every word found, but no single field holding them all — "Shift A/B"
     in a glossary entry's title and "White Balance" in its tags, or "màu ấm
     ban đêm" across a recipe's tags and its description. Worth more than a
     partial match in any one field, less than a full one. */
  if (multi && union.every(Boolean) && !tiers.some(([, w]) => w >= W.spread)) {
    tiers.push(['tag', W.spread])
  }

  /* A near miss on a single word, only when nothing matched outright. Bounded
     by word length so a three-letter typo cannot match half the catalogue. */
  if (tiers.length === 0 && !multi && q.words[0] && q.words[0].length >= 4) {
    const word = q.words[0]
    const max = word.length >= 7 ? 2 : 1
    const candidates = [...p.title.list, ...p.tags.list, ...p.aliases]
    if (candidates.some((c) => Math.abs(c.length - word.length) <= max && levenshteinDistance(word, c, max) <= max)) {
      tiers.push(['fuzzy', W.fuzzy])
    }
  }

  if (tiers.length === 0) return null

  tiers.sort((a, b) => b[1] - a[1])
  const reasons = [...new Set(tiers.map(([r]) => r))]
  /* The strongest tier places the hit; each further field it matched breaks a
     tie, by less than the gap between any two tiers. */
  const score = tiers[0][1] + Math.min(reasons.length - 1, 5) * 4 + p.doc.boost
  return { score, reasons }
}

export type RankedDoc = { readonly doc: SearchDoc; readonly score: number; readonly reasons: readonly ReasonCode[] }

const KIND_ORDER = { recipe: 0, product: 1, knowledge: 2, article: 3 } as const

export function rank(raw: string, docs: readonly PreparedDoc[]): RankedDoc[] {
  const q = parseQuery(raw)
  if (!q) return []
  const out: RankedDoc[] = []
  for (const p of docs) {
    const s = scoreDoc(q, p)
    if (s) out.push({ doc: p.doc, score: s.score, reasons: s.reasons })
  }
  return out.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_ORDER[a.doc.kind] - KIND_ORDER[b.doc.kind] ||
      a.doc.title.localeCompare(b.doc.title),
  )
}
