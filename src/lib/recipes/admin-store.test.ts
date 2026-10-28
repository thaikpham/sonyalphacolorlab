import { describe, expect, it, vi } from 'vitest';
import {
  computedRecipeName,
  getRecipeRecord,
  insertRecipeRecord,
  listRecipeRows,
  nextIdAmong,
  normaliseRecipe,
  slugifyRecipe,
  unpublishRecipe,
  updateRecipeRecord,
} from './admin-store';
import recipesSeed from '../../../data/recipes.seed.json';
import { recipeSchema, type Recipe } from '../camera/schema';
import { comboOf, optionsOf, parseRecipeName, readName, readsAlike } from './names';
import { RETIRED_RECIPE_IDS } from './retired';

/**
 * The pure halves of the recipe admin store.
 *
 * `nextRecipeId` and the three writes all reach a backend,
 * so they are covered by the route tests and by the boundary tests that assert
 * where they may be called from. What is tested here is what has no backend:
 * the slug rule and the validation seam, both of which decide what a URL and a
 * column will contain and neither of which the database can check.
 *
 * Plus the one read whose failure mode decides a status code.
 */

const answer = {
  result: { data: null, error: null } as {
    data: unknown;
    error: { message: string; status?: number } | null;
  },
  /** What an insert answers. */
  insert: { error: null } as { error: { message: string; code?: string } | null },
};

/** What the writes asked for, as PostgREST would receive it. */
const log = {
  update: null as Record<string, unknown> | null,
  filters: [] as string[],
  reads: 0,
  /** What an update `.select()` answers: the rows it matched. */
  written: [] as Record<string, unknown>[],
};

vi.mock('@/lib/supabase/server', () => {
  const builder = {
    select: () => builder,
    update: (payload: Record<string, unknown>) => {
      log.update = payload;
      return builder;
    },
    eq: (column: string, value: unknown) => {
      log.filters.push(`${column}=${String(value)}`);
      return builder;
    },
    order: () => builder,
    insert: async () => answer.insert,
    maybeSingle: async () => {
      log.reads += 1;
      return answer.result;
    },
    then: (resolve: (v: unknown) => void) => resolve({ data: log.written, error: null }),
  };
  return {
    contentAdmin: () => ({ from: () => builder }),
    hasContentConfig: () => true,
    hasControlConfig: () => true,
  };
});

describe('slugifyRecipe', () => {
  it('folds Vietnamese diacritics rather than dropping the words', () => {
    /* A name is Vietnamese often enough that stripping non-ASCII would leave
       "công thức mùa hè" as "c-th-c-m-a-h" — a URL that says nothing. */
    expect(slugifyRecipe('Công Thức Mùa Hè')).toBe('cong-thuc-mua-he');
    expect(slugifyRecipe('Đường Phố Sài Gòn')).toBe('duong-pho-sai-gon');
  });

  it('produces the kebab-case the table and the schema both demand', () => {
    const re = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const name of ['Mojave Sun', '  Golden   Hour  ', 'FX3 — Night / Neon', '35mm f/1.4']) {
      const slug = slugifyRecipe(name);
      expect(slug, name).toMatch(re);
    }
  });

  it('never ends on a separator, even when truncation lands on one', () => {
    /* The 80-character cap can cut mid-word and leave a trailing hyphen, which
       the kebab-case CHECK constraint refuses. */
    const slug = slugifyRecipe(`${'a'.repeat(79)} bbbb`);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('returns empty for a name with nothing usable in it, so the caller falls back', () => {
    expect(slugifyRecipe('———')).toBe('');
    expect(slugifyRecipe('   ')).toBe('');
  });
});

describe('normaliseRecipe', () => {
  const seed = recipesSeed as unknown as Record<string, unknown>[];
  const pp = seed.find((r) => r.format === 'pp')!;
  const cl = seed.find((r) => r.format === 'cl')!;

  it('accepts a body that is already a valid recipe', () => {
    const out = normaliseRecipe(pp.id as string, pp);
    expect(out.ok).toBe(true);
  });

  it('takes the id from the caller, never from the body', () => {
    /* The route derives the id — from `nextRecipeId` on create, from the URL
       on update. A body that names a different one must not win, or an editor
       could overwrite any recipe by editing a field in their own browser. */
    const out = normaliseRecipe('SCL-PP-777', { ...pp, id: 'SCL-PP-001' });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.recipe.id).toBe('SCL-PP-777');
  });

  it('refuses an id whose segment disagrees with the format', () => {
    const out = normaliseRecipe('SCL-CL-001', pp);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.join(' ')).toMatch(/id/);
  });

  it('refuses a value outside the camera range and says which field', () => {
    const body = { ...pp, settings: { ...(pp.settings as object), blackLevel: 999 } };
    const out = normaliseRecipe(pp.id as string, body);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.join(' ')).toMatch(/blackLevel/);
  });

  it('refuses a white-balance shift off the 0.25 grid', () => {
    const body = {
      ...pp,
      whiteBalance: { mode: 'kelvin', kelvin: 7000, shift: { ab: { axis: 'B', amount: 3.1 } } },
    };
    const out = normaliseRecipe(pp.id as string, body);
    expect(out.ok).toBe(false);
  });

  it('refuses saturation on a monochrome Creative Look', () => {
    /* The camera greys the control out for BW/SE, so a recipe carrying a value
       there describes a setting the reader cannot reproduce. */
    const body = { ...cl, settings: { ...(cl.settings as object), look: 'BW', saturation: 3 } };
    const out = normaliseRecipe(cl.id as string, body);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.join(' ')).toMatch(/saturation/i);
  });

  it('reports every issue at once rather than the first', () => {
    /* The editor points at fields with these; one-at-a-time would make fixing
       a form a series of round trips. */
    const body = {
      ...pp,
      name: '',
      settings: { ...(pp.settings as object), blackLevel: 999, colorPhase: 999 },
    };
    const out = normaliseRecipe(pp.id as string, body);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.length).toBeGreaterThan(1);
  });
});

