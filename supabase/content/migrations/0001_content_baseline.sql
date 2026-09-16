-- Content plane baseline — the published catalogue, from zero.
--
-- This is the schema of the *second* Supabase project. It holds what readers
-- read: recipes and their translations and image metadata, the Sony product
-- catalogue, and the Alpha Tech Blogs corpus. It deliberately holds nothing
-- about people. There is no `auth` schema in use here, no `admin_emails`, and
-- none of the four community tables — those stay on the control project, where
-- the Google identities they belong to live.
--
-- Composed mechanically from the historical root rather than invented: the
-- recipe types, tables, cascades, triggers and RLS come from 0001; the white
-- balance preset work from 0005 and 0006; `sony_cameras` and its evolution from
-- 0007, 0008, 0010 and 0012; `lab_articles` from 0013. Where the historical
-- root reached its final shape over several files, this states that final shape
-- once — a from-zero baseline has no history to preserve and an `alter` that
-- undoes the `create` three lines above it is just noise.
--
-- Two deliberate corrections, both privilege bugs that 0013 shipped and that a
-- clean baseline should not inherit:
--
--   * `lab_articles` gets a table-level REVOKE before its narrow column grant.
--     0013 granted columns without revoking the table first, which is only safe
--     because nothing had granted table-level SELECT yet — a default that is one
--     careless `grant select on table` away from publishing editor addresses.
--   * `lab_assets` exists from the start, with the restrictive foreign key that
--     makes an article impossible to delete while its objects are still in a
--     bucket.
--
-- The cross-project reference is a string, not a key. `recipe_comments`,
-- `recipe_proposals` and `community_photos` on the control plane reference
-- `recipes.slug` — Postgres cannot enforce that across databases, so slugs are
-- immutable and `publishedRecipeExists()` checks them before a community write.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Picture Profile and Creative Look are mutually exclusive on the camera.
create type recipe_format as enum ('pp', 'cl');

-- All three values at once. In the historical root 'preset' needed its own file
-- (0005) because Postgres refuses to use an enum label in the transaction that
-- added it; from zero there is nothing to add it to.
create type wb_mode as enum ('kelvin', 'auto', 'preset');

-- The ten built-in Creative Looks.
create type creative_look as enum ('ST', 'PT', 'NT', 'VV', 'VV2', 'FL', 'IN', 'SH', 'BW', 'SE');

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------
--
-- Column types mirror src/lib/camera/constants.ts. Zod remains the primary
-- validator at the application boundary; the CHECK constraints here are defence
-- in depth so a bad row cannot be written by a script, the SQL editor, or a
-- future service that forgets to validate. Bounds that appear in both places
-- are asserted equal by src/lib/camera/sql-drift.test.ts.

