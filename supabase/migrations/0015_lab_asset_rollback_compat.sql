-- Migration 0015: a dormant lab_assets on the control project, for rollback only.
--
-- The content plane owns article media now. This file exists so the old project
-- can *receive* a snapshot back if the cutover has to be reversed after writes
-- have begun — see the rollback window in the design. Without it, a rollback
-- would mean applying a schema change under incident pressure, which is the
-- worst possible moment to discover a typo in a constraint.
--
-- It is deliberately inert:
--
--   * no data is copied here;
--   * nothing in the application writes it while the split is in force;
--   * no browser role is granted anything on it.
--
-- The columns, checks, restrictive foreign key and grants are the same as
-- `supabase/content/migrations/0001_content_baseline.sql`. They have to be: a
-- rollback import that has to reshape rows on the way in is not a rollback.
--
-- The public `lab` bucket from 0013 is left exactly as it is, for the same
-- reason — a rollback variant needs somewhere to put published media.

create table if not exists lab_assets (
  id uuid primary key default gen_random_uuid(),
  article_id text not null references lab_articles (id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null check (mime_type = 'image/webp'),
  width integer not null check (width > 0 and width <= 12000),
  height integer not null check (height > 0 and height <= 12000),
  byte_size bigint not null check (byte_size > 0),
  animated boolean not null default false check (animated = false),
  state text not null check (
    state in ('draft', 'published', 'orphaned', 'cleanup_failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

create index if not exists lab_assets_article_idx on lab_assets (article_id, state);

alter table lab_assets enable row level security;

revoke all on table lab_assets from anon, authenticated;

-- The private draft bucket, so a rollback has both halves of the two-bucket
-- model rather than only the public one 0013 created.
insert into storage.buckets (id, name, public)
  values ('lab-drafts', 'lab-drafts', false)
  on conflict (id) do nothing;

-- No select policy for `lab-drafts`, and no write policy for either bucket.
