import createMiddleware from 'next-intl/middleware';

// Renamed from middleware.ts: Next 16 deprecated that convention in favour of
// `proxy`. next-intl still exports createMiddleware — only the file name moved.
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  /**
   * Skip API routes, Next internals, and anything with a file extension.
   *
   * Generated metadata routes must be excluded by name: `/icon`,
   * `/opengraph-image` and friends have no file extension, so the
   * `.*\\..*` escape does not catch them and the locale rewrite swallows
   * them — the icon 404s and social cards lose their image, silently.
   * `proxy.test.ts` pins the list against Next's own matcher compiler.
   * `/manifest.webmanifest` is already covered by the extension rule.
   *
   * A NESTED `opengraph-image` is excluded too, anywhere in the path. Next
   * fills the `[locale]` param into the og:image URL, so an English recipe's
   * card is `/en/recipe/<slug>/opengraph-image-<hash>` — and through this
   * middleware `as-needed` 307s the `/en/` away, a redirect hop on every
   * scrape that some scrapers do not follow. Unmatched, the request reaches
   * the route directly, with the locale already in its path.
   *
   * `/admin` is excluded for a different reason. It is a route tree of its own
   * outside the `[locale]` segment, and `localePrefix: 'as-needed'` would
   * rewrite the bare `/admin` to `/en/admin` — back into `[locale]`, onto the
   * pages that now redirect to here, which is a loop. The admin document names
   * its own `lang`; it has no locale for this middleware to negotiate.
   *
   * `/md` is the Markdown twin's route handler, reached by a rewrite from
   * `/vi/blog/<id>.md`; hit directly it must not be locale-routed either.
   */
  matcher: [
    '/((?!api|admin|md|_next|_vercel|icon|apple-icon|opengraph-image|twitter-image|sitemap|robots|.*/opengraph-image|.*\\..*).*)',
  ],
};
