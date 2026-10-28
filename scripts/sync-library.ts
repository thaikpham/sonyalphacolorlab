/**
 * Brings the content project's recipe library in line with the seed.
 *
 *   npm run library:sync -- --target content            # print the plan, touch nothing
 *   npm run library:sync -- --target content --apply    # write it
 *
 * What it writes is decided by `planLibrarySync` (scripts/lib/library-plan.ts),
 * whose header holds the rules: withdrawn recipes unpublished, never deleted;
 * missing recipes inserted unpublished; ColorLab's own originals that are still
 * unpublished follow the seed whole; every other recipe keeps its settings and
 * only takes the seed's name. An id or a slug the project gives to a different
 * recipe stops the run before anything is written, and every write is guarded
 * by the slug the plan matched on.
 *
 * It replaces the one-off `pp:refresh` of 2026-10-23, which did the first two
 * of those and nothing else, and it is what carries the `PP-NNN` / `CL-NNN`
 * names to production. `push:supabase` cannot: it never changes an existing row
 * without `--overwrite`, and `--overwrite` replaces rows whole, undoing every
 * edit an administrator made since the seed.
 *
 * It writes in the id shape the project holds. Until the content migration
 * runs that is `SCL-PP-048` at its former slug `hue-silk`, under the new name,
 * and the migration renames those rows later with every other; after it, the
 * seed's own `PP-048` at `pp-048-soft-clean-portrait`. A project holding both
 * shapes is refused before anything is planned.
 *
 * The target is required and has no default.
 */

import { readFileSync } from 'node:fs';
import { recipeSchema } from '../src/lib/camera/schema';
import { ORIGINAL_CL } from '../src/lib/originals/cl';
import { ORIGINAL_PP } from '../src/lib/originals/pp';
import { RETIRED_RECIPE_IDS } from '../src/lib/recipes/redirects';
import { adminClient } from './lib/db';
import {
  insertRows,
  planForProject,
  refreshFields,
  translationRows,
  type PlanExistingRow,
} from './lib/library-plan';
import { requireTarget } from './supabase/args';

type SeedRecipe = Record<string, unknown> & { legacyId?: string | null };
type SeedTranslation = { recipeId: string; locale: string; description: string };

async function main() {
  const { target, args } = requireTarget(process.argv.slice(2), ['--apply', '--dry-run']);
  if (target !== 'content') {
    throw new Error('Recipes live in the content project. Pass --target content.');
  }
  const db = adminClient(target);

  /* Validated here as well as at emit time: this is the last step before a
     database, and a row that fails here would fail every reader after it. */
  const seed = (JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as SeedRecipe[]).map((r) => {
    const parsed = recipeSchema.safeParse(r);
    if (!parsed.success) {
      throw new Error(`${String(r.id)} failed validation: ${parsed.error.issues[0]?.message}`);
    }
    return { recipe: parsed.data, legacyId: (r.legacyId as string | null | undefined) ?? null };
  });
  const translations = JSON.parse(readFileSync('data/translations.seed.json', 'utf8')) as SeedTranslation[];
  const originals = [...ORIGINAL_PP, ...ORIGINAL_CL].map((o) => o.recipe.id);

  const { data, error } = await db.from('recipes').select('id, slug, name, published');
  if (error) throw new Error(`recipes read: ${error.message}`);
  const existing = (data ?? []) as PlanExistingRow[];

  /* The seed goes into the project's id shape before it is planned: compared
     across the rename, every seed recipe would read as missing and the plan
     would insert the whole library a second time. From here on every id and
     slug is the stored one. */
  const planned = planForProject({ recipes: seed, translations, retired: RETIRED_RECIPE_IDS, originals }, existing);
  if ('refusal' in planned) throw new Error(planned.refusal);
  const { shape, stored, plan } = planned;

  const published = existing.filter((r) => r.published).length;
  console.log(`· ${existing.length} recipes on the content project, ${published} published`);
  console.log(
    shape === 'legacy'
      ? '· content holds SCL- ids: writing in that shape; the id migration renames them later'
      : "· content holds code-shaped ids: writing in the seed's shape",
  );
  console.log(`\nUnpublish ${plan.unpublish.length} withdrawn`);
  for (const id of plan.unpublish) console.log(`   ${id}`);
  console.log(`\nRename ${plan.rename.length}`);
  for (const r of plan.rename) console.log(`   ${r.id}  ${r.from}  →  ${r.to}`);
  console.log(`\nRefresh ${plan.refresh.length} unpublished originals from the seed`);
  for (const id of plan.refresh) console.log(`   ${id}`);
  console.log(`\nInsert ${plan.insert.length}, unpublished`);
  for (const id of plan.insert) console.log(`   ${id}`);

  if (plan.conflicts.length > 0) {
    for (const c of plan.conflicts) console.error(`✗ ${c.id} (${c.slug}) clashes with ${c.heldBy}`);
    throw new Error('Id or slug conflicts — nothing written.');
  }
  if (!args.apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to write.');
    return;
  }

  const byId = new Map(stored.recipes.map((s) => [s.recipe.id, s]));
  const translationsFor = (ids: readonly string[]) => translationRows(stored, ids);
  const stamp = new Date().toISOString();

  for (const id of plan.unpublish) {
    const { error: e } = await db
      .from('recipes')
      .update({ published: false, updated_at: stamp })
      .eq('id', id)
      .eq('published', true);
    if (e) throw new Error(`unpublish ${id}: ${e.message}`);
  }
  console.log(`✓ ${plan.unpublish.length} unpublished`);

  for (const r of plan.rename) {
    const { error: e } = await db
      .from('recipes')
      .update({ name: r.to, updated_at: stamp })
      .eq('id', r.id)
      .eq('slug', byId.get(r.id)!.recipe.slug);
    if (e) throw new Error(`rename ${r.id}: ${e.message}`);
  }
  console.log(`✓ ${plan.rename.length} renamed`);

  /* Whole row from the seed, kept unpublished, and only while it still is and
     still has the slug the plan matched: an original the owner published
     between the plan and this write is left alone. Its translations follow
     only the rows the update actually matched, so a published one keeps the
     descriptions its editor gave it too. */
  const refreshed: string[] = [];
  for (const id of plan.refresh) {
    const { recipe } = byId.get(id)!;
    const { data: hit, error: e } = await db
      .from('recipes')
      .update({ ...refreshFields(recipe), updated_at: stamp })
      .eq('id', id)
      .eq('slug', recipe.slug)
      .eq('published', false)
      .select('id');
    if (e) throw new Error(`refresh ${id}: ${e.message}`);
    if (Array.isArray(hit) && hit.length > 0) refreshed.push(id);
  }
  if (refreshed.length > 0) {
    const { error: e } = await db
      .from('recipe_translations')
      .upsert(translationsFor(refreshed), { onConflict: 'recipe_id,locale' });
    if (e) throw new Error(`refresh translations: ${e.message}`);
  }
  console.log(`✓ ${refreshed.length} of ${plan.refresh.length} originals refreshed`);

  if (plan.insert.length > 0) {
    const { error: e } = await db.from('recipes').insert(insertRows(plan, stored));
    if (e) throw new Error(`insert: ${e.message}`);
    const { error: te } = await db
      .from('recipe_translations')
      .upsert(translationsFor(plan.insert), { onConflict: 'recipe_id,locale', ignoreDuplicates: true });
    if (te) throw new Error(`insert translations: ${te.message}`);
  }
  console.log(`✓ ${plan.insert.length} inserted, unpublished`);

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
