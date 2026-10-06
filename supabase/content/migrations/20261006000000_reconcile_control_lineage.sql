-- ---------------------------------------------------------------------------
-- 20261006000000 — reconcile the content project with this root
-- ---------------------------------------------------------------------------
--
-- The live content project was not built from 0001_content_baseline. Its
-- Supabase GitHub integration ran the CONTROL root (`supabase/migrations`)
-- against it, and the control-only tables were then dropped by hand. Until this
-- migration was recorded, it carried control's 0001–0016 as its own history.
-- That is why control 0016's `gallery_urls` grant reached it on 2026-10-05,
-- eight seconds after a production build had failed for want of it.
--
-- Tables, columns, constraints, indexes, enums and the shared function came out
-- identical to this root. These did not, and this file fixes them:
--
--   * Two read policies carry the control root's names. A later migration that
--     replaces `sony_cameras_public_read` or `lab_articles_public_read` by name
--     would miss them. `drop policy if exists` would succeed without dropping
--     anything, and the old permissive policy would stay in force beside the
--     new one. Policies are OR'd, so a narrower rule would change nothing.
--   * Control 0015 created `lab_assets` without its `updated_at` trigger.
--   * Control 0001 never revoked anything on the three recipe tables. Supabase's
--     default ACL therefore left anon and authenticated with table-level ALL.
--     RLS still refuses the writes, but a column added later becomes readable
--     by accident there and unreadable here, so a migration tested against one
--     shape could break the other.
--   * The `recipe-uploads` bucket (0002) may be missing.
--   * The two column comments may be missing (control's own `wb_preset` has none).
--
-- Every statement is a no-op on a database built from this root, so the file
-- can be recorded as applied wherever it has run. `migration-roots.test.ts`
-- applies it to a simulation of the live lineage, and to this root, and asserts
-- the two results are the same.
--
-- A timestamp, not 0004. The control root numbers 0001–0017 and the integration
-- compares version prefixes only. Had this been 0004, a control-root push into
-- content would read 0001–0004 as its own and run control 0005 onwards there,
-- `admin_emails` included. A version only this root has makes that push refuse.
-- Every later content migration is a timestamp too (`supabase migration new`).

-- A content-plane file. Control is the only database that holds these tables,
-- so refuse there before changing anything, rather than narrowing its grants.
do $$
declare
  found text;
begin
  select string_agg(t, ', ') into found
    from unnest(array['admin_emails', 'community_photos', 'recipe_comments',
                      'recipe_proposals', 'proposal_votes']) as t
   where to_regclass('public.' || t) is not null;
  if found is not null then
    raise exception 'content reconcile refused: this database holds control-plane tables (%)', found;
  end if;
end $$;

-- The catalogue reads `recipes` as anon with `select('*')`. After the revoke
-- below, a column outside the grant would make that read "permission denied"
-- for the whole table, so refuse a database with one rather than take the
-- recipe pages down.
do $$
declare
  stray text;
begin
  select string_agg(c.table_name || '.' || c.column_name, ', '
                    order by c.table_name, c.column_name) into stray
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name in ('recipes', 'recipe_translations', 'recipe_images')
     and (c.table_name::text, c.column_name::text) not in (
       select 'recipes', unnest(array[
         'id', 'legacy_id', 'slug', 'name', 'format', 'wb_mode', 'wb_kelvin', 'wb_auto',
         'wb_preset', 'wb_shift_ab_axis', 'wb_shift_ab_amount', 'wb_shift_gm_axis',
         'wb_shift_gm_amount', 'look', 'settings', 'tags', 'published', 'created_at',
         'updated_at'])
       union all
       select 'recipe_translations', unnest(array['recipe_id', 'locale', 'description', 'updated_at'])
       union all
       select 'recipe_images', unnest(array[
         'id', 'recipe_id', 'storage_path', 'alt', 'sort', 'width', 'height', 'created_at']));
  if stray is not null then
    raise exception 'content reconcile refused: % not in the anon read grant', stray;
  end if;
end $$;

create or replace trigger lab_assets_touch before update on lab_assets
  for each row execute function touch_updated_at();

-- The same statements as 0001, so a revoke here cannot take away a column that
-- the baseline grants.
revoke all on table recipes from anon, authenticated;
grant select (
  id, legacy_id, slug, name, format, wb_mode, wb_kelvin, wb_auto, wb_preset,
  wb_shift_ab_axis, wb_shift_ab_amount, wb_shift_gm_axis, wb_shift_gm_amount,
  look, settings, tags, published, created_at, updated_at
) on table recipes to anon, authenticated;

revoke all on table recipe_translations from anon, authenticated;
grant select (recipe_id, locale, description, updated_at)
  on table recipe_translations to anon, authenticated;

revoke all on table recipe_images from anon, authenticated;
grant select (id, recipe_id, storage_path, alt, sort, width, height, created_at)
  on table recipe_images to anon, authenticated;

-- Private, as in 0002. If a bucket of this name already exists, it is made
-- private rather than left as found.
insert into storage.buckets (id, name, public)
  values ('recipe-uploads', 'recipe-uploads', false)
  on conflict (id) do update set public = false;

comment on column recipes.wb_preset is
  'Light-source preset, e.g. Daylight / Cloudy / Underwater Auto. Null unless wb_mode = ''preset''.';

comment on column sony_cameras.features is
  'Either ["en text", …] (legacy, English) or {"en": [...], "vi": [...]}. Read via featureList().';

-- Renamed last: `alter policy` holds an ACCESS EXCLUSIVE lock on the catalogue
-- and the article store until commit, so it should be the shortest stretch.
-- If both names exist, the stray one is dropped.
do $$
begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'sony_cameras'
                and policyname = 'Allow public read access to sony_cameras') then
    if exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'sony_cameras'
                  and policyname = 'sony_cameras_public_read') then
      drop policy "Allow public read access to sony_cameras" on sony_cameras;
    else
      alter policy "Allow public read access to sony_cameras" on sony_cameras
        rename to sony_cameras_public_read;
    end if;
  end if;

  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'lab_articles'
                and policyname = 'Allow public read access to published lab_articles') then
    if exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'lab_articles'
                  and policyname = 'lab_articles_public_read') then
      drop policy "Allow public read access to published lab_articles" on lab_articles;
    else
      alter policy "Allow public read access to published lab_articles" on lab_articles
        rename to lab_articles_public_read;
    end if;
  end if;
end $$;

-- A REVOKE by a role that does not own the table is a warning, not an error.
-- Check that it took.
do $$
declare
  left_over text;
begin
  select string_agg(c.relname || ' ' || x.privilege_type || ' to ' ||
                    case x.grantee when 0 then 'public' else pg_get_userbyid(x.grantee) end, ', ')
    into left_over
    from pg_class c, aclexplode(c.relacl) x
   where c.oid in ('public.recipes'::regclass, 'public.recipe_translations'::regclass,
                   'public.recipe_images'::regclass)
     and (x.grantee = 0 or x.grantee in (select oid from pg_roles
                                          where rolname in ('anon', 'authenticated')));
  if left_over is not null then
    raise exception 'content reconcile: table-level privileges remain: %', left_over;
  end if;
end $$;
