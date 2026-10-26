/**
 * Per-route counts for the gates that found more than zero on the first run.
 * The same rule as src/design/floor.baseline.json: a number here is what was
 * measured, and the check is an EXACT match, not a ceiling. A ceiling lets a
 * checker that stops seeing — or a fix that is never recorded — pass in
 * silence; an exact match turns both red. More than recorded: fix it. Fewer:
 * lower the entry in the same PR as the fix. A route with no entry is held at
 * zero.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Kind = 'layout' | 'axe' | 'targets';
// Not `import.meta.dirname`: Playwright's test loader requires this module as
// CJS, where `import.meta` throws before any test runs. Like setup.ts's
// fixture, this assumes cwd is the repo root.
const FILE = join(process.cwd(), 'e2e', 'budgets.json');
const budgets = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Record<string, number>>;

export function budgetFor(kind: Kind, path: string): number {
  return budgets[kind]?.[path] ?? 0;
}

/** Prints what was found and whether it is exactly the route's recorded count. */
export function report(kind: Kind, path: string, found: readonly string[]): boolean {
  const budget = budgetFor(kind, path);
  if (found.length) console.log(`${kind} ${path}: ${found.length}/${budget}\n  ${found.join('\n  ')}`);
  if (found.length > budget) console.log(`${kind} ${path}: ${found.length} > ${budget} — fix it`);
  if (found.length < budget) console.log(`${kind} ${path}: ${found.length} < ${budget} — lower e2e/budgets.json to ${found.length}`);
  return found.length === budget;
}
