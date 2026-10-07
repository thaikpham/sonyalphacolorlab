import 'server-only';
import { contentRead } from '@/lib/supabase/server';
import { ContentUnavailableError } from '@/lib/supabase/errors';

/**
 * Does a published recipe with this slug exist — asked of the content plane.
 *
 * Comments, proposals and community photographs reference a recipe by a
 * `recipe_slug` string, not a foreign key. That is what allows the two halves
 * of the schema to live in different databases at all: Postgres cannot enforce
 * a constraint across projects, and nothing in the spec is willing to pay for
 * `postgres_fdw` or a distributed transaction to pretend otherwise.
 *
 * So the constraint moves up here, and it has to be checked *before* the write
 * rather than after. A comment on a slug that does not exist is not a harmless
 * stray row: it is invisible on every page, counts toward the recipe's photo
 * limit if it is a photo, and survives until someone goes looking for it.
 *
 * The failure mode matters as much as the answer. If the content project cannot
 * be reached, this throws rather than returning `false` — "no such recipe" and
 * "cannot tell" produce opposite correct behaviours (404 versus 503), and
 * guessing `false` during a content outage would tell every reader that every
 * recipe had been deleted.
 *
 * Slugs are immutable for exactly this reason; see the design note on hard
 * deletion being blocked while operational rows still reference one.
 */
export async function publishedRecipeExists(slug: string): Promise<boolean> {
  const { data, error } = await contentRead()
    .from('recipes')
    .select('id')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    console.error('[content] recipes.exists failed:', error.message);
    throw new ContentUnavailableError('recipes.exists');
  }
  return data !== null;
}

/**
 * The same probe, answering with the recipe's format instead of a boolean —
 * `null` when no published recipe has that slug.
 *
 * A proposal's settings are validated against the format of the recipe they
 * propose to change: Picture Profile and Creative Look are mutually exclusive
 * on the camera (Rule 2), and a proposal is stored as jsonb, where nothing in
 * Postgres would notice the wrong one. Same failure contract as above: an
 * unreachable content project throws, it is never "not found".
 */
export async function publishedRecipeFormat(slug: string): Promise<'pp' | 'cl' | null> {
  const { data, error } = await contentRead()
    .from('recipes')
    .select('format')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    console.error('[content] recipes.format failed:', error.message);
    throw new ContentUnavailableError('recipes.format');
  }
  if (data === null) return null;
  const format = (data as { format?: unknown }).format;
  if (format === 'pp' || format === 'cl') return format;
  /* A value outside the enum is not a recipe this code can validate against,
     and guessing a format would accept settings for the wrong one. */
  console.error('[content] recipes.format returned an unknown format:', format);
  throw new ContentUnavailableError('recipes.format');
}
