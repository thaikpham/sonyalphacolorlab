import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Two migration roots, two databases, and the boundary between them.
 *
 * `supabase/migrations` is the historical root. It is what the old project has
 * already applied, and it stays the control plane's root — rewriting an applied
 * history is the one thing a migration history exists to prevent, so the
 * article-privilege correction arrives as 0014 rather than as an edit to 0013.
 *
 * `supabase/content/migrations` is the new root, applied from zero to an empty
 * project. What matters most about it is what it does *not* contain. A content
 * project that grew an `admin_emails` table would be a second, unsupervised
 * answer to "who may edit this site" — and one with different RLS, in a
 * different organisation, reachable by a different credential.
 *
 * Both are executed here rather than pattern-matched. A regex cannot catch
 * invalid SQL, a constraint that rejects legitimate rows, or a restrictive
 * foreign key that silently was not created.
 */

const CONTROL_ROOT = 'supabase/migrations';
const CONTENT_ROOT = 'supabase/content/migrations';

const files = (root: string) =>
  readdirSync(root)
    .filter((f) => f.endsWith('.sql'))
    .sort();

/**
 * Supabase ships roles and a `storage` schema that a bare Postgres does not.
 * The migrations grant to those roles by name and insert buckets by hand, so
 * without these stubs the column privileges — the thing actually keeping editor
 * addresses out of the public API — would go untested, and the storage
 * statements would abort the file they are in and every later one.
 */
