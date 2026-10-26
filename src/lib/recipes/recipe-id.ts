/*
 * Recipe ids are moving from `SCL-PP-001` to `PP-001` (2026-10-24). These two
 * helpers carry no dependencies, so client and server code can share them.
 * The old spelling stays a search alias after the move: it is the code the
 * site displayed for years.
 */

/**
 * One key for either shape: `SCL-PP-001` and `PP-001` both give `PP-001`.
 * Anything that looks a recipe up by id — a git-time manifest, a related link
 * written before the rename, a cache filled on the other side of it — compares
 * through this, so the two shapes never miss each other.
 */
export const recipeIdKey = (id: string): string => id.replace(/^SCL-/, '');

/** Both spellings of an id, for search: the code a reader sees now and the one they saw for years. */
export const recipeIdAliases = (id: string): readonly string[] => {
  const key = recipeIdKey(id);
  return [key, `SCL-${key}`];
};
