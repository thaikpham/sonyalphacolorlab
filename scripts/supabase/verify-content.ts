/**
 * Does the destination hold exactly what the export said?
 *
 * This is the gate the cutover turns on, and it is deliberately dumber than the
 * import: it re-reads the destination with the same column list and the same
 * ordering, recomputes the same hashes, and compares. It shares no code path
 * with the writing side beyond the table definitions, so an import bug cannot
 * also make the verification agree with it.
 *
 *   npm run content:verify -- --target content --manifest initial
 *
 * Exits nonzero on any difference, and prints which rows differ rather than
 * only that something does. "Counts match" is not verification — 47 recipes
 * with one truncated `settings` object counts as 47.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { ArgumentError, requireTarget } from './args';
import { adminClient, originOf } from './clients';
import { stableHash, tableHash } from './stable-hash';
import { CONTENT_TABLES, FORBIDDEN_IN_CONTENT, type TableSpec } from './tables';
import { EXPORT_ROOT, identify } from './export-content';

const PAGE = 500;

type Row = Record<string, unknown>;

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

async function latestExport(label: string): Promise<string> {
  const entries = await readdir(EXPORT_ROOT);
  const matching = entries.filter((e) => e.startsWith(`${label}-`)).sort();
  if (matching.length === 0) throw new Error(`No export labelled "${label}" under ${EXPORT_ROOT}.`);
  return join(EXPORT_ROOT, matching[matching.length - 1]);
}

async function main() {
  const { args, target } = requireTarget(process.argv.slice(2));
  const label = args.manifest ?? 'initial';
  const dir = await latestExport(label);

  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
    tables: Record<
      string,
      { count?: number; hash?: string; rows?: Record<string, string>; absent?: boolean }
    >;
  };

  console.log(`\n  verifying the ${target} plane against ${dir}`);
  console.log(`  ${originOf(target)}\n`);

  const db = adminClient(target);
  const failures: string[] = [];

  /* In rollback mode the destination is the control project, which legitimately
     holds Auth and the community tables alongside the content ones. Outside it,
     a control table in the content project means the planes are not separate. */
  if (!args.rollback) {
    for (const table of FORBIDDEN_IN_CONTENT) {
      /* A real GET. PostgREST answers a HEAD with `204` and no error whether
         or not the relation exists, so a HEAD probe would report every one of
         these as present and fail every verification. */
      const { error } = await db.from(table).select('*').limit(1);
      if (!error) {
        failures.push(`${table} exists here and belongs to the control plane`);
      } else if (error.code !== 'PGRST205') {
        failures.push(`could not establish whether ${table} exists: ${error.message}`);
      }
    }
  }

  for (const spec of CONTENT_TABLES) {
    const expected = manifest.tables[spec.name];
    if (!expected) {
      failures.push(`${spec.name}: absent from the manifest`);
      continue;
    }

    /* Absent on the source, so the export moved nothing and claimed nothing.
       Verifying it against a count and a hash that were never recorded is what
       produced a `FAIL` on a table the cutover never touched. */
    if (expected.absent) {
      console.log(`  --   ${spec.name.padEnd(20)}  absent on the source, nothing to verify`);
      continue;
    }

    const rows = await readAll(db, spec);
    const actualHash = tableHash(rows);
    const ok = rows.length === expected.count && actualHash === expected.hash;

    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${spec.name.padEnd(20)} ${String(rows.length).padStart(5)} rows`,
    );

    if (rows.length !== expected.count) {
      failures.push(`${spec.name}: ${rows.length} rows here, ${expected.count} in the export`);
    }

    if (actualHash !== expected.hash) {
      /* Name the rows. A table-level mismatch tells an operator to look; this
         tells them where, which is the difference between a two-minute fix and
         an afternoon of diffing JSON. */
      const here = new Map(rows.map((row) => [identify(spec, row), stableHash(row)]));
      const recorded = expected.rows ?? {};
      const differing = [
        ...Object.keys(recorded).filter((id) => here.get(id) !== recorded[id]),
        ...[...here.keys()].filter((id) => !(id in recorded)),
      ];
      failures.push(
        `${spec.name}: ${differing.length} row(s) differ, first: ${differing.slice(0, 5).join(', ')}`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('\n  Verification failed:');
    for (const failure of failures) console.error(`    - ${failure}`);
    console.error('');
    process.exit(1);
  }

  console.log('\n  OK every table matches the export.\n');
}

main().catch((error) => {
  console.error(error instanceof ArgumentError ? `\n  ${error.message}\n` : error);
  process.exit(1);
});
