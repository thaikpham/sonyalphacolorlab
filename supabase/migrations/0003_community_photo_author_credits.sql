-- Add optional author credit name and social network link columns to community_photos.

alter table community_photos
  add column if not exists author_name text check (length(author_name) <= 100),
  add column if not exists author_social text check (author_social is null or author_social ~ '^https?://');
