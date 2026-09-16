import { unstable_cache } from 'next/cache';

/**
 * The one cache the catalogue reads share.
 *
 * `next: { revalidate }` and a route-level `export const revalidate` cannot do
 * this job: supabase-js sends an `Authorization` header on every call, which
 * makes Next mark the fetch uncacheable and opts the route out of the data
 * cache entirely. The fix is this module: cache the parsed catalogue in
 * process, keyed and revalidated here, rather than hoping Next will cache a
 * request it has already decided it cannot.
 *
 * It earns its keep on what stays dynamic after the prerender fix — `/colorlab`
 * and `/cameras/compare` read `searchParams`, and the route handlers render per
 * request. The worst of those is `/api/search/predictive`, which reads a whole
 * catalogue to return five suggestions, once per keystroke behind a 120ms
 * debounce. Measured from an empty `.next/cache`: 12 predictive requests caused
 * one Supabase round trip instead of twelve.
 *
 * Shared rather than copied into each data module because the interval below is
 * a product decision, not a local one, and three copies of it would drift.
 *
 * Sixty seconds is now the backstop, not the save latency: the product write
 * routes call `revalidateTag(CATALOGUE_TAG, IMMEDIATE)` once a write has
 * committed, so an edit is visible on the next request. The interval only
 * covers a change made outside the app.
 */
export const CATALOGUE_TAG = 'catalogue';
export const CATALOGUE_TTL_SECONDS = 60;

export const catalogueCache = <A extends unknown[], R>(
  keyPart: string,
  read: (...args: A) => Promise<R>,
) =>
  unstable_cache(read, [keyPart], {
    revalidate: CATALOGUE_TTL_SECONDS,
    tags: [CATALOGUE_TAG],
  });

/**
 * What a write route passes to `revalidateTag`, and why it is not `'max'`.
 *
 * Next 16 requires the second argument — a bare `revalidateTag(tag)` is
 * deprecated — and the deprecation notice names `'max'`. `'max'` is wrong here.
 * The argument is a cache-life profile saying how long stale content may still
 * be served *after* the tag is invalidated, and `'max'` is the longest one
 * there is: measured against a real publish, the first request for the new
 * article's URL still read the pre-write list and answered a not-found page,
 * while the feed a moment later listed it. An editor pressing "view live" the
 * instant they save is the likeliest first reader of that URL, so the default
 * was failing exactly the person checking the work.
 *
 * `updateTag` is the API for read-your-own-writes and would be the better call,
 * but it throws outside a Server Action and these are route handlers. An
 * explicit zero-second expiry is the same intent the profile vocabulary can
 * express.
 *
 * It lives here, in the neutral cache module, rather than in `lab/data.ts`:
 * the product routes need it too, and importing a blog module to save a lens
 * spec is the kind of coupling that makes someone copy the constant instead.
 */
export const IMMEDIATE = { expire: 0 } as const;
