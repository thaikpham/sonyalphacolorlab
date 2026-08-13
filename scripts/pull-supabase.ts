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

const SEED = join(process.cwd(), 'data', 'sony-cameras.seed.json');

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

  const seed = JSON.parse(readFileSync(SEED, 'utf8')) as Row[];
  const byId = new Map(seed.map((p) => [p.id as string, p]));

  let changed = 0;
  const edits: string[] = [];

  for (const row of data as Row[]) {
    const local = byId.get(row.id as string);
    /* A row that exists only in the database is skipped, not appended. Adding a
       product is an extraction job with a cited source — see
       docs/HANDOVER-sony-product-specs.md — not something a sync should invent
       a seed entry for. */
    if (!local) {
      edits.push(`  ? ${row.id} — in Supabase, not in the seed. Add it by hand.`);
      continue;
    }

    for (const field of ['features', 'specs'] as const) {
      const next = row[field];
      if (next === null || next === undefined) continue;
      if (JSON.stringify(next) === JSON.stringify(local[field])) continue;
      local[field] = next;
      changed++;
      const who = row.updated_by ? ` (by ${row.updated_by})` : '';
      edits.push(`  ~ ${row.id}.${field}${who}`);
    }
  }

  for (const line of edits) console.log(line);

  if (changed === 0) {
    console.log('Seed already matches Supabase. Nothing to write.');
    return;
  }
  if (dry) {
    console.log(`\n${changed} field(s) would change. Re-run without --dry to write.`);
    return;
  }

  writeFileSync(SEED, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${changed} field(s) to data/sony-cameras.seed.json.`);
  console.log('Run `npm run verify` before committing — the suite reads this file.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
