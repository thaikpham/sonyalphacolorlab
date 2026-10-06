-- ---------------------------------------------------------------------------
-- 0003 — knowledge pages and article metadata, on the article store
-- ---------------------------------------------------------------------------
--
-- Additive only. Both columns have defaults, so every existing row becomes an
-- ordinary blog article with empty metadata and nothing a reader sees changes
-- until an editor writes one. See docs/adr/0001 and 0002.
--
-- `kind` separates the two reading surfaces that share this table: the blog
-- (`/blog/<id>`) reads 'article', the reference hub (`/learn/<id>`) reads
-- 'knowledge'. One table rather than two because the body, the editor, the
-- asset ledger and its restrictive foreign key are identical — a second table
-- would need a second `lab_assets`.
--
-- `meta` holds the editorial facts beside the body: sources, related recipes /
-- products / pages, prerequisites, the concepts a page explains, a public
-- author name, a reviewed date, and a knowledge page's section. Its shape is
-- enforced by `parseMeta()` in src/lib/lab/meta.ts on the way in and out, the
-- same split `blocks` already uses: a CHECK here restating the TypeScript
-- shape would be a second copy to keep in step. Only the object-ness is
-- checked.
--
-- Deploy order matters: apply this BEFORE deploying the code that selects the
-- two columns, or the published-article read fails (loudly — it throws, it
-- does not fall back). docs/runbooks/knowledge-search.md has the sequence.

alter table lab_articles
  add column if not exists kind text not null default 'article';

alter table lab_articles
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- Named constraints, added separately so a re-run after a partial apply does
-- not fail on the `add column if not exists` above.
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

-- The reading paths filter on kind and status and order by recency.
create index if not exists lab_articles_kind_status_updated_idx
  on lab_articles (kind, status, updated_at desc);

-- Readers need both columns. The grant is column-level and additive: the
-- table-level REVOKE in 0001 stands, and `updated_by` stays ungranted. `meta`
-- carries no address by construction — the parser refuses an author name
-- containing `@`, and who saved a row lives only in `updated_by`.
grant select (kind, meta) on table lab_articles to anon, authenticated;
