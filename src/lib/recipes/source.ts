/**
 * Recipe reads.
 *
 * Backed by the **content** project when Supabase is configured, and by the
 * migrated seed files when it is not. That is not a convenience — it is what
 * lets the site build, run and test with no credentials at all.
 *
 * The two are not interchangeable at runtime. Configuration alone decides, and
 * an online read that fails throws rather than reaching for the snapshot: see
 * `contentOrOfflineSeed`, which replaced a per-reader catch that would have
 * republished every recipe an administrator had unpublished since the last
 * commit, silently, for the duration of an outage.
 *
 * Everything above this module works in terms of `RecipeView`, so no component
 * knows or cares which source answered.
 */

import 'server-only';
import { cache } from 'react';
import { catalogueCache } from '../catalogue-cache';
import recipesSeed from '../../../data/recipes.seed.json';
import translationsSeed from '../../../data/translations.seed.json';
import { accentFor, type Accent } from '../camera/color';
import { paletteFor, type Palette } from '../camera/palette';
import { CREATIVE_LOOK_CODES } from '../camera/constants';
import { formatWhiteBalance } from '../camera/format';
import { RECIPE_TAG_RE, type Recipe } from '../camera/schema';
import { removeAccents } from '../search/fuzzy-search';
import { contentRead } from '../supabase/server';
import { contentOrOfflineSeed } from '../supabase/content-source';
import { fromRow, RECIPE_COLUMNS, type RecipeRow } from './row';
import { devListRecipes, isRecipeDevStore } from './dev-store';
import { recipeIdAliases } from './recipe-id';
import { slugFor } from './names';
import { designedLightFor, taxonomyFor } from './taxonomy-assign';
import { taxonomyTerms, type RecipeTaxonomy } from './taxonomy';

export type Locale = 'en' | 'vi';

export type RecipeView = Recipe &
  RecipeTaxonomy & {
    legacyId: string | null;
    /** Localised prose. Falls back to English when a translation is missing. */
    description: string;
    /** Pre-formatted for display, e.g. "7000K, B3-M1.5". */
    wbLabel: string;
    /** Derived from this recipe's own colour science. */
    accent: Accent;
    /**
     * Nine swatches graded by this recipe's own settings — the thumbnail, now
     * that no recipe carries a photograph. A reading of the settings in Sony's
     * documented directions, never a preview of the camera (`palette.ts`).
     */
    palette: Palette;
    /** Kelvin of the light the recipe is built for, or null for daylight — what the palette is read under. */
    light: number | null;
  };

export type RecipeFilters = { format?: 'pp' | 'cl'; look?: string; tag?: string; q?: string };

// ---------------------------------------------------------------------------
// Seed fallback
// ---------------------------------------------------------------------------

const compiledSeed = recipesSeed as unknown as (Recipe & { legacyId: string | null })[];

/**
 * The offline catalogue — exactly one source per environment.
 *
 * - **Online** — never reaches here; `contentOrOfflineSeed` calls the query.
 * - **Offline, development** — the file `/admin/colorlab` writes, so publishing
 *   a recipe on a laptop puts it on the site immediately. Without this the
 *   editor works offline and its results are invisible, which is a worse
 *   half-feature than no editor at all.
 * - **Offline, anywhere else** — the compiled snapshot, which is what the whole
 *   test suite and a credential-free build read.
 *
 * `isRecipeDevStore()` needs `NODE_ENV === 'development'` as well as an absent
 * Supabase, so `NODE_ENV=test` and a production build both take the snapshot
 * and no test result depends on a developer's scratch file.
 */
const seedRecipes = (): (Recipe & { legacyId: string | null })[] =>
  isRecipeDevStore()
    ? devListRecipes().map((r) => ({ ...r.recipe, legacyId: r.legacyId }))
    : compiledSeed;

const seedDescriptions = new Map(
  (translationsSeed as { recipeId: string; locale: string; description: string }[]).map((t) => [
    `${t.recipeId}:${t.locale}`,
    t.description,
  ]),
);

// ---------------------------------------------------------------------------
// Shared shaping
// ---------------------------------------------------------------------------