describe('getRecipeRecord', () => {
  it('throws on a failed read rather than reporting the recipe missing', async () => {
    /* It returned null on any error, and every caller reads null as 404: during
       a 402 or a 5xx the editor's Save said "That recipe no longer exists". */
    answer.result = { data: null, error: { message: 'restricted', status: 402 } };
    await expect(getRecipeRecord('SCL-PP-001')).rejects.toThrow(/restricted/);
  });

  it('still answers null for a recipe that is not there', async () => {
    answer.result = { data: null, error: null };
    await expect(getRecipeRecord('SCL-PP-999')).resolves.toBeNull();
  });
});

describe('the writes', () => {
  const recipe = (recipesSeed as unknown as Parameters<typeof updateRecipeRecord>[0][])[0];
  const V1 = '2026-10-01T09:00:00.123456+00:00';
  const V2 = '2026-10-02T10:30:00.654321+00:00';
  const reset = () => {
    log.update = null;
    log.filters = [];
    log.reads = 0;
    log.written = [];
  };

  it('saves only over the version the editor opened, and answers the new one', async () => {
    reset();
    log.written = [{ id: recipe.id, updated_at: V2 }];
    await expect(updateRecipeRecord(recipe, V1)).resolves.toBe(V2);
    expect(log.filters).toEqual([`id=${recipe.id}`, `updated_at=${V1}`]);
    expect(log.update).not.toHaveProperty('slug');
    expect(log.update).toHaveProperty('updated_at');
  });

  it('answers null when the version filter matched nothing', async () => {
    reset();
    await expect(updateRecipeRecord(recipe, V1)).resolves.toBeNull();
  });

  it('unpublishes by id without reading the row, so a row that fails the schema can go offline', async () => {
    /* It went through `getRecipeRecord`, which drops a row `fromRow` cannot
       parse: DELETE answered 404 for a row that exists, and the one screen
       that could take it off the site could not. */
    reset();
    log.written = [{ id: 'SCL-PP-010', updated_at: V2 }];
    await expect(unpublishRecipe('SCL-PP-010')).resolves.toBe(V2);
    expect(log.reads).toBe(0);
    expect(log.update).toMatchObject({ published: false });
    expect(log.filters).toEqual(['id=SCL-PP-010']);

    reset();
    await expect(unpublishRecipe('SCL-PP-999')).resolves.toBeNull();
  });
});

describe('creating', () => {
  const recipe = (recipesSeed as unknown as Parameters<typeof insertRecipeRecord>[0][])[0];

  it('answers taken when the unique key refused the id or slug, so the route allocates again', async () => {
    answer.insert = { error: { message: 'duplicate key value', code: '23505' } };
    await expect(insertRecipeRecord(recipe)).resolves.toBe('taken');
  });

  it('still throws on any other failure, and answers inserted on none', async () => {
    answer.insert = { error: { message: 'restricted' } };
    await expect(insertRecipeRecord(recipe)).rejects.toThrow(/restricted/);
    answer.insert = { error: null };
    await expect(insertRecipeRecord(recipe)).resolves.toBe('inserted');
  });

});

