/**
 * The error vocabulary `/api/tweak` answers with.
 *
 * Same rule as `@/lib/community/errors`, a different surface: the route used to
 * return English sentences — `'Too many requests. Try again shortly.'` and
 * friends — and `tweak-panel.tsx` rendered `data.error` straight to the screen.
 * On a site that is otherwise fully bilingual that is a one-directional silent
 * failure, just pointing the other way: a Vietnamese reader got English.
 *
 * One of them leaked more than language. The 422 interpolated the Zod failure
 * text — `Could not produce a valid recipe — ${lastError}` — so a validation
 * message naming internal fields and ranges went to the browser. The detail now
 * goes to the log and the reader gets a code.
 *
 * These are a separate vocabulary rather than a borrowed one because they are a
 * different surface with different conditions; `community.errors.*` has no name
 * for "the daily AI budget is used up" and should not grow one.
 *
 * The body is `{ error: code }` with no `ok` field, matching what this route
 * already returned — its success responses carry no `ok` either.
 */

export const TWEAK_ERRORS = {
  /** Per-client request ceiling. Always paired with a `Retry-After` header. */
  rateLimited: 429,
  /** The fleet-wide daily ceiling, checked before any parsing. */
  budgetExhausted: 429,
  /** The body did not parse against the route's schema. */
  invalidRequest: 400,
  /** No recipe with that slug. */
  recipeNotFound: 404,
  /** No `ANTHROPIC_API_KEY` on this deploy. */
  notConfigured: 422,
  /** The model refused the request. */
  declined: 422,
  /** Two attempts, neither of which validated against the recipe schema. */
  invalidResult: 422,
  /** The upstream call threw. Deliberately vague: the detail goes to the log. */
  unavailable: 502,
} as const;

export type TweakErrorCode = keyof typeof TWEAK_ERRORS;

/** The JSON body shape. No `ok` field — this route never sent one. */
export type TweakErrorBody = { error: TweakErrorCode };

export function tweakErrorBody(code: TweakErrorCode): TweakErrorBody {
  return { error: code };
}

/**
 * Narrows a value off the wire to a code this bundle knows.
 *
 * Anything unrecognised must fall back to `tweak.errors.unknown` rather than
 * being rendered raw, which is the failure this module exists to prevent.
 */
export function isTweakErrorCode(value: unknown): value is TweakErrorCode {
  return typeof value === 'string' && value in TWEAK_ERRORS;
}
