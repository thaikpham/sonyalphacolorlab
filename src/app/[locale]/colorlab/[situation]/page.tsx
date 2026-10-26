import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { bilingualAlternates } from '@/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadBrowse, RecipeBrowse, type BrowseSearchParams } from '@/components/browse/recipe-browse';
import { SiteHeader } from '@/components/site-header';
import { MY_CAMERA_COOKIE } from '@/lib/cameras/my-camera-cookie';
import { routing, type Locale } from '@/i18n/routing';
import { parseSituation, SITUATIONS } from '@/lib/recipes/taxonomy';

/**
 * Every situation, in both locales. The pages read `searchParams`, so they
 * render on demand whatever is listed here; listing them still tells Next the
 * route's known values, and `dynamicParams` stays on so a situation added to
 * the taxonomy later is served before the next build.
 */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SITUATIONS.map((situation) => ({ locale, situation })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; situation: string }>;
}): Promise<Metadata> {
  const { locale, situation: raw } = await params;
  const situation = parseSituation(raw);
  if (!situation) return {};
  const t = await getTranslations({ locale, namespace: 'browse' });
  const name = t(`situations.${situation}`);
  return {
    title: name,
    description: t('metaDescription', { situation: name }),
    alternates: bilingualAlternates(locale, `/colorlab/${situation}`),
  };
}

/**
 * One situation's recipes: the same browse as `/colorlab`, with the situation
 * in the path (one address per result — `?situation=` is not read) and the
 * situation's name as the h1. An id the taxonomy does not know is a 404, and
 * a real one: no loading boundary sits above this route.
 */
export default async function SituationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; situation: string }>;
  searchParams: Promise<BrowseSearchParams>;
}) {
  const { locale, situation: raw } = await params;
  const situation = parseSituation(raw);
  if (!situation) notFound();
  setRequestLocale(locale);

  const [t, model] = await Promise.all([
    getTranslations('browse'),
    loadBrowse(locale, situation, await searchParams, (await cookies()).get(MY_CAMERA_COOKIE)?.value),
  ]);

  return (
    <>
      <SiteHeader />
      <RecipeBrowse model={model} title={t(`situations.${situation}`)} />
    </>
  );
}