function toView(
  recipe: Recipe,
  legacyId: string | null,
  description: string,
): RecipeView {
  const light = designedLightFor(recipe.id);
  return {
    ...recipe,
    /* Situations, style and tone: the editor's manifest over the settings'
       own suggestion. Computed per view, not stored — there is no column yet. */
    ...taxonomyFor(recipe),
    legacyId,
    description,
    wbLabel: formatWhiteBalance(recipe.whiteBalance),
    accent: accentFor(recipe),
    palette: paletteFor(recipe, { light: light ?? undefined }),
    light,
  };
}

/**
 * Free-text search over name, tags and the browse taxonomy.
 *
 * Deliberately not over descriptions: those are prose and every recipe mentions
 * colour words, so including them makes almost any query match almost anything.
 * Diacritics are stripped, with the search engine's own fold, which also maps
 * `đ`: NFD leaves it whole, so "den trang" could not find "đen trắng".
 *
 * A recipe that carries its taxonomy (a `RecipeView`) also answers to every
 * synonym of its situations, style and tone in both languages — "cafe",
 * "chan dung", "phim", "đen trắng" — which is how the tags stopped being shown
 * without the search losing a word (D9).
 *
 * And to its code as a slug (`pp-009`), never to an earlier one: the name is
 * read off the settings now (`PP-009-Warm Deep Muted`) and the owner dropped
 * every name a recipe had before, so "mojave sun" finds nothing (R4 of the
 * 2026-10-28 names design). An old link still reaches the recipe; that is
 * `resolveRecipeSlug`'s job, not search's.
 */
const norm = (s: string) => removeAccents(s).toLowerCase();

export const matchesQuery = (r: Recipe & Partial<RecipeTaxonomy>, q: string) => {
  const needle = norm(q.trim());
  if (!needle) return true;
  const inherited =
    r.situations && r.style && r.tone
      ? taxonomyTerms({ situations: r.situations, style: r.style, tone: r.tone })
      : [];
  /* Both id spellings: `PP-009` and the `SCL-PP-009` readers knew for years. */
  const haystack = norm(
    [
      r.name,
      ...recipeIdAliases(r.id),
      slugFor(r.id).replace(/-/g, ' '),
      ...r.tags,
      ...inherited,
    ].join(' '),
  );
  // Every whitespace-separated term must appear.
  return needle.split(/\s+/).every((term) => haystack.includes(term));
};

/**
 * The query-string filters of the previous catalogue — `?look=` and `?tag=` —
 * still honoured for one release so a link shared before the situation browse
 * keeps answering, and then dropped. `format` stays accepted for callers of
 * `listRecipes`, but the browse no longer passes it: `?format=` is the
 * colour-system group now, read by `browseFilters`.
 */
export const matchesLegacyFilters = (r: Recipe, f: Omit<RecipeFilters, 'q'>) =>
  (!f.format || r.format === f.format) &&
  (!f.look || (r.format === 'cl' && r.settings.look === f.look)) &&
  (!f.tag || r.tags.includes(f.tag));

/**
 * Filters as they arrive from a query string: untrusted, and possibly arrays.
 *
 * `?q=a&q=b` is a string[] and `q.trim` threw. A `look` outside the enum or a
 * `tag` that is not a tag is not "no match" to Postgres but 22P02 or a
 * malformed array literal — which the reader reported as a content outage and
 * rendered as the error page. Neither can match a recipe, so `null` says the
 * answer is empty without asking.
 */
function cleanFilters(raw: RecipeFilters): RecipeFilters | null {
  const one = (v: unknown): string | undefined => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === 'string' && x !== '' ? x : undefined;
  };
  const [format, look, tag, q] = [one(raw.format), one(raw.look), one(raw.tag), one(raw.q)];
  if (format !== undefined && format !== 'pp' && format !== 'cl') return null;
  if (look !== undefined && !(CREATIVE_LOOK_CODES as readonly string[]).includes(look)) return null;
  if (tag !== undefined && !RECIPE_TAG_RE.test(tag)) return null;
  return { format, look, tag, q };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type TranslationRow = { recipe_id: string; locale: string; description: string };

/** Localised description with an English fallback, from a translation set. */
const pickDescription = (
  lookup: Map<string, string>,
  id: string,
  locale: Locale,
): string => lookup.get(`${id}:${locale}`) ?? lookup.get(`${id}:en`) ?? '';

