import type { Metadata } from 'next';
import { bilingualAlternates } from '@/i18n/alternates';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteStructuredData } from '@/components/structured-data';
import { RecipeCard } from '@/components/recipe-card';
import { SiteHeader } from '@/components/site-header';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { listRecipes, listTags, matchesQuery } from '@/lib/recipes/source';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  /* Without this the route inherited the layout's English description, so
     /vi/colorlab described itself in English and its tab named no page. */
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: bilingualAlternates(locale, '/colorlab'),
  };
}

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
  searchParams: Promise<Record<'format' | 'look' | 'tag' | 'q', string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  /* A repeated parameter (`?q=a&q=b`) arrives as an array; the first wins. */
  const sp = Object.fromEntries(
    Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as { format?: string; look?: string; tag?: string; q?: string };
  const format = sp.format === 'pp' || sp.format === 'cl' ? sp.format : undefined;

  const [t, tSearch, filtered, tags] = await Promise.all([
    getTranslations('home'),
    getTranslations('search'),
    listRecipes(locale, { format, look: sp.look, tag: sp.tag }),
    listTags(),
  ]);

  /* The text match runs here, not inside `listRecipes`. That read is
     `unstable_cache` keyed by its arguments, and the header pushes `?q=` after
     every typing pause, so "mojave" was up to six misses — each a recipes
     select plus a translations read on the content project — and any `?q=`
     from anyone added an entry. `listRecipes` matched in JS anyway, with this
     same function, so the result is unchanged. */
  const q = sp.q?.trim() ?? '';
  const recipes = q ? filtered.filter((r) => matchesQuery(r, q)) : filtered;

  /* The catalogue total is read by one string in the empty state, so it is
     fetched only when that string renders. It used to sit in the `Promise.all`
     above: a second unfiltered `listRecipes` — a full Supabase round trip, then
     `toView` and an accent computed per recipe — on every render of a page that
     discards it the moment the grid has anything in it. */
  const total = recipes.length === 0 ? (await listRecipes(locale)).length : 0;

  return (
    <>
      <SiteHeader tags={tags} />
      <SiteStructuredData locale={locale} description={t('metaDescription')} />

      <main className="mx-auto w-full max-w-[160rem] flex-1 inset-safe pt-8 pb-24 flex flex-col gap-6">
        {/* The page lede. The h1 used to be `sr-only` carrying an untranslated
            literal, because nothing on the page named it; the document title
            already says "Alpha ColorLab", so the heading is now the visible
            one and there is still exactly one h1 above the sr-only h2. */}
        {/* `.hero-block` / `.hero-intro`: on a phone turned sideways (or a
            split-screen pane) the padding collapses, the title steps down to
            `title-1` and the lede is hidden, because this block otherwise costs
            a full screen of scrolling before the first recipe. The rule is in
            globals.css; this is the block it was written for. */}
        {/* No eyebrow: the "Picture Profile & Creative Look" line that sat
            over the h1 is the copy CLAUDE.md removed, and was uppercase over
            four words. */}
        <div className="hero-block flex flex-col gap-3">
          <h1 className="text-display font-extrabold tracking-[-0.02em] leading-[1.08] text-ink text-pretty">
            {t('title')}
          </h1>
        </div>

        {recipes.length === 0 ? (
          /* `break-words`: the query is echoed below, and a pasted URL is one
             unbreakable token that pushed a phone-width page sideways. */
          <p className="py-20 text-center text-ink-muted break-words">
            {t('emptyTitle')}{' '}
            {/* Clears every filter, which means this page with no query — not
                `/`, which is now the launcher and would drop the reader out of
                the app they are searching in. */}
            <Link href="/colorlab" className="text-ink underline underline-offset-4">
              {t('emptyAction')}
            </Link>{' '}
            {t('emptyTail', { total })}
            {/* A query no recipe answers may still be answered elsewhere on
                the site — "ISO Auto" is an article, "a7cii" a camera. */}
            {q ? (
              <>
                {' '}
                <Link
                  href={{ pathname: '/search', query: { q } }}
                  className="text-accent-400 underline underline-offset-4"
                >
                  {tSearch('searchEverything', { query: q })}
                </Link>
              </>
            ) : null}
          </p>
        ) : (
          <>
            <h2 className="sr-only">{t('resultCount', { count: recipes.length })}</h2>
            {/* Full-bleed, 1 / 2 / 3 / 4 / 5 / 6. `3xl` and `4xl` are real
                screens declared in `@theme`; the inline `min-[2100px]:` form
                generates no rule at all, so it must not be "simplified" back
                to that. */}
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6">
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
