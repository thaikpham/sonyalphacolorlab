-- Migration 0017: `kind` and `meta` on the control project's dormant
-- lab_articles, for rollback only.
--
-- Same reason as 0015. The content plane gains these two columns in its own
-- 0003; the control project keeps a retained copy of the content tables so a
-- cutover can be reversed, and `scripts/supabase/tables.ts` names one column
-- list for export, import and verify on both. A rollback import that has to
-- reshape rows on the way in is not a rollback, so the columns, defaults,
-- checks and grants here are identical to the content root's.
--
-- Inert while the split is in force: nothing in the application reads or
-- writes this table on the control project.

alter table lab_articles
  add column if not exists kind text not null default 'article';

alter table lab_articles
  add column if not exists meta jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'lab_articles_kind_check'
  ) then
    alter table lab_articles
      add constraint lab_articles_kind_check check (kind in ('article', 'knowledge'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'lab_articles_meta_is_object'
  ) then
    alter table lab_articles
      add constraint lab_articles_meta_is_object check (jsonb_typeof(meta) = 'object');
  end if;
end $$;

create index if not exists lab_articles_kind_status_updated_idx
  on lab_articles (kind, status, updated_at desc);

grant select (kind, meta) on table lab_articles to anon, authenticated;
