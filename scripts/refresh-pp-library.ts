/**
 * The Picture Profile library refresh, on the content project.
 *
 *   npm run pp:refresh -- --target content            # plan only, touches nothing
 *   npm run pp:refresh -- --target content --apply    # unpublish and insert
 *
 * Two production writes the owner approved on 2026-10-23, each reversible:
 *
 * 1. **Unpublish** every recipe in `RETIRED_RECIPE_IDS` — `published = false`,
 *    the same column `/admin/colorlab` flips. Never a delete: comments,
 *    proposals and community photographs on the control plane point at these
 *    slugs across a project boundary no foreign key spans. The reason, in
 *    full: withdrawn, matches a licensed third-party collection.
 * 2. **Insert** the originals from `data/recipes.seed.json` that the project
 *    does not have yet, as `published = false` (D8), with their English and
 *    Vietnamese descriptions. A row whose id already exists is left exactly as
 *    it is; a slug already taken by a different id stops the whole run.
 *
 * `push:supabase` cannot do either: it never changes an existing row without
 * `--overwrite`, and `--overwrite` replaces rows whole and undoes every edit an
 * administrator made since the seed. This script names its rows.
 *
 * The plan is printed before anything is written, and without `--apply` that
 * is all that happens. The target is required and has no default.
 */

import { readFileSync } from 'node:fs';
import { recipeSchema, type Recipe } from '../src/lib/camera/schema';
import { RETIRED_RECIPE_IDS } from '../src/lib/recipes/redirects';
import { toRow } from '../src/lib/recipes/row';
import { adminClient } from './lib/db';
import { requireTarget } from './supabase/args';

type SeedRecipe = { legacyId: string | null } & Record<string, unknown>;
type SeedTranslation = { recipeId: string; locale: string; description: string };
type Existing = { id: string; slug: string; published: boolean };

async function main() {
  const { target, args } = requireTarget(process.argv.slice(2), ['--apply', '--dry-run']);
  if (target !== 'content') {
    throw new Error('Recipes live in the content project. Pass --target content.');
  }
  const apply = args.apply;
  const db = adminClient(target);

  const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as SeedRecipe[];
  const translations = JSON.parse(
    readFileSync('data/translations.seed.json', 'utf8'),
  ) as SeedTranslation[];

  /* The originals: Picture Profiles with no legacy id. Validated here as well
     as at emit time, because this is the last step before a database. */
  const originals = seed
    .filter((r) => r.format === 'pp' && r.legacyId === null)
    .map((r) => {
      const parsed = recipeSchema.safeParse(r);
      if (!parsed.success) {
        throw new Error(`${String(r.id)} failed validation: ${parsed.error.issues[0]?.message}`);
      }
      if (parsed.data.published) {
        throw new Error(`${parsed.data.id} is published in the seed; the originals go in unpublished (D8).`);
      }
      return parsed.data;
    });

  const { data, error } = await db.from('recipes').select('id, slug, published');
  if (error) throw new Error(`recipes read: ${error.message}`);
  const existing = (data ?? []) as Existing[];
  const byId = new Map(existing.map((r) => [r.id, r]));
  const bySlug = new Map(existing.map((r) => [r.slug, r]));

  console.log(`· ${existing.length} recipes on the content project, ${existing.filter((r) => r.published).length} published`);

  /* ---- 1. unpublish ------------------------------------------------------ */
  console.log(`\n1. Unpublish ${RETIRED_RECIPE_IDS.length} withdrawn Picture Profiles`);
  const toUnpublish: string[] = [];
  for (const id of RETIRED_RECIPE_IDS) {
    const row = byId.get(id);
    const state = !row ? 'not on this project' : row.published ? 'published → unpublish' : 'already unpublished';
    console.log(`   ${id}  ${row?.slug ?? ''}  ${state}`);
    if (row?.published) toUnpublish.push(id);
  }

  /* ---- 2. insert --------------------------------------------------------- */
  console.log(`\n2. Insert ${originals.length} originals, unpublished`);
  const toInsert: Recipe[] = [];
  for (const r of originals) {
    const sameId = byId.get(r.id);
    const sameSlug = bySlug.get(r.slug);
    if (sameSlug && sameSlug.id !== r.id) {
      throw new Error(`${r.id}: slug "${r.slug}" already belongs to ${sameSlug.id} on the content project.`);
    }
    if (sameId) {
      console.log(`   ${r.id}  ${r.slug}  already present (${sameId.published ? 'published' : 'unpublished'}) — left as is`);
      continue;
    }
    console.log(`   ${r.id}  ${r.slug}  → insert`);
    toInsert.push(r);
  }
  const translationRows = translations
    .filter((t) => toInsert.some((r) => r.id === t.recipeId))
    .map((t) => ({ recipe_id: t.recipeId, locale: t.locale, description: t.description }));

  console.log(
    `\nPlan: unpublish ${toUnpublish.length}, insert ${toInsert.length} recipes and ${translationRows.length} translations.`,
  );
  if (!apply) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
    return;
  }

  /* ---- write ------------------------------------------------------------- */
  const stamp = new Date().toISOString();
  let unpublished = 0;
  for (const id of toUnpublish) {
    const { data: out, error: e } = await db
      .from('recipes')
      .update({ published: false, updated_at: stamp })
      .eq('id', id)
      .eq('published', true)
      .select('id');
    if (e) throw new Error(`unpublish ${id}: ${e.message}`);
    unpublished += Array.isArray(out) ? out.length : 0;
  }
  console.log(`✓ ${unpublished} recipes unpublished`);

  if (toInsert.length > 0) {
    const rows = toInsert.map((r) => toRow(r, null));
    const { error: insertError } = await db.from('recipes').insert(rows);
    if (insertError) throw new Error(`insert recipes: ${insertError.message}`);
    console.log(`✓ ${rows.length} recipes inserted (published = false)`);

    const { error: translationError } = await db
      .from('recipe_translations')
      .upsert(translationRows, { onConflict: 'recipe_id,locale', ignoreDuplicates: true });
    if (translationError) throw new Error(`insert translations: ${translationError.message}`);
    console.log(`✓ ${translationRows.length} translations inserted`);
  }

  const { data: after, error: afterError } = await db.from('recipes').select('id, published');
  if (afterError) throw new Error(`verify: ${afterError.message}`);
  const rowsAfter = (after ?? []) as { id: string; published: boolean }[];
  console.log(
    `✓ ${rowsAfter.length} recipes now on the content project, ${rowsAfter.filter((r) => r.published).length} published`,
  );
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
