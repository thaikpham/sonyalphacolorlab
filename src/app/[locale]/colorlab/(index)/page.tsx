import type { Metadata } from 'next';
import { bilingualAlternates } from '@/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadBrowse, RecipeBrowse, type BrowseSearchParams } from '@/components/browse/recipe-browse';
import { SiteStructuredData } from '@/components/structured-data';
import { SiteHeader } from '@/components/site-header';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  /* Without this the route inherited the layout's English description, so
     /vi/colorlab described itself in English and its tab named no page. */
  const [t, tBrowse] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'browse' }),
  ]);
  return {
    title: tBrowse('title'),
    description: t('metaDescription'),
    alternates: bilingualAlternates(locale, '/colorlab'),
  };
}

/**
 * The recipe catalogue, browsed by situation.
 *
 * This was `/` until the root became the four-app launcher. It moved rather
 * than being duplicated, so the browse grid, its filters and its structured
 * data are all still one implementation — `/` now renders tiles and nothing
 * else. The legacy `/?id=scl-001` redirects are unaffected: they match on the
 * query parameter and resolve to `/recipe/<slug>`, never to this page.
 *
 * It sits in the `(index)` route group so that its `loading.tsx` wraps this
 * page alone. `/colorlab/[situation]` is a sibling that answers `notFound()`
 * for an unknown id, and a loading boundary above it would flush a 200 shell
 * before the page could refuse (`next-boundaries.test.ts`).
 */
export default async function ColorLabPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<BrowseSearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tBrowse, model] = await Promise.all([
    getTranslations('home'),
    getTranslations('browse'),
    loadBrowse(locale, null, await searchParams),
  ]);

  return (
    <>
      <SiteHeader />
      <SiteStructuredData locale={locale} description={t('metaDescription')} />
      <RecipeBrowse model={model} title={tBrowse('title')} />
    </>
  );
}
