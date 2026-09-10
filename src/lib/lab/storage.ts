/**
 * The storage keys Alpha Tech Blogs owns, and the pure value handling around
 * them.
 *
 * Nothing here touches `window`. All the I/O — and the caching and change
 * notification that a React external store needs — lives in `tick-store.ts`;
 * this module only turns a raw string into a value and back. That split is
 * what lets the parsing rules below be tested without a DOM, and it is the
 * reason a browser that denies storage is a problem for exactly one file.
 */

/** Blog checklists, keyed `<articleId>-<blockIndex>-<itemIndex>`. */
export const CHECKS_KEY = 'alpha-lab-checks-v1'

/** Setup-guide progress, keyed by the version-independent step id. */
export const SETUP_KEY = 'alpha-setup-done-v1'

/** Which menu tree the reader's camera uses. A fact about their hardware, so
    it persists rather than being asked again every visit. */
export const MENU_VERSION_KEY = 'alpha-menu-version-v1'

/**
 * A set of ticked things. `Record<string, true>` rather than `string[]`
 * because membership is the only query anyone makes, and an array's order
 * would imply an ordering the data does not have.
 */
export type TickSet = Readonly<Record<string, true>>

const EMPTY: TickSet = Object.freeze({})

/**
 * Parse a stored map, treating anything unexpected as empty.
 *
 * The value is under the reader's control and shares an origin with every
 * other page of this app, so it can be absent, truncated by a killed tab, or
 * left behind by an older version of this feature. Being strict about it costs
 * a reader their ticks exactly once; being lax spreads a string into
 * `{0: 'a', 1: 'b'}` and renders a checklist of garbage keys forever.
 */
export function parseTicks(raw: string | null): TickSet {
  if (!raw) return EMPTY

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return EMPTY
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return EMPTY

  const out: Record<string, true> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (v === true) out[k] = true
  }
  return out
}

/** Toggle one key, returning a new object — never a mutation of the argument. */
export function toggleTick(ticks: TickSet, key: string): TickSet {
  const next: Record<string, true> = { ...ticks }
  if (next[key]) {
    delete next[key]
  } else {
    next[key] = true
  }
  return next
}
