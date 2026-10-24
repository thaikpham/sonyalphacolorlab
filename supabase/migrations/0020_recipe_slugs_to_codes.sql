-- Migration 0020: community rows follow their recipe's new slug.
--
-- Recipe slugs became the recipe's name in kebab case (`hue-silk` →
-- `pp-048-soft-clean-portrait`). The content plane renames its own rows in
-- 20261024000000_recipe_code_ids.sql, applied by hand; this file is the
-- control plane's half, applied by the GitHub integration on merge. The two
-- land at different times, and the release reads every community table
-- through `slugAliases()` (src/lib/recipes/slug-aliases.ts), so a row is found
-- under either spelling before, between and after them (S7, S9).
--
-- Every table here that carries `recipe_slug`: comments, proposals and
-- community photos, hidden ones included. `proposal_votes` keys on the
-- proposal. The rollback copy of `recipes` is left as it is — applied history
-- with an SCL- CHECK.
--
-- A photo URL may already sit under the new slug, sent while the two planes
-- disagreed. `(recipe_slug, image_url)` is unique, so that row is not moved: it
-- stays under the former slug, where `slugAliases()` still finds it, rather
-- than stop the migration.
--
-- One transaction (the integration sends a file as one batch). Idempotent:
-- only rows still under a former slug match. The slug list is
-- `data/former-slugs.json`, pair for pair, the same as the content file's;
-- `migration.test.ts` fails if it stops matching the map.

create temporary table recipe_slug_moves (
  former_slug  text primary key,
  current_slug text not null unique
);

insert into recipe_slug_moves (former_slug, current_slug) values
-- former-slugs:begin
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
-- former-slugs:end
;

update recipe_comments c
   set recipe_slug = m.current_slug
  from recipe_slug_moves m
 where c.recipe_slug = m.former_slug;

update recipe_proposals p
   set recipe_slug = m.current_slug
  from recipe_slug_moves m
 where p.recipe_slug = m.former_slug;

update community_photos p
   set recipe_slug = m.current_slug
  from recipe_slug_moves m
 where p.recipe_slug = m.former_slug
   and not exists (
         select 1 from community_photos q
          where q.recipe_slug = m.current_slug and q.image_url = p.image_url);

drop table recipe_slug_moves;
