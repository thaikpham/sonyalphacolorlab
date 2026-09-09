-- Migration 0012: Support Audio (PE) category and non-unique empty SKUs in sony_cameras table

-- 1. Update category check constraint to include 'audio'
alter table sony_cameras drop constraint if exists sony_cameras_category_check;

alter table sony_cameras add constraint sony_cameras_category_check
  check (category in ('camera', 'lens', 'accessory', 'audio'));

-- 2. Allow empty SKUs for audio items by dropping strict sku constraint and adding partial unique index
alter table sony_cameras drop constraint if exists sony_cameras_sku_key;

create unique index if not exists sony_cameras_nonempty_sku_key
  on sony_cameras (sku)
  where sku <> '';
