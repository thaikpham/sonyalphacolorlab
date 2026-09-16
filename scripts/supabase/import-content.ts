/**
 * Load an export into a project, in dependency order, without deleting anything.
 *
 *   npm run content:import -- --source control --destination content --manifest initial --dry-run
 *   npm run content:import -- --source control --destination content --manifest initial --apply
 *
 * Three properties, each of them a decision:
 *
 * - **Upsert, never delete.** An import that reconciles by deleting rows the
 *   snapshot does not contain is a foot-gun aimed at whichever project it is
 *   pointed at. The destination is meant to be empty or behind; making it
 *   *equal* by removing rows is a different operation with a different blast
 *   radius, and it is not this one.
 * - **Dependency order.** `recipe_translations` has a cascading key to
 *   `recipes`, `lab_assets` a restrictive one to `lab_articles`. Any other
 *   order fails on the first row — which is the good outcome; the bad one is a
 *   partially loaded catalogue nobody checked.
 * - **Dry run by default.** `--apply` is the only thing that writes.
 *
 * Writing *into the control project* is the emergency rollback and is refused
 * without `--rollback`. See `args.ts`.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { ArgumentError, requireTransfer } from './args';
import { adminClient, originOf } from './clients';
import { CONTENT_TABLES, FORBIDDEN_IN_CONTENT, ROLLBACK_ALLOWLIST } from './tables';
import { EXPORT_ROOT } from './export-content';

/** Small enough that one bad row is easy to find in the error. */
const BATCH = 100;

async function latestExport(label: string): Promise<string> {
  const entries = await readdir(EXPORT_ROOT);
  const matching = entries.filter((e) => e.startsWith(`${label}-`)).sort();
  if (matching.length === 0) throw new Error(`No export labelled "${label}" under ${EXPORT_ROOT}.`);
  return join(EXPORT_ROOT, matching[matching.length - 1]);
}

async function main() {
  const { args, source, destination } = requireTransfer(process.argv.slice(2));
  const label = args.manifest ?? 'initial';
  const dir = await latestExport(label);

  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
    source: string;
    tables: Record<string, { count: number }>;
  };

  if (manifest.source !== source) {
    throw new Error(
      `That export came from the ${manifest.source} plane, but --source says ${source}.`,
    );
  }

  const allowed = new Set(
    destination === 'control' ? ROLLBACK_ALLOWLIST : CONTENT_TABLES.map((t) => t.name),
  );

  console.log(`\n  ${args.apply ? 'IMPORTING' : 'dry run'}: ${source} -> ${destination}`);
  console.log(`  ${originOf(destination)}`);
  console.log(`  ${dir}\n`);

  if (destination === 'control') {
    console.warn(
      '  !  Rollback mode. Only the retained legacy content tables are written;\n' +
        '     Auth, admin_emails and the community tables are not touched.\n',
    );
  }

  const db = adminClient(destination);

  /* Proof, not assumption: an import into a content project that has somehow
     grown a control table would mean the two planes are not actually separate,
     and loading rows into it would make that worse. */
  if (destination === 'content') {
    for (const table of FORBIDDEN_IN_CONTENT) {
      const { error } = await db.from(table).select('*', { head: true, count: 'exact' });
      /* A missing table is what we want, and PostgREST says so with a schema
         error rather than an empty result. */
      if (!error) {
        throw new Error(
          `The content project has a ${table} table. That belongs to the control plane; ` +
            'refusing to import until the planes are actually separate.',
        );
      }
    }
  }

  for (const spec of CONTENT_TABLES) {
    if (!allowed.has(spec.name)) continue;

    const rows = JSON.parse(await readFile(join(dir, `${spec.name}.json`), 'utf8')) as unknown[];
    const expected = manifest.tables[spec.name]?.count ?? 0;
    if (rows.length !== expected) {
      throw new Error(
        `${spec.name}: the file holds ${rows.length} rows, the manifest says ${expected}.`,
      );
    }

    if (!args.apply) {
      console.log(`  would upsert ${String(rows.length).padStart(5)} into ${spec.name}`);
      continue;
    }

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await db.from(spec.name).upsert(batch, { onConflict: spec.key.join(',') });
      if (error) throw new Error(`${spec.name} [${i}..${i + batch.length}): ${error.message}`);
    }
    console.log(`  upserted ${String(rows.length).padStart(5)} into ${spec.name}`);
  }

  console.log(
    args.apply
      ? '\n  OK imported. Run content:verify before letting anything read this project.\n'
      : '\n  Dry run only. Re-run with --apply to write.\n',
  );
}

main().catch((error) => {
  console.error(error instanceof ArgumentError ? `\n  ${error.message}\n` : error);
  process.exit(1);
});
