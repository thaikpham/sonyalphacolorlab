/**
 * Pulls the product catalogue back out of Supabase into
 * `data/sony-cameras.seed.json`.
 *
 * Supabase is the source of truth once the admin UI is in use, but the seed is
 * what the test suite reads and what the app falls back to with no credentials
 * — AGENTS.md requires the build to work offline. Without this, an admin edit
 * lives only in the database and `specs.test.ts` keeps asserting against a file
 * that is quietly months out of date.
 *
 *   npm run pull:supabase          # write the file
 *   npm run pull:supabase -- --dry # print what would change, touch nothing
 *
 * Run it before committing after an editing session. It is deliberately not
 * automatic: overwriting a tracked data file is a thing you should ask for.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SEED_CAMERAS = join(process.cwd(), 'data', 'sony-cameras.seed.json');
const SEED_AUDIO = join(process.cwd(), 'data', 'sony-audio.seed.json');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}

const dry = process.argv.includes('--dry');

type Row = Record<string, unknown>;

async function main() {
  const db = createClient(url!, key!, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('sony_cameras')
    .select(
      'id, sku, name, full_name, category, sub_category_1, sub_category_2, price_vnd, price_formatted, url, image_url, features, specs, updated_at, updated_by',
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

    for (const field of ['features', 'specs'] as const) {
      const next = row[field];
      if (next === null || next === undefined) continue;
      if (JSON.stringify(next) === JSON.stringify(local[field])) continue;
      local[field] = next;
      rowUpdated = true;
      const who = row.updated_by ? ` (by ${row.updated_by})` : '';
      edits.push(`  ~ ${row.id}.${field}${who}`);
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
