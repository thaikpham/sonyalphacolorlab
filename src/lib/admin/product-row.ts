import 'server-only';
import { PRODUCT_COLUMNS, type ProductRow } from '@/lib/cameras/row';

/**
 * What the admin product routes select: the public columns plus the row's
 * version.
 *
 * `updated_at` is the optimistic-concurrency token. The editor opens a product
 * through `GET /api/admin/products/[id]`, keeps the version that came with it,
 * and names it on save; a row that has been saved since refuses the write
 * (409 `staleEdit`) instead of having the second save silently revert the
 * first.
 *
 * Never folded into `PRODUCT_COLUMNS`. That list is what the catalogue reads
 * select under the anon key, and every column in it must be granted to `anon`
 * — `updated_at` is provenance and is not. These routes run with
 * `contentAdmin()` behind `adminGate()`. `updated_by` stays out of both lists:
 * it is an email address and the editor has no use for it.
 */
export const ADMIN_PRODUCT_COLUMNS = `${PRODUCT_COLUMNS}, updated_at`;

export type AdminProductRow = ProductRow & { updated_at: string | null };
