/**
 * Pushes the migrated catalogue into Supabase.
 *
 * Run once the project exists and the migration in supabase/migrations has been
 * applied:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run push:supabase
 *
 * Idempotent: rows are upserted on primary key, so re-running syncs rather than
 * duplicating. Nothing is deleted — removing a recipe is a deliberate act, not a
 * side effect of a sync script.
 */

import { readFileSync } from 'node:fs';
import { adminClient } from './lib/db';
import { recipeSchema } from '../src/lib/camera/schema';
import { toRow } from '../src/lib/recipes/row';

type SeedRecipe = { legacyId: string } & Record<string, unknown>;
type SeedTranslation = { recipeId: string; locale: string; description: string };

const recipes = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as SeedRecipe[];
const translations = JSON.parse(
  readFileSync('data/translations.seed.json', 'utf8'),
) as SeedTranslation[];
const images = JSON.parse(readFileSync('data/images.seed.json', 'utf8')) as {
  recipeId: string;
  storagePath: string;
  sort: number;
}[];

async function main() {
  // Validate everything before touching the database. A partial write is worse
  // than no write.
  const rows = recipes.map((seed) => {
    const parsed = recipeSchema.safeParse(seed);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      throw new Error(`${String(seed.id)} failed validation: ${detail}`);
    }
    return toRow(parsed.data, seed.legacyId);
  });
  console.log(`✓ ${rows.length} recipes validated`);

  const db = adminClient();

  const { error: recipeError } = await db.from('recipes').upsert(rows, { onConflict: 'id' });
  if (recipeError) throw new Error(`recipes upsert: ${recipeError.message}`);
  console.log(`✓ ${rows.length} recipes upserted`);

  const translationRows = translations.map((t) => ({
    recipe_id: t.recipeId,
    locale: t.locale,
    description: t.description,
  }));
  const { error: translationError } = await db
    .from('recipe_translations')
    .upsert(translationRows, { onConflict: 'recipe_id,locale' });
  if (translationError) throw new Error(`translations upsert: ${translationError.message}`);
  console.log(`✓ ${translationRows.length} translations upserted`);

  // Images were uploaded separately by migrate-images.ts; this records which
  // recipe each one belongs to. `(recipe_id, sort)` is unique, so re-running
  // updates rather than duplicating.
  if (images.length > 0) {
    const imageRows = images.map((i) => ({
      recipe_id: i.recipeId,
      storage_path: i.storagePath,
      sort: i.sort,
    }));
    const { error: imageError } = await db
      .from('recipe_images')
      .upsert(imageRows, { onConflict: 'recipe_id,sort' });
    if (imageError) throw new Error(`images upsert: ${imageError.message}`);
    console.log(`✓ ${imageRows.length} image links upserted`);
  }

  const { count, error: countError } = await db
    .from('recipes')
    .select('id', { count: 'exact', head: true });
  if (countError) throw new Error(`verify: ${countError.message}`);
  console.log(`✓ ${count} recipes now in Supabase`);
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
