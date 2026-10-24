/**
 * What `library:sync` would do to the content project, worked out without it.
 *
 * Pure: the seed, the rows the project holds, the withdrawn ids and the ids of
 * ColorLab's own originals go in; a plan comes out. The script prints it, and
 * writes it only with `--apply`. Kept apart from the script so every rule below
 * is a unit test rather than a production write.
 *
 * The rules, in the order they win:
 *
 * - A **withdrawn** id that is still published is unpublished, and nothing else
 *   happens to it. Never a delete: comments, proposals and contributed
 *   photographs on the control plane point at its slug.
 * - A seed recipe the project **lacks** is inserted unpublished, whatever the
 *   seed says — publishing is an editor's act in /admin/colorlab.
 * - A slug the project already gives to a **different** id stops the run: the
 *   unique index would refuse the insert anyway, and a silent skip is how a
 *   recipe goes missing. So does the reverse — an id the project holds under a
 *   **different slug**: that row is not the seed's recipe but one an editor
 *   created and `nextRecipeId` happened to number like an original, and
 *   refreshing or renaming it would put the original's colour over theirs.
 * - An **original** the project holds unpublished follows the seed whole
 *   (settings, white balance, tags, name, translations) — until the owner
 *   publishes it, the seed is its only source.
 * - Every other recipe the project holds keeps its settings; only a **name**
 *   that differs from the seed is updated. A published recipe's colour science
 *   is never changed by a script.
 */

export type PlanSeedRecipe = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
};

export type PlanExistingRow = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly published: boolean;
};

export type LibraryPlan = {
  /** Withdrawn ids still published. */
  readonly unpublish: readonly string[];
  /** Name changes on rows that otherwise keep everything. */
  readonly rename: readonly { readonly id: string; readonly from: string; readonly to: string }[];
  /** Unpublished originals that take the seed's row and translations whole. */
  readonly refresh: readonly string[];
  /** Seed recipes the project does not have, to insert unpublished. */
  readonly insert: readonly string[];
  /** Seed slugs the project gives to another id. Non-empty means stop. */
  readonly conflicts: readonly { readonly id: string; readonly slug: string; readonly heldBy: string }[];
};

export function planLibrarySync(
  seed: readonly PlanSeedRecipe[],
  existing: readonly PlanExistingRow[],
  retired: readonly string[],
  originals: ReadonlySet<string>,
): LibraryPlan {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const bySlug = new Map(existing.map((r) => [r.slug, r]));
  const withdrawn = new Set(retired);

  const unpublish = retired.filter((id) => byId.get(id)?.published === true);

  const rename: { id: string; from: string; to: string }[] = [];
  const refresh: string[] = [];
  const insert: string[] = [];
  const conflicts: { id: string; slug: string; heldBy: string }[] = [];

  for (const r of seed) {
    if (withdrawn.has(r.id)) continue;
    const holder = bySlug.get(r.slug);
    if (holder && holder.id !== r.id) {
      conflicts.push({ id: r.id, slug: r.slug, heldBy: holder.id });
      continue;
    }
    const row = byId.get(r.id);
    if (!row) {
      insert.push(r.id);
      continue;
    }
    if (row.slug !== r.slug) {
      conflicts.push({ id: r.id, slug: r.slug, heldBy: `${row.id} (as ${row.slug})` });
      continue;
    }
    if (originals.has(r.id) && !row.published) {
      refresh.push(r.id);
      continue;
    }
    if (row.name !== r.name) rename.push({ id: r.id, from: row.name, to: r.name });
  }

  return { unpublish, rename, refresh, insert, conflicts };
}