describe('computedRecipeName', () => {
  const seed = recipesSeed as unknown as Recipe[];
  const byId = new Map(seed.map((r) => [r.id, r]));
  const store = async (rows: readonly (Recipe & { published?: boolean })[]) => {
    const { toRow } = await import('./row');
    log.written = rows.map((r) => ({ ...toRow(r, null), updated_at: '2026-10-01T00:00:00Z' }));
  };
  const stored = () => store(seed);
  const comboOfName = (name: string) => comboOf(parseRecipeName(name)!.words);
  /** The stored rows, other than `id`, holding `name`'s three words in any order. */
  const othersHolding = (rows: readonly Recipe[], id: string, name: string) =>
    rows.filter((r) => r.id !== id && comboOfName(r.name) === comboOfName(name)).map((r) => r.id);

  it('gives a stored recipe saved unchanged the name the seed gives it, whatever its name field says', async () => {
    /* Named among every other row, drafts included — with the store equal to
       the seed, the set the seed is named across — so re-saving touches no word. */
    await stored();
    for (const r of seed) {
      await expect(computedRecipeName({ ...r, name: 'Typed by hand' }), r.id).resolves.toMatchObject({
        ok: true,
        name: r.name,
      });
    }
  });

  it('never names a recipe among the withdrawn Picture Profiles the content plane still stores', async () => {
    /* Production holds the 36 withdrawn rows, unpublished, settings intact, in
       either id shape. Here each carries a seed Picture Profile's settings and
       words under its own number (PP-003 as PP-055, …): counted as holders,
       they would push every one of those seed recipes off its seed name. */
    const pps = seed.filter((r) => r.format === 'pp');
    const start = pps.findIndex((r) => r.id === 'PP-055');
    const withdrawn = RETIRED_RECIPE_IDS.map((id, i) => {
      const like = pps[(start + i) % pps.length];
      const words = parseRecipeName(like.name)!.words.join(' ');
      return { ...like, id: i % 2 ? `SCL-${id}` : id, slug: id.toLowerCase(), name: `${id}-${words}`, published: false };
    });
    expect(withdrawn[0]).toMatchObject({ id: 'PP-003', name: `PP-003-${byId.get('PP-055')!.name.slice(7)}` });
    await store([...seed, ...withdrawn]);
    for (const r of seed) {
      await expect(computedRecipeName(r), r.id).resolves.toMatchObject({ ok: true, name: r.name });
    }
  });

  it('renames a recipe when a dial moves, from the settings alone, into words no other row holds', async () => {
    await stored();
    const cl = byId.get('CL-011')!;
    if (cl.format !== 'cl') throw new Error('CL-011 is a Creative Look');
    const punchier = { ...cl, settings: { ...cl.settings, contrast: 9 } };
    const named = await computedRecipeName(punchier);
    if (!named.ok) throw new Error('CL-011 at Contrast +9 has a free name');
    expect(named.name).not.toBe(cl.name);
    expect(named.name.startsWith('CL-011-')).toBe(true);
    expect(othersHolding(seed, cl.id, named.name)).toEqual([]);
  });

  it('holds every other row to its stored words: an edit never takes a name another row keeps', async () => {
    /* The whole-library assignment, run again for one save, handed the edited
       recipe words a later row held and moved that row aside — a move never
       written, so two stored rows held the same words (PP-082 as PP-002 took
       CL-020's). */
    await stored();
    const edits = [
      ['PP-082', 'PP-002'],
      ['PP-001', 'PP-055'],
    ] as const;
    for (const [id, like] of edits) {
      const edited = { ...byId.get(like)!, id, slug: byId.get(id)!.slug, name: byId.get(id)!.name };
      const named = await computedRecipeName(edited);
      if (!named.ok) {
        expect(named.heldBy.length, id).toBeGreaterThan(0);
        continue;
      }
      expect(named.name.startsWith(`${id}-`), id).toBe(true);
      const holders = othersHolding(seed, id, named.name);
      if (named.tiedWith) {
        /* A copy of another recipe's settings renders its palette: the one
           tie R2 allows, and only with rows that read alike. */
        expect(holders, id).toContain(named.tiedWith);
        for (const h of holders) expect(readsAlike(edited, byId.get(h)!), `${id} and ${h}`).toBe(true);
      } else {
        expect(holders, `${id} as ${like}: ${named.name}`).toEqual([]);
      }
    }
  });

  it('refuses the save when every honest name is held by rows that look different', async () => {
    /* Every option of PP-055's own reading, held by a stored row under another
       number and with other settings: nothing honest is left. */
    const like = byId.get('PP-055')!;
    const other = byId.get('CL-011')!;
    const held = optionsOf(readName(like)).map((o, i) => ({
      ...other,
      id: `CL-${900 + i}`,
      slug: `cl-${900 + i}`,
      name: `CL-${900 + i}-${o.words.join(' ')}`,
    }));
    await store(held);
    const named = await computedRecipeName({ ...like, id: 'PP-899', slug: 'pp-899' });
    expect(named).toEqual({ ok: false, heldBy: held.map((r) => r.id) });
  });

  it('names a new recipe after every stored one, by its own number, in words no row holds', async () => {
    await stored();
    const cl = byId.get('CL-011')!;
    if (cl.format !== 'cl') throw new Error('CL-011 is a Creative Look');
    const fresh = { ...cl, id: 'CL-046', slug: 'cl-046', name: 'CL-046', settings: { ...cl.settings, shadows: -6 } };
    const named = await computedRecipeName(fresh);
    expect(named).toMatchObject({ ok: true, tiedWith: null });
    if (named.ok) expect(othersHolding(seed, fresh.id, named.name)).toEqual([]);
  });

  it('shares words only with a stored recipe that reads alike, and says which', async () => {
    /* A copy of CL-011 renders CL-011's nine swatches: no word tells them
       apart, so the tie is the truth and is reported, not refused. */
    await stored();
    const copy = { ...byId.get('CL-011')!, id: 'CL-046', slug: 'cl-046', name: 'CL-046' };
    await expect(computedRecipeName(copy)).resolves.toEqual({
      ok: true,
      name: `CL-046-${byId.get('CL-011')!.name.slice(7)}`,
      tiedWith: 'CL-011',
    });
  });
});

