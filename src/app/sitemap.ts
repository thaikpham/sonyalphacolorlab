import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { listSlugs } from '@/lib/recipes/source';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Path for a locale under the `as-needed` prefix scheme. */
const path = (locale: string, rest: string) =>
  locale === routing.defaultLocale ? rest : `/${locale}${rest}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await listSlugs();

  // Each URL declares its counterparts via `alternates.languages`, so search
  // engines treat the two locales as one page in two languages rather than
  // duplicate content.
  const alternatesFor = (rest: string) => ({
    languages: Object.fromEntries(
      routing.locales.map((l) => [l, `${SITE}${path(l, rest)}`]),
    ),
  });

  const home = routing.locales.map((locale) => ({
    url: `${SITE}${path(locale, '/')}`,
    changeFrequency: 'weekly' as const,
    priority: 1,
    alternates: alternatesFor('/'),
  }));

  const recipes = routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({
      url: `${SITE}${path(locale, `/recipe/${slug}`)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      alternates: alternatesFor(`/recipe/${slug}`),
    })),
  );

  return [...home, ...recipes];
}
