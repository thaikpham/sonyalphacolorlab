/**
 * Every time recipe slugs moved, frozen at the time.
 *
 * A move is a pair of migrations — one on each plane, written once, applied
 * once, and history from then on — and the former → current pairs both files
 * rename. The pairs live here, not recomputed from the sources, because the
 * sources keep changing after the move: a Creative Look imported next month
 * arrives with an importer slug (`fl-sandeeshwara-perera-4`) that differs from
 * `slugFor(name)` and was never stored anywhere. Recomputing would call that a
 * former slug, and the paired migrations — which cannot be rewritten — would
 * stop matching the map.
 *
 * `data/former-slugs.json`, which every alias lookup reads
 * (`slug-aliases.ts`), is the union of these batches, written by `seed:emit`
 * and checked against them by `migration-roots.test.ts`.
 *
 * Renaming a recipe after its slug moved is a new batch: a new frozen JSON
 * under `data/slug-moves/`, a new migration on each plane carrying exactly its
 * pairs, and an entry below. `seed:emit` refuses the rename until then.
 */

import moves20261024 from '../../../data/slug-moves/2026-10-24.json';
import { recipeIdKey } from './recipe-id';

export type SlugMoveBatch = {
  readonly date: string;
  /** The content plane's migration, in `supabase/content/migrations`. */
  readonly content: string;
  /** The control plane's migration, in `supabase/migrations`. */
  readonly control: string;
  /** former → current, pair for pair what both migrations rename. */
  readonly moves: Readonly<Record<string, string>>;
};

export const SLUG_MOVES: readonly SlugMoveBatch[] = [
  {
    date: '2026-10-24',
    content: '20261024000000_recipe_code_ids.sql',
    control: '0020_recipe_slugs_to_codes.sql',
    moves: moves20261024,
  },
];

/** `pp-048-soft-clean-portrait` → `PP-048`; null for a slug not in the code shape. */
export function recipeIdOfSlug(slug: string): string | null {
  const m = /^(pp|cl)-(\d{3})-/.exec(slug);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
}

/**
 * The former-slug map `seed:emit` writes, and what stops it.
 *
 * `rows` carry the slug they will be emitted with (`slugFor(name)`). The map
 * is every batch's pairs, whole — a recipe later withdrawn from the seed keeps
 * its entry, because community rows and shared links still name it. A recipe
 * in no batch adds nothing, whatever slug its source gave it. A recipe whose
 * slug moved, and whose emitted slug is no longer the one it moved to, is a
 * rename with no migration behind it: reported, never mapped.
 */
export function formerSlugsFor(
  rows: readonly { readonly id: string; readonly slug: string }[],
  batches: readonly SlugMoveBatch[] = SLUG_MOVES,
): { formerSlugs: Record<string, string>; problems: string[] } {
  const formerSlugs: Record<string, string> = {};
  const movedTo = new Map<string, { slug: string; date: string }>();
  const problems: string[] = [];
  for (const batch of batches) {
    for (const [former, current] of Object.entries(batch.moves)) {
      const id = recipeIdOfSlug(current);
      if (!id) {
        problems.push(`${batch.date}: ${former} moved to ${current}, which is not a code-shape slug`);
        continue;
      }
      formerSlugs[former] = current;
      movedTo.set(id, { slug: current, date: batch.date });
    }
  }
  for (const r of rows) {
    const moved = movedTo.get(recipeIdKey(r.id));
    if (moved && moved.slug !== r.slug) {
      problems.push(
        `${r.id} would be emitted as ${r.slug}, but its slug moved to ${moved.slug} on ${moved.date}, ` +
          'and both planes hold that. A rename needs a new pair of migrations and a new batch in ' +
          'src/lib/recipes/slug-moves.ts.',
      );
    }
  }
  return { formerSlugs, problems };
}
