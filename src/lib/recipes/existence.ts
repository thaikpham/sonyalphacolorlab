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
