-- Alpha ColorLab — initial schema
--
-- Column types mirror src/lib/camera/constants.ts. Zod remains the primary
-- validator at the application boundary; the CHECK constraints here are defence
-- in depth so a bad row cannot be written by a script, the SQL editor, or a
-- future service that forgets to validate.
--
-- Bounds that appear in both places are asserted equal by
-- src/lib/camera/sql-drift.test.ts.

-- UUIDs come from gen_random_uuid(), in Postgres core since 13 — no extension
-- needed (Supabase runs 15+).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Picture Profile and Creative Look are mutually exclusive on the camera.
create type recipe_format as enum ('pp', 'cl');

create type wb_mode as enum ('kelvin', 'auto');

-- The ten built-in Creative Looks.
create type creative_look as enum ('ST', 'PT', 'NT', 'VV', 'VV2', 'FL', 'IN', 'SH', 'BW', 'SE');

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------

create table recipes (
  id            text primary key
                check (id ~ '^SCL-(PP|CL)-[0-9]{3}$'),

  -- Original sonycolorlab id (scl-001, PROCOLOR-001). Kept to generate 301
  -- redirects at cutover; never reused as a key.
  legacy_id     text unique,

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
  -- Exactly one of kelvin / auto is set, matching wb_mode.
  constraint recipes_wb_mode_consistent check (
    (wb_mode = 'kelvin' and wb_kelvin is not null and wb_auto is null) or
    (wb_mode = 'auto'   and wb_auto   is not null and wb_kelvin is null)
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

create table recipe_images (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   text not null references recipes (id) on delete cascade,
  -- Path within the Supabase Storage bucket. Never an external URL: the
  -- original site hotlinked Google Photos and those URLs expire.
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

-- ---------------------------------------------------------------------------
-- Row Level Security — public reads published rows; writes need service role
-- ---------------------------------------------------------------------------

alter table recipes             enable row level security;
alter table recipe_translations enable row level security;
alter table recipe_images       enable row level security;

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
