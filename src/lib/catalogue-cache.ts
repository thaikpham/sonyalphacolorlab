import { unstable_cache } from 'next/cache';

/**
 * The one cache the catalogue reads share.
 *
 * `next: { revalidate }` and a route-level `export const revalidate` cannot do
 * this job: supabase-js sends an `Authorization` header on every call, which
 * makes Next mark the fetch uncacheable and opts the route out of the data
 * cache entirely. `reddit/client.ts` already writes that diagnosis up for a
 * third-party API; this is the same fix for the source it matters more for.
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
 * Sixty seconds, and not longer, because nothing calls `revalidateTag` yet: the
 * admin editor writes straight to Supabase, so this interval IS how long an
 * edit takes to show. The tag is declared so wiring that up is one line in the
 * write route.
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
