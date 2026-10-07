-- Migration 0019: narrow community_photos to the columns the gallery reads,
-- and give a proposal somewhere to keep its sample photograph.
--
-- 1. community_photos had no column-level grant. 0002 added only a row policy,
--    and RLS is row-level: with Supabase's default ACL (ALL to anon and
--    authenticated on every new table) every column was readable through the
--    anon key that ships in the browser bundle. The proposals route wrote the
--    author's Google address into `submitted_by`, so
--    `/rest/v1/community_photos?select=submitted_by` listed them. The route no
--    longer writes an address there; this is the boundary that would have
--    stopped it. Same shape as 0014: revoke the table, grant named columns.
--
--    The grant is exactly what `GET /api/community-photos` touches: three
--    columns out, `recipe_slug` to filter on, `created_at` to order by. Writes
--    go through the service role, so the public roles need nothing else.
--
--    Existing rows are NOT scrubbed here. Clearing addresses already stored in
--    `submitted_by` is an irreversible data change and is left to the owner.
--
-- 2. recipe_proposals.sample_image_url. The route required a sample photo and
--    then had no column to put it in, so the thumbnail vanished on reload.
--    Nullable because every proposal written before this has none; https and
--    bounded like community_photos.image_url.

revoke all on table community_photos from anon, authenticated;

grant select (recipe_slug, image_url, author_name, author_social, created_at)
  on table community_photos to anon, authenticated;

alter table recipe_proposals
  add column if not exists sample_image_url text
    constraint recipe_proposals_sample_image_url_check
    check (
      sample_image_url is null
      or (sample_image_url ~ '^https://' and length(sample_image_url) <= 2048)
    );

grant select (sample_image_url) on table recipe_proposals to anon, authenticated;