create table recipes (
  id            text primary key
                check (id ~ '^SCL-(PP|CL)-[0-9]{3}$'),

  -- Original sonycolorlab id (scl-001, PROCOLOR-001). Kept to generate 301
  -- redirects at cutover; never reused as a key.
  legacy_id     text unique,

  -- Immutable after publication. The control plane's community rows reference
  -- it as a plain string, so renaming one orphans every comment on it.
  slug          text not null unique
                check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- Display title, e.g. "SCL-PP-001: Mojave Sun". Never translated.
  name          text not null check (length(name) > 0),

  format        recipe_format not null,

  -- White balance is split into real columns rather than buried in jsonb so the
  -- homepage grid can filter and sort on it without parsing JSON.
  wb_mode           wb_mode  not null,
  wb_kelvin         smallint check (wb_kelvin between 2500 and 9900),
  wb_auto           text     check (wb_auto in ('AWB', 'AWB (Priority White)', 'AWB (Priority Ambience)')),

  -- Light-source preset, e.g. Daylight / Cloudy / Underwater Auto. Mirrors
  -- WB_PRESETS in src/lib/camera/constants.ts; Custom 1-3 are excluded on
  -- purpose, because they replay a white card measured in one photographer's
  -- room and cannot be reproduced by a reader.
  wb_preset         text
                    check (wb_preset in (
                      'Daylight',
                      'Shade',
                      'Cloudy',
                      'Incandescent',
                      'Fluor.: Warm White',
                      'Fluor.: Cool White',
                      'Fluor.: Day White',
                      'Fluor.: Daylight',
                      'Flash',
                      'Underwater Auto'
                    )),

  -- Shift amounts move in 0.25 steps on both axes; numeric(3,2) holds them exactly.
  wb_shift_ab_axis   char(1)      check (wb_shift_ab_axis in ('A', 'B')),
  wb_shift_ab_amount numeric(3,2) check (wb_shift_ab_amount between 0 and 7),
  wb_shift_gm_axis   char(1)      check (wb_shift_gm_axis in ('G', 'M')),
  wb_shift_gm_amount numeric(3,2) check (wb_shift_gm_amount between 0 and 7),

  -- Denormalised from settings for the Creative Look filter; null for PP.
  look          creative_look,

  -- Format-specific settings. Shape is enforced by ppSettingsSchema /
  -- clSettingsSchema before write; only the object-ness is checked here.
  settings      jsonb not null check (jsonb_typeof(settings) = 'object'),

  tags          text[] not null default '{}',
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- The id segment must agree with the format column.
  constraint recipes_id_matches_format check (
    id like 'SCL-' || upper(format::text) || '-%'
  ),
  -- A Creative Look recipe has a look; a Picture Profile recipe never does.
  constraint recipes_look_matches_format check (
    (format = 'cl') = (look is not null)
  ),
  -- Exactly one of kelvin / auto / preset is set, and it is the one wb_mode names.
  constraint recipes_wb_mode_consistent check (
    (wb_mode = 'kelvin' and wb_kelvin is not null and wb_auto is null   and wb_preset is null) or
    (wb_mode = 'auto'   and wb_auto   is not null and wb_kelvin is null and wb_preset is null) or
    (wb_mode = 'preset' and wb_preset is not null and wb_kelvin is null and wb_auto   is null)
  ),
  -- An axis and its amount travel together.
  constraint recipes_wb_shift_ab_paired check (
    (wb_shift_ab_axis is null) = (wb_shift_ab_amount is null)
  ),
  constraint recipes_wb_shift_gm_paired check (
    (wb_shift_gm_axis is null) = (wb_shift_gm_amount is null)
  ),
  -- Shift amounts land on the 0.25 grid.
  constraint recipes_wb_shift_ab_step check (
    wb_shift_ab_amount is null or (wb_shift_ab_amount * 4) = floor(wb_shift_ab_amount * 4)
  ),
  constraint recipes_wb_shift_gm_step check (
    wb_shift_gm_amount is null or (wb_shift_gm_amount * 4) = floor(wb_shift_gm_amount * 4)
  )
);

create index recipes_published_created_idx on recipes (created_at desc) where published;
create index recipes_format_idx            on recipes (format)          where published;
create index recipes_look_idx              on recipes (look)            where published and look is not null;
create index recipes_tags_idx              on recipes using gin (tags);

comment on column recipes.wb_preset is
  'Light-source preset, e.g. Daylight / Cloudy / Underwater Auto. Null unless wb_mode = ''preset''.';

-- ---------------------------------------------------------------------------
-- recipe_translations
-- ---------------------------------------------------------------------------

-- Only descriptions are translated. Recipe names, parameter labels, Look codes,
-- gamma names and WB values stay in English and therefore live on `recipes`.
create table recipe_translations (
  recipe_id   text not null references recipes (id) on delete cascade,
  locale      text not null check (locale in ('en', 'vi')),
  description text not null check (length(description) > 0),
  updated_at  timestamptz not null default now(),
  primary key (recipe_id, locale)
);

-- ---------------------------------------------------------------------------
-- recipe_images
-- ---------------------------------------------------------------------------
--
-- Metadata only, and deliberately not a runtime dependency any more. Recipe
-- photography is vendored into `public/recipes` at three WebP widths by commit
-- 4464fcc, because serving it from Storage was ~1.27 GB of cached egress a day
-- and is what restricted the old project. The table is kept because the import
-- and export scripts still round-trip it and the association it records — path
-- to recipe — is the thing that would be expensive to reconstruct.

create table recipe_images (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   text not null references recipes (id) on delete cascade,
  -- Path within a Storage bucket. Never an external URL: the original site
  -- hotlinked Google Photos and those URLs expire.
  storage_path text not null check (storage_path !~ '^https?://'),
  alt         text,
  sort        smallint not null default 0 check (sort >= 0),
  width       integer check (width > 0),
  height      integer check (height > 0),
  created_at  timestamptz not null default now(),
  unique (recipe_id, sort)
);

create index recipe_images_recipe_idx on recipe_images (recipe_id, sort);

-- ---------------------------------------------------------------------------
-- sony_cameras — the Wiki catalogue, cameras through audio
-- ---------------------------------------------------------------------------
--
-- `specs` is jsonb rather than a column per field on purpose. The four product
-- kinds share almost no fields — see the discriminated union in
-- src/lib/cameras/types.ts — so a flat table would be ~30 mostly-null columns
-- and a new lens field would be a migration.

