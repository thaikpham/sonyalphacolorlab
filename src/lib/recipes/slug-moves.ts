/**
 * Every time recipe slugs moved, frozen at the time.
 *
 * A move is a pair of migrations — one on each plane, written once, applied
 * once, and history from then on — and the former → current pairs both files
 * rename. The pairs live here, not recomputed from the sources, because the
 * sources keep changing after the move: a Creative Look imported next month
 * arrives with an importer slug (`fl-sandeeshwara-perera-4`) that differs from
 * the slug it is emitted with and was never stored anywhere. Recomputing would
 * call that a former slug, and the paired migrations — which cannot be
 * rewritten — would stop matching the map.
 *
 * Two moves so far. On 2026-10-24 each seed recipe's first slug (`mojave-sun`)
 * moved to its code and the name of the day (`pp-001-vivid-nostalgia-film`);
 * on 2026-10-28 it moved to the code alone (`pp-001`), because names are
 * computed from the settings since then and a name must be free to change
 * without moving a URL. The slug is `slugFor(id)` from now on, so there should
 * never be a third.
 *
 * Every spelling a recipe has had is its **history**, oldest first
 * (`slugHistories`): what `slug-aliases.ts` answers every lookup with, what
 * `library:sync` matches the content plane against, whichever generation it
 * holds. `data/former-slugs.json` is every earlier spelling mapped to the
 * newest, written by `seed:emit` and checked against these batches by
 * `migration-roots.test.ts`.
 *
 * Moving a slug again is a new batch: a new frozen JSON under
 * `data/slug-moves/`, a new migration on each plane carrying exactly its
 * pairs, and an entry below. `seed:emit` refuses the move until then.
 */

import moves20261024 from '../../../data/slug-moves/2026-10-24.json';
import moves20261028 from '../../../data/slug-moves/2026-10-28.json';
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
  {
    date: '2026-10-28',
    content: '20261028000000_recipe_code_slugs.sql',
    control: '0021_recipe_slugs_to_code_only.sql',
    moves: moves20261028,
  },
];

/** `pp-048` or `pp-048-soft-clean-portrait` → `PP-048`; null for a slug not in the code shape. */
export function recipeIdOfSlug(slug: string): string | null {
  const m = /^(pp|cl)-(\d{3})(?:-|$)/.exec(slug);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
}

/**
 * One spelling in a recipe's history: the slug, and the first database state
 * that holds it — the number of batches applied (0 before any move ran,
 * `batches.length` once all have).
 */
export type SlugSpelling = { readonly slug: string; readonly since: number };

/**
 * Every recipe's history, oldest spelling first, keyed by each spelling it
 * holds — so any spelling finds the whole list.
 *
 * A history starts at the first batch that moves it: its first spelling is
 * held from state 0 (a recipe that a later batch moves was written under it
 * by anything that inserted it before that batch ran), and batch k's target
 * from state k + 1. A batch that moves a slug which is not the end of its
 * history, or onto a slug another history already holds, is a broken record
 * and throws: the paired migrations would not agree with it.
 */
export function slugHistories(
  batches: readonly SlugMoveBatch[] = SLUG_MOVES,
): ReadonlyMap<string, readonly SlugSpelling[]> {
  const historyOf = new Map<string, SlugSpelling[]>();
  batches.forEach((batch, k) => {
    for (const [from, to] of Object.entries(batch.moves)) {
      let history = historyOf.get(from);
      if (!history) {
        history = [{ slug: from, since: 0 }];
        historyOf.set(from, history);
      } else if (history.at(-1)!.slug !== from) {
        throw new Error(`${batch.date}: ${from} moved again after it had already moved to ${history.at(-1)!.slug}`);
      }
      if (historyOf.has(to)) throw new Error(`${batch.date}: ${from} moves to ${to}, which another recipe already had`);
      history.push({ slug: to, since: k + 1 });
      historyOf.set(to, history);
    }
  });
  return historyOf;
}

let recorded: ReadonlyMap<string, readonly SlugSpelling[]> | null = null;
/** `slugHistories(SLUG_MOVES)`, built once. */
export const recordedHistories = (): ReadonlyMap<string, readonly SlugSpelling[]> =>
  (recorded ??= slugHistories(SLUG_MOVES));

/**
 * The spelling a database that has applied the first `state` batches holds
 * for the recipe `slug` is a spelling of: `mojave-sun` at 0,
 * `pp-001-vivid-nostalgia-film` at 1, `pp-001` at 2. A slug in no history is
 * itself in every state.
 */
export function slugAtState(
  slug: string,
  state: number,
  histories: ReadonlyMap<string, readonly SlugSpelling[]> = recordedHistories(),
): string {
  const history = histories.get(slug);
  if (!history) return slug;
  let at = history[0].slug;
  for (const s of history) if (s.since <= state) at = s.slug;
  return at;
}

/**
 * The former-slug map `seed:emit` writes, and what stops it.
 *
 * Every spelling that is not the newest in its history, mapped to the newest:
 * `mojave-sun` and `pp-001-vivid-nostalgia-film` both to `pp-001`. A recipe
 * later withdrawn from the seed keeps its entries, because community rows and
 * shared links still name it, and a recipe in no batch adds nothing, whatever
 * slug its source gave it.
 *
 * `rows` carry the slug they will be emitted with (`slugFor(id)`). A recipe
 * whose slug moved and whose emitted slug is not the newest it moved to is a
 * rename with no migration behind it: reported, never mapped. So is a batch
 * whose target is not a code-shape slug.
 */
export function formerSlugsFor(
  rows: readonly { readonly id: string; readonly slug: string }[],
  batches: readonly SlugMoveBatch[] = SLUG_MOVES,
): { formerSlugs: Record<string, string>; problems: string[] } {
  const problems: string[] = [];
  for (const batch of batches) {
    for (const [former, current] of Object.entries(batch.moves)) {
      if (!recipeIdOfSlug(current)) {
        problems.push(`${batch.date}: ${former} moved to ${current}, which is not a code-shape slug`);
      }
    }
  }
  let histories: ReadonlyMap<string, readonly SlugSpelling[]>;
  try {
    histories = slugHistories(batches);
  } catch (e) {
    return { formerSlugs: {}, problems: [...problems, e instanceof Error ? e.message : String(e)] };
  }

  const formerSlugs: Record<string, string> = {};
  const movedTo = new Map<string, { slug: string; date: string }>();
  for (const batch of batches) {
    for (const current of Object.values(batch.moves)) {
      const history = histories.get(current)!;
      const newest = history.at(-1)!;
      for (const s of history) if (s !== newest) formerSlugs[s.slug] = newest.slug;
      const id = recipeIdOfSlug(newest.slug);
      if (id) movedTo.set(id, { slug: newest.slug, date: batches[newest.since - 1].date });
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
