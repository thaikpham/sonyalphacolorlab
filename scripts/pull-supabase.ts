/**
 * Pulls the product catalogue back out of Supabase into
 * `data/sony-cameras.seed.json` and `data/sony-audio.seed.json`.
 *
 * Supabase is the source of truth once the admin UI is in use, but the seed is
 * what the test suite reads and what the app falls back to with no credentials
 * — AGENTS.md requires the build to work offline. Without this, an admin edit
 * lives only in the database and `specs.test.ts` keeps asserting against a file
 * that is quietly months out of date.
 *
 *   npm run pull:supabase -- --target content         # write the files
 *   npm run pull:supabase -- --target content --dry   # print what would change, touch nothing
 *
 * Every column the admin editor writes comes back — names, image, gallery,
 * features and specs. It used to bring only features and specs, so a renamed
 * product or a corrected gallery stayed in the database alone, and the next
 * `push:supabase --overwrite` put the seed's old copy back over it.
 *
 * Run it before committing after an editing session. It is deliberately not
 * automatic: overwriting a tracked data file is a thing you should ask for.
 */
import { adminClient } from './lib/db';
import { requireTarget } from './supabase/args';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED_CAMERAS = join(process.cwd(), 'data', 'sony-cameras.seed.json');
const SEED_AUDIO = join(process.cwd(), 'data', 'sony-audio.seed.json');

/* `sony_cameras` lives in the content project. There is no generic "the
   project" left to default to, and pulling the catalogue out of the wrong one
   would overwrite the seed files with whatever that project happened to hold. */
const dry = process.argv.includes('--dry');

type Row = Record<string, unknown>;

const PULLED = [
  ['name', 'name'],
  ['full_name', 'fullName'],
  ['image_url', 'imageUrl'],
  ['gallery_urls', 'galleryUrls'],
  ['features', 'features'],
  ['specs', 'specs'],
  ['highlights', 'highlights'],
] as const;

async function main() {
  const { target } = requireTarget(process.argv.slice(2).filter((a) => a !== '--dry'));
  if (target !== 'content') {
    throw new Error('The catalogue lives in the content project. Pass --target content.');
  }
  const db = adminClient(target);
  const { data, error } = await db
    .from('sony_cameras')
    .select(
      'id, sku, name, full_name, category, sub_category_1, sub_category_2, price_vnd, price_formatted, url, image_url, gallery_urls, features, specs, highlights, updated_at, updated_by',
    );

  if (error) {
    console.error('Read failed:', error.message);
    process.exit(1);
  }
  if (!data?.length) {
    console.error('The table is empty. Refusing to overwrite the seed with nothing.');
    process.exit(1);
  }

  const cameraSeed = JSON.parse(readFileSync(SEED_CAMERAS, 'utf8')) as Row[];
  const audioSeed = JSON.parse(readFileSync(SEED_AUDIO, 'utf8')) as Row[];

  type SeedEntry = { seed: 'cameras' | 'audio'; row: Row };
  const entries: [string, SeedEntry][] = [
    ...cameraSeed.map((p): [string, SeedEntry] => [p.id as string, { seed: 'cameras', row: p }]),
    ...audioSeed.map((p): [string, SeedEntry] => [p.id as string, { seed: 'audio', row: p }]),
  ];
  const byId = new Map<string, SeedEntry>(entries);

  let cameraChanged = 0;
  let audioChanged = 0;
  const edits: string[] = [];

  for (const row of data as Row[]) {
    const entry = byId.get(row.id as string);
    if (!entry) {
      edits.push(`  ? ${row.id} — in Supabase, not in any seed. Add it by hand.`);
      continue;
    }

    const local = entry.row;
    let rowUpdated = false;

    /* Database column → seed key, for every column `/admin/wiki` can edit. A
       null column is "never written", not "cleared", and leaves the seed alone
       — the same reading `productFromRow` gives it. */
    for (const [column, key] of PULLED) {
      const next = row[column];
      if (next === null || next === undefined) continue;
      if (JSON.stringify(next) === JSON.stringify(local[key])) continue;
      local[key] = next;
      rowUpdated = true;
      const who = row.updated_by ? ` (by ${row.updated_by})` : '';
      edits.push(`  ~ ${row.id}.${key}${who}`);
    }

    if (rowUpdated) {
      if (entry.seed === 'cameras') cameraChanged++;
      else audioChanged++;
    }
  }

  for (const line of edits) console.log(line);

  const totalChanged = cameraChanged + audioChanged;
  if (totalChanged === 0) {
    console.log('Seeds already match Supabase. Nothing to write.');
    return;
  }
  if (dry) {
    console.log(`\n${totalChanged} field(s) would change. Re-run without --dry to write.`);
    return;
  }

  if (cameraChanged > 0) {
    writeFileSync(SEED_CAMERAS, `${JSON.stringify(cameraSeed, null, 2)}\n`, 'utf8');
    console.log(`Wrote changes to data/sony-cameras.seed.json.`);
  }
  if (audioChanged > 0) {
    writeFileSync(SEED_AUDIO, `${JSON.stringify(audioSeed, null, 2)}\n`, 'utf8');
    console.log(`Wrote changes to data/sony-audio.seed.json.`);
  }
  console.log('Run `npm run verify` before committing — the suite reads these files.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