create table sony_cameras (
  id text primary key,
  -- Not unique outright: audio accessories ship without one, and 0012 replaced
  -- the constraint with a partial index so many rows may share the empty string.
  sku text not null,
  name text not null,
  full_name text not null,
  category text not null check (category in ('camera', 'lens', 'accessory', 'audio')),
  sub_category_1 text not null default '',
  sub_category_2 text not null default '',
  price_vnd bigint not null default 0,
  price_formatted text not null,
  url text not null,
  image_url text not null,
  gallery_urls jsonb default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  specs jsonb,
  created_at timestamptz not null default now(),
  -- Provenance for anything a human edited. Never exposed to anon; see grants.
  updated_at timestamptz,
  updated_by text
);

create unique index sony_cameras_nonempty_sku_key
  on sony_cameras (sku)
  where sku <> '';

comment on column sony_cameras.features is
  'Either ["en text", …] (legacy, English) or {"en": [...], "vi": [...]}. Read via featureList().';

-- ---------------------------------------------------------------------------
-- lab_articles — Alpha Tech Blogs
-- ---------------------------------------------------------------------------

create table lab_articles (
  -- The `/blog/<id>` segment, so it is the slug and not a uuid. `setup`,
  -- `admin` and `new` are static sibling routes and are refused in the API;
  -- an article holding one would render at a URL Next never reaches it from.
  id text primary key,
  status text not null default 'draft' check (status in ('draft', 'published')),
  topic text not null,
  level text not null check (level in ('newbie', 'mid', 'pro')),
  archetype text not null,
  read text not null default '',
  title text not null,
  dek text not null default '',
  -- The block list, validated in `parse.ts` on the way both in and out. The
  -- column is deliberately unconstrained beyond "an array": the block
  -- vocabulary is a TypeScript union that changes with the renderers, and a
  -- CHECK constraint restating it here would be a second copy to keep in step.
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- The feed's only ordering, and the only filter the reading path applies.
create index lab_articles_status_updated_idx
  on lab_articles (status, updated_at desc);

-- ---------------------------------------------------------------------------
-- lab_assets — what an article's media actually is
-- ---------------------------------------------------------------------------
--
-- An article block stores an asset UUID, never a Storage URL. A URL bakes a
-- project ref into the article body, which is precisely what made this
-- migration expensive: every embedded image in every article would have had to
-- be rewritten to move projects.
--
-- The foreign key is RESTRICT rather than CASCADE, and that is the whole point
-- of the table. Objects in a bucket are not transactional; rows are. If
-- deleting an article could delete its asset rows, the objects they name would
-- survive with nothing left pointing at them and no way to find them again.
-- RESTRICT forces the delete route to clean the buckets first, then the rows,
-- then the article — and to fail loudly at step one instead of silently at
-- step three.

create table lab_assets (
  id uuid primary key default gen_random_uuid(),
  article_id text not null references lab_articles (id) on delete restrict,
  -- Immutable once written, and unique so a compensating delete can never
  -- remove an object a second row still claims.
  storage_path text not null unique,
  -- Only processed output is ever recorded. The original upload is decoded and
  -- re-encoded; its bytes, its metadata and its filename do not survive.
  mime_type text not null check (mime_type = 'image/webp'),
  -- Pixel bounds as well as byte bounds: a 200 KB PNG can decode to gigabytes.
  width integer not null check (width > 0 and width <= 12000),
  height integer not null check (height > 0 and height <= 12000),
  byte_size bigint not null check (byte_size > 0),
  -- Animation is disabled for the cutover. The check is a constraint rather
  -- than a default so re-enabling it is a deliberate migration with a measured
  -- size policy, not a forgotten flag.
  animated boolean not null default false check (animated = false),
  -- draft        — private bucket only, article not published
  -- published    — processed variants copied into the public bucket
  -- orphaned     — the row exists, its object write failed
  -- cleanup_failed — the object exists, its row delete failed
  state text not null check (
    state in ('draft', 'published', 'orphaned', 'cleanup_failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The verified editor, from the JWT. Never exposed to a browser.
  updated_by text not null
);

create index lab_assets_article_idx on lab_assets (article_id, state);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger recipes_touch before update on recipes
  for each row execute function touch_updated_at();
create trigger recipe_translations_touch before update on recipe_translations
  for each row execute function touch_updated_at();
create trigger lab_assets_touch before update on lab_assets
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
--
-- Every table, without exception. RLS is row-level and cannot hide a column, so
-- it is half the story: the column grants below are the other half, and the
-- rule for both is that the anon key ships inside the browser bundle. Anyone
-- can call PostgREST directly with it.

alter table recipes             enable row level security;
alter table recipe_translations enable row level security;
alter table recipe_images       enable row level security;
alter table sony_cameras        enable row level security;
alter table lab_articles        enable row level security;
alter table lab_assets          enable row level security;

create policy recipes_public_read on recipes
  for select using (published);

create policy recipe_translations_public_read on recipe_translations
  for select using (exists (
    select 1 from recipes r where r.id = recipe_id and r.published
  ));

create policy recipe_images_public_read on recipe_images
  for select using (exists (
    select 1 from recipes r where r.id = recipe_id and r.published
  ));

create policy sony_cameras_public_read on sony_cameras
  for select
  to anon, authenticated
  using (true);

-- Readers see published rows and nothing else. This is the real gate on drafts:
-- the query in `data.ts` also filters on status, but a query is a convenience
-- and this policy is what makes an unpublished draft unreachable.
create policy lab_articles_public_read on lab_articles
  for select
  to anon, authenticated
  using (status = 'published');

-- No policy on lab_assets at all. A reader never queries it: they fetch an
-- object from the public bucket by a URL the server put in the page.

-- ---------------------------------------------------------------------------
-- Column privileges
-- ---------------------------------------------------------------------------
--
-- Every narrow grant is preceded by a table-level REVOKE ALL. Granting columns
-- without revoking first relies on nothing having granted the table already —
-- true today, one careless statement away from false, and the failure is
-- silent: `updated_by` is an administrator's email address.

revoke all on table recipes from anon, authenticated;
grant select (
  id, legacy_id, slug, name, format, wb_mode, wb_kelvin, wb_auto, wb_preset,
  wb_shift_ab_axis, wb_shift_ab_amount, wb_shift_gm_axis, wb_shift_gm_amount,
  look, settings, tags, published, created_at, updated_at
) on table recipes to anon, authenticated;

revoke all on table recipe_translations from anon, authenticated;
grant select (recipe_id, locale, description, updated_at)
  on table recipe_translations to anon, authenticated;

revoke all on table recipe_images from anon, authenticated;
grant select (id, recipe_id, storage_path, alt, sort, width, height, created_at)
  on table recipe_images to anon, authenticated;

revoke all on table sony_cameras from anon, authenticated;
grant select (
  id, sku, name, full_name, category, sub_category_1, sub_category_2,
  price_vnd, price_formatted, url, image_url, gallery_urls, features, specs,
  created_at
) on table sony_cameras to anon, authenticated;

-- The correction 0013 needs and cannot receive retroactively: revoke first.
revoke all on table lab_articles from anon, authenticated;
grant select (
  id, status, topic, level, archetype, read, title, dek, blocks,
  created_at, updated_at
) on table lab_articles to anon, authenticated;

-- Nothing at all on the asset ledger. Every column is either an internal path
-- or an editor's address.
revoke all on table lab_assets from anon, authenticated;

-- No insert, update or delete grant to anon or authenticated on any table here.
-- Every write goes through a route handler that calls adminGate() against the
-- CONTROL project and then uses the content service credential — so writes
-- bypass RLS by design, and the gate is the route rather than a policy a
-- browser could ever satisfy.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
--
-- Two buckets, and the split is the egress policy.
--
-- `lab-drafts` is private and holds raw uploads and the processed variants of
-- articles that are not published. Admin preview uses a short-lived signed URL,
-- so an unpublished photograph is not addressable by anyone who guesses a path.
--
-- `lab` is public and receives only the processed WebP variants of *published*
-- articles. Unpublishing removes the public copies and keeps the private ones,
-- so a republish costs no reprocessing.
--
-- Recipe photography is not here and never will be: it is served from
-- `public/recipes`, which is what ended the 1.27 GB/day of cached egress.

insert into storage.buckets (id, name, public)
  values ('lab-drafts', 'lab-drafts', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('lab', 'lab', true)
  on conflict (id) do nothing;

-- The only browser-facing Storage policy in the project.
create policy "Allow public read access to lab media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'lab');

-- There is deliberately no select policy for `lab-drafts`, and no insert,
-- update or delete policy for either bucket. Uploads are service-role only, for
-- the same reason the tables' writes are: an insert policy for `authenticated`
-- would let any signed-in reader put a file in a bucket this app's own pages
-- then embed.
