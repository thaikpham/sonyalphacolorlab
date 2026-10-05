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
import { PILOT_DRAFTS } from '../src/lib/lab/pilot-drafts';

/**
 * `--with-pilot-drafts` also inserts the nine pilot pages from
 * `pilot-drafts.ts` — always as drafts, for review in `/admin/blog`. Without
 * the flag the script does exactly what it always did. `--dry-run` prints the
 * plan and writes nothing.
 */
async function main() {
  const { args, target } = requireTarget(process.argv.slice(2));
  if (target !== 'content') {
    throw new Error('This script seeds content tables. Pass --target content.');
  }
  const withPilots = args.withPilotDrafts;
  const dryRun = args.dryRun;
  const db = adminClient(target);

  const { data: existing, error: readError } = await db.from('lab_articles').select('id');
  if (readError) throw new Error(`read lab_articles: ${readError.message}`);

  const have = new Set((existing ?? []).map((r) => r.id as string));
  const candidates = [
    /* Published, because these three are already live on the site. A draft
       here would take them off it, which is the opposite of a seed. */
    ...ARTICLES.map((a) => ({ article: a, status: 'published' as const })),
    /* Drafts, always: pilot content is for the owner to review and publish
       by hand, after re-checking every source and filling every marker. */
    ...(withPilots ? PILOT_DRAFTS.map((a) => ({ article: a, status: 'draft' as const })) : []),
  ];
  const missing = candidates.filter((c) => !have.has(c.article.id));

  if (missing.length === 0) {
    console.log(`✓ all ${candidates.length} pages are already in Supabase`);
    return;
  }

  if (dryRun) {
    for (const c of missing) console.log(`  would insert ${c.status.padEnd(9)} ${c.article.kind.padEnd(9)} ${c.article.id}`);
    console.log(`  (dry run — nothing written; ${have.size} row(s) already present)`);
    return;
  }

  const now = new Date().toISOString();
  const rows = missing.map(({ article: a, status }) => ({
    id: a.id,
    status,
    kind: a.kind,
    topic: a.topic,
    level: a.level,
    archetype: a.archetype,
    read: a.read,
    title: a.title,
    dek: a.dek,
    blocks: a.blocks,
    meta: a.meta,
    created_at: now,
    updated_at: now,
    updated_by: null,
  }));

  const { error } = await db.from('lab_articles').insert(rows);
  if (error) throw new Error(`insert lab_articles: ${error.message}`);

  console.log(`✓ ${rows.length} page(s) inserted: ${missing.map((c) => `${c.article.id} (${c.status})`).join(', ')}`);
  if (have.size > 0) console.log(`  ${have.size} already present, left untouched`);
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
