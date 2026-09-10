import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/components/auth-context';
import { HtmlLang } from '@/components/html-lang';
/* The face comes from `@font-face` in globals.css, vendored into
   public/fonts/noto-sans by `npm run fonts:vendor`. No next/font: it hashes the
   family into a per-app variable, so the four apps in this ecosystem could not
   name the same face — which is what "font không đồng đều" was. */
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Alpha ColorLab',
    template: '%s · Alpha ColorLab',
  },
  description:
    'White Balance Shift recipes for Sony Alpha cameras, paired with Picture Profile or Creative Look.',
};

export const viewport: Viewport = {
  /* `--color-void`, restated as sRGB because this string is read by the OS
     browser chrome, not by CSS — it goes into a `<meta name="theme-color">`
     and an `oklch()` there is simply ignored. Same exemption as `icon.tsx`,
     `opengraph-image.tsx` and `manifest.ts`; keep it in step with the token. */
  themeColor: '#07080B',
  colorScheme: 'dark',
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for the static rendering of every page under this layout.
  setRequestLocale(locale);

  const messages = await getMessages();
  const clientMessages = {
    auth: messages.auth,
    cameras: messages.cameras,
    community: messages.community,
    error: messages.error,
    lab: messages.lab,
    language: messages.language,
    launcher: messages.launcher,
    nav: messages.nav,
    recipe: messages.recipe,
    search: messages.search,
    tweak: messages.tweak,
  };

  return (
    /* `<html>` lives HERE, not in the root layout above, and that placement is
       load-bearing rather than stylistic. `lang` needs the locale; the root
       layout has no `[locale]` param, so it could only get one from
       `getLocale()`, which reads `headers()`. Reading headers in the outermost
       layout opts the ENTIRE route tree out of static generation — every page
       became `ƒ` (server-rendered on demand), `generateStaticParams` below was
       dead, and every view re-queried Supabase. Here the locale arrives as a
       param that `generateStaticParams` already enumerates, so the same
       attribute costs no dynamic rendering. */
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
        <NextIntlClientProvider messages={clientMessages}>
          {/* Still needed: switching language is a soft navigation, and React
              does not re-render `<html>`'s attributes across one. */}
          <HtmlLang />
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
