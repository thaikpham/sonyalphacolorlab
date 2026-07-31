/**
 * Moves recipe photographs into Supabase Storage, from both libraries.
 *
 * The original site hotlinked Google Photos. Those URLs expire — five of them
 * already 404 — which is the whole reason for this migration. The Creative Look
 * photographs have the same problem in a different wrapper: they live on Sony's
 * marketing CDN, which is not ours to depend on either.
 *
 * Each image is fetched once, stored under `<recipeId>/<n>.<ext>`, and its
 * association with the recipe is preserved by that path, not by ordering.
 *
 * Idempotent: re-running overwrites the same paths. Both sources are read on
 * every run, so `images.seed.json` is rewritten complete rather than losing
 * whichever library was not part of this invocation. Dead source URLs are
 * reported and skipped, never written as a broken row.
 *
 * The Creative Look photographs are Sony's, credited to the named photographers
 * in `data/sony-asia-credits.json`. That credit is what the recipe descriptions
 * carry, and it should stay attached wherever these are displayed.
 *
 * Run: npm run migrate:images
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { adminClient } from './lib/db';
import { toRecipeId } from '../src/lib/legacy/migrate';

const BUCKET = 'recipes';

/** Pulls the id -> [url] map straight out of the legacy JS module. */
function legacyImageMap(): Record<string, string[]> {
  const src = readFileSync('src/lib/legacy/images.legacy.js', 'utf8');
  const map: Record<string, string[]> = {};
  for (const m of src.matchAll(/"(scl-\d+|PROCOLOR-\d+)":\s*\[([\s\S]*?)\]/g)) {
    map[m[1]] = [...m[2].matchAll(/"(https?:[^"]+)"/g)].map((x) => x[1]);
  }
  return map;
}

/**
 * Creative Look photos, keyed by the recipe id the importer already assigned.
 * Unlike the legacy map these need no id translation — `emit-seed` wrote the
 * canonical `SCL-CL-0xx` alongside each credit.
 */
function sonyAsiaImageMap(): Record<string, string[]> {
  const credits = JSON.parse(readFileSync('data/sony-asia-credits.json', 'utf8')) as {
    recipeId: string;
    imageUrls: string[];
  }[];
  return Object.fromEntries(credits.map((c) => [c.recipeId, c.imageUrls]));
}

const isPlaceholder = (url: string) => url.includes('placehold.co');

const extFor = (contentType: string) =>
  contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

type Row = { recipeId: string; storagePath: string; sort: number };

async function main() {
  const db = adminClient();

  // Both libraries, already keyed by canonical recipe id.
  const sources: Record<string, string[]> = {
    ...Object.fromEntries(
      Object.entries(legacyImageMap()).map(([legacyId, urls]) => [toRecipeId(legacyId), urls]),
    ),
    ...sonyAsiaImageMap(),
  };

  const rows: Row[] = [];
  const skipped: string[] = [];
  let uploaded = 0;

  for (const [recipeId, urls] of Object.entries(sources)) {
    // Placeholders were never photographs — carrying them over would dress up
    // "no image yet" as content.
    const real = urls.filter((u) => !isPlaceholder(u));
    if (real.length === 0) {
      skipped.push(`${recipeId} (placeholder only)`);
      continue;
    }

    let sort = 0;
    for (const url of real) {
      const res = await fetch(url).catch(() => null);
      if (!res?.ok) {
        skipped.push(`${recipeId} <- ${res?.status ?? 'network'} ${url.slice(0, 60)}`);
        continue;
      }

      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const bytes = new Uint8Array(await res.arrayBuffer());
      const path = `${recipeId}/${String(sort).padStart(2, '0')}.${extFor(contentType)}`;

      const { error } = await db.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (error) {
        skipped.push(`${recipeId} <- upload failed: ${error.message}`);
        continue;
      }

      rows.push({ recipeId, storagePath: path, sort });
      sort += 1;
      uploaded += 1;
      process.stdout.write('.');
    }
  }

  process.stdout.write('\n');
  writeFileSync('data/images.seed.json', JSON.stringify(rows, null, 2) + '\n');

  const withImages = new Set(rows.map((r) => r.recipeId)).size;
  console.log(`✓ ${uploaded} images uploaded, covering ${withImages} recipes`);
  console.log(`✓ associations written to data/images.seed.json`);
  if (skipped.length) {
    console.log(`\n${skipped.length} skipped:`);
    for (const s of skipped) console.log('  ' + s);
  }
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
