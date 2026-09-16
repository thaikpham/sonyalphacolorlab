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
   * `/manifest.webmanifest` is already covered by the extension rule.
   *
   * `/admin` is excluded for a different reason. It is a route tree of its own
   * outside the `[locale]` segment, and `localePrefix: 'as-needed'` would
   * rewrite the bare `/admin` to `/en/admin` — back into `[locale]`, onto the
   * pages that now redirect to here, which is a loop. The admin document names
   * its own `lang`; it has no locale for this middleware to negotiate.
   */
  matcher: ['/((?!api|admin|_next|_vercel|icon|apple-icon|opengraph-image|twitter-image|sitemap|robots|.*\\..*).*)'],
};
