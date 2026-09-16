import { createHash } from 'node:crypto';

/**
 * A hash of what a row *is*, not of how it happened to be serialised.
 *
 * This is the whole verification story for the migration: export from one
 * project, import into the other, hash both, compare. That only means anything
 * if two identical rows hash identically regardless of the order PostgREST
 * chose to return their JSON keys in — which it does not guarantee, and which
 * differs between a `select *` and a named column list.
 *
 * So object keys are sorted recursively and arrays are left exactly as they
 * are. Array order is data: `tags: ['a', 'b']` and `tags: ['b', 'a']` are
 * different rows, and a "helpful" sort here would report a real difference as a
 * match — the one failure this function exists to prevent.
 *
 * Timestamps are compared as the exact strings the database returned. Parsing
 * and reformatting them would paper over a genuine precision change on the way
 * through the import, which is the kind of drift that shows up months later as
 * an ordering bug.
 */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(',')}}`;
}

/** SHA-256 over the UTF-8 bytes of the normalised form. */
export function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

/**
 * One hash for a whole table, order-sensitive.
 *
 * The export orders every table explicitly, so a difference in row order is a
 * difference worth failing on: it means the import did not preserve something,
 * or the two projects disagree about a collation.
 */
export function tableHash(rows: readonly unknown[]): string {
  const hash = createHash('sha256');
  for (const row of rows) hash.update(stableStringify(row), 'utf8').update('\n', 'utf8');
  return hash.digest('hex');
}
