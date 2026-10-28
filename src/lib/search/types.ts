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
  /** Every word found, but spread over fields none of which holds them all. */
  | 'spread'
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
  /**
   * The snippet's language. A recipe's name is English and its description
   * the reader's, so one `lang` cannot cover the title and the snippet both.
   */
  readonly snippetLanguage: string
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
 * What an empty first page says, or `null` when there are hits to show.
 *
 * `unsearched` — every kind the scope names failed to read: the status line
 * names them, and "no results" would claim a search that did not run.
 * `noResultsSearched` — some failed and the rest had nothing, so the sentence
 * is qualified. `noResults` only when every kind was searched.
 */
export function emptyState(
  res: Pick<SearchResponse, 'scope' | 'hits' | 'unavailable'>,
): 'noResults' | 'noResultsSearched' | 'unsearched' | null {
  if (res.hits.length > 0) return null
  if (SCOPE_KINDS[res.scope].every((k) => res.unavailable.includes(k))) return 'unsearched'
  return res.unavailable.length > 0 ? 'noResultsSearched' : 'noResults'
}
