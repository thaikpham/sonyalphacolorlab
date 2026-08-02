import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notoSans, notoSansMono } from '../fonts';
import { AuthProvider } from '@/components/auth-context';
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

/**
 * `viewportFit: 'cover'` lets the page paint under a notch and the home
 * indicator, which is where the extra screen space comes from — the layout then
 * pays it back with `env(safe-area-inset-*)` padding so nothing is ever clipped.
 *
 * `interactiveWidget: 'resizes-content'` makes the on-screen keyboard shrink the
 * layout rather than scroll it out from under itself.
 */
export const viewport: Viewport = {
  themeColor: '#0b0d12',
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

  /**
   * Only the namespaces client components actually use are sent to the browser.
   * The default ships the entire catalogue — a recipe page was carrying the
   * homepage's headline copy, and every namespace added would have been paid
   * for on every page load by every visitor.
   *
   * Server components read messages server-side and are unaffected. If a client
   * component starts using a new namespace, add it here or its labels render as
   * the raw key.
   */
  const messages = await getMessages();
  const clientMessages = {
    auth: messages.auth,
    community: messages.community,
    language: messages.language,
    nav: messages.nav,
    recipe: messages.recipe,
    search: messages.search,
    tweak: messages.tweak,
  };

  return (
    <html
      lang={locale}
      className={`${notoSans.variable} ${notoSansMono.variable} h-full antialiased`}
    >
      <body className="app-shell font-sans min-h-screen-dynamic flex flex-col">
        <NextIntlClientProvider messages={clientMessages}>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
