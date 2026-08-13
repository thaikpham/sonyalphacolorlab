-- Migration 0010: Add gallery_urls column to sony_cameras table

alter table sony_cameras
add column if not exists gallery_urls jsonb default '[]'::jsonb;
