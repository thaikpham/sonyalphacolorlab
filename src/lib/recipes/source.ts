/**
 * Recipe reads.
 *
 * Backed by Supabase when it is configured, and by the migrated seed files when
 * it is not. That is not a convenience — it is what lets the site build, run and
 * test with no credentials at all, so a missing env var degrades to stale-but-
 * correct content rather than a blank page.
 *
 * Everything above this module works in terms of `RecipeView`, so no component
 * knows or cares which source answered.
 */

import 'server-only';
import recipesSeed from '../../../data/recipes.seed.json';
import translationsSeed from '../../../data/translations.seed.json';
import imagesSeed from '../../../data/images.seed.json';
import { accentFor, type Accent } from '../camera/color';
import { formatWhiteBalance } from '../camera/format';
import type { Recipe } from '../camera/schema';
import { isSupabaseConfigured, supabaseRead } from '../supabase/server';
import { fromRow, type RecipeRow } from './row';

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

const STORAGE_BUCKET = 'recipes';

/** Storage path -> public URL. Empty when Supabase is not configured. */
function publicImageUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${path}` : null;
}

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
  (seedImages[recipeId] ?? []).map(publicImageUrl).filter((u): u is string => Boolean(u));

export type RecipeFilters = { format?: 'pp' | 'cl'; look?: string; tag?: string; q?: string };

/**
 * Runs a Supabase read, falling back to the seed files if it fails.
 *
 * Stale-but-correct beats a blank page for a content site, and the seed is the
 * same catalogue the database was populated from. The failure is logged loudly
 * rather than swallowed — a silent fallback would hide a real outage, which is
 * worse than the outage.
 */
async function withSeedFallback<T>(
  label: string,
  fromDb: () => Promise<T>,
  fromSeed: () => T,
): Promise<T> {
  try {
    return await fromDb();
  } catch (e) {
    console.error(
      `[recipes] ${label} failed against Supabase, serving seed data instead:`,
      e instanceof Error ? e.message : e,
    );
    return fromSeed();
  }
}

// ---------------------------------------------------------------------------
// Seed fallback
// ---------------------------------------------------------------------------

const seedRecipes = recipesSeed as unknown as (Recipe & { legacyId: string })[];

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

export async function listRecipes(
  locale: Locale = 'en',
  filters: RecipeFilters = {},
): Promise<RecipeView[]> {
  const seed = () =>
    photosFirst(
      seedRecipes
        .filter((r) => r.published && matches(r, filters))
        .map((r) => toView(r, r.legacyId, pickDescription(seedDescriptions, r.id, locale))),
    );

  if (!isSupabaseConfigured()) return seed();

  return withSeedFallback('listRecipes', async () => {
  const db = supabaseRead();
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
  const { data, error } = await supabaseRead()
    .from('recipe_translations')
    .select('recipe_id, locale, description')
    .in('recipe_id', ids);
  if (error) throw new Error(`loadTranslations: ${error.message}`);
  return new Map(
    ((data ?? []) as TranslationRow[]).map((t) => [`${t.recipe_id}:${t.locale}`, t.description]),
  );
}

export async function getRecipe(slug: string, locale: Locale = 'en'): Promise<RecipeView | null> {
  const seed = () => {
    const found = seedRecipes.find((r) => r.slug === slug && r.published);
    return found
      ? toView(found, found.legacyId, pickDescription(seedDescriptions, found.id, locale))
      : null;
  };

  if (!isSupabaseConfigured()) return seed();

  return withSeedFallback('getRecipe', async () => {
  const { data, error } = await supabaseRead()
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

export async function listSlugs(): Promise<string[]> {
  const seed = () => seedRecipes.filter((r) => r.published).map((r) => r.slug);
  if (!isSupabaseConfigured()) return seed();

  return withSeedFallback('listSlugs', async () => {
    const { data, error } = await supabaseRead()
      .from('recipes')
      .select('slug')
      .eq('published', true);
    if (error) throw new Error(`listSlugs: ${error.message}`);
    const slugs = ((data ?? []) as { slug: string }[]).map((r) => r.slug);
    // An empty table would silently prerender zero pages; treat it as a failure.
    if (slugs.length === 0) throw new Error('no published recipes returned');
    return slugs;
  }, seed);
}


/** Tags in use, most common first — drives the filter bar. */
export async function listTags(limit = 14): Promise<{ tag: string; count: number }[]> {
  const seedTags = () => seedRecipes.filter((r) => r.published).map((r) => r.tags);
  const tagLists = isSupabaseConfigured()
    ? await withSeedFallback(
        'listTags',
        async () => {
          const { data, error } = await supabaseRead()
            .from('recipes')
            .select('tags')
            .eq('published', true);
          if (error) throw new Error(`listTags: ${error.message}`);
          const lists = ((data ?? []) as { tags: string[] }[]).map((r) => r.tags ?? []);
          if (lists.length === 0) throw new Error('no published recipes returned');
          return lists;
        },
        seedTags,
      )
    : seedTags();

  const counts = new Map<string, number>();
  for (const tags of tagLists) {
    for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
