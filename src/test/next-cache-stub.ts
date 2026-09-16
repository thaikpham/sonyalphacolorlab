/**
 * `next/cache`, for tests.
 *
 * `unstable_cache` reaches for Next's incremental cache and throws
 * `Invariant: incrementalCache missing in unstable_cache` when there isn't one
 * — which there never is under vitest, so wrapping the catalogue reads in it
 * broke five tests that only wanted to assert what those reads return.
 *
 * Stubbed rather than worked around in `source.ts`, for the same reason
 * `server-only` is stubbed beside it: the caching is a deployment concern of
 * the framework, and a runtime branch in application code to keep the suite
 * green would put test scaffolding in the shipped bundle. The identity function
 * is also the honest model — a cache miss is what every first call does, and
 * these tests assert the value, never that it was cached.
 */

/** Returns the function untouched: every call is a miss. */
export const unstable_cache = <T extends (...args: never[]) => unknown>(
  read: T,
  _keyParts?: string[],
  _options?: { revalidate?: number | false; tags?: string[] },
): T => read;

/**
 * No cache to invalidate, so nothing to do.
 *
 * Whether a route invalidates — and whether it does so only *after* the write
 * committed — is asserted in `content-write-boundaries.test.ts`, against the
 * source. That is the right level for it: executing these handlers would need
 * two live Supabase projects, and what has to hold is a property of the code.
 * A recording stub here would be a second mechanism for the same guarantee,
 * with nothing importing it.
 *
 * The second parameter is Next 16's required cache-life profile — accepted and
 * ignored, so a call written against the real signature type-checks and runs
 * identically here.
 */
export const revalidateTag = (_tag: string, _profile?: string | { expire?: number }): void => {};
export const revalidatePath = (_path: string): void => {};
