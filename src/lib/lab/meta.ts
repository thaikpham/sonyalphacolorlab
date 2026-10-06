/**
 * The runtime half of `ArticleMeta`, the same contract `parse.ts` applies to
 * blocks: every field is rebuilt from validated pieces, never cast, and what
 * does not validate is dropped and counted rather than thrown on.
 *
 * Dropping per entry rather than refusing the whole object is deliberate. One
 * mistyped source URL should cost the reader that source, not every related
 * link on the page; and an editor who saved something this file refuses needs
 * to see the rest of their metadata to work out what. The admin API reports
 * the count, so a drop cannot pass unnoticed.
 *
 * The bounds are generous for a reference page and tight enough that a pasted
 * web page cannot become one field.
 */

import { RECIPE_ID_RE } from '@/lib/camera/schema'
import { isConceptKey, type ConceptKey } from '@/lib/content/concepts'
import type {
  ArticleKind,
  ArticleMeta,
  ContentRef,
  ContentRefKind,
  KnowledgeSection,
  SourceRef,
} from './types'

export const META_LIMITS = {
  related: 24,
  prerequisites: 6,
  concepts: 16,
  sources: 16,
  authorName: 80,
  sourceTitle: 200,
  sourceText: 160,
  url: 500,
} as const

export const KNOWLEDGE_SECTIONS: readonly KnowledgeSection[] = [
  'fundamentals',
  'sony-color',
  'workflows',
] as const

const REF_KINDS: readonly ContentRefKind[] = ['recipe', 'product', 'article', 'knowledge']

export const EMPTY_META: ArticleMeta = {
  related: [],
  prerequisites: [],
  concepts: [],
  sources: [],
  authorName: null,
  reviewedAt: null,
  section: null,
  order: null,
}

/** The id shape `slugify()` produces — articles and knowledge pages. */
export const ARTICLE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** `sony_cameras.id` — lower-case, digits and dashes, as the seed writes them. */
const PRODUCT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ')
  if (!t || t.length > max) return null
  return t
}

/** A real calendar date in `YYYY-MM-DD`, or null. `2026-02-31` is refused. */
export function parseIsoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = DATE_RE.exec(v.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null
  }
  return m[0]
}

/**
 * A source link a reader may follow. `https:` only — a reference page links
 * out to documentation, never to a script or a local file — with no embedded
 * credentials and a real hostname.
 */
export function parseSourceUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const raw = v.trim()
  if (!raw || raw.length > META_LIMITS.url) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (!url.hostname.includes('.')) return null
  return url.toString()
}

export function parseRef(raw: unknown): ContentRef | null {
  if (!isObject(raw)) return null
  const kind = REF_KINDS.find((k) => k === raw.kind)
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!kind || !id) return null
  switch (kind) {
    case 'recipe':
      return RECIPE_ID_RE.test(id) ? { kind, id } : null
    case 'product':
      return PRODUCT_ID_RE.test(id) && id.length <= 80 ? { kind, id } : null
    case 'article':
    case 'knowledge':
      return ARTICLE_ID_RE.test(id) && id.length <= 80 ? { kind, id } : null
  }
}

function parseSource(raw: unknown): SourceRef | null {
  if (!isObject(raw)) return null
  const url = parseSourceUrl(raw.url)
  const title = text(raw.title, META_LIMITS.sourceTitle)
  if (!url || !title) return null

  const source: { -readonly [K in keyof SourceRef]: SourceRef[K] } = { url, title }
  const publisher = text(raw.publisher, META_LIMITS.sourceText)
  const section = text(raw.section, META_LIMITS.sourceText)
  const scope = text(raw.scope, META_LIMITS.sourceText)
  const checkedAt = parseIsoDate(raw.checkedAt)
  if (publisher) source.publisher = publisher
  if (section) source.section = section
  if (scope) source.scope = scope
  if (checkedAt) source.checkedAt = checkedAt
  return source
}

/** A display name, or null. Anything address-shaped is refused outright. */
export function parseAuthorName(v: unknown): string | null {
  const name = text(v, META_LIMITS.authorName)
  if (!name || name.includes('@')) return null
  return name
}

export function parseKind(raw: unknown): ArticleKind | null {
  return raw === 'article' || raw === 'knowledge' ? raw : null
}

export function parseSection(raw: unknown): KnowledgeSection | null {
  return KNOWLEDGE_SECTIONS.find((s) => s === raw) ?? null
}

export type ParsedMeta = {
  readonly meta: ArticleMeta
  /** Entries or fields refused. Reported to the editor beside the block count. */
  readonly dropped: number
}

/**
 * Collect up to `max` parsed, de-duplicated entries from an array. Everything
 * refused, duplicated or beyond the bound counts as dropped.
 */
function collect<T>(
  raw: unknown,
  max: number,
  parse: (v: unknown) => T | null,
  key: (t: T) => string,
): { items: T[]; dropped: number } {
  if (raw === undefined || raw === null) return { items: [], dropped: 0 }
  if (!Array.isArray(raw)) return { items: [], dropped: 1 }
  const items: T[] = []
  const seen = new Set<string>()
  let dropped = 0
  for (const entry of raw) {
    const parsed = parse(entry)
    if (!parsed || seen.has(key(parsed)) || items.length >= max) {
      dropped += 1
      continue
    }
    seen.add(key(parsed))
    items.push(parsed)
  }
  return { items, dropped }
}

export function parseMeta(raw: unknown): ParsedMeta {
  if (raw === undefined || raw === null) return { meta: EMPTY_META, dropped: 0 }
  if (!isObject(raw)) return { meta: EMPTY_META, dropped: 1 }

  let dropped = 0

  const related = collect(raw.related, META_LIMITS.related, parseRef, (r) => `${r.kind}:${r.id}`)
  const prerequisites = collect(
    raw.prerequisites,
    META_LIMITS.prerequisites,
    (v) => (typeof v === 'string' && ARTICLE_ID_RE.test(v.trim()) ? v.trim() : null),
    (id) => id,
  )
  const concepts = collect<ConceptKey>(
    raw.concepts,
    META_LIMITS.concepts,
    (v) => (isConceptKey(v) ? v : null),
    (k) => k,
  )
  const sources = collect(raw.sources, META_LIMITS.sources, parseSource, (s) => `${s.url}#${s.section ?? ''}`)
  dropped += related.dropped + prerequisites.dropped + concepts.dropped + sources.dropped

  /* A present-but-invalid scalar counts as one drop; an absent or empty one is
     simply not set, which is the editor's to choose. */
  const scalar = <T>(value: unknown, parsed: T | null): T | null => {
    const blank = value === undefined || value === null || value === ''
    if (!blank && parsed === null) dropped += 1
    return parsed
  }

  const authorName = scalar(raw.authorName, parseAuthorName(raw.authorName))
  const reviewedAt = scalar(raw.reviewedAt, parseIsoDate(raw.reviewedAt))
  const section = scalar(raw.section, parseSection(raw.section))
  const order = scalar(
    raw.order,
    typeof raw.order === 'number' && Number.isInteger(raw.order) && raw.order >= 0 && raw.order <= 999
      ? raw.order
      : null,
  )

  return {
    meta: {
      related: related.items,
      prerequisites: prerequisites.items,
      concepts: concepts.items,
      sources: sources.items,
      authorName,
      reviewedAt,
      section,
      order,
    },
    dropped,
  }
}
