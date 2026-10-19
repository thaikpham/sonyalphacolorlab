/**
 * The decisions inside `pull:supabase`, out of the script so they can be
 * tested: the script itself connects to a project the moment it is imported.
 */

import { requireTarget, type Target } from '../supabase/args';

export type Row = Record<string, unknown>;

/**
 * `--dry` is what the runbook documents; `--dry-run` is what every other
 * script calls a preview. Both are one here. `--dry-run` used to pass the
 * argument check, be read by nothing, and write both seed files.
 */
export function readPullArgs(argv: readonly string[]): { target: Target; dry: boolean } {
  const { args, target } = requireTarget(
    argv.filter((a) => a !== '--dry'),
    ['--dry-run'],
  );
  return { target, dry: args.dryRun || argv.includes('--dry') };
}

/** Database column → seed key, for every column `/admin/wiki` can edit. */
const PULLED = [
  ['name', 'name'],
  ['full_name', 'fullName'],
  ['image_url', 'imageUrl'],
  ['gallery_urls', 'galleryUrls'],
  ['features', 'features'],
  ['specs', 'specs'],
  ['highlights', 'highlights'],
] as const;

/**
 * Columns whose null means "cleared", not "never written".
 *
 * For the rest, a null column leaves the seed alone — the same reading
 * `productFromRow` gives it, falling back to the seed. Highlights have no
 * fallback: the PATCH route writes null to clear them and the reader takes
 * null as "no highlights", so skipping it kept deleted highlights rendering in
 * every offline build.
 */
const CLEARABLE = new Set<string>(['highlights']);

/** Copies each row's edited columns into its seed entry, in place. */
export function mergePulled(
  rows: readonly Row[],
  seedRows: readonly Row[],
): { changed: Set<Row>; edits: string[] } {
  const byId = new Map(seedRows.map((p) => [p.id as string, p]));
  const changed = new Set<Row>();
  const edits: string[] = [];

  for (const row of rows) {
    const local = byId.get(row.id as string);
    if (!local) {
      edits.push(`  ? ${row.id} — in Supabase, not in any seed. Add it by hand.`);
      continue;
    }
    const who = row.updated_by ? ` (by ${row.updated_by})` : '';

    for (const [column, key] of PULLED) {
      const next = row[column];
      if (next === null || next === undefined) {
        if (next === null && CLEARABLE.has(column) && key in local) {
          delete local[key];
          changed.add(local);
          edits.push(`  - ${row.id}.${key}${who}`);
        }
        continue;
      }
      if (JSON.stringify(next) === JSON.stringify(local[key])) continue;
      local[key] = next;
      changed.add(local);
      edits.push(`  ~ ${row.id}.${key}${who}`);
    }
  }

  return { changed, edits };
}
