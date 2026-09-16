-- ---------------------------------------------------------------------------
-- 0002 — the recipe photograph intake bucket
-- ---------------------------------------------------------------------------
--
-- PRIVATE, and it must stay private. The baseline says recipe photography "is
-- not here and never will be", and this does not contradict that: nothing in
-- this bucket is ever served to a reader. It is the INTAKE.
--
-- The split the two halves make:
--
--   `/admin/colorlab` uploads  ->  recipe-uploads (private)  ->  the editor
--                                                                sees it via a
--                                                                signed URL
--
--   npm run vendor:images      ->  public/recipes (committed) ->  every reader,
--                                                                on the static
--                                                                CDN, no egress
--                                                                quota in front
--
-- Making this bucket public would re-create the 2026-09-11 incident exactly:
-- Storage served the recipe grid at stored resolution, 1.27 GB of cached egress
-- a day against a 5 GB quota, and the whole project answered 402 — Storage,
-- Auth and PostgREST together. The grid is still the highest-traffic image
-- surface on the site. There is no policy below for `anon` or `authenticated`
-- on this bucket, and there must never be one: the service-role key is the only
-- thing that reads it, from the upload route and from the vendor script.

insert into storage.buckets (id, name, public)
  values ('recipe-uploads', 'recipe-uploads', false)
  on conflict (id) do nothing;

-- No `create policy` for this bucket. The omission is the security property, so
-- it is written down rather than left to be noticed.
