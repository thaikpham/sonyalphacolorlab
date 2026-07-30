import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { toRow } from './row';
import type { Recipe } from '../camera/schema';

/**
 * Executes the real migration against an in-process Postgres and loads the full
 * migrated dataset. Catches what a regex test cannot: invalid SQL, constraints
 * that reject legitimate rows, and constraints that fail to reject bad ones.
 */

const sql = readFileSync('supabase/migrations/0001_init.sql', 'utf8');
const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as (Recipe & {
  legacyId: string;
})[];

let db: PGlite;

async function insert(row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const params = cols.map((_c, i) => `$${i + 1}`).join(', ');
  return db.query(
    `insert into recipes (${cols.join(', ')}) values (${params})`,
    Object.values(row),
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sql);
}, 60_000);

describe('migration 0001', () => {
  it('applies cleanly', async () => {
    const t = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' order by table_name`,
    );
    expect(t.rows.map((r) => r.table_name)).toEqual([
      'recipe_images',
      'recipe_translations',
      'recipes',
    ]);
  });

  it('accepts all 46 migrated recipes', async () => {
    for (const r of seed) await insert(toRow(r, r.legacyId));
    const c = await db.query<{ n: number }>('select count(*)::int as n from recipes');
    expect(c.rows[0].n).toBe(46);
  });

  it('round-trips white balance through real columns', async () => {
    const q = await db.query<{ wb_kelvin: number; wb_shift_gm_amount: string }>(
      `select wb_kelvin, wb_shift_gm_amount from recipes where id = 'SCL-PP-001'`,
    );
    expect(q.rows[0].wb_kelvin).toBe(7000);
    // numeric(3,2) must preserve the quarter-step exactly, not round it.
    expect(Number(q.rows[0].wb_shift_gm_amount)).toBe(1.5);
  });

  it('stores AWB recipes with a null kelvin', async () => {
    const q = await db.query<{ wb_auto: string; wb_kelvin: number | null }>(
      `select wb_auto, wb_kelvin from recipes where legacy_id = 'scl-030'`,
    );
    expect(q.rows[0]).toEqual({ wb_auto: 'AWB (Priority White)', wb_kelvin: null });
  });

  // Each of these must be rejected by the database itself, not just by Zod.
  // The expected constraint name is asserted so a case cannot pass for the
  // wrong reason (e.g. tripping a unique index instead of the check it targets).
  const base = () => ({ ...toRow(seed[0], null), legacy_id: null });

  it.each([
    ['an id that does not match the scheme', { id: 'scl-001' }, 'recipes_id_check'],
    ['an id whose segment disagrees with format', { id: 'SCL-CL-900' }, 'recipes_id_matches_format'],
    ['a Kelvin outside the camera range', { id: 'SCL-PP-900', wb_kelvin: 12000 }, 'recipes_wb_kelvin_check'],
    ['a WB shift off the 0.25 grid', { id: 'SCL-PP-901', wb_shift_gm_amount: 1.1 }, 'recipes_wb_shift_gm_step'],
    ['a WB shift beyond 7', { id: 'SCL-PP-902', wb_shift_ab_amount: 9 }, 'recipes_wb_shift_ab_amount_check'],
    ['a shift amount with no axis', { id: 'SCL-PP-903', wb_shift_gm_axis: null }, 'recipes_wb_shift_gm_paired'],
    ['an uppercase slug', { id: 'SCL-PP-904', slug: 'Mojave-Sun' }, 'recipes_slug_check'],
    ['a PP recipe carrying a Creative Look', { id: 'SCL-PP-905', slug: 'x1', look: 'FL' }, 'recipes_look_matches_format'],
    ['a CL recipe with no Creative Look', { id: 'SCL-CL-905', slug: 'x2', format: 'cl' }, 'recipes_look_matches_format'],
  ])('rejects %s', async (_label, patch, constraint) => {
    await expect(insert({ ...base(), ...patch })).rejects.toThrow(constraint);
  });

  it('rejects an image row pointing at an external URL', async () => {
    await expect(
      db.query(
        `insert into recipe_images (recipe_id, storage_path)
         values ('SCL-PP-001', 'https://lh3.googleusercontent.com/pw/abc')`,
      ),
    ).rejects.toThrow();
  });

  it('cascades translations and images when a recipe is deleted', async () => {
    await db.query(
      `insert into recipe_translations (recipe_id, locale, description)
       values ('SCL-PP-002', 'vi', 'Mô tả tiếng Việt có dấu')`,
    );
    await db.query(
      `insert into recipe_images (recipe_id, storage_path, sort)
       values ('SCL-PP-002', 'recipes/scl-pp-002/01.jpg', 0)`,
    );
    await db.query(`delete from recipes where id = 'SCL-PP-002'`);
    const t = await db.query<{ n: number }>(
      `select count(*)::int as n from recipe_translations where recipe_id = 'SCL-PP-002'`,
    );
    const i = await db.query<{ n: number }>(
      `select count(*)::int as n from recipe_images where recipe_id = 'SCL-PP-002'`,
    );
    expect([t.rows[0].n, i.rows[0].n]).toEqual([0, 0]);
  });
});
