import type { RecipeView } from '@/lib/recipes/source';

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

export function SiteStructuredData({ locale }: { locale: string }) {
  const home = locale === 'en' ? SITE : `${SITE}/${locale}`;
  return (
    <Ld
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Alpha ColorLab',
        url: home,
        inLanguage: locale,
        description:
          'White Balance Shift recipes for Sony Alpha cameras, paired with Picture Profile or Creative Look.',
        // Declared because the site has a real GET search endpoint at `?q=`.
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${home}/?q={search_term_string}` },
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
          about: {
            '@type': 'Thing',
            name: 'Sony Alpha camera colour settings',
          },
        }}
      />
      <Ld
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Alpha ColorLab', item: home },
            { '@type': 'ListItem', position: 2, name: recipe.name, item: url },
          ],
        }}
      />
    </>
  );
}
