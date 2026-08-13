import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteStructuredData } from '@/components/structured-data';
import { RecipeCard } from '@/components/recipe-card';
import { SiteHeader } from '@/components/site-header';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { listRecipes, listTags } from '@/lib/recipes/source';

/**
 * The recipe catalogue.
 *
 * This was `/` until the root became the four-app launcher. It moved rather
 * than being duplicated, so the browse grid, its filters and its structured
 * data are all still one implementation — `/` now renders tiles and nothing
 * else. The legacy `/?id=scl-001` redirects are unaffected: they match on the
 * query parameter and resolve to `/recipe/<slug>`, never to this page.
 */
export default async function ColorLabPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ format?: string; look?: string; tag?: string; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const format = sp.format === 'pp' || sp.format === 'cl' ? sp.format : undefined;

  const [t, recipes, tags] = await Promise.all([
    getTranslations('home'),
    listRecipes(locale, { format, look: sp.look, tag: sp.tag, q: sp.q }),
    listTags(),
  ]);

  /* The catalogue total is read by one string in the empty state, so it is
     fetched only when that string renders. It used to sit in the `Promise.all`
     above: a second unfiltered `listRecipes` — a full Supabase round trip, then
     `toView` and an accent computed per recipe — on every render of a page that
     discards it the moment the grid has anything in it. */
  const total = recipes.length === 0 ? (await listRecipes(locale)).length : 0;

  return (
    <>
      <SiteHeader tags={tags} />
      <SiteStructuredData locale={locale} />

      <main className="mx-auto w-full max-w-[160rem] flex-1 inset-safe pt-4 pb-24 px-4 sm:px-6 lg:px-8">
        <h1 className="sr-only">Alpha ColorLab — Sony Alpha Colour Recipes</h1>

        {recipes.length === 0 ? (
          <p className="py-20 text-center text-ink-muted">
            {t('emptyTitle')}{' '}
            {/* Clears every filter, which means this page with no query — not
                `/`, which is now the launcher and would drop the reader out of
                the app they are searching in. */}
            <Link href="/colorlab" className="text-ink underline underline-offset-4">
              {t('emptyAction')}
            </Link>{' '}
            {t('emptyTail', { total })}
          </p>
        ) : (
          <>
            <h2 className="sr-only">{t('resultCount', { count: recipes.length })}</h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6">
              {recipes.map((r) => (
                <li key={r.id}>
                  <RecipeCard recipe={r} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
