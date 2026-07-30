-- Recipe comments, community tweak proposals, and heart votes.

create table if not exists recipe_comments (
  id           uuid primary key default gen_random_uuid(),
  recipe_slug  text not null check (recipe_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  author_name  text not null check (length(author_name) between 1 and 100),
  author_email text not null check (length(author_email) between 3 and 255),
  author_avatar text,
  content      text not null check (length(content) between 1 and 2000),
  created_at   timestamptz not null default now()
);

create index if not exists recipe_comments_slug_idx
  on recipe_comments (recipe_slug, created_at desc);

create table if not exists recipe_proposals (
  id            uuid primary key default gen_random_uuid(),
  recipe_slug   text not null check (recipe_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null check (length(title) between 1 and 150),
  author_name   text not null check (length(author_name) between 1 and 100),
  author_email  text not null check (length(author_email) between 3 and 255),
  author_avatar text,
  settings      jsonb not null,
  white_balance jsonb not null,
  vote_count    integer not null default 0 check (vote_count >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists recipe_proposals_slug_idx
  on recipe_proposals (recipe_slug, vote_count desc, created_at desc);

create table if not exists proposal_votes (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references recipe_proposals(id) on delete cascade,
  user_email   text not null check (length(user_email) between 3 and 255),
  created_at   timestamptz not null default now(),
  unique (proposal_id, user_email)
);

-- Enable RLS
alter table recipe_comments enable row level security;
alter table recipe_proposals enable row level security;
alter table proposal_votes enable row level security;

-- Public Read Policies
--
-- RLS is row-level, so a policy alone cannot hide a column. These tables store
-- the commenter's Google address, and the anon key ships inside the browser
-- bundle — so `for select using (true)` on its own lets anyone call PostgREST
-- directly with `?select=author_email` and walk off with every address.
-- Narrowing the API response is not enough; the grant is the real boundary.
--
-- Writes are unaffected: there is no insert/update policy at all, so every
-- write already has to go through the service role in a route handler.
drop policy if exists recipe_comments_read on recipe_comments;
create policy recipe_comments_read on recipe_comments for select using (true);
revoke select on recipe_comments from anon, authenticated;
grant select (id, recipe_slug, author_name, author_avatar, content, created_at)
  on recipe_comments to anon, authenticated;

drop policy if exists recipe_proposals_read on recipe_proposals;
create policy recipe_proposals_read on recipe_proposals for select using (true);
revoke select on recipe_proposals from anon, authenticated;
grant select (id, recipe_slug, title, author_name, author_avatar, settings,
              white_balance, vote_count, created_at)
  on recipe_proposals to anon, authenticated;

-- proposal_votes is nothing but (proposal, email) pairs — there is no subset of
-- it that is safe to publish, so the public roles get no read at all. The API
-- resolves "did *you* vote?" with the service role instead.
drop policy if exists proposal_votes_read on proposal_votes;
revoke all on proposal_votes from anon, authenticated;
