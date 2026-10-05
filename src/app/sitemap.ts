import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { listSlugs } from '@/lib/recipes/source';
import { getSonyAudio } from '@/lib/audio/data';
import { getSonyCameras } from '@/lib/cameras/data';
import { ARTICLE_LANG } from '@/lib/lab/articles';
import { getPublishedArticles, getPublishedKnowledge } from '@/lib/lab/data';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Path for a locale under the `as-needed` prefix scheme. */
const path = (locale: string, rest: string) =>
  locale === routing.defaultLocale ? rest : `/${locale}${rest}`;

/**
 * Every indexable page, and nothing else.
 *
 * Absent on purpose: `/search` (a view of other pages, `noindex`),
 * `/cameras/compare` and every filtered URL (query-string views of a listed
 * page), `/admin`, drafts, and the API.
 *
 * Two kinds of entry (ADR 0004). A page whose content is genuinely bilingual
 * — the catalogues, recipes, products, the glossary — is listed once per
 * locale with both as alternates. A page whose body is authored Vietnamese on
 * every locale — a blog article, a knowledge page — is listed once, at its
 * canonical Vietnamese URL, with no alternates: the English route is the same
 * article under English chrome, not a translation of it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, audio, cameras, articles, knowledge] = await Promise.all([
    listSlugs(),
    getSonyAudio(),
    getSonyCameras(),
    // Published only, and from the store rather than the seed: an article an
    // editor unpublished must leave the sitemap, or a crawler keeps asking for
    // a URL that now 404s.
    getPublishedArticles(),
    getPublishedKnowledge(),
  ]);

  // Each bilingual URL declares its counterparts via `alternates.languages`,
  // so search engines treat the two locales as one page in two languages
  // rather than duplicate content.
  const alternatesFor = (rest: string) => ({
    languages: Object.fromEntries(
      routing.locales.map((l) => [l, `${SITE}${path(l, rest)}`]),
    ),
  });

  const bilingual = (
    rest: string,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: number,
  ) =>
    routing.locales.map((locale) => ({
      url: `${SITE}${path(locale, rest)}`,
      changeFrequency,
      priority,
      alternates: alternatesFor(rest),
    }));

  /** The one URL a Vietnamese-bodied page is indexed under. */
  const vietnamese = (
    rest: string,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: number,
  ) => ({ url: `${SITE}${path(ARTICLE_LANG, rest)}`, changeFrequency, priority });

  return [
    // The launcher. Static, and the entry point to all the apps.
    ...bilingual('/', 'monthly', 1),

    /* The recipe catalogue, which used to be `/`. It carries the search and
       filter surface and every recipe link, so it keeps the crawl priority the
       root had. */
    ...bilingual('/colorlab', 'weekly', 1),
    ...slugs.flatMap((slug) => bilingual(`/recipe/${slug}`, 'monthly', 0.8)),

    /* Sony Wiki — the camera, lens and accessory catalogue. Missing until this
       revision: the catalogue and its 94 product pages were prerendered,
       linked from the launcher, and never listed here. */
    ...bilingual('/cameras', 'monthly', 0.8),
    ...cameras.flatMap((c) => bilingual(`/cameras/${c.id}`, 'yearly', 0.6)),

    // The headphone & speaker wiki, and a page per product.
    ...bilingual('/audio', 'monthly', 0.8),
    ...audio.flatMap((p) => bilingual(`/audio/${p.id}`, 'yearly', 0.6)),

    /* Alpha Tech Blogs. The feed carries a query string in use, but the
       canonical URL is the unfiltered one — a sitemap listing `?topic=af`
       would ask a crawler to index eleven near-identical pages. */
    ...bilingual('/blog', 'weekly', 0.9),
    ...articles.map((a) => vietnamese(`/blog/${a.id}`, 'monthly', 0.8)),
    // The setup tool. A reference page people link to, so it ranks with the feed.
    ...bilingual('/blog/setup', 'monthly', 0.9),

    /* The reference shelf (ADR 0001). The hub and the glossary are bilingual;
       authored knowledge pages are Vietnamese-bodied like articles. */
    ...bilingual('/learn', 'weekly', 0.8),
    ...bilingual('/learn/glossary', 'monthly', 0.8),
    ...knowledge.map((k) => vietnamese(`/learn/${k.id}`, 'monthly', 0.8)),
  ];
}