describe('listRecipeRows', () => {
  it('returns a row that fails the schema as unreadable, so the editor can take it offline', async () => {
    /* `toRecord` dropped it from the list, so the screen could never select
       it, while the public grid threw on it. */
    const good = (recipesSeed as unknown as Record<string, unknown>[])[0];
    const { toRow } = await import('./row');
    log.written = [
      { ...toRow(good as never, null), updated_at: '2026-10-01T00:00:00Z' },
      { id: 'SCL-PP-998', slug: 'broken', name: 'Broken', format: 'pp', settings: {}, published: true },
    ];
    const { records, unreadable } = await listRecipeRows();
    expect(records.map((r) => r.recipe.id)).toEqual([good.id]);
    expect(unreadable).toEqual([{ id: 'SCL-PP-998', published: true, error: expect.any(String) }]);
    log.written = [];
  });
});

describe('the shipped catalogue', () => {
  it('still validates, so the dev store can seed from it', () => {
    /* `dev-store.ts` calls `recipeSchema.parse` on every seed row the first
       time the editor opens. A seed row that stopped validating would make the
       offline editor throw on load rather than show a list. */
    const seed = recipesSeed as unknown as unknown[];
    expect(seed.length).toBeGreaterThan(0);
    for (const row of seed) {
      const parsed = recipeSchema.safeParse(row);
      expect(parsed.success, JSON.stringify((row as { id?: string }).id)).toBe(true);
    }
  });
});

/*
 * The id allocator across the move from `SCL-PP-001` to `PP-001`. The content
 * migration renames every row in one transaction and swaps the CHECK with it,
 * so the rows themselves say which shape the next insert must use.
 */
describe('nextIdAmong', () => {
  it('issues the stored shape while every row still has it', () => {
    expect(nextIdAmong('PP', ['SCL-PP-001', 'SCL-PP-082', 'SCL-CL-045'])).toBe('SCL-PP-083');
    expect(nextIdAmong('CL', ['SCL-PP-001', 'SCL-PP-082', 'SCL-CL-045'])).toBe('SCL-CL-046');
  });

  it('issues the code shape once the rows have it', () => {
    expect(nextIdAmong('PP', ['PP-001', 'PP-082', 'CL-045'])).toBe('PP-083');
    expect(nextIdAmong('CL', ['PP-001', 'PP-082', 'CL-045'])).toBe('CL-046');
  });

  it('never reissues a number held under the other shape', () => {
    expect(nextIdAmong('PP', ['SCL-PP-090', 'PP-012'])).toBe('PP-091');
  });

  it('starts at 001 in the stored shape when a format has no rows', () => {
    expect(nextIdAmong('CL', ['SCL-PP-001'])).toBe('SCL-CL-001');
  });

  it('reads the shape across both formats once the CHECK has moved', () => {
    expect(nextIdAmong('CL', ['PP-001'])).toBe('CL-001');
  });

  it('ignores ids of other shapes and refuses past 999', () => {
    expect(nextIdAmong('PP', ['scl-001', 'PROCOLOR-001', 'SCL-PP-007'])).toBe('SCL-PP-008');
    expect(() => nextIdAmong('PP', ['PP-999'])).toThrow('idSpaceExhausted');
  });
});
