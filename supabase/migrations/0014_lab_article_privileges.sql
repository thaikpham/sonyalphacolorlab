-- Migration 0014: close the table-level grant 0013 left open on lab_articles.
--
-- 0013 wrote `grant select (…) on table lab_articles to anon, authenticated`
-- without revoking the table first. That is safe only for as long as nothing
-- has granted table-level SELECT — a default, not a guarantee, and the column
-- it protects is `updated_by`, an administrator's email address. The anon key
-- ships in the browser bundle, so a table-level grant here would publish the
-- editorial team's addresses to anyone who can call PostgREST.
--
-- 0013 is not edited. It may already be applied, and rewriting an applied
-- migration makes the file disagree with what the database actually ran — the
-- one thing a migration history exists to prevent. A correction is a new file.
--
-- Idempotent in effect: revoking what was never granted is a no-op, and the
-- grant restates 0013's own column list unchanged.

revoke all on table lab_articles from anon, authenticated;

grant select (
  id, status, topic, level, archetype, read, title, dek, blocks,
  created_at, updated_at
) on table lab_articles to anon, authenticated;
