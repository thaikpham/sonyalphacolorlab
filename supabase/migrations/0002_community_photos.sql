-- Community-contributed photo URLs and Author credits.

create table if not exists community_photos (
  id           uuid primary key default gen_random_uuid(),

  -- Slug rather than a FK to recipes(id)
  recipe_slug  text not null check (recipe_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- https only.
  image_url    text not null
               check (image_url ~ '^https://')
               check (length(image_url) between 12 and 2048),

  -- Optional author credit name and social link
  author_name  text check (length(author_name) <= 100),
  author_social text check (author_social is null or author_social ~ '^https?://'),

  -- Moderation switch. Defaults to visible.
  approved     boolean not null default true,

  -- Coarse origin marker for abuse cleanup.
  submitted_by text,

  created_at   timestamptz not null default now(),

  -- The same URL twice on one recipe is a duplicate.
  unique (recipe_slug, image_url)
);

create index if not exists community_photos_recipe_idx
  on community_photos (recipe_slug, created_at desc)
  where approved;

alter table community_photos enable row level security;

-- Public reads approved rows only.
drop policy if exists community_photos_public_read on community_photos;
create policy community_photos_public_read on community_photos
  for select using (approved);

drop policy if exists community_photos_public_insert on community_photos;
