import type { Target } from './args';

/**
 * What lives where, as data rather than as a comment.
 *
 * The export, the import and the verification all need the same answer to
 * "which tables, in what order, with which columns" — and they need it to be
 * the *same* answer, because the whole cutover is gated on a hash comparison
 * between an export and an import that disagreed about nothing.
 *
 * The order is dependency order and is not alphabetical. `recipe_translations`
 * and `recipe_images` have cascading foreign keys to `recipes`; `lab_assets`
 * has a restrictive one to `lab_articles`. An import in any other order fails
 * on the first row.
 *
 * Columns are named, never `*`. An export built from `*` silently starts
 * carrying a column added later — which for `updated_by` means an editorial
 * email address in a JSON artifact on somebody's laptop.
 */

export type TableSpec = {
  readonly name: string;
  readonly columns: readonly string[];
  /** Ordered explicitly so two exports of the same data hash identically. */
  readonly orderBy: readonly string[];
  /** The stable identity of a row, for the manifest's ID list. */
  readonly key: readonly string[];
};

export const CONTENT_TABLES: readonly TableSpec[] = [
  {
    name: 'recipes',
    columns: [
      'id', 'legacy_id', 'slug', 'name', 'format', 'wb_mode', 'wb_kelvin', 'wb_auto',
      'wb_preset', 'wb_shift_ab_axis', 'wb_shift_ab_amount', 'wb_shift_gm_axis',
      'wb_shift_gm_amount', 'look', 'settings', 'tags', 'published', 'created_at', 'updated_at',
    ],
    orderBy: ['id'],
    key: ['id'],
  },
  {
    name: 'recipe_translations',
    columns: ['recipe_id', 'locale', 'description', 'updated_at'],
    orderBy: ['recipe_id', 'locale'],
    key: ['recipe_id', 'locale'],
  },
  {
    name: 'recipe_images',
    columns: ['id', 'recipe_id', 'storage_path', 'alt', 'sort', 'width', 'height', 'created_at'],
    orderBy: ['recipe_id', 'sort'],
    key: ['id'],
  },
  {
    name: 'sony_cameras',
    columns: [
      'id', 'sku', 'name', 'full_name', 'category', 'sub_category_1', 'sub_category_2',
      'price_vnd', 'price_formatted', 'url', 'image_url', 'gallery_urls', 'features', 'specs',
      'created_at', 'updated_at', 'updated_by',
    ],
    orderBy: ['id'],
    key: ['id'],
  },
  {
    name: 'lab_articles',
    columns: [
      'id', 'status', 'topic', 'level', 'archetype', 'read', 'title', 'dek', 'blocks',
      'created_at', 'updated_at', 'updated_by',
    ],
    orderBy: ['id'],
    key: ['id'],
  },
  {
    name: 'lab_assets',
    columns: [
      'id', 'article_id', 'storage_path', 'mime_type', 'width', 'height', 'byte_size',
      'animated', 'state', 'created_at', 'updated_at', 'updated_by',
    ],
    orderBy: ['id'],
    key: ['id'],
  },
];

/**
 * Tables that must never appear in the content project.
 *
 * Checked rather than assumed, because the failure is quiet: a content project
 * that grew an `admin_emails` would be a second, unsupervised answer to "who
 * may edit this site", with different RLS, in a different organisation,
 * reachable by a different credential. Nothing on the site would look wrong.
 */
export const FORBIDDEN_IN_CONTENT: readonly string[] = [
  'admin_emails',
  'community_photos',
  'recipe_comments',
  'recipe_proposals',
  'proposal_votes',
];

/**
 * The legacy content tables the control project still holds.
 *
 * They are the rollback copy: read-only, no dual writes, retained for at least
 * fourteen days. A rollback import is allowed to write exactly these and
 * nothing else — an import that could touch `admin_emails` during an incident
 * is a way to lose the administrator list at the worst possible moment.
 */
export const ROLLBACK_ALLOWLIST: readonly string[] = CONTENT_TABLES.map((t) => t.name);

export function tablesFor(target: Target): readonly TableSpec[] {
  /* The same list either way: a rollback writes the content tables back into
     the control project, which is why they were not dropped at cutover. */
  return target === 'content' ? CONTENT_TABLES : CONTENT_TABLES;
}
