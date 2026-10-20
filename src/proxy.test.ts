import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

/* Next's own compiler for `config.matcher`, so this tests the regexp the
   router actually runs, not a hand-translation of the source string. It is
   exported from the module but absent from its type declarations. */
const { getMiddlewareMatchers } = createRequire(import.meta.url)(
  'next/dist/build/analysis/get-page-static-info',
) as {
  getMiddlewareMatchers: (matcher: string[], nextConfig: object) => { regexp: string }[];
};

/* The middleware itself imports `next/server` without an extension, which
   Node's resolver refuses outside a Next build. Only `config` is under test. */
vi.mock('next-intl/middleware', () => ({ default: () => () => undefined }));

const { config } = await import('./proxy');

/**
 * Which paths reach the locale middleware.
 *
 * A metadata route missing from the exclusion 404s silently — the locale
 * rewrite swallows it and nothing errors — and `/admin` missing from it is a
 * redirect loop. Nothing pinned the list, so dropping `icon` from the
 * lookahead passed the whole suite.
 */
const [matcher] = getMiddlewareMatchers(config.matcher, {});
const reachesProxy = (path: string) => new RegExp(matcher.regexp).test(path);

describe('the proxy matcher', () => {
  it.each([
    '/icon',
    '/apple-icon',
    '/opengraph-image',
    '/admin',
    '/admin/blog',
    '/api/search',
    '/api/search/predictive',
    '/_next/static/chunks/main.js',
    '/sitemap.xml',
    '/robots.txt',
    '/manifest.webmanifest',
    '/fonts/noto-sans/latin-400.woff2',
  ])('leaves %s alone', (path) => {
    expect(reachesProxy(path)).toBe(false);
  });

  it.each(['/', '/vi', '/colorlab', '/vi/colorlab', '/recipe/mojave-sun', '/vi/recipe/mojave-sun', '/cameras/a7-iv', '/search'])(
    'negotiates the locale for %s',
    (path) => {
      expect(reachesProxy(path)).toBe(true);
    },
  );

  it('lets a recipe’s social card through without a redirect', () => {
    /* Next fills the `[locale]` param into the og:image URL, so an English
       recipe's card is `/en/recipe/<slug>/opengraph-image-<hash>`. Through the
       middleware, `as-needed` 307s that `/en/` away — a hop per scrape, and
       some scrapers do not follow it. Unmatched, it hits the route directly,
       where `[locale]` is already in the path. */
    expect(reachesProxy('/en/recipe/mojave-sun/opengraph-image-1x2y3z')).toBe(false);
    expect(reachesProxy('/vi/recipe/mojave-sun/opengraph-image-1x2y3z')).toBe(false);
  });
});
