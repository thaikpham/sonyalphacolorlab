/**
 * A deterministic snapshot of the content tables, plus the hashes that prove it.
 *
 * Everything here exists to make one question answerable at cutover: does the
 * new project hold exactly what the old one held? "The page looks right" is not
 * an answer — 47 recipes with one silently truncated `settings` object looks
 * identical to 47 correct ones.
 *
 * So: explicit column lists, explicit ordering, full pagination, and a SHA-256
 * over a key-sorted normalisation of every row. `verify-content.ts` recomputes
 * the same numbers against the destination and exits nonzero on any difference.
 *
 *   npm run content:export -- --target control --label initial
 *
 * Nothing about people is exported. No `auth` schema, no `admin_emails`, no
 * community tables, no keys. The artifact lands in a gitignored directory
 * because it still contains `updated_by` — an editor's address — and a JSON
 * file of the whole catalogue is not something to leave in a repository.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ArgumentError, requireTarget } from './args';
import { adminClient, originOf } from './clients';
import { stableHash, tableHash } from './stable-hash';
import { CONTENT_TABLES, type TableSpec } from './tables';

/** Large enough to be few round trips, small enough to stay under any limit. */
const PAGE = 500;

export const EXPORT_ROOT = join('artifacts', 'supabase', 'content-export');

type Row = Record<string, unknown>;

/**
 * Every row, in the declared order, however many pages that takes.
 *
 * PostgREST caps a response at its configured maximum and says so only by
 * returning fewer rows than asked for. An export that reads one page and stops
 * reports a clean hash over two thirds of the catalogue.
 */
async function readAll(db: ReturnType<typeof adminClient>, spec: TableSpec): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(spec.name).select(spec.columns.join(', ')).range(from, from + PAGE - 1);
    for (const column of spec.orderBy) query = query.order(column, { ascending: true });

    const { data, error } = await query;
    if (error) throw new Error(`${spec.name}: ${error.message}`);

    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/** A row's stable identity, as JSON so no separator can appear inside a value. */
export function identify(spec: TableSpec, row: Row): string {
  return JSON.stringify(spec.key.map((k) => row[k]));
}

async function main() {
  const { args, target } = requireTarget(process.argv.slice(2));
  const label = args.label ?? 'initial';
  const db = adminClient(target);

  console.log(`\n  exporting content from the ${target} plane`);
  console.log(`  ${originOf(target)}\n`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(EXPORT_ROOT, `${label}-${stamp}`);
  await mkdir(dir, { recursive: true });

  const tables: Record<string, unknown> = {};

  for (const spec of CONTENT_TABLES) {
    const rows = await readAll(db, spec);
    await writeFile(join(dir, `${spec.name}.json`), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');

    tables[spec.name] = {
      count: rows.length,
      ids: rows.map((row) => identify(spec, row)),
      hash: tableHash(rows),
      /* Per-row hashes as well as the table hash. A table-level mismatch says
         something is wrong; these say *which row*, which is the difference
         between a two-minute fix and an afternoon. */
      rows: Object.fromEntries(rows.map((row) => [identify(spec, row), stableHash(row)])),
    };

    console.log(`  ${spec.name.padEnd(20)} ${String(rows.length).padStart(5)} rows`);
  }

  /*
   * Article media is referenced by UUID, so there is no URL in a block to
   * rewrite — that coupling was removed before this script existed, which is
   * why there is no legacy-URL resolution pass here. `lab_assets` rows carry
   * the paths, and the objects at those paths are copied by the cutover plan's
   * storage step, which verifies them against these hashes.
   */
  const manifest = {
    label,
    source: target,
    exportedAt: new Date().toISOString(),
    tables,
  };

  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`\n  ✓ ${dir}\n`);
}

main().catch((error) => {
  console.error(error instanceof ArgumentError ? `\n  ${error.message}\n` : error);
  process.exit(1);
});
