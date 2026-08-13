import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { listSlugs } from '@/lib/recipes/source';
import { getSonyAudio } from '@/lib/audio/data';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Path for a locale under the `as-needed` prefix scheme. */
const path = (locale: string, rest: string) =>
  locale === routing.defaultLocale ? rest : `/${locale}${rest}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await listSlugs();
  const audio = await getSonyAudio();

  // Each URL declares its counterparts via `alternates.languages`, so search
  // engines treat the two locales as one page in two languages rather than
  // duplicate content.
  const alternatesFor = (rest: string) => ({
    languages: Object.fromEntries(
      routing.locales.map((l) => [l, `${SITE}${path(l, rest)}`]),
    ),
  });

  // The launcher. Static, and the entry point to all four apps.
  const home = routing.locales.map((locale) => ({
    url: `${SITE}${path(locale, '/')}`,
    changeFrequency: 'monthly' as const,
    priority: 1,
    alternates: alternatesFor('/'),
  }));

  /* The recipe catalogue, which used to be `/`. It carries the search and
     filter surface and every recipe link, so it keeps the crawl priority the
     root had — the launcher is four links and changes about once a year. */
  const catalogue = routing.locales.map((locale) => ({
    url: `${SITE}${path(locale, '/colorlab')}`,
    changeFrequency: 'weekly' as const,
    priority: 1,
    alternates: alternatesFor('/colorlab'),
  }));

  const recipes = routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({
      url: `${SITE}${path(locale, `/recipe/${slug}`)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      alternates: alternatesFor(`/recipe/${slug}`),
    })),
  );

  // The headphone & speaker wiki, and a page per product.
  const audioIndex = routing.locales.map((locale) => ({
    url: `${SITE}${path(locale, '/audio')}`,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
    alternates: alternatesFor('/audio'),
  }));

  const audioProducts = routing.locales.flatMap((locale) =>
    audio.map((p) => ({
      url: `${SITE}${path(locale, `/audio/${p.id}`)}`,
      changeFrequency: 'yearly' as const,
      priority: 0.6,
      alternates: alternatesFor(`/audio/${p.id}`),
    })),
  );

  return [...home, ...catalogue, ...recipes, ...audioIndex, ...audioProducts];
}
