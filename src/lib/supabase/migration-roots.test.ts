import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Recipe } from '@/lib/camera/schema';
import { PRODUCT_COLUMNS } from '@/lib/cameras/row';
import { toRow } from '@/lib/recipes/row';

/**
 * Two migration roots, two databases, and the boundary between them.
 *
 * `supabase/migrations` is the historical root. It is what the old project has
 * already applied, and it stays the control plane's root — rewriting an applied
 * history is the one thing a migration history exists to prevent, so the
 * article-privilege correction arrives as 0014 rather than as an edit to 0013.
 *
 * `supabase/content/migrations` is the content plane's root, run from zero here.
 * The live content project was built from the control root instead, and the
 * reconcile migration closes the gap; the block on it below proves it. What matters most
 * about this root is what it does *not* contain. A content
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
 *
 * The default ACL is Supabase's too: every table created in `public` starts
 * with ALL granted to anon and authenticated. Without it a table that a
 * migration never revokes looks private here and is not in production. That
 * is the difference between the two roots' recipe tables that this file could
 * not see until the reconcile migration.
 */
async function freshDatabase(
  root: string,
  include: (file: string) => boolean = () => true,
): Promise<PGlite> {
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
    alter default privileges in schema public grant all on tables to anon, authenticated;
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
    if (!include(file)) continue;
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

/**
 * Everything about the schema that a later migration or a reader can depend
 * on, as sorted lines: every relation in `public` with its RLS flags and ACL,
 * columns with their types, defaults and comments, constraints, indexes,
 * policies, triggers and whether they fire, functions with their security and
 * ACL, enums, every privilege anon, authenticated or PUBLIC holds on a table or
 * a column, and buckets. Rows and column order are left out, because no
 * migration depends on either.
 */
async function shape(db: PGlite): Promise<string[]> {
  const result = await db.query<{ line: string }>(`
    with r(oid, rolname) as (
      select oid, rolname from pg_roles where rolname in ('anon', 'authenticated')
      union all select 0::oid, 'PUBLIC'
    ), t(oid, relname) as (
      select oid, relname from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r'
    )
    select line from (
      select 'relation ' || relname || ' kind=' || relkind::text || ' rls=' || relrowsecurity
             || ' force=' || relforcerowsecurity || ' acl=' || coalesce(relacl::text, '-') as line
        from pg_class where relnamespace = 'public'::regnamespace
      union all
      select 'column ' || t.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
             || ' notnull=' || a.attnotnull
             || ' default=' || coalesce(pg_get_expr(d.adbin, d.adrelid), '-')
             || ' comment=' || coalesce(col_description(a.attrelid, a.attnum), '-')
        from t join pg_attribute a on a.attrelid = t.oid
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attnum > 0 and not a.attisdropped
      union all
      select 'constraint ' || t.relname || ' ' || c.conname || ' ' || pg_get_constraintdef(c.oid)
        from t join pg_constraint c on c.conrelid = t.oid where c.contype <> 'n'
      union all
      select 'index ' || indexname || ' ' || indexdef from pg_indexes where schemaname = 'public'
      union all
      select 'policy ' || schemaname || '.' || tablename || ' ' || policyname || ' ' || cmd
             || ' ' || permissive || ' to ' || array_to_string(roles, ',')
             || ' using ' || coalesce(qual, '-') || ' check ' || coalesce(with_check, '-')
        from pg_policies where schemaname in ('public', 'storage')
      union all
      select 'trigger ' || pg_get_triggerdef(g.oid) || ' enabled=' || g.tgenabled::text
        from pg_trigger g join t on t.oid = g.tgrelid where not g.tgisinternal
      union all
      select 'function ' || proname || '(' || pg_get_function_identity_arguments(oid) || ') '
             || md5(prosrc) || ' secdef=' || prosecdef
             || ' config=' || coalesce(array_to_string(proconfig, ';'), '-')
             || ' acl=' || coalesce(proacl::text, '-')
        from pg_proc where pronamespace = 'public'::regnamespace
      union all
      select 'enum ' || y.typname || ' ' || string_agg(e.enumlabel, ',' order by e.enumsortorder)
        from pg_type y join pg_enum e on e.enumtypid = y.oid
       where y.typnamespace = 'public'::regnamespace group by y.typname
      union all
      select 'table-grant ' || t.relname || ' ' || r.rolname || ' '
             || coalesce((select string_agg(x.privilege_type, ',' order by x.privilege_type)
                            from pg_class c, aclexplode(c.relacl) x
                           where c.oid = t.oid and x.grantee = r.oid), '-')
        from t cross join r
      union all
      select 'column-grant ' || t.relname || ' ' || r.rolname || ' '
             || coalesce((select string_agg(x.privilege_type || ':' || a.attname, ','
                                            order by x.privilege_type, a.attname)
                            from pg_attribute a, aclexplode(a.attacl) x
                           where a.attrelid = t.oid and x.grantee = r.oid), '-')
        from t cross join r
      union all
      select 'bucket ' || id || ' public=' || public from storage.buckets
    ) lines
    order by line
  `);
  return result.rows.map((r) => r.line);
}

const CONTROL_ONLY = [
  'proposal_votes',
  'recipe_proposals',
  'recipe_comments',
  'community_photos',
  'admin_emails',
];

/**
 * The live content project as it stood before the reconcile, not today's
 * roots: control 0001–0016 with the control-only tables dropped by hand and
 * content 0003 pasted into the SQL editor.
 */
async function liveLineage(): Promise<PGlite> {
  const db = await freshDatabase(CONTROL_ROOT, (f) => f.split('_')[0] <= '0016');
  await db.exec(`drop table ${CONTROL_ONLY.join(', ')} cascade`);
  await db.exec(readFileSync(`${CONTENT_ROOT}/0003_lab_article_kind_and_meta.sql`, 'utf8'));
  return db;
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
      values ('PP-001', 'cascade-probe', 'Cascade probe', 'pp', 'kelvin', 5600, '{}'::jsonb, true);
      insert into recipe_translations (recipe_id, locale, description)
      values ('PP-001', 'en', 'A description.');
      insert into recipe_images (recipe_id, storage_path, sort)
      values ('PP-001', 'PP-001/1.jpg', 0);
      delete from recipes where id = 'PP-001';
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
    ).rejects.toThrow(/lab_assets_article_id_fkey/);
  });

  /* Each case names the check it targets and seeds its own article. A bare
     `toThrow()` leaning on the previous test's row passed on the foreign key
     whenever this ran alone — refusing for the wrong reason. Postgres tests
     CHECK constraints in name order, so the bomb trips `height` first. */
  it.each([
    ['a non-WebP asset', `'image/png', 640, 480, 10, 'draft'`, 'lab_assets_mime_type_check'],
    ['an animated asset', `'image/webp', 640, 480, 10, 'draft', true`, 'lab_assets_animated_check'],
    ['a zero-width asset', `'image/webp', 0, 480, 10, 'draft'`, 'lab_assets_width_check'],
    ['a decompression bomb', `'image/webp', 40000, 40000, 10, 'draft'`, 'lab_assets_height_check'],
    ['an unknown lifecycle state', `'image/webp', 640, 480, 10, 'limbo'`, 'lab_assets_state_check'],
  ])('refuses %s', async (_label, values, constraint) => {
    const columns = values.split(',').length === 6
      ? 'mime_type, width, height, byte_size, state, animated'
      : 'mime_type, width, height, byte_size, state';
    await content.exec(`
      insert into lab_articles (id, topic, level, archetype, title)
      values ('asset-check-probe', 'setup', 'mid', 'explainer', 'Asset check probe')
      on conflict (id) do nothing;
    `);
    await expect(
      content.exec(`
        insert into lab_assets (article_id, storage_path, ${columns}, updated_by)
        values ('asset-check-probe', 'probe-${Math.random()}.webp', ${values}, 'editor@example.com');
      `),
    ).rejects.toThrow(constraint);
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

describe('the content reconcile, on the lineage the live content project came from', () => {
  /* The content project was built by the control root, not by this one. Its
     integration ran control 0001–0016, the control-only tables were dropped by
     hand, and content 0003 was pasted into the SQL editor. The reconcile
     migration is what makes "this root describes the content project" true,
     and it may be recorded as applied wherever it ran only because it is a
     no-op on a database this root built. */
  const RECONCILE = '20261006000000_reconcile_control_lineage.sql';
  const sql = () => readFileSync(`${CONTENT_ROOT}/${RECONCILE}`, 'utf8');
  /** This root up to, and not including, the reconcile. */
  const contentRoot = () => freshDatabase(CONTENT_ROOT, (f) => f < RECONCILE);

  /** What differs, by kind and name, so drift in either root fails loudly. */
  function differing(a: string[], b: string[]): string[] {
    const inA = new Set(a);
    const inB = new Set(b);
    return [...a.filter((l) => !inB.has(l)), ...b.filter((l) => !inA.has(l))]
      .map((l) => l.split(' ').slice(0, 3).join(' '))
      .filter((k, i, all) => all.indexOf(k) === i)
      .sort();
  }

  it('versions itself so a control-root push cannot read it as its own', () => {
    /* The integration compares version prefixes. A prefix the control root also
       has would let a control-root push into content treat this project's
       history as control's and run control's later files there. */
    const version = RECONCILE.split('_')[0];
    expect(files(CONTROL_ROOT).map((f) => f.split('_')[0])).not.toContain(version);
    expect(version).toMatch(/^\d{14}$/);
  });

  it('brings the live lineage to exactly this root', async () => {
    const lineage = await liveLineage();
    const target = await shape(await contentRoot());

    // These differences, and only these, are what the file is for.
    expect(differing(await shape(lineage), target)).toEqual([
      'bucket recipe-uploads public=false',
      'column-grant recipe_images anon',
      'column-grant recipe_images authenticated',
      'column-grant recipe_translations anon',
      'column-grant recipe_translations authenticated',
      'column-grant recipes anon',
      'column-grant recipes authenticated',
      'policy public.lab_articles Allow',
      'policy public.lab_articles lab_articles_public_read',
      'policy public.sony_cameras Allow',
      'policy public.sony_cameras sony_cameras_public_read',
      'relation recipe_images kind=r',
      'relation recipe_translations kind=r',
      'relation recipes kind=r',
      'table-grant recipe_images anon',
      'table-grant recipe_images authenticated',
      'table-grant recipe_translations anon',
      'table-grant recipe_translations authenticated',
      'table-grant recipes anon',
      'table-grant recipes authenticated',
      'trigger CREATE TRIGGER',
    ]);

    await lineage.exec(sql());
    expect(await shape(lineage)).toEqual(target);
  }, 60_000);

  it('handles the live project as it may be found: bucket made by hand, comments gone, both policy names', async () => {
    const lineage = await liveLineage();
    await lineage.exec(`
      create policy sony_cameras_public_read on sony_cameras
        for select to anon, authenticated using (true);
      create policy lab_articles_public_read on lab_articles
        for select to anon, authenticated using (status = 'published');
      insert into storage.buckets (id, name, public) values ('recipe-uploads', 'recipe-uploads', true);
      comment on column recipes.wb_preset is null;
      comment on column sony_cameras.features is null;
    `);
    await lineage.exec(sql());
    expect(await shape(lineage)).toEqual(await shape(await contentRoot()));
  }, 60_000);

  it('changes nothing on a database this root built, however often it runs', async () => {
    const db = await contentRoot();
    const before = await shape(db);
    await db.exec(sql());
    await db.exec(sql());
    expect(await shape(db)).toEqual(before);
  }, 60_000);

  it('refuses the control plane before changing anything', async () => {
    const text = sql();
    const firstChange = text.search(
      /^\s*(create|revoke|grant|insert|comment|alter|drop)\b/m,
    );
    expect(text.indexOf('control-plane tables')).toBeGreaterThan(-1);
    expect(text.indexOf('control-plane tables')).toBeLessThan(firstChange);

    const before = await shape(control);
    await expect(control.exec(text)).rejects.toThrow(/control-plane tables/);
    expect(await shape(control)).toEqual(before);
  });

  it('refuses a recipes column the anon read grant would not cover', async () => {
    /* The catalogue reads recipes as anon with select('*'). One ungranted
       column turns that into "permission denied" for the whole table. */
    const lineage = await liveLineage();
    await lineage.exec(`alter table recipes add column internal_note text`);
    await expect(lineage.exec(sql())).rejects.toThrow(/recipes\.internal_note not in the anon read grant/);
  }, 60_000);
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

  it.each(['anon', 'authenticated'])(
    '%s can read lab_articles.kind and .meta on both projects, and still not updated_by',
    async (role) => {
      /* The published read names both columns (`PUBLIC_COLUMNS` in
         `lab/data.ts`). A column missing from the grant is "permission denied"
         for the whole query — the blog and /learn go down together. The grant
         is additive, so the address must still be absent afterwards. */
      for (const [name, db] of ROOTS()) {
        const columns = await selectableColumns(db, 'lab_articles', role);
        expect(columns, `${name}: kind`).toContain('kind');
        expect(columns, `${name}: meta`).toContain('meta');
        expect(columns, `${name}: updated_by`).not.toContain('updated_by');
      }
    },
  );

  it('defaults every existing row to an ordinary article with empty metadata', async () => {
    for (const [, db] of ROOTS()) {
      await db.exec(`
        insert into lab_articles (id, topic, level, archetype, title)
        values ('kind-default-probe', 'setup', 'mid', 'explainer', 'Kind default probe')
        on conflict (id) do nothing;
      `);
      const row = await db.query<{ kind: string; meta: unknown }>(
        `select kind, meta from lab_articles where id = 'kind-default-probe'`,
      );
      expect(row.rows[0]).toEqual({ kind: 'article', meta: {} });
    }
  });

  it.each([
    ['an unknown kind', `kind = 'wiki'`, 'lab_articles_kind_check'],
    ['metadata that is not an object', `meta = '[]'::jsonb`, 'lab_articles_meta_is_object'],
  ])('refuses %s', async (_label, assignment, constraint) => {
    for (const [, db] of ROOTS()) {
      await expect(
        db.exec(`update lab_articles set ${assignment} where id = 'kind-default-probe'`),
      ).rejects.toThrow(constraint);
    }
  });

  it.each(['anon', 'authenticated'])('%s cannot read sony_cameras.updated_by', async (role) => {
    for (const [, db] of ROOTS()) {
      expect(await selectableColumns(db, 'sony_cameras', role)).not.toContain('updated_by');
    }
  });

  it.each(['anon', 'authenticated'])(
    '%s can read every column the catalogue selects, on both projects',
    async (role) => {
      /* The catalogue reads run under the anon key and name their columns
         (`PRODUCT_COLUMNS`). A column missing from the grant is not a missing
         field, it is "permission denied" for the whole query — and through
         `contentOrOfflineSeed` an outage of the entire Wiki. The control root
         counts too: it serves the catalogue during a rollback. `gallery_urls`
         is the column that was never granted there (0010 added it after 0008
         narrowed the grant) until 0016. */
      const wanted = PRODUCT_COLUMNS.split(',').map((c) => c.trim());
      for (const [name, db] of ROOTS()) {
        const granted = await selectableColumns(db, 'sony_cameras', role);
        for (const column of wanted) {
          expect(granted, `${name}: ${role} cannot select sony_cameras.${column}`).toContain(column);
        }
      }
    },
  );

  it.each(['anon', 'authenticated'])('%s may not write sony_cameras on the control project either', async (role) => {
    const granted = await tablePrivileges(control, 'sony_cameras', role);
    expect(granted).not.toContain('INSERT');
    expect(granted).not.toContain('UPDATE');
    expect(granted).not.toContain('DELETE');
  });

  /* 0004 revoked SELECT on the community tables and nothing else, and 0001
     revoked nothing on the recipe tables, so under Supabase's default ACL the
     browser roles kept INSERT, UPDATE, DELETE and TRUNCATE there and writes
     rested on "no write policy" alone. One `for all using (true)` policy would
     have opened them — on a table holding commenters' addresses. */
  it.each([
    'recipe_comments',
    'recipe_proposals',
    'recipes',
    'recipe_translations',
    'recipe_images',
  ])('no browser role may write %s on the control project', async (table) => {
    for (const role of ['anon', 'authenticated']) {
      const granted = await tablePrivileges(control, table, role);
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        expect(granted, `${role} ${privilege} ${table}`).not.toContain(privilege);
      }
    }
  });

  it.each(['anon', 'authenticated'])('%s cannot read lab_assets at all', async (role) => {
    expect(await selectableColumns(content, 'lab_assets', role)).toEqual([]);
  });

  it('stores highlights as an object or nothing, in both roots', async () => {
    for (const [name, db] of ROOTS()) {
      await expect(
        db.exec(`update sony_cameras set highlights = '[]'::jsonb where false`),
        `${name}: the column exists`,
      ).resolves.toBeDefined();
      await db.exec(`
        insert into sony_cameras (id, sku, name, full_name, category, price_vnd, price_formatted, url, image_url)
        values ('hl-probe', 'HL-1', 'Probe', 'Probe', 'camera', 1, '1 ₫', '', '')
        on conflict (id) do nothing;
      `);
      await expect(db.exec(`update sony_cameras set highlights = '[]'::jsonb where id = 'hl-probe'`), name).rejects.toThrow(
        /sony_cameras_highlights_is_object/,
      );
      await db.exec(`update sony_cameras set highlights = '{"en":{},"vi":{}}'::jsonb where id = 'hl-probe'`);
      await db.exec(`update sony_cameras set highlights = null where id = 'hl-probe'`);
    }
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

describe('the three buckets', () => {
  it('creates one public bucket and two private ones', async () => {
    const rows = await content.query<{ id: string; public: boolean }>(
      `select id, public from storage.buckets order by id`,
    );
    expect(rows.rows).toEqual([
      { id: 'lab', public: true },
      { id: 'lab-drafts', public: false },
      /* The former recipe photograph INTAKE, and private forever. Nothing
         reads it any more — the catalogue carries no photograph — but the
         migration that made it is applied history. See 0002 and the
         assertion below. */
      { id: 'recipe-uploads', public: false },
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
       restricted. The catalogue's photographs are gone altogether now, and
       `recipe_images` is a table nothing reads. */
    const sql = readFileSync(`${CONTENT_ROOT}/0001_content_baseline.sql`, 'utf8');
    expect(sql).not.toMatch(/values \('recipes', 'recipes'/);
  });

  it('keeps the recipe intake bucket private across every migration', () => {
    /* Asserted over the whole root rather than one file, because the way this
       comes back is a later migration flipping the flag or adding a read
       policy — not an edit to the one that created it. A public intake bucket
       IS the 2026-09-11 incident: the recipe grid is still the highest-traffic
       image surface on the site. */
    const all = readdirSync(CONTENT_ROOT)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(`${CONTENT_ROOT}/${f}`, 'utf8'))
      .join('\n');

    expect(all).toMatch(/values \('recipe-uploads', 'recipe-uploads', false\)/);
    expect(all).not.toMatch(/values \('recipe-uploads', 'recipe-uploads', true\)/);
    expect(all).not.toMatch(/bucket_id = 'recipe-uploads'/);
    expect(all).not.toMatch(/update storage\.buckets[\s\S]{0,200}recipe-uploads/);
  });
});

describe('the recipe code-id migration (S5)', () => {
  /* The content project today: SCL- ids, the slugs each recipe was first
     published under, translations and images keyed by id, the withdrawn
     Picture Profiles unpublished beside them, and articles that link recipes
     by id. The migration renames all of it in one transaction. */
  const CODE_IDS = '20261024000000_recipe_code_ids.sql';
  const sql = () => readFileSync(`${CONTENT_ROOT}/${CODE_IDS}`, 'utf8');

  const FORMER_SLUGS = JSON.parse(readFileSync('data/former-slugs.json', 'utf8')) as Record<string, string>;
  const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as (Recipe & {
    legacyId: string | null;
  })[];
  const formerOf = new Map(Object.entries(FORMER_SLUGS).map(([former, current]) => [current, former]));

  /** A withdrawn row: not in the seed, so its slug is not in the map (S4). */
  const WITHDRAWN = { id: 'SCL-PP-003', slug: 'withdrawn-probe', legacyId: 'scl-003' };

  const RELATED_BEFORE = [
    { kind: 'recipe', id: 'SCL-PP-048' },
    { kind: 'product', id: 'ilce-7m4' },
    { kind: 'recipe', id: 'CL-013' },
    { kind: 'knowledge', id: 'scl-pp-048-notes' },
    { kind: 'recipe', id: 'SCL-CL-013' },
  ];
  const RELATED_AFTER = [
    { kind: 'recipe', id: 'PP-048' },
    { kind: 'product', id: 'ilce-7m4' },
    { kind: 'recipe', id: 'CL-013' },
    { kind: 'knowledge', id: 'scl-pp-048-notes' },
    { kind: 'recipe', id: 'CL-013' },
  ];

  async function insertRecipe(db: PGlite, row: Record<string, unknown>) {
    const cols = Object.keys(row);
    await db.query(
      `insert into recipes (${cols.join(', ')}) values (${cols.map((_c, i) => `$${i + 1}`).join(', ')})`,
      Object.values(row),
    );
  }

  /** This root up to, and not including, the migration, holding today's rows. */
  async function contentBefore(): Promise<PGlite> {
    const db = await freshDatabase(CONTENT_ROOT, (f) => f < CODE_IDS);
    for (const r of seed) {
      await insertRecipe(db, { ...toRow(r, r.legacyId), id: `SCL-${r.id}`, slug: formerOf.get(r.slug) });
      await db.query(
        `insert into recipe_translations (recipe_id, locale, description) values ($1, 'en', 'A description.')`,
        [`SCL-${r.id}`],
      );
    }
    await insertRecipe(db, {
      ...toRow(seed[0], WITHDRAWN.legacyId),
      id: WITHDRAWN.id,
      slug: WITHDRAWN.slug,
      published: false,
    });
    await db.exec(`
      insert into recipe_translations (recipe_id, locale, description) values ('${WITHDRAWN.id}', 'vi', 'Mô tả.');
      insert into recipe_images (recipe_id, storage_path, sort) values ('SCL-PP-048', 'SCL-PP-048/1.jpg', 0);
      insert into recipe_images (recipe_id, storage_path, sort) values ('SCL-CL-013', 'SCL-CL-013/1.jpg', 0);
    `);
    await db.query(
      `insert into lab_articles (id, topic, level, archetype, title, meta)
       values ('code-id-probe', 'setup', 'mid', 'recipe', 'Code id probe', $1),
              ('code-id-untouched', 'setup', 'mid', 'explainer', 'Untouched', $2)`,
      [{ related: RELATED_BEFORE, authorName: 'Editor' }, { related: [{ kind: 'product', id: 'ilce-7m4' }] }],
    );
    return db;
  }

  /** Every row the migration may touch, in a stable order, timestamps included. */
  async function rows(db: PGlite) {
    const q = async (text: string) => (await db.query(text)).rows;
    return {
      recipes: await q(`select id, slug, published, updated_at from recipes order by id`),
      translations: await q(`select recipe_id, locale, updated_at from recipe_translations order by recipe_id, locale`),
      images: await q(`select recipe_id, storage_path from recipe_images order by recipe_id`),
      articles: await q(`select id, meta, updated_at from lab_articles order by id`),
    };
  }

  let migrated: PGlite;
  beforeAll(async () => {
    migrated = await contentBefore();
    await migrated.exec(sql());
  }, 60_000);

  it('is the newest content migration, versioned so the control root cannot claim it', () => {
    const version = CODE_IDS.split('_')[0];
    expect(version).toMatch(/^\d{14}$/);
    expect(files(CONTENT_ROOT).at(-1)).toBe(CODE_IDS);
    expect(files(CONTROL_ROOT).map((f) => f.split('_')[0])).not.toContain(version);
  });

  it('renames every id, the withdrawn row included, and translations and images follow', async () => {
    const ids = (await migrated.query<{ id: string }>(`select id from recipes order by id`)).rows.map((r) => r.id);
    expect(ids).toEqual([...seed.map((r) => r.id), 'PP-003'].sort());

    const t = await migrated.query<{ recipe_id: string }>(`select recipe_id from recipe_translations order by recipe_id`);
    expect(t.rows.map((r) => r.recipe_id)).toEqual(ids);

    /* The key follows; the path is a Storage object name, not a reference. */
    const i = await migrated.query(`select recipe_id, storage_path from recipe_images order by recipe_id`);
    expect(i.rows).toEqual([
      { recipe_id: 'CL-013', storage_path: 'SCL-CL-013/1.jpg' },
      { recipe_id: 'PP-048', storage_path: 'SCL-PP-048/1.jpg' },
    ]);
  });

  it('gives every seed recipe its current slug and leaves a withdrawn row its own', async () => {
    const q = await migrated.query<{ id: string; slug: string }>(`select id, slug from recipes`);
    const slugById = new Map(q.rows.map((r) => [r.id, r.slug]));
    for (const r of seed) expect(slugById.get(r.id), r.id).toBe(r.slug);
    expect(slugById.get('PP-003')).toBe(WITHDRAWN.slug);
  });

  it('keeps the child keys cascading on delete, and now on update', async () => {
    const q = await migrated.query<{ def: string }>(
      `select conrelid::regclass::text || ' ' || pg_get_constraintdef(oid) as def from pg_constraint
        where contype = 'f' and confrelid = 'public.recipes'::regclass order by 1`,
    );
    expect(q.rows.map((r) => r.def)).toEqual([
      'recipe_images FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON UPDATE CASCADE ON DELETE CASCADE',
      'recipe_translations FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON UPDATE CASCADE ON DELETE CASCADE',
    ]);
  });

  it('rewrites recipe links in article metadata, and only those', async () => {
    const q = await migrated.query(`select id, meta from lab_articles order by id`);
    expect(q.rows).toEqual([
      { id: 'code-id-probe', meta: { related: RELATED_AFTER, authorName: 'Editor' } },
      { id: 'code-id-untouched', meta: { related: [{ kind: 'product', id: 'ilce-7m4' }] } },
    ]);
  });

  it.each([
    ['an SCL- id', 'SCL-PP-990', 'recipes_id_check'],
    ['an id that is not a code', 'PP-99', 'recipes_id_check'],
    ['an id whose code disagrees with the format', 'CL-990', 'recipes_id_matches_format'],
  ])('refuses %s afterwards', async (_label, id, constraint) => {
    const pp = seed.find((r) => r.format === 'pp')!;
    const row = { ...toRow(pp, null), id, slug: `refuse-probe-${id.toLowerCase()}` };
    await expect(insertRecipe(migrated, row)).rejects.toThrow(constraint);
  });

  it('changes nothing the second time it runs', async () => {
    const db = await contentBefore();
    await db.exec(sql());
    const [onceRows, onceShape] = [await rows(db), await shape(db)];
    await db.exec(sql());
    expect(await rows(db)).toEqual(onceRows);
    expect(await shape(db)).toEqual(onceShape);
  }, 60_000);

  it('leaves the project exactly as it was when it cannot finish', async () => {
    /* A current slug another row already holds stops the file on the unique
       key, after the ids were renamed. The file is one transaction, so
       nothing it did before that point survives. */
    const db = await contentBefore();
    await insertRecipe(db, {
      ...toRow(seed[0], null),
      id: 'SCL-PP-990',
      slug: seed.find((r) => r.id === 'PP-048')!.slug,
      published: false,
    });
    const [beforeRows, beforeShape] = [await rows(db), await shape(db)];
    await expect(db.exec(sql())).rejects.toThrow(/recipes_slug_key/);
    expect(await rows(db)).toEqual(beforeRows);
    expect(await shape(db)).toEqual(beforeShape);
  }, 60_000);

  it('brings the live lineage to exactly the shape this root builds', async () => {
    /* The live project came from the control root and the reconcile gave it
       this root's shape. This file must keep the two the same: the keys it
       replaces are found by what they reference, whatever either lineage
       named them. */
    const lineage = await liveLineage();
    for (const file of files(CONTENT_ROOT).filter((f) => f >= '20261006000000')) {
      await lineage.exec(readFileSync(`${CONTENT_ROOT}/${file}`, 'utf8'));
    }
    expect(await shape(lineage)).toEqual(await shape(await freshDatabase(CONTENT_ROOT)));
  }, 60_000);

  it('refuses the control plane before changing anything', async () => {
    const text = sql();
    const firstChange = text.search(/^\s*(create|revoke|grant|insert|comment|alter|drop|update)\b/m);
    expect(text.indexOf('control-plane tables')).toBeGreaterThan(-1);
    expect(text.indexOf('control-plane tables')).toBeLessThan(firstChange);

    const before = await shape(control);
    await expect(control.exec(text)).rejects.toThrow(/control-plane tables/);
    expect(await shape(control)).toEqual(before);
  });
});

describe('the slug lists in both migrations', () => {
  /* The content file and control 0020 rename slugs from the same list, written
     into each as SQL. A re-emit that changes a slug changes
     `data/former-slugs.json`, and this fails until both files follow, so the
     two planes can never be migrated to different spellings. */
  const FORMER_SLUGS = JSON.parse(readFileSync('data/former-slugs.json', 'utf8')) as Record<string, string>;

  function pairs(path: string): [string, string][] {
    const text = readFileSync(path, 'utf8');
    const begin = text.indexOf('-- former-slugs:begin');
    const end = text.indexOf('-- former-slugs:end');
    expect(begin, `${path}: begin marker`).toBeGreaterThan(-1);
    expect(end, `${path}: end marker`).toBeGreaterThan(begin);
    const lines = text
      .slice(text.indexOf('\n', begin) + 1, end)
      .split('\n')
      .filter((l) => l.trim());
    const found = lines.map((l) => /^\s*\('([a-z0-9-]+)',\s*'([a-z0-9-]+)'\),?\s*$/.exec(l));
    expect(found.every(Boolean), `${path}: every line is one pair`).toBe(true);
    return found.map((m) => [m![1], m![2]]);
  }

  it.each([`${CONTENT_ROOT}/20261024000000_recipe_code_ids.sql`, `${CONTROL_ROOT}/0020_recipe_slugs_to_codes.sql`])(
    '%s renames exactly data/former-slugs.json',
    (path) => {
      expect(pairs(path)).toEqual(Object.entries(FORMER_SLUGS));
    },
  );
});
