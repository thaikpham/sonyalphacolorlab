import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/components/auth-context';
import { HtmlLang } from '@/components/html-lang';

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
    language: messages.language,
    launcher: messages.launcher,
    nav: messages.nav,
    recipe: messages.recipe,
    search: messages.search,
    tweak: messages.tweak,
  };

  return (
    <NextIntlClientProvider messages={clientMessages}>
      {/* `<html>` lives in the root layout, above this segment, so a soft
          navigation between locales never re-renders its `lang`. */}
      <HtmlLang />
      <AuthProvider>{children}</AuthProvider>
    </NextIntlClientProvider>
  );
}
