-- Migration 0013: Alpha Tech Blogs articles, and the bucket their media lives in.
--
-- The catalogue used to be a typed array in `src/lib/lab/articles.ts`, which its
-- own header called out as the thing to replace. This is that replacement. The
-- array stays as the seed: `data.ts` falls back to it when Supabase is not
-- configured, so the tree still builds and the suite still runs with no
-- credentials at all — the same arrangement `sony_cameras` has.

create table if not exists lab_articles (
  -- The `/blog/<id>` segment, so it is the slug and not a uuid. `setup`,
  -- `admin` and `new` are static sibling routes and are refused in the API;
  -- an article holding one would render at a URL Next never reaches it from.
  id text primary key,
  status text not null default 'draft' check (status in ('draft', 'published')),
  topic text not null,
  level text not null check (level in ('newbie', 'mid', 'pro')),
  archetype text not null,
  read text not null default '',
  title text not null,
  dek text not null default '',
  -- The block list, validated in `parse.ts` on the way both in and out. The
  -- column is deliberately unconstrained beyond "an array": the block
  -- vocabulary is a TypeScript union that changes with the renderers, and a
  -- CHECK constraint restating it here would be a second copy to keep in step.
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- The feed's only ordering, and the only filter the reading path applies.
create index if not exists lab_articles_status_updated_idx
  on lab_articles (status, updated_at desc);

alter table lab_articles enable row level security;

-- Readers see published rows and nothing else. This is the real gate on drafts:
-- the anon key ships in the browser bundle, so "the query filters on status" is
-- a convenience, and this policy is what makes an unpublished draft actually
-- unreachable.
create policy "Allow public read access to published lab_articles"
  on lab_articles for select
  to anon, authenticated
  using (status = 'published');

-- Column privileges, not `grant select on table`: `updated_by` is an admin's
-- email address and the anon role must never be able to select it. Same rule
-- `no-email-leak.test.ts` pins for the community tables.
grant select (id, status, topic, level, archetype, read, title, dek, blocks, created_at, updated_at)
  on table lab_articles to anon, authenticated;

-- No insert/update/delete grant to anon or authenticated at all. Every write
-- goes through `/api/admin/articles`, which calls `requireAdmin()` and then
-- uses the service-role client — so writes bypass RLS by design, and the gate
-- is the route rather than a policy a browser could ever satisfy.

-- Article media: uploaded stills, GIFs and the two halves of a comparison.
-- Public because `next/image` fetches it as an anonymous client, and because
-- an article's photography is published the moment the article is.
insert into storage.buckets (id, name, public)
  values ('lab', 'lab', true)
  on conflict (id) do nothing;

create policy "Allow public read access to lab media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'lab');

-- There is deliberately no insert, update or delete policy on this bucket.
-- Uploads are service-role only, for the same reason the table's writes are:
-- `/api/admin/articles/upload` checks `requireAdmin()` and sniffs the bytes
-- first. An insert policy for `authenticated` would let any signed-in reader
-- put a file in a bucket this app's own pages then embed.
