-- Migration 0019: narrow community_photos to the columns the gallery reads,
-- give a proposal somewhere to keep its sample photograph, take table-level
-- writes away from the browser roles, and make admin_emails refuse the two
-- rows that fail silently.
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
--
--    `PROPOSAL_COLUMNS` in the proposals route names this column, so the route
--    answers 503 on every GET until this file has run. Apply it before the
--    route ships: see "Pending: 0019" in docs/runbooks/supabase-control-content.md.
--
-- 3. Table-level writes. 0004 revoked SELECT on the community tables and
--    nothing else, and 0001 revoked nothing on the recipe tables, so under the
--    default ACL anon and authenticated still held INSERT, UPDATE, DELETE,
--    TRUNCATE, REFERENCES and TRIGGER on all five. Writes rested on "no write
--    policy" alone — 0016's rule is that a table holding addresses should not
--    rely on one layer, and recipe_comments holds author_email. Every write
--    goes through the service role. The column SELECT grants are untouched,
--    so the reads and a rollback read with RECIPE_COLUMNS keep working.
--
-- 4. admin_emails.role had `default 'super'` (0011), and 0009's insert shape —
--    `(email, note)` — is the one an operator copies to add an editor. That row
--    got full rights: the least-privileged path granting the most privilege.
--    With no default, NOT NULL refuses a row that does not state its role.
--
-- 5. admin_emails.email had no case rule, but requireAdmin matches only the
--    lowercased address from the JWT. A mixed-case row was refused on every
--    request with no error anywhere, and 'A@x.com' and 'a@x.com' could hold
--    different roles. Existing rows are lowercased first; if two collide the
--    primary key stops this migration, which is the right place to find out.

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

revoke insert, update, delete, truncate, references, trigger
  on table recipe_comments, recipe_proposals, recipes, recipe_translations, recipe_images
  from anon, authenticated;

alter table admin_emails alter column role drop default;

update admin_emails set email = lower(email) where email <> lower(email);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'admin_emails_email_lowercase'
  ) then
    alter table admin_emails
      add constraint admin_emails_email_lowercase check (email = lower(email));
  end if;
end $$;
