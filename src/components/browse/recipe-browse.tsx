import { getTranslations } from 'next-intl/server';
import { RecipeCard } from '@/components/recipe-card';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import {
  browseFilters,
  facetCounts,
  hasBrowseFilters,
  matchesBrowse,
  type BrowseFilters,
} from '@/lib/recipes/browse';
import { listRecipes, matchesLegacyFilters, matchesQuery, type RecipeView } from '@/lib/recipes/source';
import { SITUATIONS, type SituationId } from '@/lib/recipes/taxonomy';
import { BrowseFilterRow } from './browse-filters';
import { SituationTiles } from './situation-tiles';

/** What one request to `/colorlab` or `/colorlab/[situation]` carries. */
export type BrowseSearchParams = Record<string, string | string[] | undefined>;

export type BrowseModel = {
  readonly filters: BrowseFilters;
  /** The whole published catalogue, for the tiles. */
  readonly all: readonly RecipeView[];
  /** What the filters leave. */
  readonly recipes: readonly RecipeView[];
  readonly facets: ReturnType<typeof facetCounts>;
};

/**
 * One catalogue read, then everything in memory.
 *
 * `listRecipes(locale)` is `unstable_cache` keyed by its arguments, and the
 * header pushes `?q=` after every typing pause — so "mojave" used to be up to
 * six cache misses, each a recipes select plus a translations read, and any
 * `?q=` from anyone added an entry. Nothing new goes into that key: the text
 * match, the four groups and the legacy `?look=`/`?tag=` of the previous
 * catalogue (one more release, then gone) all run here. `?format=` is not
 * legacy any more: it is the colour-system group, read by `browseFilters`.
 */
export async function loadBrowse(locale: Locale, situation: SituationId | null, sp: BrowseSearchParams): Promise<BrowseModel> {
  const filters = browseFilters(situation, sp);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const legacy = {
    look: one(sp.look),
    tag: one(sp.tag),
  };

  const all = await listRecipes(locale);
  const narrowed = all
    .filter((r) => matchesLegacyFilters(r, legacy))
    .filter((r) => !filters.q || matchesQuery(r, filters.q));

  return {
    filters,
    all,
    recipes: narrowed.filter((r) => matchesBrowse(r, filters)),
    facets: facetCounts(narrowed, filters),
  };
}

/**
 * The catalogue, browsed.
 *
 * Shared by `/colorlab` and `/colorlab/[situation]`, so the filter row, the
 * tiles and the grid are one implementation. The only difference between the
 * two routes is the heading: the index names the catalogue, a situation page
 * names its situation.
 */
export async function RecipeBrowse({ model, title }: { model: BrowseModel; title: string }) {
  const { filters, all, recipes, facets } = model;
  const [t, tSearch, tBrowse] = await Promise.all([
    getTranslations('home'),
    getTranslations('search'),
    getTranslations('browse'),
  ]);
  const situationLabels = Object.fromEntries(
    SITUATIONS.map((id) => [id, tBrowse(`situations.${id}`)]),
  ) as Record<SituationId, string>;
  const landing = !hasBrowseFilters(filters);

  return (
    <main className="mx-auto w-full max-w-[160rem] flex-1 inset-safe pt-8 pb-24 flex flex-col gap-6">
      {/* `.hero-block`: on a phone turned sideways (or a split-screen pane)
          the padding collapses and the title steps down to `title-1`, because
          this block otherwise costs a full screen of scrolling before the
          first recipe. The rule is in globals.css; this is the block it was
          written for. Nothing over the h1: a line above it is removed copy. */}
      <div className="hero-block flex flex-col gap-3">
        <h1 className="text-display font-extrabold tracking-[-0.02em] leading-[1.08] text-ink text-pretty">
          {title}
        </h1>
      </div>

      <BrowseFilterRow filters={filters} facets={facets} total={recipes.length} />

      {landing ? <SituationTiles recipes={all} /> : null}

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
          {t('emptyTail', { total: all.length })}
          {/* A query no recipe answers may still be answered elsewhere on
              the site — "ISO Auto" is an article, "a7cii" a camera. */}
          {filters.q ? (
            <>
              {' '}
              <Link
                href={{ pathname: '/search', query: { q: filters.q } }}
                className="text-accent-400 underline underline-offset-4"
              >
                {tSearch('searchEverything', { query: filters.q })}
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <section aria-labelledby="browse-grid" className="flex flex-col gap-4">
          {landing ? (
            <h2 id="browse-grid" className="text-title-3 font-semibold text-ink">
              {t('title')}
            </h2>
          ) : (
            <h2 id="browse-grid" className="sr-only">
              {t('resultCount', { count: recipes.length })}
            </h2>
          )}
          {/* Full-bleed, 1 / 2 / 3 / 4 / 5 / 6. `3xl` and `4xl` are real
              screens declared in `@theme`; the inline `min-[2100px]:` form
              generates no rule at all, so it must not be "simplified" back
              to that. */}
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6">
            {recipes.map((r) => (
              <li key={r.id}>
                <RecipeCard recipe={r} situationLabels={situationLabels} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
