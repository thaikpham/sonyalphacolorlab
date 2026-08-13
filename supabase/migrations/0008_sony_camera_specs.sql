-- Specs and bilingual features for the product catalogue, so the admin UI has
-- somewhere to write.
--
-- Until now `sony_cameras` carried no specs at all: every value lived in
-- `data/sony-cameras.seed.json` and Supabase held only the identity and pricing
-- columns. An admin editing a spec had nothing to edit.
--
-- `specs` is jsonb rather than a column per field on purpose. The three product
-- kinds (camera / lens / accessory) share almost no fields — see the
-- discriminated union in `src/lib/cameras/types.ts` — so a flat table would be
-- ~30 mostly-null columns and a new lens field would be a migration. The shape
-- is validated in the API route against the same types the seed is, which is
-- where the checking belongs.

alter table sony_cameras
  add column if not exists specs jsonb;

-- Marketing prose, and the only per-product text that is genuinely translated.
-- Spec VALUES are not in here: they stay language-neutral numbers plus the
-- per-field wordlist in `data/spec-values.en.json`, per Rule 3 in AGENTS.md.
--
-- Two shapes are accepted on read (`featureList()` in src/lib/cameras/features.ts):
-- the legacy flat `["…"]` array, which is English, and `{"en": [...], "vi": [...]}`.
-- Existing rows are left in the legacy shape rather than rewritten blind — a
-- backfill here would have to invent Vietnamese, and inventing is what the whole
-- extraction design exists to prevent. The admin UI fills `vi` per product.
comment on column sony_cameras.features is
  'Either ["en text", …] (legacy, English) or {"en": [...], "vi": [...]}. Read via featureList().';

-- Provenance for anything a human edited, so a wrong value can be traced to a
-- person and a time. Never exposed to anon — see the grants below.
alter table sony_cameras
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by text;

-- The anon key ships in the browser bundle, so anyone can call PostgREST
-- directly and RLS cannot hide a column. `updated_by` is an email address:
-- naming the columns is what keeps it out of an unauthenticated response, the
-- same rule `no-email-leak.test.ts` pins for the community tables.
revoke select on table sony_cameras from anon, authenticated;
grant select (
  id, sku, name, full_name, category, sub_category_1, sub_category_2,
  price_vnd, price_formatted, url, image_url, features, specs, created_at
) on table sony_cameras to anon, authenticated;

-- Writes are service-role only. The admin route checks the caller against
-- `admin_emails` (migration 0009) and then writes with the service client;
-- there is deliberately no RLS policy that would let a logged-in reader write
-- their own row.
