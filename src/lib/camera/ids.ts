/**
 * Recipe id and tag shapes, apart from the zod schema so client code can read
 * them without shipping zod (src/design/client-graph.test.ts). `schema.ts`
 * re-exports them; `sql-drift.test.ts` still pins RECIPE_ID_RE to the CHECK.
 */

/**
 * `PP-001` / `CL-042` — the shape the content plane's CHECK stores once
 * `20261024000000_recipe_code_ids.sql` has run, and the shape the seed, the
 * originals and the importers issue. `sql-drift.test.ts` pins it to that CHECK.
 */
export const RECIPE_ID_RE = /^(PP|CL)-\d{3}$/;

/**
 * Either shape: the code `PP-001`, or the `SCL-PP-001` the content plane holds
 * until its migration is applied by hand (S1, S7). Everything that READS an id
 * accepts both, so a deployment never depends on whether that migration has
 * run, and stays tolerant after it: a stale link or a rollback copy still
 * carries the old shape. Group 1 is the format code.
 */
export const RECIPE_ID_TRANSITION_RE = /^(?:SCL-)?(PP|CL)-\d{3}$/;

/** A recipe tag: lower-case, digits and dashes. Also what a `?tag=` filter must be. */
export const RECIPE_TAG_RE = /^[a-z0-9-]+$/;
