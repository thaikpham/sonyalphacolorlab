-- Migration 0007: Sony Camera, Lens & Accessory Product Catalog Table

create table if not exists sony_cameras (
  id text primary key,
  sku text not null unique,
  name text not null,
  full_name text not null,
  category text not null check (category in ('camera', 'lens', 'accessory')),
  sub_category_1 text not null default '',
  sub_category_2 text not null default '',
  price_vnd bigint not null default 0,
  price_formatted text not null,
  url text not null,
  image_url text not null,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table sony_cameras enable row level security;

-- Public read access for anonymous and authenticated users
create policy "Allow public read access to sony_cameras"
  on sony_cameras for select
  to anon, authenticated
  using (true);

-- Explicit column privileges
grant select on table sony_cameras to anon, authenticated;
