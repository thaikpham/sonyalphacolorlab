-- Migration 0016: let the catalogue read the gallery it stores.
--
-- 0008 narrowed `sony_cameras` to a column-level SELECT grant. 0010 added
-- `gallery_urls` two migrations later and granted nothing, so on this project
-- the anon key cannot read the column at all. The catalogue never noticed
-- because it never asked: both readers took the gallery from the seed file,
-- which is exactly why a gallery saved in /admin/wiki reached the database and
-- never came back out of it.
--
-- The readers select `gallery_urls` now (see src/lib/cameras/row.ts). The
-- content project's baseline already grants it. This project still serves the
-- catalogue in one situation — the documented rollback, with
-- SUPABASE_ROLLBACK_MODE=true — and without this grant that read would fail
-- with "permission denied for column gallery_urls" and take the whole Wiki
-- down with it, mid-incident.
--
-- Revoke first, then grant the full list: the same statement shape and the
-- same columns as supabase/content/migrations/0001_content_baseline.sql. The
-- revoke also clears the INSERT/UPDATE/DELETE/TRUNCATE privileges Supabase's
-- default grants gave anon and authenticated on this table. RLS already
-- refuses those writes; a table holding `updated_by` addresses should not be
-- relying on one layer.
--
-- A correction, not an edit to 0010: that file is applied history.

revoke all on table sony_cameras from anon, authenticated;

grant select (
  id, sku, name, full_name, category, sub_category_1, sub_category_2,
  price_vnd, price_formatted, url, image_url, gallery_urls, features, specs,
  created_at
) on table sony_cameras to anon, authenticated;
