-- ---------------------------------------------------------------------------
-- 20261007000001 — highlights for the camera page
-- ---------------------------------------------------------------------------
--
-- 4–6 explained key features and up to eight plain core specs, EN and VI, for
-- a buyer. The shape is validated by `highlightsSchema` (src/lib/cameras/
-- highlights.ts) on every read and write; the database only insists it is an
-- object or nothing, so a malformed write is refused rather than stored.
-- Public, like every other catalogue column the page reads.

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
