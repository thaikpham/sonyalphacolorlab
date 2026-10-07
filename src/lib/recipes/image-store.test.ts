import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessedLabImage } from '@/lib/lab/image-process';
import type { Recipe } from '../camera/schema';
import { toRow } from './row';

/**
 * The photograph store, run against the content root's real `recipe_images`.
 *
 * Every defect this pins was invisible to a mock that simply said "ok": the
 * `sort >= 0` CHECK and `unique (recipe_id, sort)` are the two constraints a
 * reorder and an upload have to step around, and only Postgres enforces them.
 * So the content client here is a thin translation of the PostgREST calls the
 * store makes into SQL against PGlite, and Storage is an in-memory bucket that
 * refuses an existing path unless asked to overwrite, as Supabase's does.
 */

const CONTENT_ROOT = 'supabase/content/migrations';

let pg: PGlite;
const objects = new Map<string, Uint8Array>();
const removals: string[][] = [];
let failUpload: ((path: string) => boolean) | null = null;
let conflicts = 0;

type Filter = [column: string, value: unknown];
type Op = 'select' | 'insert' | 'update' | 'delete';
type Result = { data: unknown; error: { code?: string; message: string } | null };

async function run(
  op: Op,
  payload: Record<string, unknown> | null,
  returning: string | null,
  filters: Filter[],
  order: string | null,
  mode: 'many' | 'single' | 'maybe',
): Promise<Result> {
  const params: unknown[] = [];
  const bind = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const where = () =>
    filters.length ? ` where ${filters.map(([c, v]) => `${c} = ${bind(v)}`).join(' and ')}` : '';
  let sql: string;
  if (op === 'select') {
    sql = `select ${returning} from recipe_images${where()}${order ? ` order by ${order}` : ''}`;
  } else if (op === 'insert') {
    const cols = Object.keys(payload!);
    const values = cols.map((c) => bind(payload![c]));
    sql = `insert into recipe_images (${cols.join(', ')}) values (${values.join(', ')})`;
    if (returning) sql += ` returning ${returning}`;
  } else if (op === 'update') {
    const sets = Object.entries(payload!).map(([c, v]) => `${c} = ${bind(v)}`);
    sql = `update recipe_images set ${sets.join(', ')}${where()}`;
    if (returning) sql += ` returning ${returning}`;
  } else {
    sql = `delete from recipe_images${where()}`;
  }
  try {
    const out = await pg.query<Record<string, unknown>>(sql, params);
    const rows = returning ? out.rows : null;
    if (mode === 'single') {
      return rows?.length === 1
        ? { data: rows[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
    }
    if (mode === 'maybe') return { data: rows?.[0] ?? null, error: null };
    return { data: rows, error: null };
  } catch (err) {
    const e = err as { code?: string; message: string };
    return { data: null, error: { code: e.code, message: e.message } };
  }
}

function table(name: string) {
  expect(name).toBe('recipe_images');
  let op: Op | null = null;
  let payload: Record<string, unknown> | null = null;
  let returning: string | null = null;
  const filters: Filter[] = [];
  let order: string | null = null;
  const exec = (mode: 'many' | 'single' | 'maybe') =>
    run(op ?? 'select', payload, returning, filters, order, mode);
  const builder = {
    select(columns: string) {
      if (!op) op = 'select';
      returning = columns;
      return builder;
    },
    insert(p: Record<string, unknown>) {
      op = 'insert';
      payload = p;
      return builder;
    },
    update(p: Record<string, unknown>) {
      op = 'update';
      payload = p;
      return builder;
    },
    delete() {
      op = 'delete';
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.push([column, value]);
      return builder;
    },
    order(column: string, o?: { ascending?: boolean }) {
      order = `${column} ${o?.ascending === false ? 'desc' : 'asc'}`;
      return builder;
    },
    single: () => exec('single'),
    maybeSingle: () => exec('maybe'),
    then<T>(resolve: (r: Result) => T, reject?: (e: unknown) => T) {
      return exec('many').then(resolve, reject);
    },
  };
  return builder;
}

const bucket = {
  async upload(path: string, bytes: Uint8Array, opts: { upsert?: boolean }) {
    if (failUpload?.(path)) return { data: null, error: { message: 'gateway timeout' } };
    if (!opts.upsert && objects.has(path)) {
      conflicts += 1;
      /* What Storage answers for a path that is already there. */
      return { data: null, error: { statusCode: '409', message: 'The resource already exists' } };
    }
    objects.set(path, bytes);
    return { data: { path }, error: null };
  },
  async remove(paths: string[]) {
    removals.push(paths);
    for (const p of paths) objects.delete(p);
    return { data: [], error: null };
  },
  async createSignedUrl(path: string) {
    if (!objects.has(path)) return { data: null, error: { message: 'Object not found' } };
    return { data: { signedUrl: `https://signed.test/${path}` }, error: null };
  },
};

vi.mock('@/lib/supabase/server', () => ({
  contentAdmin: () => ({
    from: table,
    storage: { from: () => bucket },
  }),
  contentRead: () => {
    throw new Error('the photograph store writes with the admin client only');
  },
  hasContentConfig: () => true,
  hasControlConfig: () => true,
}));

/* What the last deploy serves, held still so a vendor run cannot move it. */
vi.mock('./vendored-images', () => {
  const VENDORED_IMAGES = [
    { recipeId: 'SCL-PP-002', storagePath: 'SCL-PP-002/00-1024.webp', sort: 0 },
    { recipeId: 'SCL-PP-002', storagePath: 'SCL-PP-002/01-1024.webp', sort: 1 },
    { recipeId: 'SCL-PP-002', storagePath: 'SCL-PP-002/02-1024.webp', sort: 2 },
  ];
  const paths = new Set(VENDORED_IMAGES.map((i) => i.storagePath));
  return { VENDORED_IMAGES, isVendored: (p: string) => paths.has(p) };
});

const store = await import('./image-store');

const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as (Recipe & {
  legacyId: string | null;
})[];

const image = (): ProcessedLabImage => ({
  width: 1200,
  height: 800,
  byteSize: 3,
  variants: ([320, 640, 1024] as const).map((rung) => ({ rung, bytes: Buffer.from([rung % 256]) })),
});

async function addRow(recipeId: string, slot: number, sort: number): Promise<string> {
  const path = `${recipeId}/${String(slot).padStart(2, '0')}-1024.webp`;
  for (const w of [320, 640, 1024]) {
    objects.set(path.replace(/-1024\.webp$/, `-${w}.webp`), new Uint8Array([1]));
  }
  const out = await pg.query<{ id: string }>(
    'insert into recipe_images (recipe_id, storage_path, sort) values ($1, $2, $3) returning id',
    [recipeId, path, sort],
  );
  return out.rows[0].id;
}

async function rows(recipeId: string) {
  const out = await pg.query<{ id: string; storage_path: string; sort: number }>(
    'select id, storage_path, sort from recipe_images where recipe_id = $1 order by sort',
    [recipeId],
  );
  return out.rows;
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    do $$ begin
      if not exists (select from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
    end $$;
    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key, name text not null, public boolean not null default false
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text
    );
  `);
  for (const f of readdirSync(CONTENT_ROOT).filter((x) => x.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(`${CONTENT_ROOT}/${f}`, 'utf8'));
  }
  for (const id of ['SCL-PP-001', 'SCL-PP-002']) {
    const r = seed.find((x) => x.id === id)!;
    const row = toRow(r, r.legacyId);
    const cols = Object.keys(row);
    await pg.query(
      `insert into recipes (${cols.join(', ')}) values (${cols.map((_c, i) => `$${i + 1}`).join(', ')})`,
      Object.values(row),
    );
  }
}, 60_000);

beforeEach(async () => {
  await pg.exec('delete from recipe_images');
  objects.clear();
  removals.length = 0;
  failUpload = null;
  conflicts = 0;
});

describe('reorderRecipeImages', () => {
  it('reorders without ever writing a sort the CHECK refuses', async () => {
    /* It used to park every row at a negative sort first, which `sort >= 0`
       rejects on the first UPDATE — so every up/down click failed online. */
    const a = await addRow('SCL-PP-001', 0, 0);
    const b = await addRow('SCL-PP-001', 1, 1);
    const c = await addRow('SCL-PP-001', 2, 2);

    await expect(store.reorderRecipeImages('SCL-PP-001', [c, a, b])).resolves.toBe(true);
    expect((await rows('SCL-PP-001')).map((r) => [r.id, r.sort])).toEqual([
      [c, 0],
      [a, 1],
      [b, 2],
    ]);
  });

  it('renumbers a list with holes in it back to 0..n-1', async () => {
    const a = await addRow('SCL-PP-001', 0, 3);
    const b = await addRow('SCL-PP-001', 1, 7);

    await expect(store.reorderRecipeImages('SCL-PP-001', [b, a])).resolves.toBe(true);
    expect((await rows('SCL-PP-001')).map((r) => [r.id, r.sort])).toEqual([
      [b, 0],
      [a, 1],
    ]);
  });
});

describe('uploadRecipeImage', () => {
  it('takes the sort after the highest one, not the row count', async () => {
    /* Sorts 1 and 2 left behind by deleting the first photograph. The row count
       is 2, which is taken, and `unique (recipe_id, sort)` refused every later
       upload to the recipe. */
    await addRow('SCL-PP-001', 1, 1);
    await addRow('SCL-PP-001', 2, 2);

    const out = await store.uploadRecipeImage('SCL-PP-001', image());
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.image.sort).toBe(3);
  });

  it('never reuses a slot the deployed manifest still serves', async () => {
    /* Slot 02 was deleted from the table but is still in `images.seed.json`:
       reusing it would leave the old photograph live and the new one never
       vendored. */
    await addRow('SCL-PP-002', 0, 0);
    await addRow('SCL-PP-002', 1, 1);

    const out = await store.uploadRecipeImage('SCL-PP-002', image());
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.image.storagePath).toBe('SCL-PP-002/03-1024.webp');
  });

  it('removes only what it uploaded when a variant fails', async () => {
    failUpload = (p) => p.endsWith('-640.webp');

    const out = await store.uploadRecipeImage('SCL-PP-001', image());
    expect(out).toEqual({ ok: false, error: 'uploadFailed' });
    expect(removals.flat()).toEqual(['SCL-PP-001/00-320.webp']);
    expect([...objects.keys()]).toEqual([]);
  });

  it('steps past a slot whose objects outlived a failed upload', async () => {
    /* A compensating remove is best-effort. If it failed, the slot's objects
       are still in the bucket with no row, and an overwrite would hand them to
       a different photograph. */
    objects.set('SCL-PP-001/00-320.webp', new Uint8Array([9]));

    const out = await store.uploadRecipeImage('SCL-PP-001', image());
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.image.storagePath).toBe('SCL-PP-001/01-1024.webp');
    expect(objects.get('SCL-PP-001/00-320.webp')).toEqual(new Uint8Array([9]));
  });

  it('lets two concurrent uploads both land without deleting each other', async () => {
    const [x, y] = await Promise.all([
      store.uploadRecipeImage('SCL-PP-001', image()),
      store.uploadRecipeImage('SCL-PP-001', image()),
    ]);
    expect(x.ok && y.ok).toBe(true);
    /* Both read the same list, so both picked the same slot first. */
    expect(conflicts).toBeGreaterThan(0);

    const stored = await rows('SCL-PP-001');
    expect(stored).toHaveLength(2);
    expect(new Set(stored.map((r) => r.storage_path)).size).toBe(2);
    expect(new Set(stored.map((r) => r.sort)).size).toBe(2);
    /* Every row still has all three of its objects. */
    for (const r of stored) {
      for (const w of [320, 640, 1024]) {
        expect(objects.has(r.storage_path.replace(/-1024\.webp$/, `-${w}.webp`)), r.storage_path).toBe(
          true,
        );
      }
    }
  });
});

describe('one photograph, addressed through its recipe', () => {
  it('will not delete another recipe’s photograph', async () => {
    const other = await addRow('SCL-PP-002', 3, 0);

    await expect(store.deleteRecipeImage('SCL-PP-001', other)).resolves.toBe(false);
    expect(await rows('SCL-PP-002')).toHaveLength(1);
    expect(objects.has('SCL-PP-002/03-1024.webp')).toBe(true);
  });

  it('will not set alt text on another recipe’s photograph', async () => {
    const other = await addRow('SCL-PP-002', 3, 0);

    await expect(store.setRecipeImageAlt('SCL-PP-001', other, 'Dunes')).resolves.toBe(false);
    const out = await pg.query<{ alt: string | null }>('select alt from recipe_images where id = $1', [
      other,
    ]);
    expect(out.rows[0].alt).toBeNull();
  });

  it('still deletes and labels its own', async () => {
    const own = await addRow('SCL-PP-001', 0, 0);

    await expect(store.setRecipeImageAlt('SCL-PP-001', own, 'Dunes')).resolves.toBe(true);
    await expect(store.deleteRecipeImage('SCL-PP-001', own)).resolves.toBe(true);
    expect(await rows('SCL-PP-001')).toHaveLength(0);
  });
});
