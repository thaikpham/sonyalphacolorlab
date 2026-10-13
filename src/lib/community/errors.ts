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
  /** No proposal with that id — deleted since the list was loaded, or never was. */
  proposalNotFound: 404,
  /** This recipe already holds the maximum number of community photos. */
  photoLimitReached: 409,
  /** A photo URL that is not an https:// address. */
  invalidImageUrl: 400,
  /** A proposal without the sample photograph that gives it evidence. */
  sampleUrlRequired: 400,
  /**
   * Proposal settings or white balance the camera schema rejects — out of
   * range, a key from the other format, or the wrong format for the recipe.
   */
  invalidSettings: 400,
  /** A request body over the route's byte cap. Refused before it is parsed. */
  payloadTooLarge: 413,
  /** Persistence failed. Deliberately vague: the detail goes to the log. */
  saveFailed: 500,
  /** The control project could not be reached. Nothing was written. */
  controlUnavailable: 503,
  /** The content project could not confirm the recipe. Nothing was written. */
  contentUnavailable: 503,
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
  // Own keys only: `in` walks the prototype, so 'constructor' and 'toString'
  // passed and rendered as a raw `errors.constructor` key path.
  return typeof value === 'string' && Object.hasOwn(COMMUNITY_ERRORS, value);
}

/** What the client renders: a known code, or `community.errors.unknown`. */
export type CommunityAlertCode = CommunityErrorCode | 'unknown';

/**
 * The code a non-2xx community response carries, for `community.errors.*`.
 *
 * One reader for every caller, because each one used to decide for itself and
 * most decided to say nothing: the recipe page acted only on `res.ok`, so a
 * 429, an expired session or an outage left the button reset, the draft in
 * place and no word of why. A body that is not JSON — a proxy's error page —
 * is `unknown`, never an exception the caller forgets to catch.
 */
export async function communityErrorOf(res: Response): Promise<CommunityAlertCode> {
  const data: unknown = await res.json().catch(() => null);
  const code = (data as { error?: unknown } | null)?.error;
  return isCommunityErrorCode(code) ? code : 'unknown';
}

/**
 * Which plane just failed, if either did.
 *
 * The community routes now touch both projects on a single write — the content
 * plane to confirm the recipe exists, the control plane to store the row — and
 * they have to say which one is down, because the two mean different things to
 * a reader and different things to whoever is on call. Everything else stays
 * `saveFailed`: a constraint violation or a bug here is not an outage, and
 * dressing it up as one would send someone to look at a healthy project.
 *
 * Returns `null` for anything that is not one of the two typed outages, so the
 * caller keeps its existing default rather than guessing.
 */
export function outageErrorCode(error: unknown): CommunityErrorCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'controlUnavailable' || code === 'contentUnavailable') return code;
  return null;
}
