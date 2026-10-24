/**
 * Regenerates data/recipes.seed.json from three sources:
 *   - the legacy sonycolorlab dataset  -> the Picture Profile recipes kept
 *   - ColorLab's own originals         -> the Picture Profile library and
 *                                         eight Creative Looks
 *   - Sony's Alpha Recipes microsite   -> Creative Look recipes
 * and names every recipe `PP-NNN-Mood Words` / `CL-NNN-Mood Words`
 * (src/lib/recipes/names.ts): the originals carry theirs, the legacy and
 * Sony Asia rows take theirs from RECIPE_NAMES. Every slug is then
 * `slugFor(name)`, and the slug each source first published the recipe under
 * goes to data/former-slugs.json (former → current), which is how an old link
 * still reaches its recipe (`src/lib/recipes/slug-aliases.ts`).
 * Run with: npm run seed:emit
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { recipeSchema } from '../src/lib/camera/schema';
import legacyRecipes from '../src/lib/legacy/recipes.legacy.js';
import { migrateAll } from '../src/lib/legacy/migrate';
import { ORIGINAL_CL } from '../src/lib/originals/cl';
import { ORIGINAL_PP, type OriginalRecipe } from '../src/lib/originals/pp';
import { NAME_VOCABULARY, RECIPE_NAMES, parseRecipeName, slugFor } from '../src/lib/recipes/names';
import { importSonyAsia } from '../src/lib/sony-asia/import';
import { SONY_ASIA_IDS } from '../src/lib/sony-asia/ids';

const { ok, failed } = migrateAll(legacyRecipes as Record<string, unknown>[]);
if (failed.length) {
  console.error(`✗ ${failed.length} recipe(s) failed validation:`);
  for (const f of failed) console.error(`  ${f.legacyId}: ${f.error}`);
  process.exit(1);
}

/* The originals are typed, but typed is not validated: the ranges and the
   gamma/colour-mode pairing live in the schema, and a number outside them
   must stop the emit here rather than fail on a real camera. */
const validated = (list: readonly OriginalRecipe[]) =>
  list.map((o) => {
    const parsed = recipeSchema.safeParse(o.recipe);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      console.error(`✗ ${o.recipe.id} failed validation: ${detail}`);
      process.exit(1);
    }
    return { ...parsed.data, legacyId: null as string | null, description: o.description };
  });
const originals = validated(ORIGINAL_PP);
const clOriginals = validated(ORIGINAL_CL);

/* ColorLab's own Creative Looks share the CL- sequence: reserve their ids
   and slugs so a row the scrape has never seen is numbered after them. */
const sony = importSonyAsia(readFileSync('data/sony-asia-creative-looks.csv', 'utf8'), SONY_ASIA_IDS, {
  ids: ORIGINAL_CL.map((o) => o.recipe.id),
  slugs: ORIGINAL_CL.map((o) => o.recipe.slug),
});

/* The legacy and Sony Asia rows keep their settings and take their new name
   from RECIPE_NAMES (their slug follows the name below). A row with
   no entry, or an entry no row uses, stops the emit: a recipe left on its old
   name would fail the syntax below anyway, and a stray entry is a typo. */
const unusedNames = new Set(Object.keys(RECIPE_NAMES));
const renamed = <T extends { id: string; name: string }>(r: T): T => {
  const name = RECIPE_NAMES[r.id];
  if (!name) {
    console.error(`✗ ${r.id} (${r.name}) has no entry in RECIPE_NAMES`);
    process.exit(1);
  }
  unusedNames.delete(r.id);
  return { ...r, name };
};

mkdirSync('data', { recursive: true });
const ppRows = [
  ...ok.map((r) => renamed({ ...r.recipe, legacyId: r.legacyId as string | null })),
  ...originals.map(({ description: _description, ...recipe }) => recipe),
];
// `images` and `credit` are provenance, not recipe fields — they are written to
// their own file so a seed row still parses as a plain Recipe.
const clRows = [
  ...sony.recipes.map(({ images: _images, credit: _credit, ...recipe }) => renamed(recipe)),
  ...clOriginals.map(({ description: _description, ...recipe }) => recipe),
];
/* The slug follows the name (S2 of the 2026-10-24 id design). The one the
   source published is kept as a former slug, so a link shared before still
   lands — in either database state, see `slug-aliases.ts`. Recorded only
   where it differs: a recipe born after the change has no former slug. */
