-- 0018: `highlights` on the control project's dormant sony_cameras copy, so a
-- rollback import keeps one column list (scripts/supabase/tables.ts). Same
-- statements as content 20261007000001.

alter table sony_cameras add column if not exists highlights jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sony_cameras_highlights_is_object') then
    alter table sony_cameras
      add constraint sony_cameras_highlights_is_object
      check (highlights is null or jsonb_typeof(highlights) = 'object');
  end if;
end $$;

grant select (highlights) on table sony_cameras to anon, authenticated;