export const listRecipes = catalogueCache('listRecipes', _listRecipes);

async function _listRecipes(
  locale: Locale = 'en',
  rawFilters: RecipeFilters = {},
): Promise<RecipeView[]> {
  const filters = cleanFilters(rawFilters);
  if (!filters) return [];

  const seed = () =>
    seedRecipes()
      .filter((r) => r.published && matchesLegacyFilters(r, filters))
      .map((r) => toView(r, r.legacyId, pickDescription(seedDescriptions, r.id, locale)))
      .filter((v) => !filters.q || matchesQuery(v, filters.q));

  return contentOrOfflineSeed('recipes.list', async () => {
  const db = contentRead();
  let query = db.from('recipes').select(RECIPE_COLUMNS).eq('published', true);
  if (filters.format) query = query.eq('format', filters.format);
  if (filters.look) query = query.eq('look', filters.look);
  if (filters.tag) query = query.contains('tags', [filters.tag]);

  const { data, error } = await query.order('id');
  if (error) throw new Error(`listRecipes: ${error.message}`);

  const rows = (data ?? []) as unknown as RecipeRow[];
  const lookup = await loadTranslations(rows.map((r) => r.id));
  const views = rows.map((row) =>
    toView(fromRow(row), row.legacy_id, pickDescription(lookup, row.id, locale)),
  );
  // Text matching happens here rather than in SQL: the catalogue is small enough
  // that a full-text index would be more moving parts than it earns, and this
  // keeps the seed and Supabase paths behaving identically. After `toView`, so
  // the query sees the taxonomy the seed path's `matches` also sees.
  return filters.q ? views.filter((v) => matchesQuery(v, filters.q!)) : views;
  }, seed);
}

async function loadTranslations(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await contentRead()
    .from('recipe_translations')
    .select('recipe_id, locale, description')
    .in('recipe_id', ids);
  if (error) throw new Error(`loadTranslations: ${error.message}`);
  return new Map(
    ((data ?? []) as TranslationRow[]).map((t) => [`${t.recipe_id}:${t.locale}`, t.description]),
  );
}

/**
 * One recipe, deduplicated across a single render pass.
 *
 * The detail route asks for the same row twice — once in `generateMetadata` and
 * once in the page body — and they are separate renders as far as this module
 * is concerned, so it was two Supabase round trips per view. React's `cache()`
 * memoizes per request, so the second caller gets the first one's promise.
 *
 * This is NOT a cache across requests: it lives and dies with the render, which
 * is why it is safe to apply to published content that an admin can edit. A
 * cross-request cache is a separate decision with its own invalidation.
 */
export const getRecipe = cache(catalogueCache('getRecipe', _getRecipe));

async function _getRecipe(slug: string, locale: Locale = 'en'): Promise<RecipeView | null> {
  const seed = () => {
    const found = seedRecipes().find((r) => r.slug === slug && r.published);
    return found
      ? toView(found, found.legacyId, pickDescription(seedDescriptions, found.id, locale))
      : null;
  };

  return contentOrOfflineSeed('recipes.get', async () => {
  const { data, error } = await contentRead()
    .from('recipes')
    .select(RECIPE_COLUMNS)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) throw new Error(`getRecipe: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as RecipeRow;
  const lookup = await loadTranslations([row.id]);
  return toView(fromRow(row), row.legacy_id, pickDescription(lookup, row.id, locale));
  }, seed);
}

export const listSlugs = catalogueCache('listSlugs', _listSlugs);

async function _listSlugs(): Promise<string[]> {
  const seed = () => seedRecipes().filter((r) => r.published).map((r) => r.slug);

  return contentOrOfflineSeed('recipes.slugs', async () => {
    const { data, error } = await contentRead()
      .from('recipes')
      .select('slug')
      .eq('published', true);
    if (error) throw new Error(`listSlugs: ${error.message}`);
    /* An empty result is an answer, not a failure. It used to throw here on
       purpose, to reach the seed fallback — with that fallback gone, the throw
       would turn a genuinely empty catalogue into a site-wide outage, and
       prerendering zero pages is the correct response to zero recipes. */
    return ((data ?? []) as { slug: string }[]).map((r) => r.slug);
  }, seed);
}
