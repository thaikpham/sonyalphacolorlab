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
   */
  matcher: ['/((?!api|_next|_vercel|icon|apple-icon|opengraph-image|twitter-image|sitemap|robots|.*\\..*).*)'],
};
