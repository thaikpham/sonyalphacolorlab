-- Migration 0021: community rows follow their recipe's slug to the code alone.
--
-- Recipe slugs became the recipe's code (`pp-048-soft-clean-portrait` →
-- `pp-048`), because names are computed from the settings since 2026-10-28
-- and a name must be free to change without moving a URL. The content plane
-- renames its own rows in 20261028000000_recipe_code_slugs.sql, applied by
-- hand; this file is the control plane's half, applied by the GitHub
-- integration on merge. The two land at different times, and the release
-- reads every community table through `slugAliases()`
-- (src/lib/recipes/slug-aliases.ts), which knows all three spellings, so a row
-- is found under any of them before, between and after both files.
--
-- Rows come from BOTH earlier spellings. 0020 moved the first slugs
-- (`hue-silk`) to the 2026-10-24 ones, but kept a photo whose URL already sat
-- under the new slug where it was, and every row written while the content
-- plane still held the first slugs was stored under them. So each row under a
-- first slug or a 2026-10-24 slug moves to the code slug: the 2026-10-24 list
-- is `data/slug-moves/2026-10-28.json`, pair for pair, the same as the content
-- file's, and the first slugs reach it through the 2026-10-24 batch
-- (`data/slug-moves/2026-10-24.json`, 0020's list) below it.
-- `migration-roots.test.ts` fails if either list stops matching its batch.
--
-- Every table here that carries `recipe_slug`: comments, proposals and
-- community photos, hidden ones included. `proposal_votes` keys on the
-- proposal. The rollback copy of `recipes` is left as it is.
--
-- `(recipe_slug, image_url)` is unique, and the gallery reads every spelling.
-- A photo whose URL already sits under the code slug is not moved: it stays
-- where it is, where `slugAliases()` still finds it, rather than stop the
-- migration. The 2026-10-24 spelling moves first, so where both earlier
-- spellings hold one URL, the older row is the one that stays. Where an editor
-- hid any row of such a set, every row of it is hidden first: hiding is the
-- only moderation there is (src/lib/community/moderation.ts), and a twin left
-- visible undoes it.
--
-- One transaction (the integration sends a file as one batch). Idempotent:
-- only rows still under an earlier spelling with no twin under the code slug
-- match, and hiding a hidden row changes nothing.

create temporary table recipe_slug_moves (
  former_slug  text primary key,
  current_slug text not null,
  -- 1: the 2026-10-24 spelling; 0: the first one, two moves back.
  generation   int  not null
);

insert into recipe_slug_moves (former_slug, current_slug, generation)
select former_slug, current_slug, 1 from (values
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
) as v (former_slug, current_slug);

create temporary table recipe_slug_earlier (
  former_slug  text primary key,
  current_slug text not null unique
);

insert into recipe_slug_earlier (former_slug, current_slug) values
-- earlier-slugs:begin
  ('mojave-sun',                'pp-001-vivid-nostalgia-film'),
  ('kyoto-jade',                'pp-002-jade-soft-film'),
  ('urban-teal',                'pp-009-teal-muted-street'),
  ('vintage-slide',             'pp-015-warm-faded-slide'),
  ('saturated-cinema',          'pp-025-vivid-deep-cinema'),
  ('daylight-cinema',           'pp-027-vivid-daylight-cinema'),
  ('filmic-fj-c200',            'pp-044-matte-vivid-film'),
  ('clearcast-pro',             'pp-045-clean-neutral-stream'),
  ('clearcast-pro-2',           'pp-046-clean-soft-stream'),
  ('extra-dr-stream-109',       'pp-047-range-neutral-stream'),
  ('hue-silk',                  'pp-048-soft-clean-portrait'),
  ('clear-day',                 'pp-049-clean-natural-daylight'),
  ('linen-editorial',           'pp-050-neutral-crisp-studio'),
  ('sa-pa-morning',             'pp-051-range-soft-landscape'),
  ('mekong-noon',               'pp-052-range-bright-daylight'),
  ('mui-ne-dusk',               'pp-053-range-warm-dusk'),
  ('phu-quoc-blue',             'pp-054-cyan-vivid-coast'),
  ('tam-coc-green',             'pp-055-green-vivid-nature'),
  ('hoi-an-lantern',            'pp-056-warm-vivid-festival'),
  ('tet-blossom',               'pp-057-rosy-bright-portrait'),
  ('da-lat-mist',               'pp-058-cool-pastel-matte'),
  ('ha-noi-winter',             'pp-059-warm-muted-nostalgia'),
  ('cho-lon-slide',             'pp-060-warm-dense-slide'),
  ('sai-gon-cafe',              'pp-061-tungsten-soft-indoor'),
  ('neon-night',                'pp-062-cyan-deep-night'),
  ('ben-thanh-night',           'pp-063-warm-vivid-night'),
  ('old-quarter-mono',          'pp-064-mono-crisp-street'),
  ('pearl-mono',                'pp-065-mono-soft-portrait'),
  ('ho-tay-golden',             'pp-066-golden-soft-portrait'),
  ('moc-chau-frost',            'pp-067-cool-crisp-airy'),
  ('vung-tau-pop',              'pp-068-punchy-vivid-pop'),
  ('hem-noir',                  'pp-069-mono-hard-noir'),
  ('late-night-mono',           'pp-070-mono-soft-night'),
  ('silver-hard-muted',         'pp-071-silver-hard-muted'),
  ('teal-orange-cinema',        'pp-072-teal-orange-cinema'),
  ('bright-airy-studio',        'pp-073-bright-airy-studio'),
  ('dark-rich-velvet',          'pp-074-dark-rich-velvet'),
  ('warm-pastel-cream',         'pp-075-warm-pastel-cream'),
  ('violet-cool-dusk',          'pp-076-violet-cool-dusk'),
  ('cool-muted-overcast',       'pp-077-cool-muted-overcast'),
  ('amber-vivid-autumn',        'pp-078-amber-vivid-autumn'),
  ('warm-rich-table',           'pp-079-warm-rich-table'),
  ('range-hlg-daylight',        'pp-080-range-hlg-daylight'),
  ('flat-log-base',             'pp-081-flat-log-base'),
  ('cyan-vivid-monsoon',        'pp-082-cyan-vivid-monsoon'),
  ('fl-raoul-rutnam',           'cl-001-film-hard-faded'),
  ('fl-arantha-sirimanne',      'cl-002-film-warm-muted'),
  ('vv2-ravi-ranasinghe',       'cl-003-vivid-crisp-neutral'),
  ('vv2-sony-asia',             'cl-004-vivid-soft-faded'),
  ('vv2-jonpoon-jpg',           'cl-005-vivid-warm-crisp'),
  ('vv2-jonpoon-jpg-2',         'cl-006-vivid-bright-crisp'),
  ('vv-khong',                  'cl-007-vivid-natural-daylight'),
  ('vv-filmreel',               'cl-008-vivid-cool-natural'),
  ('st-sandeeshwara-perera',    'cl-009-flat-cool-standard'),
  ('st-ravi-ranasinghe',        'cl-010-soft-natural-standard'),
  ('st-khong',                  'cl-011-natural-standard-daylight'),
  ('st-filmreel',               'cl-012-soft-warm-rich'),
  ('sh-sony-asia',              'cl-013-airy-warm-pastel'),
  ('sh-jonpoon-jpg',            'cl-014-airy-warm-rich'),
  ('sh-puy',                    'cl-015-airy-faded-soft'),
  ('sh-jomnot',                 'cl-016-airy-matte-natural'),
  ('se-satheeshan-thiyagaraja', 'cl-017-sepia-soft-deep'),
  ('se-ravi-ranasinghe',        'cl-018-sepia-flat-crisp'),
  ('pt-sandeeshwara-perera',    'cl-019-portrait-soft-warm'),
  ('in-eranga-siriwardhana',    'cl-020-instant-faded-natural'),
  ('in-sony-asia',              'cl-021-instant-soft-violet'),
  ('in-sony-asia-2',            'cl-022-instant-cool-soft'),
  ('in-jonpoon-jpg',            'cl-023-instant-warm-faded'),
  ('in-check-in-siemreap',      'cl-024-instant-warm-punchy'),
  ('fl-sandeeshwara-perera',    'cl-025-film-warm-bright'),
  ('fl-sandeeshwara-perera-2',  'cl-026-film-warm-soft'),
  ('fl-sandeeshwara-perera-3',  'cl-027-film-deep-muted'),
  ('fl-lahiru-rumesh',          'cl-028-film-warm-deep'),
  ('fl-isuru-mudalige',         'cl-029-film-flat-rich'),
  ('fl-sony-asia',              'cl-030-film-soft-faded'),
  ('fl-sony-asia-2',            'cl-031-film-hard-muted'),
  ('fl-jonpoon-jpg',            'cl-032-film-warm-faded'),
  ('fl-mardy-suong',            'cl-033-film-natural-daylight'),
  ('fl-mardy-suong-2',          'cl-034-film-natural-neutral'),
  ('fl-khong',                  'cl-035-film-deep-crisp'),
  ('fl-hea-kimhong',            'cl-036-film-warm-natural'),
  ('fl-filmreel',               'cl-037-film-soft-rich'),
  ('mono-deep-noir',            'cl-038-mono-deep-noir'),
  ('mono-airy-portrait',        'cl-039-mono-airy-portrait'),
  ('neutral-clean-product',     'cl-040-neutral-clean-product'),
  ('portrait-golden-daylight',  'cl-041-portrait-golden-daylight'),
  ('airy-cool-pastel',          'cl-042-airy-cool-pastel'),
  ('film-matte-cool',           'cl-043-film-matte-cool'),
  ('instant-amber-soft',        'cl-044-instant-amber-soft'),
  ('vivid-tropical-punchy',     'cl-045-vivid-tropical-punchy')
-- earlier-slugs:end
;

insert into recipe_slug_moves (former_slug, current_slug, generation)
select e.former_slug, m.current_slug, 0
  from recipe_slug_earlier e
  join recipe_slug_moves m on m.former_slug = e.current_slug;

-- Every spelling, the code slug's own included, beside the code slug it means.
create temporary table recipe_slug_spellings as
  select former_slug as slug, current_slug as code from recipe_slug_moves
  union
  select current_slug, current_slug from recipe_slug_moves;

update recipe_comments c
   set recipe_slug = m.current_slug
  from recipe_slug_moves m
 where c.recipe_slug = m.former_slug;

update recipe_proposals p
   set recipe_slug = m.current_slug
  from recipe_slug_moves m
 where p.recipe_slug = m.former_slug;

update community_photos q
   set approved = false
  from recipe_slug_spellings sq
 where q.recipe_slug = sq.slug
   and q.approved
   and exists (
         select 1
           from community_photos p
           join recipe_slug_spellings sp on sp.slug = p.recipe_slug
          where sp.code = sq.code
            and p.image_url = q.image_url
            and not p.approved);

update community_photos p
   set recipe_slug = m.current_slug
  from recipe_slug_moves m
 where p.recipe_slug = m.former_slug
   and m.generation = 1
   and not exists (
         select 1 from community_photos q
          where q.recipe_slug = m.current_slug and q.image_url = p.image_url);

update community_photos p
   set recipe_slug = m.current_slug
  from recipe_slug_moves m
 where p.recipe_slug = m.former_slug
   and m.generation = 0
   and not exists (
         select 1 from community_photos q
          where q.recipe_slug = m.current_slug and q.image_url = p.image_url);

drop table recipe_slug_spellings;
drop table recipe_slug_earlier;
drop table recipe_slug_moves;
