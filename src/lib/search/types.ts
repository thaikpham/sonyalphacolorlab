import { z } from 'zod'

/**
 * The search contract (ADR 0003), shared by `/api/search`, the `/search` page,
 * the header and the evaluation set.
 */

export const SEARCH_KINDS = ['recipe', 'product', 'article', 'knowledge'] as const
export type SearchKind = (typeof SEARCH_KINDS)[number]

export const SEARCH_SCOPES = ['all', 'recipes', 'products', 'articles', 'knowledge'] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]

/** Which kinds a scope covers. */
export const SCOPE_KINDS: Readonly<Record<SearchScope, readonly SearchKind[]>> = {
  all: SEARCH_KINDS,
  recipes: ['recipe'],
  products: ['product'],
  articles: ['article'],
  knowledge: ['knowledge'],
}

/** Bounds. Edit distance is O(query × field), so the query length bounds the work. */
export const MAX_QUERY = 64
export const MAX_LIMIT = 20
export const DEFAULT_LIMIT = 10
/** How far an offset cursor may page. The corpus is a few hundred entities. */
export const MAX_OFFSET = 200

/**
 * Why a hit is where it is. Shown to nobody as a number — a reader gets the
 * order, the API gets the reasons, and nothing is dressed up as an accuracy
 * percentage.
 */
export type ReasonCode =
  | 'exact'
  | 'alias'
  | 'title'
  | 'summary'
  | 'tag'
  | 'heading'
  | 'body'
  | 'fuzzy'

export type SearchHit = {
  readonly id: string
  readonly kind: SearchKind
  readonly title: string
  /** Locale-free path; the caller's `Link` adds the prefix. */
  readonly url: string
  readonly snippet?: string
  /** The language the entity's own text is written in — not the UI locale. */
  readonly contentLanguage: string
  readonly reasonCodes: readonly ReasonCode[]
  /** Display only. */
  readonly subtitle?: string
  readonly badge?: string
  readonly imageUrl?: string
  readonly price?: string
  readonly accentHex?: string
}

export type SearchResponse = {
  readonly query: string
  readonly scope: SearchScope
  readonly hits: readonly SearchHit[]
  /** Matches per kind across the whole scope, before `limit`. */
  readonly counts: Readonly<Partial<Record<SearchKind, number>>>
  /**
   * Kinds whose source could not be read. Their absence from `hits` means
   * "not searched", never "nothing matched" — the UI must say which.
   */
  readonly unavailable: readonly SearchKind[]
  readonly nextCursor: string | null
}

/**
 * The request, validated. Strings from a URL are trimmed and bounded rather
 * than refused where a sensible reading exists — an over-long query is cut to
 * `MAX_QUERY`, the way the predictive route always has — and refused where
 * there is none: an unknown scope or locale is a 400, not a silent default.
 */
export const searchRequestSchema = z.object({
  q: z
    .string()
    .transform((s) => s.trim().slice(0, MAX_QUERY))
    .pipe(z.string().min(1)),
  locale: z.enum(['en', 'vi']).default('en'),
  scope: z.enum(SEARCH_SCOPES).default('all'),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z
    .string()
    .regex(/^\d{1,3}$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(MAX_OFFSET))
    .optional(),
})

export type SearchRequest = z.input<typeof searchRequestSchema>
export type ParsedSearchRequest = z.output<typeof searchRequestSchema>
