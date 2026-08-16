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
        <div className="hero-block flex flex-col gap-3">
          {/* Sony menu names. Technical terms are never translated and stay
              out of the catalogues (rule 3) — the same literal pair that
              `structured-data.tsx` writes. */}
          <p className="text-label font-semibold uppercase tracking-[0.08em] text-community">
            Picture Profile &amp; Creative Look
          </p>
          <h1 className="text-display font-extrabold tracking-[-0.02em] leading-[1.08] text-ink text-pretty">
            {t('title')}
          </h1>
          <p className="hero-intro text-body-lg text-ink-muted max-w-[58ch] leading-[1.5] text-pretty">
            {t('lede')}
          </p>
        </div>

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
