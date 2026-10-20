import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { PRODUCT_COLUMNS } from '@/lib/cameras/row';
import { COMMENT_COLUMNS, PHOTO_COLUMNS, PROPOSAL_COLUMNS } from '@/lib/community/columns';
import { PUBLIC_COLUMNS } from '@/lib/lab/data';
import { RECIPE_COLUMNS } from '@/lib/recipes/row';

/**
 * Every column list a public read sends, run as the role that sends it.
 *
 * The anon role is granted columns, not tables, so one column a list names and
 * the grant does not cover is "permission denied" for the whole query — not a
 * missing field. `gallery_urls` took the Wiki down that way (0010 added it,
 * nothing granted it until 0016), and only `PRODUCT_COLUMNS` was checked
 * against the grants afterwards; the comment, proposal and photo lists were
 * restated by hand or not at all. Each list is imported from where its route
 * reads it, so a column added there is a column checked here.
 *
 * The stub matches `migration-roots.test.ts`, Supabase's default ACL included:
 * without it a table no migration revokes would look private here.
 */

const CONTROL_ROOT = 'supabase/migrations';
const CONTENT_ROOT = 'supabase/content/migrations';

async function build(root: string): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text
    );
  `);
  for (const file of readdirSync(root).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(`${root}/${file}`, 'utf8'));
  }
  return db;
}

let control: PGlite;
let content: PGlite;

beforeAll(async () => {
  [control, content] = await Promise.all([build(CONTROL_ROOT), build(CONTENT_ROOT)]);
}, 60_000);

/** `select <list> from <table> limit 0` as `role`; resolves only if every column is granted. */
async function selectAs(db: PGlite, role: string, table: string, list: string) {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(`select ${list} from ${table} limit 0`);
  } finally {
    await db.exec('reset role');
  }
}

/* The community tables live on control only. The content tables are read from
   content, and from control during a rollback, so both roots must serve them. */
const READS: [string, string, string, () => PGlite[]][] = [
  ['recipe_proposals', 'PROPOSAL_COLUMNS', PROPOSAL_COLUMNS, () => [control]],
  ['recipe_comments', 'COMMENT_COLUMNS', COMMENT_COLUMNS, () => [control]],
  ['community_photos', 'PHOTO_COLUMNS', PHOTO_COLUMNS, () => [control]],
  ['lab_articles', 'PUBLIC_COLUMNS', PUBLIC_COLUMNS, () => [control, content]],
  ['recipes', 'RECIPE_COLUMNS', RECIPE_COLUMNS, () => [control, content]],
  ['sony_cameras', 'PRODUCT_COLUMNS', PRODUCT_COLUMNS, () => [control, content]],
];

describe.each(['anon', 'authenticated'])('%s', (role) => {
  it.each(READS)('can select %s as %s names it', async (table, _name, list, roots) => {
    for (const db of roots()) {
      await expect(selectAs(db, role, table, list), `${table}: ${list}`).resolves.toBeDefined();
    }
  });
});

describe('the lists themselves', () => {
  it.each(READS)('%s: %s names no address and no wildcard', (_table, _name, list) => {
    const columns = list.split(',').map((c) => c.trim());
    expect(columns).not.toContain('*');
    for (const column of columns) expect(column).not.toMatch(/email|updated_by|submitted_by/);
  });

  /* A probe that cannot fail is not a probe: an ungranted column must refuse. */
  it('refuses a list that names an ungranted column', async () => {
    await expect(selectAs(control, 'anon', 'recipe_comments', `${COMMENT_COLUMNS}, author_email`)).rejects.toThrow(
      /permission denied/,
    );
  });
});
