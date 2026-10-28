-- ---------------------------------------------------------------------------
-- 20261028000000 — recipe slugs become the code alone
-- ---------------------------------------------------------------------------
--
-- `pp-048-soft-clean-portrait` becomes `pp-048`: the slug is the recipe's id,
-- lowercased (`slugFor()` in src/lib/recipes/names.ts), because names are
-- computed from the settings since 2026-10-28 and a name must be free to
-- change without moving a URL. Design: docs/superpowers/specs/
-- 2026-10-28-names-from-settings-design.md, S1–S2.
--
-- Applied by hand, `npm run supabase:migrations -- --target content --apply`,
-- once the release that reads every spelling is deployed. That release
-- resolves a slug in any of a recipe's three spellings (`slug-aliases.ts`), so
-- it is right before this file runs and after.
--
-- Slugs only: no id, name or setting changes, and a withdrawn row keeps the
-- slug its share links already redirect from. It follows 20261024000000,
-- which gave every seed recipe the slug this file renames, and refuses to run
-- on a project that migration has not reached.
--
-- Atomic: `supabase db push` sends a file as one batch and a multi-statement
-- query is one implicit transaction, so a failure anywhere below leaves the
-- project as it was. Idempotent: a pair matches only a row still under its
-- 2026-10-24 slug, so a second run changes nothing. No column is added or
-- removed, so the grants stand as they are.
--
-- The slug list is `data/slug-moves/2026-10-28.json`, pair for pair, and so
-- is control 0021's. `migration-roots.test.ts` runs this file and fails if
-- either list stops matching the batch.

-- A content-plane file, as 20261024000000 is. Control's `recipes` is the
-- rollback copy and keeps the shape it was created with, so refuse there
-- before changing anything.
do $$
declare
  found text;
begin
  select string_agg(t, ', ') into found
    from unnest(array['admin_emails', 'community_photos', 'recipe_comments',
                      'recipe_proposals', 'proposal_votes']) as t
   where to_regclass('public.' || t) is not null;
  if found is not null then
    raise exception 'recipe code slugs refused: this database holds control-plane tables (%)', found;
  end if;
end $$;

-- An SCL- id means 20261024000000 has not run: its rows are still under the
-- slugs it renames, none of which is in the list below, and recording this
-- file as applied would leave them there for good.
do $$
begin
  if exists (select 1 from recipes where id like 'SCL-%') then
    raise exception 'recipe code slugs refused: SCL- ids found, apply 20261024000000_recipe_code_ids.sql first';
  end if;
end $$;

