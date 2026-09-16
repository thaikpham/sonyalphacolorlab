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
import imagesSeed from '../../../data/images.seed.json';
import { accentFor, type Accent } from '../camera/color';
import { formatWhiteBalance } from '../camera/format';
import type { Recipe } from '../camera/schema';
import { contentRead } from '../supabase/server';
import { contentOrOfflineSeed } from '../supabase/content-source';
import { fromRow, type RecipeRow } from './row';
import { devListRecipes, isRecipeDevStore } from './dev-store';

export type Locale = 'en' | 'vi';

export type RecipeView = Recipe & {
  legacyId: string | null;
  /** Localised prose. Falls back to English when a translation is missing. */
  description: string;
  /** Pre-formatted for display, e.g. "7000K, B3-M1.5". */
  wbLabel: string;
  /** Derived from this recipe's own colour science. */
  accent: Accent;
  /** Public image URLs, first is the grid thumbnail and the OG card. */
  images: string[];
};

/**
 * Seed path -> public URL.
 *
 * These are vendored into `public/recipes/` by `npm run vendor:images`, not
 * fetched from Supabase Storage. Storage served every photograph at its stored
 * resolution — 1.27GB of CDN egress a day, ~38GB a month against a 5GB quota —
 * and that is what restricted the whole project, Auth and PostgREST included.
 *
 * Serving them from `public/` puts them on the same static CDN as the fonts:
 * no egress quota and no optimizer in the path, because the sizes already exist
 * on disk and `catalogue-loader.ts` picks between them by rewriting the suffix.
 *
 * It also means this no longer returns null without credentials, which is what
 * `AGENTS.md` promised all along — the app "builds, runs and tests offline",
 * except that every photograph used to vanish when it did.
 */
const publicImageUrl = (path: string): string => `/recipes/${path}`;

/**
 * Recipe id -> ordered image paths.
 *
 * Read from the seed rather than the database: the association is the storage
 * path itself (`<recipeId>/<n>.jpg`), so it cannot drift from the recipe even
 * if the table is out of sync. Only 11 of 47 recipes have photographs — the
 * rest still render the derived colour field.
 */
const seedImages = (imagesSeed as { recipeId: string; storagePath: string; sort: number }[])
  .slice()
  .sort((a, b) => a.sort - b.sort)
  .reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.recipeId] ||= []).push(r.storagePath);
    return acc;
  }, {});

const imagesFor = (recipeId: string): string[] =>
  (seedImages[recipeId] ?? []).map(publicImageUrl);

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
  return {
    ...recipe,
    legacyId,
    description,
    wbLabel: formatWhiteBalance(recipe.whiteBalance),
    accent: accentFor(recipe),
    images: imagesFor(recipe.id),
  };
}

/**
 * Free-text search over name and tags.
 *
 * Deliberately not over descriptions: those are prose and every recipe mentions
 * colour words, so including them makes almost any query match almost anything.
 * Diacritics are stripped so "mojave" finds a Vietnamese reader's query too.
 */
const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const matchesQuery = (r: Recipe, q: string) => {
  const needle = norm(q.trim());
  if (!needle) return true;
  const haystack = norm([r.name, r.id, ...r.tags].join(' '));
  // Every whitespace-separated term must appear.
  return needle.split(/\s+/).every((term) => haystack.includes(term));
};

const matches = (r: Recipe, f: RecipeFilters) =>
  (!f.format || r.format === f.format) &&
  (!f.look || (r.format === 'cl' && r.settings.look === f.look)) &&
  (!f.tag || r.tags.includes(f.tag)) &&
  (!f.q || matchesQuery(r, f.q));

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

/**
 * Recipes with a photograph first, everything else after in its existing order.
 *
 * The grid falls back to a derived colour field when a recipe has no photo, and
 * most of the catalogue has none — 11 of the 46 Picture Profile recipes, and
 * none of the Creative Look ones until their images are migrated to Storage.
 * Ordered by id, that put a long run of colour fields at the top and the page
 * read as though the images were broken.
 *
 * `sort` is stable, so this is a partition, not a reshuffle: within each group
 * the id order is untouched and the page stays deterministic.
 */
export const photosFirst = <T extends { images: string[] }>(views: T[]): T[] =>
  views.slice().sort((a, b) => (b.images.length > 0 ? 1 : 0) - (a.images.length > 0 ? 1 : 0));

export const listRecipes = catalogueCache('listRecipes', _listRecipes);

async function _listRecipes(
  locale: Locale = 'en',
  filters: RecipeFilters = {},
): Promise<RecipeView[]> {
  const seed = () =>
    photosFirst(
      seedRecipes()
        .filter((r) => r.published && matches(r, filters))
        .map((r) => toView(r, r.legacyId, pickDescription(seedDescriptions, r.id, locale))),
    );

  return contentOrOfflineSeed('recipes.list', async () => {
  const db = contentRead();
  let query = db.from('recipes').select('*').eq('published', true);
  if (filters.format) query = query.eq('format', filters.format);
  if (filters.look) query = query.eq('look', filters.look);
  if (filters.tag) query = query.contains('tags', [filters.tag]);

  const { data, error } = await query.order('id');
  if (error) throw new Error(`listRecipes: ${error.message}`);

  let rows = (data ?? []) as RecipeRow[];
  // Text matching happens here rather than in SQL: the catalogue is small enough
  // that a full-text index would be more moving parts than it earns, and this
  // keeps the seed and Supabase paths behaving identically.
  if (filters.q) rows = rows.filter((row) => matchesQuery(fromRow(row), filters.q!));

  const lookup = await loadTranslations(rows.map((r) => r.id));
  return photosFirst(
    rows.map((row) =>
      toView(fromRow(row), row.legacy_id, pickDescription(lookup, row.id, locale)),
    ),
  );
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
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) throw new Error(`getRecipe: ${error.message}`);
  if (!data) return null;

  const row = data as RecipeRow;
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


/** Tags in use, most common first — drives the filter bar. */
export const listTags = catalogueCache('listTags', _listTags);

async function _listTags(limit = 14): Promise<{ tag: string; count: number }[]> {
  const seedTags = () => seedRecipes().filter((r) => r.published).map((r) => r.tags);
  const tagLists = await contentOrOfflineSeed(
    'recipes.tags',
    async () => {
      const { data, error } = await contentRead()
        .from('recipes')
        .select('tags')
        .eq('published', true);
      if (error) throw new Error(`listTags: ${error.message}`);
      return ((data ?? []) as { tags: string[] }[]).map((r) => r.tags ?? []);
    },
    seedTags,
  );

  const counts = new Map<string, number>();
  for (const tags of tagLists) {
    for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
