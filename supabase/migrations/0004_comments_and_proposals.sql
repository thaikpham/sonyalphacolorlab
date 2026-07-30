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
drop policy if exists recipe_comments_read on recipe_comments;
create policy recipe_comments_read on recipe_comments for select using (true);

drop policy if exists recipe_proposals_read on recipe_proposals;
create policy recipe_proposals_read on recipe_proposals for select using (true);

drop policy if exists proposal_votes_read on proposal_votes;
create policy proposal_votes_read on proposal_votes for select using (true);