-- 2026-10-24 slug → code slug. A pair moves only the recipe whose id its new
-- slug is, so a row that holds a listed slug by coincidence is never renamed.
-- A code slug another row already holds stops the whole file on the unique
-- key.
update recipes r
   set slug = v.current_slug
  from (values
-- former-slugs:begin
  ('pp-001-vivid-nostalgia-film',      'pp-001'),
  ('pp-002-jade-soft-film',            'pp-002'),
  ('pp-009-teal-muted-street',         'pp-009'),
  ('pp-015-warm-faded-slide',          'pp-015'),
  ('pp-025-vivid-deep-cinema',         'pp-025'),
  ('pp-027-vivid-daylight-cinema',     'pp-027'),
  ('pp-044-matte-vivid-film',          'pp-044'),
  ('pp-045-clean-neutral-stream',      'pp-045'),
  ('pp-046-clean-soft-stream',         'pp-046'),
  ('pp-047-range-neutral-stream',      'pp-047'),
  ('pp-048-soft-clean-portrait',       'pp-048'),
  ('pp-049-clean-natural-daylight',    'pp-049'),
  ('pp-050-neutral-crisp-studio',      'pp-050'),
  ('pp-051-range-soft-landscape',      'pp-051'),
  ('pp-052-range-bright-daylight',     'pp-052'),
  ('pp-053-range-warm-dusk',           'pp-053'),
  ('pp-054-cyan-vivid-coast',          'pp-054'),
  ('pp-055-green-vivid-nature',        'pp-055'),
  ('pp-056-warm-vivid-festival',       'pp-056'),
  ('pp-057-rosy-bright-portrait',      'pp-057'),
  ('pp-058-cool-pastel-matte',         'pp-058'),
  ('pp-059-warm-muted-nostalgia',      'pp-059'),
  ('pp-060-warm-dense-slide',          'pp-060'),
  ('pp-061-tungsten-soft-indoor',      'pp-061'),
  ('pp-062-cyan-deep-night',           'pp-062'),
  ('pp-063-warm-vivid-night',          'pp-063'),
  ('pp-064-mono-crisp-street',         'pp-064'),
  ('pp-065-mono-soft-portrait',        'pp-065'),
  ('pp-066-golden-soft-portrait',      'pp-066'),
  ('pp-067-cool-crisp-airy',           'pp-067'),
  ('pp-068-punchy-vivid-pop',          'pp-068'),
  ('pp-069-mono-hard-noir',            'pp-069'),
  ('pp-070-mono-soft-night',           'pp-070'),
  ('pp-071-silver-hard-muted',         'pp-071'),
  ('pp-072-teal-orange-cinema',        'pp-072'),
  ('pp-073-bright-airy-studio',        'pp-073'),
  ('pp-074-dark-rich-velvet',          'pp-074'),
  ('pp-075-warm-pastel-cream',         'pp-075'),
  ('pp-076-violet-cool-dusk',          'pp-076'),
  ('pp-077-cool-muted-overcast',       'pp-077'),
  ('pp-078-amber-vivid-autumn',        'pp-078'),
  ('pp-079-warm-rich-table',           'pp-079'),
  ('pp-080-range-hlg-daylight',        'pp-080'),
  ('pp-081-flat-log-base',             'pp-081'),
  ('pp-082-cyan-vivid-monsoon',        'pp-082'),
  ('cl-001-film-hard-faded',           'cl-001'),
  ('cl-002-film-warm-muted',           'cl-002'),
  ('cl-003-vivid-crisp-neutral',       'cl-003'),
  ('cl-004-vivid-soft-faded',          'cl-004'),
  ('cl-005-vivid-warm-crisp',          'cl-005'),
  ('cl-006-vivid-bright-crisp',        'cl-006'),
  ('cl-007-vivid-natural-daylight',    'cl-007'),
  ('cl-008-vivid-cool-natural',        'cl-008'),
  ('cl-009-flat-cool-standard',        'cl-009'),
  ('cl-010-soft-natural-standard',     'cl-010'),
  ('cl-011-natural-standard-daylight', 'cl-011'),
  ('cl-012-soft-warm-rich',            'cl-012'),
  ('cl-013-airy-warm-pastel',          'cl-013'),
  ('cl-014-airy-warm-rich',            'cl-014'),
  ('cl-015-airy-faded-soft',           'cl-015'),
  ('cl-016-airy-matte-natural',        'cl-016'),
  ('cl-017-sepia-soft-deep',           'cl-017'),
  ('cl-018-sepia-flat-crisp',          'cl-018'),
  ('cl-019-portrait-soft-warm',        'cl-019'),
  ('cl-020-instant-faded-natural',     'cl-020'),
  ('cl-021-instant-soft-violet',       'cl-021'),
  ('cl-022-instant-cool-soft',         'cl-022'),
  ('cl-023-instant-warm-faded',        'cl-023'),
  ('cl-024-instant-warm-punchy',       'cl-024'),
  ('cl-025-film-warm-bright',          'cl-025'),
  ('cl-026-film-warm-soft',            'cl-026'),
  ('cl-027-film-deep-muted',           'cl-027'),
  ('cl-028-film-warm-deep',            'cl-028'),
  ('cl-029-film-flat-rich',            'cl-029'),
  ('cl-030-film-soft-faded',           'cl-030'),
  ('cl-031-film-hard-muted',           'cl-031'),
  ('cl-032-film-warm-faded',           'cl-032'),
  ('cl-033-film-natural-daylight',     'cl-033'),
  ('cl-034-film-natural-neutral',      'cl-034'),
  ('cl-035-film-deep-crisp',           'cl-035'),
  ('cl-036-film-warm-natural',         'cl-036'),
  ('cl-037-film-soft-rich',            'cl-037'),
  ('cl-038-mono-deep-noir',            'cl-038'),
  ('cl-039-mono-airy-portrait',        'cl-039'),
  ('cl-040-neutral-clean-product',     'cl-040'),
  ('cl-041-portrait-golden-daylight',  'cl-041'),
  ('cl-042-airy-cool-pastel',          'cl-042'),
  ('cl-043-film-matte-cool',           'cl-043'),
  ('cl-044-instant-amber-soft',        'cl-044'),
  ('cl-045-vivid-tropical-punchy',     'cl-045')
-- former-slugs:end
       ) as v (former_slug, current_slug)
 where r.slug = v.former_slug
   and r.id = upper(v.current_slug);
