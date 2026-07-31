/**
 * Regenerates data/recipes.seed.json from two sources:
 *   - the legacy sonycolorlab dataset  -> Picture Profile recipes
 *   - Sony's Alpha Recipes microsite   -> Creative Look recipes
 * Run with: npm run seed:emit
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import legacyRecipes from '../src/lib/legacy/recipes.legacy.js';
import { migrateAll } from '../src/lib/legacy/migrate';
import { importSonyAsia } from '../src/lib/sony-asia/import';

const { ok, failed } = migrateAll(legacyRecipes as Record<string, unknown>[]);
if (failed.length) {
  console.error(`✗ ${failed.length} recipe(s) failed validation:`);
  for (const f of failed) console.error(`  ${f.legacyId}: ${f.error}`);
  process.exit(1);
}

const sony = importSonyAsia(readFileSync('data/sony-asia-creative-looks.csv', 'utf8'));

mkdirSync('data', { recursive: true });
const ppRows = ok.map((r) => ({ ...r.recipe, legacyId: r.legacyId }));
// `images` and `credit` are provenance, not recipe fields — they are written to
// their own file so a seed row still parses as a plain Recipe.
const clRows = sony.recipes.map(({ images: _images, credit: _credit, ...recipe }) => recipe);
const rows = [...ppRows, ...clRows];
writeFileSync('data/recipes.seed.json', JSON.stringify(rows, null, 2) + '\n');

/**
 * Photographer credit and the original photo URLs.
 *
 * The URLs are Sony's CDN and are deliberately NOT written into
 * images.seed.json, which holds Supabase Storage paths. Hotlinking someone
 * else's CDN is what broke the images on the old site; these are recorded so
 * `migrate-images` can pull them across, and so every recipe can name the
 * photographer it came from.
 */
writeFileSync(
  'data/sony-asia-credits.json',
  JSON.stringify(
    sony.recipes.map((r) => ({ recipeId: r.id, ...r.credit, imageUrls: r.images })),
    null,
    2,
  ) + '\n',
);

// Descriptions are the only translated field, so they live apart from the
// recipe row — mirroring the recipe_translations table.
const byLegacyId = new Map(
  (legacyRecipes as { id: string; description?: string }[]).map((r) => [r.id, r.description ?? '']),
);
const translations = rows.map((r) => {
  // Picture Profile prose comes from the legacy dataset; Creative Look prose is
  // built from the microsite's own credit line by the importer.
  const description =
    'legacyId' in r
      ? byLegacyId.get(r.legacyId as string)?.trim()
      : sony.descriptions[r.id]?.trim();
  if (!description) throw new Error(`${r.id}: description missing`);
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
console.log(`  ${ppRows.length} Picture Profile (legacy) + ${clRows.length} Creative Look (Sony Asia)`);
console.log(`✓ ${sony.recipes.length} credits → data/sony-asia-credits.json`);
if (sony.duplicates) {
  console.log(`  ${sony.duplicates} duplicate carousel row(s) merged into their recipe`);
}
if (sony.corrections) {
  console.log(`  ${sony.corrections} scrape defect(s) corrected — see SCRAPE_CORRECTIONS`);
}
if (sony.skipped.length) {
  console.log(`  ${sony.skipped.length} Sony Asia row(s) skipped, the source does not state enough:`);
  for (const s of sony.skipped) {
    console.log(`    ${s.data.slice(0, 60)}…\n      ${s.why}`);
  }
}
console.log(`✓ ${translations.length} EN + ${vi.length} VI descriptions → data/translations.seed.json`);
if (missingVi > 0) console.log(`  ${missingVi} recipe(s) have no VI description yet — they fall back to English`);
if (corrected.length) {
  console.log(`  ${corrected.length} with documented corrections: ${corrected.map((c) => c.legacyId).join(', ')}`);
}
