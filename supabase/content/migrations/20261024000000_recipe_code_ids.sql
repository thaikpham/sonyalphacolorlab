-- ---------------------------------------------------------------------------
-- 20261024000000 — recipe ids and slugs follow the code
-- ---------------------------------------------------------------------------
--
-- `SCL-PP-048` becomes `PP-048` and `hue-silk` becomes
-- `pp-048-soft-clean-portrait`: the id loses its prefix, the slug becomes the
-- recipe's name in kebab case (`slugFor()` in src/lib/recipes/names.ts), and
-- the number never changes. Design: docs/superpowers/specs/
-- 2026-10-24-recipe-code-ids-design.md, S1–S5.
--
-- Applied by hand, `npm run supabase:migrations -- --target content --apply`,
-- once the release that reads both shapes is deployed. That release reads an
-- id in either shape and resolves a slug in either spelling, so it is right
-- before this file runs and after.
--
-- Every row's id is renamed, the withdrawn Picture Profiles included, so the
-- CHECK can be strict (S4). Only the seed recipes' slugs change: a withdrawn
-- row keeps the slug its share links already redirect from.
--
-- Atomic: `supabase db push` sends a file as one batch and a multi-statement
-- query is one implicit transaction, so a failure anywhere below leaves the
-- project as it was. Idempotent: each step matches only what it has not done
-- yet, so a second run changes nothing. No column is added or removed, so the
-- grants stand as they are.
--
-- The slug list is `data/former-slugs.json`, pair for pair, and so is control
-- 0020's. `migration-roots.test.ts` runs this file in both lineages and fails
-- if either list stops matching the map.

-- A content-plane file. Control's `recipes` is the rollback copy and keeps the
-- SCL- shape it was created with, so refuse there before changing anything.
do $$
declare
  found text;
begin
  select string_agg(t, ', ') into found
    from unnest(array['admin_emails', 'community_photos', 'recipe_comments',
                      'recipe_proposals', 'proposal_votes']) as t
   where to_regclass('public.' || t) is not null;
  if found is not null then
    raise exception 'recipe code ids refused: this database holds control-plane tables (%)', found;
  end if;
end $$;

-- 1. The child keys follow a renamed id. Found by what they reference, not by
--    name, so a key some lineage named differently is replaced too rather than
--    surviving beside the new one and refusing the rename.
do $$
declare
  fk record;
begin
  for fk in
    select conrelid::regclass as tbl, conname
      from pg_constraint
     where contype = 'f'
       and confrelid = 'public.recipes'::regclass
       and conrelid in ('public.recipe_translations'::regclass, 'public.recipe_images'::regclass)
  loop
    execute format('alter table %s drop constraint %I', fk.tbl, fk.conname);
  end loop;
end $$;

alter table recipe_translations
  add constraint recipe_translations_recipe_id_fkey
  foreign key (recipe_id) references recipes (id) on update cascade on delete cascade;

alter table recipe_images
  add constraint recipe_images_recipe_id_fkey
  foreign key (recipe_id) references recipes (id) on update cascade on delete cascade;

-- 2. The id CHECKs, for the code shape. The pattern is `RECIPE_ID_RE` in
--    src/lib/camera/schema.ts; sql-drift.test.ts fails if the two disagree.
alter table recipes drop constraint if exists recipes_id_check;
alter table recipes drop constraint if exists recipes_id_matches_format;

update recipes set id = regexp_replace(id, '^SCL-', '') where id like 'SCL-%';

alter table recipes
  add constraint recipes_id_check check (id ~ '^(PP|CL)-[0-9]{3}$');
alter table recipes
  add constraint recipes_id_matches_format check (id like upper(format::text) || '-%');

-- 3. Seed slugs, former → current. A pair moves only the recipe whose number
--    its new slug carries, so a row that holds a former slug by coincidence is
--    never renamed. A new slug another row already holds stops the whole file
--    on the unique key.
update recipes r
   set slug = v.current_slug
  from (values
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
       ) as v (former_slug, current_slug)
 where r.slug = v.former_slug
   and r.id = upper(left(v.current_slug, 6));

-- 4. Recipe links in article metadata: `meta.related` entries shaped
--    `{ "kind": "recipe", "id": "SCL-PP-001" }` (`parseRef()` in
--    src/lib/lab/meta.ts). Only recipe refs change, in place and in order.
update lab_articles a
   set meta = jsonb_set(a.meta, '{related}', (
         select jsonb_agg(
                  case
                    when e ->> 'kind' = 'recipe' and btrim(e ->> 'id') ~ '^SCL-(PP|CL)-[0-9]{3}$'
                      then jsonb_set(e, '{id}', to_jsonb(substr(btrim(e ->> 'id'), 5)))
                    else e
                  end
                  order by n)
           from jsonb_array_elements(a.meta -> 'related') with ordinality as x (e, n)))
 where jsonb_typeof(a.meta -> 'related') = 'array'
   and exists (
         select 1 from jsonb_array_elements(a.meta -> 'related') as x (e)
          where e ->> 'kind' = 'recipe' and btrim(e ->> 'id') ~ '^SCL-(PP|CL)-[0-9]{3}$');
