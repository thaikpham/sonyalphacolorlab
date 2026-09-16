/**
 * Pulls uploaded recipe photographs out of Storage and into `public/recipes`.
 *
 * This is the second half of the pipeline `/admin/colorlab` starts. An upload
 * lands in the PRIVATE `recipe-uploads` bucket and is visible only to the
 * editor, through a signed URL. Nothing serves it to a reader. This script is
 * what makes it public, by copying the bytes onto the static CDN where the rest
 * of the photography already lives and rewriting `data/images.seed.json`.
 *
 * The indirection is the 2026-09-11 incident's fix, not ceremony. Storage
 * served the recipe grid at stored resolution — 1.27 GB of cached egress a day
 * against a 5 GB quota — and restricted the whole project: Storage, Auth and
 * PostgREST answering 402 together. `public/` has no egress quota in front of
 * it, so the grid costs nothing to serve however popular it gets.
 *
 * The manifest is rewritten from `recipe_images`, which means ORDER and ALT
 * come from the table too. So reordering photographs in the admin takes effect
 * the same way adding one does: run this, commit, deploy.
 *
 * SAFETY. This rewrites the file that decides which photographs the site shows,
 * from a table this script did not populate. If `recipe_images` is emptier than
 * the manifest — a half-finished import, the wrong project, a migration not yet
 * applied — writing it out would silently drop photographs from the live site
 * and the commit would look like a routine manifest update. So a shrink is
 * refused unless `--allow-removals` says it was intended.
 *
 * Run: npm run vendor:uploads -- --target content
 *      npm run vendor:uploads -- --target content --dry-run
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { adminClient } from './supabase/clients';
import { parseArgs, requireTarget } from './supabase/args';

const BUCKET = 'recipe-uploads';
const WIDTHS = [320, 640, 1024] as const;
const PUBLIC_ROOT = join(process.cwd(), 'public', 'recipes');
const MANIFEST = join(process.cwd(), 'data', 'images.seed.json');

type ManifestEntry = { recipeId: string; storagePath: string; sort: number; alt?: string };

type ImageRow = {
  recipe_id: string;
  storage_path: string;
  sort: number;
  alt: string | null;
};

const stem = (path: string) => path.replace(/-(\d+)\.webp$/, '');

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const target = requireTarget(argv).target;
  if (target !== 'content') {
    throw new Error('Recipe photographs live on the content project. Pass --target content.');
  }

  const db = adminClient('content');

  const { data, error } = await db
    .from('recipe_images')
    .select('recipe_id, storage_path, sort, alt')
    .order('recipe_id', { ascending: true })
    .order('sort', { ascending: true });

  if (error) throw new Error(`recipe_images: ${error.message}`);
  const rows = (data ?? []) as ImageRow[];

  const current = JSON.parse(await readFile(MANIFEST, 'utf8')) as ManifestEntry[];
  const currentPaths = new Set(current.map((e) => e.storagePath));

  const next: ManifestEntry[] = rows.map((r) => ({
    recipeId: r.recipe_id,
    storagePath: r.storage_path,
    sort: r.sort,
    ...(r.alt ? { alt: r.alt } : {}),
  }));

  const added = next.filter((e) => !currentPaths.has(e.storagePath));
  const nextPaths = new Set(next.map((e) => e.storagePath));
  const removed = current.filter((e) => !nextPaths.has(e.storagePath));

  console.log(
    `recipe_images: ${rows.length} rows | manifest: ${current.length} entries | ` +
      `+${added.length} new, -${removed.length} gone`,
  );

  if (removed.length > 0 && !args.allowRemovals) {
    for (const r of removed.slice(0, 10)) console.error(`  would drop ${r.storagePath}`);
    throw new Error(
      `${removed.length} photograph(s) are in the manifest but not in recipe_images. ` +
        'That is either a deliberate removal or the wrong project / an unfinished import. ' +
        'Re-run with --allow-removals if it was deliberate.',
    );
  }

  if (args.dryRun) {
    console.log('--dry-run: nothing written.');
    return;
  }

  /* Only the new ones are downloaded. A photograph already in `public/` is
     byte-identical to the bucket's copy — the slot in its name never changes,
     which is what makes that safe to assume and what lets the CDN cache it
     forever. */
  let bytes = 0;
  for (const entry of added) {
    for (const width of WIDTHS) {
      const path = `${stem(entry.storagePath)}-${width}.webp`;
      const { data: blob, error: dlError } = await db.storage.from(BUCKET).download(path);
      if (dlError || !blob) throw new Error(`download ${path}: ${dlError?.message ?? 'empty'}`);
      const buf = Buffer.from(await blob.arrayBuffer());
      const target = join(PUBLIC_ROOT, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, buf);
      bytes += buf.byteLength;
    }
    console.log(`  + ${entry.storagePath}`);
  }

  await writeFile(MANIFEST, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  console.log(
    `Wrote ${added.length * WIDTHS.length} file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB, ` +
      `and rewrote the manifest with ${next.length} entries.`,
  );
  console.log('Commit public/recipes and data/images.seed.json, then deploy.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
