import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CREATIVE_LOOK_CODES,
  RECIPE_FORMATS,
  WB_AUTO_MODES,
  WB_AXIS_AB,
  WB_AXIS_GM,
  WB_KELVIN,
  WB_PRESETS,
  WB_SHIFT_AXIS,
} from './constants';
import { RECIPE_ID_RE } from './schema';

/**
 * The SQL restates a handful of bounds that also live in constants.ts. These
 * assertions fail if the two drift apart — the SQL is defence in depth, and
 * defence that disagrees with the app is worse than none.
 *
 * Read from the database each root BUILDS, not from the text of one file. This
 * used to regex `0001_init.sql`, `0005` and `0006` of the control root, which
 * had two faults. It never looked at the content root, which is where recipes
 * are actually written and which restates every one of these independently;
 * and it could only go green again after a range change by editing applied
 * history. Executed, a later migration that alters an enum or a CHECK is what
 * gets compared, in whichever root it lands.
 *
 * The stub is the minimum the roots need to run — the two Supabase roles they
 * grant to and the `storage` tables they insert buckets into. The full stub,
 * with Supabase's default ACL, lives in `migration-roots.test.ts`, which is
 * about privileges; this file is only about values.
 */

const CONTROL_ROOT = 'supabase/migrations';
const CONTENT_ROOT = 'supabase/content/migrations';
const ROOTS = [CONTROL_ROOT, CONTENT_ROOT] as const;

/** The id shape each root's `recipes` CHECK must store; see the last case. */
const ID_CHECK: Record<(typeof ROOTS)[number], RegExp> = {
  [CONTENT_ROOT]: RECIPE_ID_RE,
  [CONTROL_ROOT]: /^SCL-(PP|CL)-\d{3}$/,
};

async function build(root: string): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
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

describe.each(ROOTS)('SQL / constants drift in %s', (root) => {
  let db: PGlite;
  beforeAll(async () => {
    db = await build(root);
  }, 60_000);

  async function enumLabels(name: string): Promise<string[]> {
    const { rows } = await db.query<{ label: string }>(
      `select e.enumlabel as label from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = $1 order by e.enumsortorder`,
      [name],
    );
    return rows.map((r) => r.label);
  }

  /** `pg_get_constraintdef` of one CHECK on `recipes`, as Postgres normalised it. */
  async function check(name: string): Promise<string> {
    const { rows } = await db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
        where conrelid = 'public.recipes'::regclass and contype = 'c' and conname = $1`,
      [name],
    );
    expect(rows, `check ${name} not found`).toHaveLength(1);
    return rows[0].def;
  }

  /** The literals of an `= ANY (ARRAY['a'::text, …])` check, in order. */
  const listed = (def: string) => [...def.matchAll(/'((?:[^']|'')*)'::(?:text|bpchar)/g)].map((m) => m[1]);

  /** The two bounds of a `(x >= lo) AND (x <= hi)` check. */
  const between = (def: string) => {
    const m = />= \(?(\d+(?:\.\d+)?)\)?(?:::numeric)?\) AND \(\w+ <= \(?(\d+(?:\.\d+)?)\)?/.exec(def);
    expect(m, def).not.toBeNull();
    return [Number(m![1]), Number(m![2])];
  };

  it('recipe_format enum matches RECIPE_FORMATS', async () => {
    expect(await enumLabels('recipe_format')).toEqual([...RECIPE_FORMATS]);
  });

  it('creative_look enum matches CREATIVE_LOOK_CODES', async () => {
    expect(await enumLabels('creative_look')).toEqual([...CREATIVE_LOOK_CODES]);
  });

  it('wb_mode enum covers exactly the modes the schema can produce', async () => {
    /* Miss one and rows the app considers valid are rejected at insert time. */
    expect((await enumLabels('wb_mode')).sort()).toEqual(['auto', 'kelvin', 'preset']);
  });

  it('wb_auto check matches WB_AUTO_MODES', async () => {
    expect(listed(await check('recipes_wb_auto_check'))).toEqual([...WB_AUTO_MODES]);
  });

  it('wb_preset check matches WB_PRESETS', async () => {
    expect(listed(await check('recipes_wb_preset_check'))).toEqual([...WB_PRESETS]);
  });

  it('wb_kelvin bounds match WB_KELVIN', async () => {
    expect(between(await check('recipes_wb_kelvin_check'))).toEqual([WB_KELVIN.min, WB_KELVIN.max]);
  });

  it.each([
    ['ab', WB_AXIS_AB],
    ['gm', WB_AXIS_GM],
  ] as const)('the %s shift matches WB_SHIFT_AXIS and its axis letters', async (axis, letters) => {
    expect(between(await check(`recipes_wb_shift_${axis}_amount_check`))).toEqual([
      WB_SHIFT_AXIS.min,
      WB_SHIFT_AXIS.max,
    ]);
    /* The SQL multiplies by 1/step to test grid alignment. */
    const step = /\* \((\d+)\)::numeric\) = floor/.exec(await check(`recipes_wb_shift_${axis}_step`));
    expect(Number(step?.[1])).toBe(1 / WB_SHIFT_AXIS.step);
    expect(listed(await check(`recipes_wb_shift_${axis}_axis_check`))).toEqual([...letters]);
  });

  it('id check stores the shape its root is meant to store', async () => {
    /* Per root. The content root is where recipes are written, so its latest
       CHECK is the app's id pattern. The control root's `recipes` is applied
       history — the rollback copy, created with the SCL- CHECK in 0001 — and
       rewriting an applied migration is the one thing a history exists to
       prevent, so it keeps that shape and is pinned to it here. */
    const pattern = /'([^']*)'/.exec(await check('recipes_id_check'))?.[1];
    expect(pattern).toBe(ID_CHECK[root].source.replace('\\d', '[0-9]'));
  });

  it('id format check uses the same prefix as the id check', async () => {
    const def = await check('recipes_id_matches_format');
    expect(def).toContain('upper((format)::text)');
    expect(def.includes("'SCL-'")).toBe(root === CONTROL_ROOT);
  });
});
