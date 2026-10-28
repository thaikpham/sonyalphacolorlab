import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { recipeIdKey } from './recipe-id';
import { toRow } from './row';
import { slugAliases } from './slug-aliases';
import { SLUG_MOVES } from './slug-moves';
import { PHOTO_COLUMNS, PROPOSAL_COLUMNS } from '../community/columns';
import type { Recipe } from '../camera/schema';

/**
 * Executes the real migrations against an in-process Postgres and loads the full
 * migrated dataset. Catches what a regex test cannot: invalid SQL, constraints
 * that reject legitimate rows, and constraints that fail to reject bad ones.
 *
 * Reads the whole directory rather than naming one file. It used to run only
 * 0001, so 0002-0004 were never executed anywhere — and 0004 turned out never to
 * have been applied to Supabase either, which left comments, proposals and heart
 * voting silently falling back to per-process memory in production. A migration
 * nothing runs is a migration nobody notices is missing.
 *
 * This directory is the **control** root now. `supabase/content/migrations` is
 * the second root and is exercised by `migration-roots.test.ts`, which is also
 * where the boundary between the two is asserted — that the content project
 * never grows an `admin_emails`, and that the control project keeps a schema
 * capable of receiving a rollback. This file stays what it always was: proof
 * that the history the old project has already applied still applies from zero.
 */

const MIGRATIONS = readdirSync('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort();
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
  // Supabase ships these roles; a bare Postgres does not. The migrations grant
  // to them by name, so without this the column-level privileges — the thing
  // actually keeping commenter emails off the public API — would go untested.
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
  `);
  /* The default ACL above is Supabase's too: every table created in `public`
     starts with ALL granted to anon and authenticated. Without it a table that
     no migration revokes looks private here and is readable in production —
     which is how `community_photos.submitted_by` passed every check in this
     file while serving proposal authors' addresses to the anon key.

     Same reasoning one level up: Supabase ships a `storage` schema, and a bare
     Postgres does not. 0013 creates the `lab` bucket and the policy that makes
     article photography publicly readable, so without these two stubs that
     migration would abort and every later one with it — the whole file would
     go red on a table nothing in it tests. Only the columns the migrations
     name are stubbed; this is a stand-in for the SQL to run against, not a
     model of Supabase Storage. */
  await db.exec(`
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
  for (const file of MIGRATIONS) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
}, 60_000);

