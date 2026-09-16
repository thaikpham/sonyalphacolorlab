/**
 * Pushes the three authored articles into `lab_articles`.
 *
 * Run once, after migration 0013 has been applied:
 *
 *   npm run push:lab
 *
 * The catalogue used to live in `src/lib/lab/articles.ts` and be compiled into
 * the build. `lib/lab/data.ts` now reads Supabase and falls back to that array
 * only when the table is missing or Supabase is unreachable — so the moment the
 * migration lands on a project with an empty table, `/blog` goes empty. This
 * script is what closes that gap: the seed becomes real rows, and the editor
 * can open all three in the admin.
 *
 * Idempotent, and deliberately NOT an upsert. An article edited through the
 * admin must not be silently reverted to the compiled version by someone
 * re-running a seed script — that is a day of editorial work gone with no
 * error. Rows that already exist are counted and skipped.
 */

import { adminClient } from './lib/db';
import { requireTarget } from './supabase/args';
import { ARTICLES } from '../src/lib/lab/articles';

async function main() {
  const { target } = requireTarget(process.argv.slice(2));
  if (target !== 'content') {
    throw new Error('This script seeds content tables. Pass --target content.');
  }
  const db = adminClient(target);

  const { data: existing, error: readError } = await db.from('lab_articles').select('id');
  if (readError) throw new Error(`read lab_articles: ${readError.message}`);

  const have = new Set((existing ?? []).map((r) => r.id as string));
  const missing = ARTICLES.filter((a) => !have.has(a.id));

  if (missing.length === 0) {
    console.log(`✓ all ${ARTICLES.length} authored articles are already in Supabase`);
    return;
  }

  const now = new Date().toISOString();
  const rows = missing.map((a) => ({
    id: a.id,
    // Published, because these three are already live on the site. A draft
    // here would take them off it, which is the opposite of a seed.
    status: 'published',
    topic: a.topic,
    level: a.level,
    archetype: a.archetype,
    read: a.read,
    title: a.title,
    dek: a.dek,
    blocks: a.blocks,
    created_at: now,
    updated_at: now,
    updated_by: null,
  }));

  const { error } = await db.from('lab_articles').insert(rows);
  if (error) throw new Error(`insert lab_articles: ${error.message}`);

  console.log(`✓ ${rows.length} article(s) inserted: ${missing.map((a) => a.id).join(', ')}`);
  if (have.size > 0) console.log(`  ${have.size} already present, left untouched`);
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
