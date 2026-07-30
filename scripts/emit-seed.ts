/**
 * Regenerates data/recipes.seed.json from the legacy dataset.
 * Run with: npm run seed:emit
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import legacyRecipes from '../src/lib/legacy/recipes.legacy.js';
import { migrateAll } from '../src/lib/legacy/migrate';

const { ok, failed } = migrateAll(legacyRecipes as Record<string, unknown>[]);
if (failed.length) {
  console.error(`✗ ${failed.length} recipe(s) failed validation:`);
  for (const f of failed) console.error(`  ${f.legacyId}: ${f.error}`);
  process.exit(1);
}

mkdirSync('data', { recursive: true });
const rows = ok.map((r) => ({ ...r.recipe, legacyId: r.legacyId }));
writeFileSync('data/recipes.seed.json', JSON.stringify(rows, null, 2) + '\n');

// Descriptions are the only translated field, so they live apart from the
// recipe row — mirroring the recipe_translations table.
const byLegacyId = new Map(
  (legacyRecipes as { id: string; description?: string }[]).map((r) => [r.id, r.description ?? '']),
);
const translations = rows.map((r) => {
  const description = byLegacyId.get(r.legacyId)?.trim();
  if (!description) throw new Error(`${r.id}: legacy description missing`);
  return { recipeId: r.id, locale: 'en' as const, description };
});

// Vietnamese lives in a hand-maintained source file and is merged in here, so
// regenerating the seed never silently discards translated prose.
const viSource = JSON.parse(readFileSync('data/translations.vi.json', 'utf8')) as Record<
  string,
  string
>;
const vi = rows
  .map((r) => ({ recipeId: r.id, locale: 'vi' as const, description: viSource[r.id]?.trim() ?? '' }))
  .filter((t) => t.description.length > 0);

const missingVi = rows.length - vi.length;
writeFileSync(
  'data/translations.seed.json',
  JSON.stringify([...translations, ...vi], null, 2) + '\n',
);

const corrected = ok.filter((r) => r.corrections > 0);
console.log(`✓ ${rows.length} recipes → data/recipes.seed.json`);
console.log(`✓ ${translations.length} EN + ${vi.length} VI descriptions → data/translations.seed.json`);
if (missingVi > 0) console.log(`  ${missingVi} recipe(s) have no VI description yet — they fall back to English`);
if (corrected.length) {
  console.log(`  ${corrected.length} with documented corrections: ${corrected.map((c) => c.legacyId).join(', ')}`);
}