describe('migrations', () => {
  it('runs every migration in the directory', () => {
    // Guards the reason this file missed 0004: a new .sql that no test executes.
    expect(MIGRATIONS).toContain('0001_init.sql');
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(4);
  });

  it('applies cleanly', async () => {
    const t = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' order by table_name`,
    );
    // Every table the app reads must exist once the migrations have run. If the
    // deployed database disagrees with this list, the feature using it is dead.
    expect(t.rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        'recipe_comments',
        'recipe_images',
        'recipe_proposals',
        'recipe_translations',
        'recipes',
      ]),
    );
  });

  it('keeps the content tables the rollback window depends on', async () => {
    /* `recipes`, `sony_cameras` and `lab_articles` are no longer written here
       once the split is live — but they are not dropped either. They are the
       rollback copy, read-only, for at least fourteen days. Cleanup is a
       separate approved change and deliberately not part of the cutover; the
       cheapest possible mistake at that point would be a migration that tidies
       them away while they are still the only recoverable copy. */
    const t = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' order by table_name`,
    );
    expect(t.rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(['recipes', 'sony_cameras', 'lab_articles', 'lab_assets']),
    );
  });

  it('denies the anon role the commenter email column', async () => {
    /* The check that matters. The anon key is public — it is in the browser
       bundle — so this privilege, not the API code, is what stops
       `/rest/v1/recipe_comments?select=author_email` from dumping every
       address. Asserted against real Postgres because a policy cannot express
       it and reading the SQL cannot prove it. */
    const readable = await db.query<{ column_name: string }>(
      `select column_name from information_schema.column_privileges
        where grantee = 'anon' and table_name = 'recipe_comments'
          and privilege_type = 'SELECT'`,
    );
    const cols = readable.rows.map((r) => r.column_name);
    expect(cols).toContain('content');
    expect(cols).not.toContain('author_email');
  });

  it.each(['anon', 'authenticated'])(
    '%s cannot read who submitted a community photo',
    async (role) => {
      /* `submitted_by` once held a proposal author's Google address, and 0002
         granted nothing narrower than the Supabase default — so
         `?select=submitted_by` on the anon key returned it. Asserted by running
         the query as the role, not by reading the catalog, so a table-level
         grant cannot hide behind a column list that looks right. */
      await db.exec(`set role ${role}`);
      try {
        await expect(db.query('select submitted_by from community_photos')).rejects.toThrow(
          /permission denied/,
        );
      } finally {
        await db.exec('reset role');
      }
    },
  );

  it('still serves the public gallery read to anon', async () => {
    /* The exact shape `GET /api/community-photos` sends: three columns out,
       filtered on the slug, newest first. Narrowing the grant must not take the
       gallery down with it. */
    await db.query(
      `insert into community_photos (recipe_slug, image_url, author_name, submitted_by)
       values ('grant-probe', 'https://cdn.example.com/a.jpg', 'Reader', '203.0.113.7')`,
    );
    await db.exec('set role anon');
    try {
      const q = await db.query<{ image_url: string; author_name: string }>(
        `select image_url, author_name, author_social from community_photos
          where recipe_slug = $1 order by created_at desc limit 40`,
        ['grant-probe'],
      );
      expect(q.rows).toEqual([
        { image_url: 'https://cdn.example.com/a.jpg', author_name: 'Reader', author_social: null },
      ]);
    } finally {
      await db.exec('reset role');
    }
  });

  it.each(['anon', 'authenticated'])('never serves %s a photo a moderator has hidden', async (role) => {
    /* `/admin/colorlab` hides a photo by setting `approved = false` on the
       service role. The public GET adds no filter of its own — it cannot:
       0019 grants anon no `approved` column, so naming it there would be
       "permission denied" for every gallery. 0002's policy is the filter, and
       this is its proof, in the exact shape the route sends. */
    await db.query(
      `insert into community_photos (recipe_slug, image_url, author_name, approved)
       values ('hidden-probe', 'https://cdn.example.com/shown.jpg', 'Reader', true),
              ('hidden-probe', 'https://cdn.example.com/hidden.jpg', 'Reader', false)
       on conflict do nothing`,
    );
    await db.exec(`set role ${role}`);
    try {
      const q = await db.query<{ image_url: string }>(
        `select ${PHOTO_COLUMNS} from community_photos
          where recipe_slug = $1 order by created_at desc limit 40`,
        ['hidden-probe'],
      );
      expect(q.rows.map((r) => r.image_url)).toEqual(['https://cdn.example.com/shown.jpg']);
      await expect(db.query('select approved from community_photos')).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });

  it('keeps a proposal sample photo, https only, readable by anon', async () => {
    const readable = await db.query<{ column_name: string }>(
      `select column_name from information_schema.column_privileges
        where grantee = 'anon' and table_name = 'recipe_proposals'
          and privilege_type = 'SELECT'`,
    );
    const cols = readable.rows.map((r) => r.column_name);
    expect(cols).toContain('sample_image_url');
    expect(cols).not.toContain('author_email');

    const proposal = (sample: string | null) =>
      db.query(
        `insert into recipe_proposals
           (recipe_slug, title, author_name, author_email, settings, white_balance, sample_image_url)
         values ('grant-probe', 't', 'Reader', 'reader@example.com', '{}', '{}', $1)`,
        [sample],
      );
    await expect(proposal('https://cdn.example.com/s.jpg')).resolves.toBeDefined();
    await expect(proposal('http://cdn.example.com/s.jpg')).rejects.toThrow(
      /recipe_proposals_sample_image_url_check/,
    );
    await expect(proposal(`https://${'a'.repeat(2048)}`)).rejects.toThrow(
      /recipe_proposals_sample_image_url_check/,
    );
  });

  it.each(['anon', 'authenticated'])('%s can read every column the proposals route selects', async (role) => {
    /* `PROPOSAL_COLUMNS` names sample_image_url, which only 0019 adds. A column
       the grant does not cover is "permission denied" for the whole query, so
       every GET /api/proposals would answer 503. This pins the dependency; it
       cannot pin the order — 0019 must be applied before the route ships. */
    const columns = PROPOSAL_COLUMNS;
    expect(columns).toContain('sample_image_url');
    await db.exec(`set role ${role}`);
    try {
      await expect(db.query(`select ${columns} from recipe_proposals limit 0`)).resolves.toBeDefined();
    } finally {
      await db.exec('reset role');
    }
  });

  /* An operator adding an editor copies 0009's `insert (email, note)`. With a
     default of 'super' that row could edit everything — the least-privileged
     path granting the most privilege. With no default it is refused. */
  it('refuses an admin row that does not state its role', async () => {
    await expect(
      db.query(`insert into admin_emails (email, note) values ('role-probe@example.com', 'DI')`),
    ).rejects.toThrow(/null value in column "role"/);
    await expect(
      db.query(`insert into admin_emails (email, role) values ('role-probe@example.com', 'di')`),
    ).resolves.toBeDefined();
  });

  /* requireAdmin matches the lowercased address from the JWT. A mixed-case row
     never matches: that administrator is refused on every request, with no
     error anywhere. */
  it('refuses an admin address that is not lowercase', async () => {
    await expect(
      db.query(`insert into admin_emails (email, role) values ('Mixed@Example.com', 'di')`),
    ).rejects.toThrow(/admin_emails_email_lowercase/);
  });

  it('denies the anon role the votes table entirely', async () => {
    const readable = await db.query<{ column_name: string }>(
      `select column_name from information_schema.column_privileges
        where grantee = 'anon' and table_name = 'proposal_votes'
          and privilege_type = 'SELECT'`,
    );
    expect(readable.rows).toHaveLength(0);
  });

  it("moves community rows to their recipe's current slug, and only once", async () => {
    /* 0020 already ran in beforeAll, on empty tables. Rows written under the
       former spellings, as production holds them, are moved by running it
       again here, which is also the proof that a second run is harmless. */
    const file = MIGRATIONS.find((f) => f.startsWith('0020_'));
    expect(file).toBe('0020_recipe_slugs_to_codes.sql');
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
    /* 0020's own list, frozen with it: `data/former-slugs.json` maps to the
       code slugs since 2026-10-28. */
    const FORMER = SLUG_MOVES[0].moves;
    const [former, current] = ['hue-silk', FORMER['hue-silk']];
    const [otherFormer, otherCurrent] = ['sh-sony-asia', FORMER['sh-sony-asia']];
    expect([current, otherCurrent]).toEqual(['pp-048-soft-clean-portrait', 'cl-013-airy-warm-pastel']);

    await db.query(
      `insert into recipe_comments (recipe_slug, author_name, author_email, content)
       values ($1, 'Reader', 'reader@example.com', 'Before'),
              ($2, 'Reader', 'reader@example.com', 'Other'),
              ('slug-probe-unmapped', 'Reader', 'reader@example.com', 'Unmapped')`,
      [former, otherFormer],
    );
    const proposal = await db.query<{ id: string }>(
      `insert into recipe_proposals (recipe_slug, title, author_name, author_email, settings, white_balance)
       values ($1, 'slug-probe', 'Reader', 'reader@example.com', '{}', '{}') returning id`,
      [former],
    );
    await db.query(`insert into proposal_votes (proposal_id, user_email) values ($1, 'voter@example.com')`, [
      proposal.rows[0].id,
    ]);
    /* A photo sent between the two migrations is already under the new slug.
       Where its URL matches one under the former slug, the unique key keeps
       the older row where it is, and `slugAliases()` still reads it there.
       The gallery reads both spellings, so where an editor hid either of the
       pair, both end hidden: a visible twin would show the hidden photo. */
    await db.query(
      `insert into community_photos (recipe_slug, image_url, author_name, approved)
       values ($1, 'https://cdn.example.com/slug-moved.jpg', 'Reader', true),
              ($1, 'https://cdn.example.com/slug-hidden.jpg', 'Reader', false),
              ($1, 'https://cdn.example.com/slug-both.jpg', 'Reader', true),
              ($2, 'https://cdn.example.com/slug-both.jpg', 'Reader', true),
              ($1, 'https://cdn.example.com/slug-hid-former.jpg', 'Reader', false),
              ($2, 'https://cdn.example.com/slug-hid-former.jpg', 'Reader', true),
              ($1, 'https://cdn.example.com/slug-hid-current.jpg', 'Reader', true),
              ($2, 'https://cdn.example.com/slug-hid-current.jpg', 'Reader', false)`,
      [former, current],
    );

    const state = async () => ({
      comments: (
        await db.query(
          `select recipe_slug, content from recipe_comments
            where content in ('Before', 'Other', 'Unmapped') order by content`,
        )
      ).rows,
      proposals: (await db.query(`select id, recipe_slug from recipe_proposals where title = 'slug-probe'`)).rows,
      votes: (await db.query(`select proposal_id from proposal_votes where user_email = 'voter@example.com'`)).rows,
      photos: (
        await db.query(
          `select recipe_slug, image_url, approved from community_photos
            where recipe_slug in ($1, $2) order by image_url, recipe_slug`,
          [former, current],
        )
      ).rows,
    });

    await db.exec(sql);
    const once = await state();
    expect(once.comments).toEqual([
      { recipe_slug: current, content: 'Before' },
      { recipe_slug: otherCurrent, content: 'Other' },
      { recipe_slug: 'slug-probe-unmapped', content: 'Unmapped' },
    ]);
    expect(once.proposals).toEqual([{ id: proposal.rows[0].id, recipe_slug: current }]);
    expect(once.votes).toEqual([{ proposal_id: proposal.rows[0].id }]);
    expect(once.photos).toEqual([
      { recipe_slug: former, image_url: 'https://cdn.example.com/slug-both.jpg', approved: true },
      { recipe_slug: current, image_url: 'https://cdn.example.com/slug-both.jpg', approved: true },
      { recipe_slug: former, image_url: 'https://cdn.example.com/slug-hid-current.jpg', approved: false },
      { recipe_slug: current, image_url: 'https://cdn.example.com/slug-hid-current.jpg', approved: false },
      { recipe_slug: former, image_url: 'https://cdn.example.com/slug-hid-former.jpg', approved: false },
      { recipe_slug: current, image_url: 'https://cdn.example.com/slug-hid-former.jpg', approved: false },
      { recipe_slug: current, image_url: 'https://cdn.example.com/slug-hidden.jpg', approved: false },
      { recipe_slug: current, image_url: 'https://cdn.example.com/slug-moved.jpg', approved: true },
    ]);

    await db.exec(sql);
    expect(await state()).toEqual(once);
  });

  it('moves community rows from both earlier spellings to the code slug, and only once', async () => {
    /* 0021 already ran in beforeAll, on empty tables; running it again here
       on rows production may hold is the proof, and so is a third run. The
       rows sit under the first slug (written while the content plane still
       held it, or a photo 0020 left behind) and under the 2026-10-24 one. */
    const file = MIGRATIONS.find((f) => f.startsWith('0021_'));
    expect(file).toBe('0021_recipe_slugs_to_code_only.sql');
    expect(MIGRATIONS.at(-1)).toBe(file);
    const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
    const [OCT24, OCT28] = SLUG_MOVES;
    const first = 'clear-day';
    const middle = OCT24.moves[first];
    const code = OCT28.moves[middle];
    expect([middle, code]).toEqual(['pp-049-clean-natural-daylight', 'pp-049']);
    const otherMiddle = OCT24.moves['sh-puy'];
    const otherCode = OCT28.moves[otherMiddle];
    expect(otherCode).toBe('cl-015');

    await db.query(
      `insert into recipe_comments (recipe_slug, author_name, author_email, content)
       values ($1, 'Reader', 'reader@example.com', 'code-probe-first'),
              ($2, 'Reader', 'reader@example.com', 'code-probe-middle'),
              ($3, 'Reader', 'reader@example.com', 'code-probe-code'),
              ($4, 'Reader', 'reader@example.com', 'code-probe-other'),
              ('slug-probe-unmapped', 'Reader', 'reader@example.com', 'code-probe-unmapped')`,
      [first, middle, code, otherMiddle],
    );
    const proposals = await db.query<{ id: string }>(
      `insert into recipe_proposals (recipe_slug, title, author_name, author_email, settings, white_balance)
       values ($1, 'code-probe', 'Reader', 'reader@example.com', '{}', '{}'),
              ($2, 'code-probe', 'Reader', 'reader@example.com', '{}', '{}') returning id`,
      [first, middle],
    );
    await db.query(`insert into proposal_votes (proposal_id, user_email) values ($1, 'code-voter@example.com')`, [
      proposals.rows[0].id,
    ]);

    /* One URL per case, under the spellings named; `h` marks a hidden row. */
    const url = (name: string) => `https://cdn.example.com/code-${name}.jpg`;
    const photos: [string, string, boolean][] = [
      [first, url('first-only'), true],
      [middle, url('middle-only'), true],
      [first, url('first-hidden'), false],
      /* The two earlier spellings: the newer moves, the older stays. */
      [first, url('first-and-middle'), true],
      [middle, url('first-and-middle'), true],
      /* Already under the code slug: neither earlier row moves. */
      [middle, url('middle-and-code'), true],
      [code, url('middle-and-code'), true],
      [first, url('all-three'), true],
      [middle, url('all-three'), true],
      [code, url('all-three'), true],
      /* A hidden row anywhere in a set hides the whole set. */
      [first, url('hid-first'), false],
      [middle, url('hid-first'), true],
      [middle, url('hid-middle'), false],
      [code, url('hid-middle'), true],
      [first, url('hid-code'), true],
      [code, url('hid-code'), false],
      [first, url('hid-first-of-three'), false],
      [middle, url('hid-first-of-three'), true],
      [code, url('hid-first-of-three'), true],
      /* Another recipe's spelling with the same URL is not a twin. */
      [otherMiddle, url('hid-middle'), true],
    ];
    for (const [slug, image, approved] of photos) {
      await db.query(
        `insert into community_photos (recipe_slug, image_url, author_name, approved) values ($1, $2, 'Reader', $3)`,
        [slug, image, approved],
      );
    }

    const state = async () => ({
      comments: (
        await db.query(
          `select recipe_slug, content from recipe_comments where content like 'code-probe-%' order by content`,
        )
      ).rows,
      proposals: (
        await db.query(`select id, recipe_slug from recipe_proposals where title = 'code-probe' order by id`)
      ).rows,
      votes: (await db.query(`select proposal_id from proposal_votes where user_email = 'code-voter@example.com'`))
        .rows,
      photos: (
        await db.query<{ recipe_slug: string; image_url: string; approved: boolean }>(
          `select recipe_slug, image_url, approved from community_photos
            where image_url like 'https://cdn.example.com/code-%' order by image_url, recipe_slug`,
        )
      ).rows,
    });

    await db.exec(sql);
    const once = await state();
    expect(once.comments).toEqual([
      { recipe_slug: code, content: 'code-probe-code' },
      { recipe_slug: code, content: 'code-probe-first' },
      { recipe_slug: code, content: 'code-probe-middle' },
      { recipe_slug: otherCode, content: 'code-probe-other' },
      { recipe_slug: 'slug-probe-unmapped', content: 'code-probe-unmapped' },
    ]);
    expect((once.proposals as { recipe_slug: string }[]).map((p) => p.recipe_slug)).toEqual([code, code]);
    expect(once.votes).toEqual([{ proposal_id: proposals.rows[0].id }]);

    /* Sorted here, by code unit, so the expectation does not lean on the
       database's collation. */
    const by = (name: string) =>
      once.photos
        .filter((p) => p.image_url === url(name))
        .map((p) => [p.recipe_slug, p.approved] as const)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    expect(by('first-only')).toEqual([[code, true]]);
    expect(by('middle-only')).toEqual([[code, true]]);
    expect(by('first-hidden')).toEqual([[code, false]]);
    expect(by('first-and-middle')).toEqual([
      [first, true],
      [code, true],
    ]);
    expect(by('middle-and-code')).toEqual([
      [code, true],
      [middle, true],
    ]);
    expect(by('all-three')).toEqual([
      [first, true],
      [code, true],
      [middle, true],
    ]);
    expect(by('hid-first')).toEqual([
      [first, false],
      [code, false],
    ]);
    /* The other recipe's row keeps its URL visible and moves to its own code. */
    expect(by('hid-middle')).toEqual([
      [otherCode, true],
      [code, false],
      [middle, false],
    ]);
    expect(by('hid-code')).toEqual([
      [first, false],
      [code, false],
    ]);
    expect(by('hid-first-of-three')).toEqual([
      [first, false],
      [code, false],
      [middle, false],
    ]);
    /* Whatever stayed behind is under a spelling `slugAliases` still reads. */
    for (const p of once.photos) {
      if (p.recipe_slug === otherCode) continue;
      expect(slugAliases(code), p.image_url).toContain(p.recipe_slug);
    }

    await db.exec(sql);
    expect(await state()).toEqual(once);
  });

  it('accepts every seeded recipe, in both formats', async () => {
    /* In the id shape this root stores. Its `recipes` table is applied
       history and keeps the `SCL-` CHECK it was created with; the seed's code
       shape (`PP-001`) is what the content root stores, and
       `migration-roots.test.ts` loads it there. */
    for (const r of seed) await insert({ ...toRow(r, r.legacyId), id: `SCL-${recipeIdKey(r.id)}` });
    const c = await db.query<{ n: number }>('select count(*)::int as n from recipes');
    // Derived, not hardcoded — the catalogue grows, and a stale literal here
    // fails for the wrong reason and teaches nothing.
    expect(c.rows[0].n).toBe(seed.length);

    // Both libraries must survive the real CHECK constraints, not just the
    // Picture Profile one the schema was originally written around.
    const byFormat = await db.query<{ format: string; n: number }>(
      'select format::text as format, count(*)::int as n from recipes group by format order by format',
    );
    expect(byFormat.rows.map((r) => r.format)).toEqual(['cl', 'pp']);
    for (const row of byFormat.rows) expect(row.n).toBeGreaterThan(0);
  });

  it('stores a light-source preset with a null kelvin and a null auto', async () => {
    const q = await db.query<{ wb_preset: string; wb_kelvin: number | null; wb_auto: string | null }>(
      `select wb_preset, wb_kelvin, wb_auto from recipes where wb_mode = 'preset' limit 1`,
    );
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0].wb_preset).toBeTruthy();
    expect(q.rows[0].wb_kelvin).toBeNull();
    expect(q.rows[0].wb_auto).toBeNull();
  });

  it('rejects a preset row that also carries a kelvin', async () => {
    // The three-way consistency constraint from 0006. Without it a row could
    // claim both a named light source and a colour temperature.
    await expect(
      insert({
        id: 'SCL-CL-999',
        slug: 'wb-mode-conflict',
        name: 'conflict',
        format: 'cl',
        wb_mode: 'preset',
        wb_preset: 'Cloudy',
        wb_kelvin: 5600,
        look: 'ST',
        settings: JSON.stringify({ look: 'ST' }),
      }),
    ).rejects.toThrow(/recipes_wb_mode_consistent/);
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
    /* Filmic FJ C200: AWB with a B1 / G0.5 shift and no Kelvin. (It was
       scl-030, withdrawn on 2026-10-23.) */
    const q = await db.query<{ wb_auto: string; wb_kelvin: number | null }>(
      `select wb_auto, wb_kelvin from recipes where legacy_id = 'scl-044'`,
    );
    expect(q.rows[0]).toEqual({ wb_auto: 'AWB', wb_kelvin: null });
  });

  // Each of these must be rejected by the database itself, not just by Zod.
  // The expected constraint name is asserted so a case cannot pass for the
  // wrong reason (e.g. tripping a unique index instead of the check it targets).
  const base = () => ({ ...toRow(seed[0], null), id: `SCL-${recipeIdKey(seed[0].id)}`, legacy_id: null });

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
    /* Its own parent row, and the check named: a bare `toThrow()` also passed
       on the foreign key, or on `(recipe_id, sort)` if an earlier case held 0. */
    await insert({ ...base(), id: 'SCL-PP-950', slug: 'image-check-probe' });
    await expect(
      db.query(
        `insert into recipe_images (recipe_id, storage_path)
         values ('SCL-PP-950', 'https://lh3.googleusercontent.com/pw/abc')`,
      ),
    ).rejects.toThrow(/recipe_images_storage_path_check/);
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
