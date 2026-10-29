import { getTranslations } from 'next-intl/server';
import type { RecipeView } from '@/lib/recipes/source';
import type { Article } from '@/lib/lab/types';
import { ARTICLE_LANG } from '@/lib/lab/articles';
import { articleJsonLd } from '@/lib/lab/jsonld';

/**
 * JSON-LD structured data.
 *
 * Typed as `CreativeWork`, not `Recipe` — schema.org `Recipe` means food, and
 * claiming it would be describing the page as something it is not. `HowTo` was
 * also considered and rejected: it earns rich results only with step-by-step
 * markup this page does not have, and over-claiming risks a manual action.
 *
 * The JSON is serialised with `JSON.stringify` and the `<` escaped, so recipe
 * names cannot break out of the script tag.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Prevents a stray `</script>` in any string field from ending the block. */
function serialise(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function Ld({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // serialise() escapes `<`, so a recipe name cannot close the tag.
      // This is the documented way to emit JSON-LD in React.
      dangerouslySetInnerHTML={{ __html: serialise(data) }}
    />
  );
}

/**
 * `description` comes from the caller's `home.metaDescription`. It was an
 * English literal declared `inLanguage: locale`, so /vi/colorlab told search
 * engines its English sentence was Vietnamese.
 */
export function SiteStructuredData({ locale, description }: { locale: string; description: string }) {
  const home = locale === 'en' ? SITE : `${SITE}/${locale}`;
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Alpha ColorLab',
        url: home,
        inLanguage: locale,
        description,
        /* `/search` is the one page that answers `?q=` across everything. This
           used to name `/?q=`, which became the launcher when the catalogue
           moved to `/colorlab` — a SearchAction pointing at a page with no
           search on it. */
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${home}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  );
}

export function RecipeStructuredData({
  recipe,
  locale,
  url,
}: {
  recipe: RecipeView;
  locale: string;
  url: string;
}) {
  const home = locale === 'en' ? SITE : `${SITE}/${locale}`;
  return (
    <>
      <Ld
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: recipe.name,
          headline: recipe.name,
          description: recipe.description,
          url,
          inLanguage: locale,
          identifier: recipe.id,
          keywords: recipe.tags.join(', '),
          genre: recipe.format === 'pp' ? 'Picture Profile' : 'Creative Look',
          isPartOf: { '@type': 'WebSite', name: 'Alpha ColorLab', url: home },
          /* No `about`: its name was an English literal declared in the
             page's language, and `genre` already says what the work is. */
        }}
      />
      <Ld
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            /* The catalogue, where the page's own back link goes. The root is
               the four-app launcher now, not the parent of a recipe. */
            { '@type': 'ListItem', position: 1, name: 'Alpha ColorLab', item: `${home}/colorlab` },
            { '@type': 'ListItem', position: 2, name: recipe.name, item: url },
          ],
        }}
      />
    </>
  );
}

/**
 * A blog article (`BlogPosting`) or a knowledge page (`TechArticle`).
 *
 * What is declared is only what the store knows (ADR 0004): the body's
 * language is Vietnamese whatever the route's locale; `dateModified` is the
 * row's `updated_at` when there is one; there is no `datePublished`, because
 * nothing records when a draft became visible and `created_at` is when it was
 * started. The reviewed date is shown on the page and deliberately absent
 * here. The author is a display name with no credentials attached. The nodes
 * themselves are built by `articleJsonLd()` in `src/lib/lab/jsonld.ts`.
 */
export async function ArticleStructuredData({ article, path }: { article: Article; path: string }) {
  /* In the body's language, because the canonical URL is the Vietnamese one.
     `Alpha Tech Blogs` is a product name and is the same in both. */
  const learnTitle =
    article.kind === 'knowledge'
      ? (await getTranslations({ locale: ARTICLE_LANG, namespace: 'learn' }))('title')
      : '';

  return (
    <>
      {articleJsonLd(article, { site: SITE, path, learnTitle }).map((data, i) => (
        <Ld key={i} data={data} />
      ))}
    </>
  );
}