const formerSlugs: Record<string, string> = {};
const rows = [...ppRows, ...clRows].map((r) => {
  const slug = slugFor(r.name);
  if (slug !== r.slug) formerSlugs[r.slug] = slug;
  return { ...r, slug };
});

if (unusedNames.size) {
  console.error(`✗ RECIPE_NAMES names recipes the seed does not have: ${[...unusedNames].join(', ')}`);
  process.exit(1);
}

/* One id, one slug and one name each, across every source. The originals are
   hand-numbered after the legacy set and the Sony Asia pins, and a collision
   here would otherwise surface as a silently skipped row in push:supabase —
   or, for the Creative Looks, as the importer handing its next unpinned row
   the number an original already holds. */
for (const key of ['id', 'slug', 'name'] as const) {
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r[key])) {
      console.error(`✗ duplicate recipe ${key}: ${r[key]}`);
      process.exit(1);
    }
    seen.add(r[key]);
  }
}

/* A former slug is a second address for its own recipe and nothing else:
   another recipe's current slug under that spelling would make an old link
   land on the wrong colour. */
const currentSlugs = new Set(rows.map((r) => r.slug));
for (const [former, current] of Object.entries(formerSlugs)) {
  if (currentSlugs.has(former)) {
    console.error(`✗ former slug ${former} (now ${current}) is another recipe's current slug`);
    process.exit(1);
  }
}

/* Every name in the one syntax: the recipe's own format and number, then
   two or three words from the closed vocabulary. */
for (const r of rows) {
  const parsed = parseRecipeName(r.name);
  const stray = parsed?.words.filter((w) => !NAME_VOCABULARY.has(w)) ?? [];
  if (!parsed || parsed.format !== r.format || parsed.number !== r.id.slice(-3) || stray.length) {
    console.error(
      `✗ ${r.id}: name "${r.name}" is not ${r.format.toUpperCase()}-${r.id.slice(-3)}-Mood Words` +
        (stray.length ? ` (not in the vocabulary: ${stray.join(', ')})` : ''),
    );
    process.exit(1);
  }
}

/**
 * Photographer credit and the original photo URLs, as provenance.
 *
 * The URLs are Sony's CDN and nothing on the site follows them: hotlinking
 * someone else's CDN is what broke the images on the old site, and the
 * catalogue carries no photograph of its own any more. They are recorded so
 * every recipe can name the photographer it came from.
 */
const credits = sony.recipes.map((r) => ({ recipeId: r.id, ...r.credit, imageUrls: r.images }));

// Descriptions are the only translated field, so they live apart from the
// recipe row — mirroring the recipe_translations table.
const byLegacyId = new Map(
  (legacyRecipes as { id: string; description?: string }[]).map((r) => [r.id, r.description ?? '']),
);
const byOriginalId = new Map([...originals, ...clOriginals].map((o) => [o.id as string, o.description]));
const translations = rows.map((r) => {
  // Legacy Picture Profile prose comes from the legacy dataset, the originals
  // (both formats) carry their own, and Sony Asia prose is built from the
  // microsite's credit line by the importer.
  const description =
    'legacyId' in r
      ? (r.legacyId ? byLegacyId.get(r.legacyId as string) : byOriginalId.get(r.id as string))?.trim()
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

/* Written together, after every check above has passed. A throw used to land
   between files — recipes.seed.json already holding a recipe whose
   translation never got written — and doctor and push:supabase then read a
   recipe with no English text. */
writeFileSync('data/recipes.seed.json', JSON.stringify(rows, null, 2) + '\n');
writeFileSync('data/sony-asia-credits.json', JSON.stringify(credits, null, 2) + '\n');
writeFileSync('data/former-slugs.json', JSON.stringify(formerSlugs, null, 2) + '\n');
writeFileSync(
  'data/translations.seed.json',
  JSON.stringify([...translations, ...vi], null, 2) + '\n',
);

const corrected = ok.filter((r) => r.corrections > 0);
console.log(`✓ ${rows.length} recipes → data/recipes.seed.json`);
console.log(
  `  ${ok.length} Picture Profile (legacy) + ${originals.length} Picture Profile (originals) + ` +
    `${sony.recipes.length} Creative Look (Sony Asia) + ${clOriginals.length} Creative Look (originals)`,
);
console.log(`✓ ${sony.recipes.length} credits → data/sony-asia-credits.json`);
console.log(`✓ ${Object.keys(formerSlugs).length} former slugs → data/former-slugs.json`);
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
