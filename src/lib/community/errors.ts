/**
 * The error vocabulary the community routes answer with.
 *
 * Every one of these used to be a Vietnamese sentence written straight into the
 * route — `'Bạn cần đăng nhập để thực hiện thao tác này.'` and friends — with a
 * few English ones mixed in where a different day's author reached for a
 * different language. That breaks the rule the whole app is built on: a
 * user-visible string belongs in `messages/*.json`, because a literal in code
 * renders untranslated to half the readers and nothing errors when it does. An
 * English visitor hitting the rate limit got a sentence in a language they may
 * not read, on a site that is otherwise fully translated.
 *
 * So the wire format is a **code**, not prose. The server names the condition;
 * the client looks the code up in `community.errors.*` and renders it in the
 * reader's own locale. Adding a case means adding a member here and a key in
 * both catalogues — and `messages.test.ts` fails the build if only one of the
 * two catalogues gets it.
 *
 * The codes are also stable in a way sentences are not: rewording the copy no
 * longer changes what the API returns, so it cannot silently break a caller.
 */

export const COMMUNITY_ERRORS = {
  /** No verified session on a route that writes on a reader's behalf. */
  unauthenticated: 401,
  /** `checkRateLimit` said no. Always paired with a `Retry-After` header. */
  rateLimited: 429,
  /** The request is missing something the route cannot invent. */
  missingFields: 400,
  /** No recipe with that slug. */
  recipeNotFound: 404,
  /** This recipe already holds the maximum number of community photos. */
  photoLimitReached: 409,
  /** A photo URL that is not an https:// address. */
  invalidImageUrl: 400,
  /** A proposal without the sample photograph that gives it evidence. */
  sampleUrlRequired: 400,
  /** Persistence failed. Deliberately vague: the detail goes to the log. */
  saveFailed: 500,
} as const;

export type CommunityErrorCode = keyof typeof COMMUNITY_ERRORS;

/** The JSON body shape. `ok: false` because two of the routes already used it. */
export type CommunityErrorBody = { ok: false; error: CommunityErrorCode };

export function communityErrorBody(code: CommunityErrorCode): CommunityErrorBody {
  return { ok: false, error: code };
}

/**
 * Narrows a value off the wire to a code this bundle knows.
 *
 * The client reads `error` from a body it did not build: an older deploy, a
 * proxy's own error page, or a code added after this bundle shipped. Anything
 * unrecognised must fall back to `community.errors.unknown` — rendering the raw
 * value instead would put an untranslated string on screen, which is the exact
 * failure this module exists to prevent.
 */
export function isCommunityErrorCode(value: unknown): value is CommunityErrorCode {
  return typeof value === 'string' && value in COMMUNITY_ERRORS;
}
