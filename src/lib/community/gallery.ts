import 'server-only';

/**
 * What both gallery write paths share.
 *
 * A community photo arrives two ways: `POST /api/community-photos`, and as the
 * sample photograph of a proposal. The second path used to restate the insert
 * by hand and drifted from the first in every way that mattered — no photo cap,
 * a credit longer than the column's own CHECK, and the author's address in
 * `submitted_by`, a column the anon key could read.
 */

export const MAX_PHOTOS_PER_RECIPE = 40;

/**
 * Coarse origin marker for `community_photos.submitted_by`, kept for abuse
 * cleanup. Deliberately not an identity: 0019 narrowed the table's grant, but
 * an address in this column was a published address until then, and nothing
 * that reads it needs to know who the submitter is.
 */
export const clientKey = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  req.headers.get('x-real-ip') ??
  'local';
