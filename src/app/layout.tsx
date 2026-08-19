import { getLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import './globals.css';

/**
 * Root layout required by Next.js 16 (Turbopack).
 * Renders top-level <html> and <body> elements for all routes including _not-found.
 *
 * `lang` is set here because this is the only place that owns the `<html>` tag —
 * the locale layout below renders no element to hang it on. It was missing
 * entirely, on both locales: `axe` counts that a serious `html-has-lang`
 * violation, and it is not cosmetic. A screen reader picks its phoneme set from
 * this attribute, so every Vietnamese page was being read aloud with English
 * pronunciation rules, and search engines lost the language signal on a site
 * whose whole navigation is a language switch.
 *
 * `getLocale()` resolves from the request, and falls back to the default for
 * routes rendered outside the `[locale]` segment — `_not-found` and
 * `_global-error`, which have no locale of their own.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let locale: string = routing.defaultLocale;
  try {
    locale = await getLocale();
  } catch {
    // Outside a locale-aware request; the default is the honest answer.
  }

  return (
    // The face comes from `@font-face` in globals.css, vendored into
    // public/fonts/noto-sans by `npm run fonts:vendor`. No next/font: it hashes
    // the family into a per-app variable, so the four apps in this ecosystem
    // could not name the same face — which is what "font không đồng đều" was.
    <html lang={locale} className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://nqeedlgzaewccqztqvik.supabase.co" />
        <link rel="preconnect" href="https://static.bhphoto.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://sony.scene7.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://nqeedlgzaewccqztqvik.supabase.co" />
        <link rel="dns-prefetch" href="https://static.bhphoto.com" />
        <link rel="dns-prefetch" href="https://sony.scene7.com" />
      </head>
      <body className="app-shell font-sans min-h-screen-dynamic flex flex-col">
        {children}
      </body>
    </html>
  );
}