async function freshDatabase(root: string): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
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
      id text primary key,
      name text not null,
      public boolean not null default false
    );
    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text
    );
  `);
  for (const file of files(root)) {
    await db.exec(readFileSync(`${root}/${file}`, 'utf8'));
  }
  return db;
}

async function tableNames(db: PGlite): Promise<string[]> {
  const result = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  return result.rows.map((r) => r.table_name);
}

/** Which columns a role may select — the real answer, from the catalog. */
async function selectableColumns(db: PGlite, table: string, role: string): Promise<string[]> {
  const result = await db.query<{ column_name: string }>(
    `select column_name from information_schema.column_privileges
      where table_name = $1 and grantee = $2 and privilege_type = 'SELECT'
      order by column_name`,
    [table, role],
  );
  return result.rows.map((r) => r.column_name);
}

async function tablePrivileges(db: PGlite, table: string, role: string): Promise<string[]> {
  const result = await db.query<{ privilege_type: string }>(
    `select distinct privilege_type from information_schema.role_table_grants
      where table_name = $1 and grantee = $2`,
    [table, role],
  );
  return result.rows.map((r) => r.privilege_type);
}

let content: PGlite;
let control: PGlite;

beforeAll(async () => {
  [content, control] = await Promise.all([
    freshDatabase(CONTENT_ROOT),
    freshDatabase(CONTROL_ROOT),
  ]);
}, 120_000);

describe('the content root', () => {
  it('is a directory of its own, so a push cannot mean both projects', () => {
    expect(files(CONTENT_ROOT).length).toBeGreaterThan(0);
    expect(files(CONTENT_ROOT)).toContain('0001_content_baseline.sql');
  });

  it.each([
    'recipes',
    'recipe_translations',
    'recipe_images',
    'sony_cameras',
    'lab_articles',
    'lab_assets',
  ])('creates %s', async (table) => {
    expect(await tableNames(content)).toContain(table);
  });

  it.each([
    'admin_emails',
    'community_photos',
    'recipe_comments',
    'recipe_proposals',
    'proposal_votes',
  ])('never creates %s, which belongs to the control plane', async (table) => {
    expect(await tableNames(content)).not.toContain(table);
  });

  it('keeps the recipe child cascades', async () => {
    await content.exec(`
      insert into recipes (id, slug, name, format, wb_mode, wb_kelvin, settings, published)
      values ('SCL-PP-001', 'cascade-probe', 'Cascade probe', 'pp', 'kelvin', 5600, '{}'::jsonb, true);
      insert into recipe_translations (recipe_id, locale, description)
      values ('SCL-PP-001', 'en', 'A description.');
      insert into recipe_images (recipe_id, storage_path, sort)
      values ('SCL-PP-001', 'SCL-PP-001/1.jpg', 0);
      delete from recipes where id = 'SCL-PP-001';
    `);
    const left = await content.query<{ n: number }>(
      `select (select count(*) from recipe_translations)
            + (select count(*) from recipe_images) as n`,
    );
    expect(Number(left.rows[0].n)).toBe(0);
  });

  it('refuses to delete an article while an asset still references it', async () => {
    /* The reason the foreign key is RESTRICT and not CASCADE. Objects in a
       bucket are not transactional; rows are. If the article delete could take
       the asset rows with it, the objects they name would survive with nothing
       pointing at them and no way to find them again. */
    await content.exec(`
      insert into lab_articles (id, topic, level, archetype, title)
      values ('restrict-probe', 'setup', 'mid', 'explainer', 'Restrict probe');
      insert into lab_assets (article_id, storage_path, mime_type, width, height, byte_size, state, updated_by)
      values ('restrict-probe', 'restrict-probe/a.webp', 'image/webp', 640, 480, 1234, 'draft', 'editor@example.com');
    `);
    await expect(
      content.exec(`delete from lab_articles where id = 'restrict-probe'`),
    ).rejects.toThrow();
  });

  it.each([
    ['a non-WebP asset', `'image/png', 640, 480, 10, 'draft'`],
    ['an animated asset', `'image/webp', 640, 480, 10, 'draft', true`],
    ['a zero-width asset', `'image/webp', 0, 480, 10, 'draft'`],
    ['a decompression bomb', `'image/webp', 40000, 40000, 10, 'draft'`],
    ['an unknown lifecycle state', `'image/webp', 640, 480, 10, 'limbo'`],
  ])('refuses %s', async (_label, values) => {
    const columns = values.split(',').length === 6
      ? 'mime_type, width, height, byte_size, state, animated'
      : 'mime_type, width, height, byte_size, state';
    await expect(
      content.exec(`
        insert into lab_assets (article_id, storage_path, ${columns}, updated_by)
        values ('restrict-probe', 'probe-${Math.random()}.webp', ${values}, 'editor@example.com');
      `),
    ).rejects.toThrow();
  });
});

describe('the control root', () => {
  it('still applies every historical file from zero', async () => {
    const tables = await tableNames(control);
    for (const table of ['recipes', 'admin_emails', 'recipe_comments', 'proposal_votes']) {
      expect(tables).toContain(table);
    }
  });

  it('gains a dormant lab_assets shaped for a rollback import', async () => {
    /* Same columns and the same restrictive key as the content baseline. A
       rollback that has to reshape rows on the way in is not a rollback. */
    expect(await tableNames(control)).toContain('lab_assets');
    const a = await selectableColumns(content, 'lab_assets', 'anon');
    const b = await selectableColumns(control, 'lab_assets', 'anon');
    expect(a).toEqual(b);
    expect(a).toEqual([]);
  });
});

describe('what a browser may read', () => {
  const ROOTS = () => [
    ['content', content],
    ['control', control],
  ] as const;

  it.each(['anon', 'authenticated'])('%s cannot read lab_articles.updated_by', async (role) => {
    for (const [, db] of ROOTS()) {
      const columns = await selectableColumns(db, 'lab_articles', role);
      expect(columns).not.toContain('updated_by');
      // It must still be able to read the article itself, or the blog is blank.
      expect(columns).toContain('title');
    }
  });

  it.each(['anon', 'authenticated'])('%s cannot read sony_cameras.updated_by', async (role) => {
    for (const [, db] of ROOTS()) {
      expect(await selectableColumns(db, 'sony_cameras', role)).not.toContain('updated_by');
    }
  });

  it.each(['anon', 'authenticated'])('%s cannot read lab_assets at all', async (role) => {
    expect(await selectableColumns(content, 'lab_assets', role)).toEqual([]);
  });

  it.each([
    'recipes',
    'recipe_translations',
    'recipe_images',
    'sony_cameras',
    'lab_articles',
    'lab_assets',
  ])('no browser role may write %s', async (table) => {
    for (const role of ['anon', 'authenticated']) {
      const granted = await tablePrivileges(content, table, role);
      expect(granted).not.toContain('INSERT');
      expect(granted).not.toContain('UPDATE');
      expect(granted).not.toContain('DELETE');
    }
  });
});

describe('the two buckets', () => {
  it('creates a private drafts bucket and a public published one', async () => {
    const rows = await content.query<{ id: string; public: boolean }>(
      `select id, public from storage.buckets order by id`,
    );
    expect(rows.rows).toEqual([
      { id: 'lab', public: true },
      { id: 'lab-drafts', public: false },
    ]);
  });

  it('gives the browser a read policy on the public bucket only', () => {
    const sql = readFileSync(`${CONTENT_ROOT}/0001_content_baseline.sql`, 'utf8');
    expect(sql).toMatch(/using \(bucket_id = 'lab'\)/);
    expect(sql).not.toMatch(/bucket_id = 'lab-drafts'/);
    /* No write policy on either bucket: an insert policy for `authenticated`
       would let any signed-in reader put a file in a bucket this app's own
       pages then embed. */
    expect(sql).not.toMatch(/on storage\.objects for (insert|update|delete)/);
  });

  it('never gives a recipe photograph a Storage runtime path again', () => {
    /* ~1.27 GB of cached egress a day, and the reason the old project is
       restricted. The photographs live in `public/recipes` at three WebP
       widths; `recipe_images` keeps only the association. */
    const sql = readFileSync(`${CONTENT_ROOT}/0001_content_baseline.sql`, 'utf8');
    expect(sql).not.toMatch(/values \('recipes', 'recipes'/);
  });
});
