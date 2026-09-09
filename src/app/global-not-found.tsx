import Link from 'next/link';
import { routing } from '@/i18n/routing';
import './globals.css';

/**
 * The 404 for anything that never reached the `[locale]` segment.
 *
 * `[locale]/not-found.tsx` handles a missing recipe or camera, where a locale
 * is known and the chrome is already mounted. This one answers requests that
 * matched no route at all, so it renders its own complete document — the root
 * layout above deliberately renders no element (see its header), which means
 * nothing else here supplies `<html>`.
 *
 * The locale is genuinely unknown at this point: there is no param to read and
 * `getLocale()` is exactly the `headers()` call that this restructuring removed.
 * So the copy stays in the default locale rather than reintroducing dynamic
 * rendering to translate a 404.
 */
export const metadata = {
  title: 'Not found · Alpha ColorLab',
};

export default function GlobalNotFound() {
  return (
    <html lang={routing.defaultLocale} className="h-full antialiased">
      <body className="app-shell font-sans min-h-screen-dynamic flex flex-col">
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">404</h1>
          <p className="text-body leading-relaxed text-ink-muted">
            This page does not exist.
          </p>
          {/* `next/link`, not `@/i18n/navigation` — this document renders
              outside the locale segment, so there is no request locale for the
              i18n wrapper to resolve a prefix against. */}
          <Link href="/" className="btn-glass inline-flex items-center justify-center px-5">
            Back to Alpha ColorLab
          </Link>
        </main>
      </body>
    </html>
  );
}
