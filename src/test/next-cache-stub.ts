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

/** No cache to invalidate, so nothing to do. */
export const revalidateTag = (_tag: string): void => {};
export const revalidatePath = (_path: string): void => {};
