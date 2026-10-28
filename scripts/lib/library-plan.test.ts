import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recipeSchema, type Recipe } from '../../src/lib/camera/schema';
import { ORIGINAL_CL } from '../../src/lib/originals/cl';
import { ORIGINAL_PP } from '../../src/lib/originals/pp';
import { recipeIdKey } from '../../src/lib/recipes/recipe-id';
import { RETIRED_RECIPE_IDS } from '../../src/lib/recipes/redirects';
import { slugHistory } from '../../src/lib/recipes/slug-aliases';
import { SLUG_MOVES, slugAtState } from '../../src/lib/recipes/slug-moves';
import {
  insertRows,
  planForProject,
  planLibrarySync,
  refreshFields,
  seedInStoredShape,
  storedShape,
  storedSlug,
  storedSlugState,
  translationRows,
  type PlanExistingRow,
  type PlanSeedRecipe,
  type SyncSeed,
} from './library-plan';

const seed = (id: string, slug: string, name: string): PlanSeedRecipe => ({ id, slug, name });
const row = (id: string, slug: string, name: string, published: boolean): PlanExistingRow => ({
  id,
  slug,
  name,
  published,
});

describe('planLibrarySync', () => {
  it('unpublishes a withdrawn id only while it is published, and never touches it otherwise', () => {
    const plan = planLibrarySync(
      [],
      [row('PP-003', 'caspian-blue', 'SCL-PP-003: Caspian Blue', true), row('PP-004', 'tuscan-ochre', 'x', false)],
      ['PP-003', 'PP-004', 'PP-005'],
      new Set(),
    );
    expect(plan.unpublish).toEqual(['PP-003']);
    expect(plan.rename).toEqual([]);
    expect(plan.insert).toEqual([]);
  });

  it('skips a withdrawn id even if the seed still carried it', () => {
    const plan = planLibrarySync(
      [seed('PP-003', 'caspian-blue', 'PP-003-Anything Else')],
      [row('PP-003', 'caspian-blue', 'SCL-PP-003: Caspian Blue', false)],
      ['PP-003'],
      new Set(),
    );
    expect(plan).toEqual({ unpublish: [], rename: [], refresh: [], insert: [], conflicts: [] });
  });

  it('renames a published recipe and changes nothing else about it', () => {
    const plan = planLibrarySync(
      [seed('PP-001', 'pp-001-vivid-nostalgia-film', 'PP-001-Vivid Nostalgia Film')],
      [row('PP-001', 'pp-001-vivid-nostalgia-film', 'SCL-PP-001: Mojave Sun', true)],
      [],
      new Set(),
    );
    expect(plan.rename).toEqual([{ id: 'PP-001', from: 'SCL-PP-001: Mojave Sun', to: 'PP-001-Vivid Nostalgia Film' }]);
    expect(plan.refresh).toEqual([]);
  });

  it('leaves a recipe whose name already matches', () => {
    const plan = planLibrarySync(
      [seed('CL-001', 'cl-001-film-hard-faded', 'CL-001-Film Hard Faded')],
      [row('CL-001', 'cl-001-film-hard-faded', 'CL-001-Film Hard Faded', true)],
      [],
      new Set(),
    );
    expect(plan).toEqual({ unpublish: [], rename: [], refresh: [], insert: [], conflicts: [] });
  });

  it('refreshes an unpublished original whole, and only renames a published one', () => {
    const plan = planLibrarySync(
      [seed('PP-048', 'pp-048-soft-clean-portrait', 'PP-048-Soft Clean Portrait'), seed('PP-049', 'pp-049-clean-natural-daylight', 'PP-049-Clean Natural Daylight')],
      [
        row('PP-048', 'pp-048-soft-clean-portrait', 'SCL-PP-048: Huế Silk', false),
        row('PP-049', 'pp-049-clean-natural-daylight', 'SCL-PP-049: Clear Day', true),
      ],
      [],
      new Set(['PP-048', 'PP-049']),
    );
    expect(plan.refresh).toEqual(['PP-048']);
    expect(plan.rename).toEqual([{ id: 'PP-049', from: 'SCL-PP-049: Clear Day', to: 'PP-049-Clean Natural Daylight' }]);
  });

  it('inserts what the project lacks', () => {
    const plan = planLibrarySync(
      [seed('PP-071', 'pp-071-silver-hard-muted', 'PP-071-Silver Hard Muted')],
      [],
      [],
      new Set(['PP-071']),
    );
    expect(plan.insert).toEqual(['PP-071']);
  });

  it.each([false, true])(
    'reports an id the project holds under another slug (published: %s) instead of touching it',
    (published) => {
      /* An editor's draft that nextRecipeId numbered PP-071 before the
         sync ran: it is not the original, so neither refresh nor rename. */
      const plan = planLibrarySync(
        [seed('PP-071', 'pp-071-silver-hard-muted', 'PP-071-Silver Hard Muted')],
        [row('PP-071', 'editor-draft', 'SCL-PP-071: Editor Draft', published)],
        [],
        new Set(['PP-071']),
      );
      expect(plan.conflicts).toEqual([
        { id: 'PP-071', slug: 'pp-071-silver-hard-muted', heldBy: 'PP-071 (as editor-draft)' },
      ]);
      expect(plan.refresh).toEqual([]);
      expect(plan.rename).toEqual([]);
      expect(plan.insert).toEqual([]);
    },
  );

  it('never refreshes a published original, only renames it', () => {
    const plan = planLibrarySync(
      [seed('PP-048', 'pp-048-soft-clean-portrait', 'PP-048-Soft Clean Portrait')],
      [row('PP-048', 'pp-048-soft-clean-portrait', 'SCL-PP-048: Huế Silk', true)],
      [],
      new Set(['PP-048']),
    );
    expect(plan.refresh).toEqual([]);
    expect(plan.rename.map((r) => r.id)).toEqual(['PP-048']);
  });

  it('reports a slug another id already holds instead of skipping it', () => {
    const plan = planLibrarySync(
      [seed('PP-071', 'pp-048-soft-clean-portrait', 'PP-071-Silver Hard Muted')],
      [row('PP-048', 'pp-048-soft-clean-portrait', 'x', false)],
      [],
      new Set(['PP-071']),
    );
    expect(plan.conflicts).toEqual([{ id: 'PP-071', slug: 'pp-048-soft-clean-portrait', heldBy: 'PP-048' }]);
    expect(plan.insert).toEqual([]);
  });
});

describe('storedShape', () => {
  it('reads SCL- ids as the legacy shape, so the sync writes before the migration', () => {
    expect(storedShape(['PP-001', 'CL-001'], ['SCL-PP-001', 'SCL-PP-003', 'SCL-CL-001'])).toEqual({ shape: 'legacy' });
  });

  it('reads code-shaped ids, or an empty project, as the seed shape', () => {
    expect(storedShape(['PP-001', 'CL-045'], ['PP-001', 'PP-003', 'CL-045'])).toEqual({ shape: 'code' });
    expect(storedShape(['PP-001'], [])).toEqual({ shape: 'code' });
  });

  it('refuses a project holding both shapes', () => {
    const read = storedShape(['PP-001'], ['SCL-PP-001', 'SCL-PP-003', 'SCL-CL-001', 'SCL-CL-002', 'PP-090']);
    expect(read).toHaveProperty('refusal');
    const why = 'refusal' in read ? read.refusal : '';
    expect(why).toMatch(/both shapes: 4 SCL- \(SCL-PP-001, SCL-PP-003, SCL-CL-001, …\) and 1 code-shaped \(PP-090\)/);
    expect(why).toMatch(/Nothing was planned or written/);
  });

  it('refuses a stale SCL- seed against a migrated project', () => {
    const read = storedShape(['SCL-PP-001'], ['PP-001']);
    expect('refusal' in read && read.refusal).toMatch(/seed:emit/);
  });
});

/* The seed exactly as the script reads it. */
const SEED = (
  JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as (Record<string, unknown> & { legacyId?: string | null })[]
).map((r) => ({ recipe: recipeSchema.parse(r), legacyId: r.legacyId ?? null }));
const SYNC_SEED: SyncSeed<Recipe> = {
  recipes: SEED,
  translations: JSON.parse(readFileSync('data/translations.seed.json', 'utf8')) as SyncSeed<Recipe>['translations'],
  retired: RETIRED_RECIPE_IDS,
  originals: [...ORIGINAL_PP, ...ORIGINAL_CL].map((o) => o.recipe.id),
};
const ORIGINALS = new Set(SYNC_SEED.originals);
const KEPT = SEED.filter(({ recipe }) => !ORIGINALS.has(recipe.id));
const nameOf = new Map(SEED.map(({ recipe }) => [recipe.id, recipe.name]));
const titled = (slug: string) => slug.replace(/(^|-)([a-z])/g, (_m, sep: string, c: string) => `${sep ? ' ' : ''}${c.toUpperCase()}`);

/* What the old content CHECKs admit (supabase/content/migrations/0001_content_baseline.sql). */
const OLD_ID_CHECK = /^SCL-(PP|CL)-[0-9]{3}$/;
const SLUG_CHECK = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The content project as it is before the code-id migration: the 47 published
 * seed recipes (10 kept legacy Picture Profiles, 37 Sony Asia Creative Looks)
 * under SCL- ids, their former slugs and their old names, and the 36 withdrawn
 * Picture Profiles still published. None of the 43 originals.
 */
const PRODUCTION: readonly PlanExistingRow[] = [
  ...KEPT.map(({ recipe }) => {
    const former = slugHistory(recipe.slug)[0];
    return row(`SCL-${recipe.id}`, former, `SCL-${recipe.id}: ${titled(former)}`, true);
  }),
  ...RETIRED_RECIPE_IDS.map((id) => row(`SCL-${id}`, `withdrawn-${id.toLowerCase()}`, `SCL-${id}: Withdrawn`, true)),
];

const [OCT24, OCT28] = SLUG_MOVES;

/** What 20261024000000 does to a row: the id loses SCL-, a first slug moves when its number agrees. */
const migrate = (r: PlanExistingRow): PlanExistingRow => {
  const id = recipeIdKey(r.id);
  const current = OCT24.moves[r.slug];
  return { ...r, id, slug: current && current.slice(0, 6).toUpperCase() === id ? current : r.slug };
};

/** What 20261028000000 does to a row: a 2026-10-24 slug moves to the code when the id is that code. */
const migrateSlugs = (r: PlanExistingRow): PlanExistingRow => {
  const code = OCT28.moves[r.slug];
  return code && code.toUpperCase() === r.id ? { ...r, slug: code } : r;
};

/** A plan applied to a fixture, as the script's writes would leave it. */
function applied(existing: readonly PlanExistingRow[], seed: SyncSeed<Recipe>): PlanExistingRow[] {
  const planned = planForProject(seed, existing);
  if ('refusal' in planned) throw new Error(planned.refusal);
  const { plan, stored } = planned;
  const renamed = new Map(plan.rename.map((r) => [r.id, r.to]));
  return [
    ...existing.map((r) => ({
      ...r,
      name: renamed.get(r.id) ?? r.name,
      published: plan.unpublish.includes(r.id) ? false : r.published,
    })),
    ...insertRows(plan, stored).map((r) => row(r.id, r.slug, r.name, r.published)),
  ];
}

describe('library:sync against the content project before the code-id migration', () => {
  const planned = planForProject(SYNC_SEED, PRODUCTION);
  if ('refusal' in planned) throw new Error(planned.refusal);
  const { shape, stored, plan } = planned;

  it('is the production fixture: 47 kept, 36 withdrawn, 43 originals missing', () => {
    expect(KEPT).toHaveLength(47);
    expect(RETIRED_RECIPE_IDS).toHaveLength(36);
    expect(ORIGINALS.size).toBe(43);
    expect(PRODUCTION).toHaveLength(83);
    expect(PRODUCTION[0]).toEqual(row('SCL-PP-001', 'mojave-sun', 'SCL-PP-001: Mojave Sun', true));
  });

  it('writes in the SCL- shape, at the first slugs', () => {
    expect(shape).toBe('legacy');
    expect(planned).toHaveProperty('slugState', 0);
  });

  it('plans exactly: unpublish 36, rename 47, insert 43, refresh 0, conflicts 0', () => {
    expect(plan.unpublish).toEqual(RETIRED_RECIPE_IDS.map((id) => `SCL-${id}`));
    expect(plan.rename).toHaveLength(47);
    expect(plan.insert).toHaveLength(43);
    expect(plan.refresh).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it("renames the 47 under their SCL- ids, to the seed's new names", () => {
    expect(plan.rename.map((r) => r.id).sort()).toEqual(KEPT.map(({ recipe }) => `SCL-${recipe.id}`).sort());
    for (const r of plan.rename) expect(r.to, r.id).toBe(nameOf.get(recipeIdKey(r.id)));
    expect(plan.rename).toContainEqual({ id: 'SCL-PP-001', from: 'SCL-PP-001: Mojave Sun', to: nameOf.get('PP-001') });
  });

  it('inserts the 43 originals under SCL- ids and their former slugs, unpublished, under the new names', () => {
    const rows = insertRows(plan, stored);
    expect(rows.map((r) => r.id).sort()).toEqual([...ORIGINALS].map((id) => `SCL-${id}`).sort());
    for (const r of rows) {
      const seedRecipe = SEED.find(({ recipe }) => recipe.id === recipeIdKey(r.id))!.recipe;
      expect(r.slug, r.id).toBe(slugHistory(seedRecipe.slug)[0]);
      expect(r.name, r.id).toBe(seedRecipe.name);
      expect(r.published, r.id).toBe(false);
    }
  });

  it('inserts rows the old content CHECKs admit', () => {
    for (const r of insertRows(plan, stored)) {
      expect(r.id, r.id).toMatch(OLD_ID_CHECK);
      expect(r.id.startsWith(`SCL-${r.format.toUpperCase()}-`), r.id).toBe(true);
      expect(r.slug, r.id).toMatch(SLUG_CHECK);
    }
  });

  /* Every original already ships published: false, so only a recipe the
     seed publishes shows whether the insert overrides it. */
  it('inserts a published seed recipe the project lacks unpublished', () => {
    const missing = PRODUCTION.filter((r) => r.id !== 'SCL-PP-001');
    const p = planForProject(SYNC_SEED, missing);
    if ('refusal' in p) throw new Error(p.refusal);
    expect(p.plan.insert).toContain('SCL-PP-001');
    const r = insertRows(p.plan, p.stored).find((x) => x.id === 'SCL-PP-001')!;
    expect(SEED.find(({ recipe }) => recipe.id === 'PP-001')!.recipe.published).toBe(true);
    expect(r.published).toBe(false);
  });

  it('refreshes a recipe unpublished even when it says published', () => {
    const orig = stored.recipes.find(({ recipe }) => recipe.id === 'SCL-PP-048')!.recipe;
    expect(refreshFields({ ...orig, published: true } as Recipe).published).toBe(false);
  });

  it('stores a recipe with no former slug under its own slug, in every slug state', () => {
    for (const n of [0, 1, 2]) expect(storedSlug('cl-046', n)).toBe('cl-046');
    expect([0, 1, 2].map((n) => storedSlug('pp-001', n))).toEqual(['mojave-sun', 'pp-001-vivid-nostalgia-film', 'pp-001']);
  });

  it('inserts a recipe born after the move under SCL- and its own slug', () => {
    const template = SEED.find(({ recipe }) => ORIGINALS.has(recipe.id) && recipe.format === 'cl')!;
    const born = {
      ...template,
      recipe: { ...template.recipe, id: 'CL-046', slug: 'cl-046', name: 'CL-046-Warm Soft Rich' } as Recipe,
    };
    expect(slugHistory(born.recipe.slug)).toEqual(['cl-046']);
    expect(SEED.some(({ recipe }) => recipe.id === 'CL-046' || recipe.name === born.recipe.name)).toBe(false);
    const p = planForProject(
      { ...SYNC_SEED, recipes: [...SYNC_SEED.recipes, born], originals: [...SYNC_SEED.originals, 'CL-046'] },
      PRODUCTION,
    );
    if ('refusal' in p) throw new Error(p.refusal);
    expect(p.plan.insert).toContain('SCL-CL-046');
    expect(p.plan.conflicts).toEqual([]);
    const r = insertRows(p.plan, p.stored).find((x) => x.id === 'SCL-CL-046')!;
    expect(r.slug).toBe('cl-046');
    expect(r.id).toMatch(OLD_ID_CHECK);
    expect(r.slug).toMatch(SLUG_CHECK);
  });

  it('inserts rows the later migration renames: each id is the number its first slug moves to', () => {
    for (const r of insertRows(plan, stored)) {
      const current = OCT24.moves[r.slug];
      expect(current, r.id).toBeTruthy();
      expect(recipeIdKey(r.id), r.id).toBe(current.slice(0, 6).toUpperCase());
      const seedSlug = SEED.find(({ recipe }) => recipe.id === recipeIdKey(r.id))!.recipe.slug;
      expect(current, r.id).toBe(slugAtState(seedSlug, 1));
    }
  });

  it('writes translations under the SCL- ids', () => {
    const rows = translationRows(stored, plan.insert);
    expect(rows).toHaveLength(86);
    for (const t of rows) expect(t.recipe_id).toMatch(OLD_ID_CHECK);
    expect(new Set(rows.map((t) => t.recipe_id))).toEqual(new Set(plan.insert));
  });

  it('refreshes the originals in place the second time, in the same shape, and does nothing else', () => {
    const second = planForProject(SYNC_SEED, applied(PRODUCTION, SYNC_SEED));
    if ('refusal' in second) throw new Error(second.refusal);
    expect(second.shape).toBe('legacy');
    expect(second.plan).toEqual({
      unpublish: [],
      rename: [],
      refresh: [...ORIGINALS].map((id) => `SCL-${id}`),
      insert: [],
      conflicts: [],
    });
    const fields = refreshFields(second.stored.recipes.find(({ recipe }) => recipe.id === 'SCL-PP-048')!.recipe);
    expect(fields).not.toHaveProperty('id');
    expect(fields).not.toHaveProperty('slug');
    expect(fields.published).toBe(false);
  });

  it('after the migration plans in the code shape with nothing to insert or rename', () => {
    const after = applied(PRODUCTION, SYNC_SEED).map(migrate);
    const next = planForProject(SYNC_SEED, after);
    if ('refusal' in next) throw new Error(next.refusal);
    expect(next.shape).toBe('code');
    expect(next.slugState).toBe(1);
    expect(next.plan).toEqual({ unpublish: [], rename: [], refresh: [...ORIGINALS], insert: [], conflicts: [] });
  });

  it('stops on a former slug or an id another recipe holds, before any write', () => {
    const clash = planForProject(SYNC_SEED, [
      ...PRODUCTION,
      row('SCL-PP-090', 'hue-silk', 'SCL-PP-090: Editor Draft', false),
      row('SCL-PP-071', 'editor-draft', 'SCL-PP-071: Editor Draft', false),
    ]);
    if ('refusal' in clash) throw new Error(clash.refusal);
    expect(clash.plan.conflicts).toEqual([
      { id: 'SCL-PP-048', slug: 'hue-silk', heldBy: 'SCL-PP-090' },
      { id: 'SCL-PP-071', slug: 'silver-hard-muted', heldBy: 'SCL-PP-071 (as editor-draft)' },
    ]);
  });

  it('refuses a project holding both shapes', () => {
    const mixed = planForProject(SYNC_SEED, [...PRODUCTION, row('PP-048', 'pp-048-soft-clean-portrait', 'x', false)]);
    expect(mixed).toEqual({ refusal: expect.stringMatching(/both shapes: 83 SCL- .* and 1 code-shaped \(PP-048\)/) });
  });
});

describe('library:sync against the content project after the code-id migration', () => {
  const MIGRATED = PRODUCTION.map(migrate);

  it('leaves the seed as it is', () => {
    expect(seedInStoredShape(SYNC_SEED, 'code')).toBe(SYNC_SEED);
  });

  it('plans as before: code ids and slugs throughout', () => {
    const planned = planForProject(SYNC_SEED, MIGRATED);
    if ('refusal' in planned) throw new Error(planned.refusal);
    expect(planned.shape).toBe('code');
    expect(planned.plan.unpublish).toEqual(RETIRED_RECIPE_IDS);
    expect(planned.plan.rename.map((r) => r.id).sort()).toEqual(KEPT.map(({ recipe }) => recipe.id).sort());
    expect(planned.plan.refresh).toEqual([]);
    expect(planned.plan.conflicts).toEqual([]);
    expect(planned.slugState).toBe(1);
    const rows = insertRows(planned.plan, planned.stored);
    expect(rows.map((r) => r.id).sort()).toEqual([...ORIGINALS].sort());
    for (const r of rows) {
      expect(r.slug).toBe(slugAtState(SEED.find(({ recipe }) => recipe.id === r.id)!.recipe.slug, 1));
    }
    for (const t of translationRows(planned.stored, planned.plan.insert)) expect(t.recipe_id).toMatch(/^(PP|CL)-\d{3}$/);
  });
});

/**
 * The content project today (2026-10-28): 20261024000000 applied, so code ids
 * and every seed recipe at its 2026-10-24 slug, under the names main's seed
 * gave them — the name of the day was the slug, in Title Case (`HLG` the one
 * acronym) — 47 published, the 43 originals unpublished, the 36 withdrawn
 * Picture Profiles unpublished beside them. 126 rows.
 */
const mainName = (slug: string) =>
  `${slug.slice(0, 6).toUpperCase()}-${titled(slug.slice(7)).replace(/\bHlg\b/, 'HLG')}`;
const TODAY: readonly PlanExistingRow[] = [
  ...SEED.map(({ recipe }) => {
    const slug = slugAtState(recipe.slug, 1);
    return row(recipe.id, slug, mainName(slug), recipe.published);
  }),
  ...RETIRED_RECIPE_IDS.map((id) => row(id, `withdrawn-${id.toLowerCase()}`, `SCL-${id}: Withdrawn`, false)),
];

describe('library:sync against the content project today, before and after the code-slug migration', () => {
  const states = [
    ['before 20261028000000', TODAY, 1],
    ['after 20261028000000', TODAY.map(migrateSlugs), 2],
  ] as const;

  it('is the production fixture: 126 rows, 47 published, every seed recipe at its 2026-10-24 slug', () => {
    expect(TODAY).toHaveLength(126);
    expect(TODAY.filter((r) => r.published)).toHaveLength(47);
    expect(TODAY[0]).toEqual(row('PP-001', 'pp-001-vivid-nostalgia-film', 'PP-001-Vivid Nostalgia Film', true));
    expect(TODAY.find((r) => r.id === 'PP-080')?.name).toBe('PP-080-Range HLG Daylight');
    /* The published ones are exactly the kept recipes, the originals all drafts. */
    expect(TODAY.filter((r) => r.published).map((r) => r.id).sort()).toEqual(KEPT.map(({ recipe }) => recipe.id).sort());
    /* 20261028000000 moves every seed row and nothing else. */
    const after = TODAY.map(migrateSlugs);
    for (const { recipe } of SEED) expect(after.find((r) => r.id === recipe.id)?.slug, recipe.id).toBe(recipe.slug);
    expect(after.filter((r) => r.slug.startsWith('withdrawn-'))).toHaveLength(36);
  });

  it.each(states)('%s: plans rename 47 (names only), refresh 43, nothing else, 0 conflicts', (_label, rows, slugState) => {
    const planned = planForProject(SYNC_SEED, rows);
    if ('refusal' in planned) throw new Error(planned.refusal);
    expect(planned.shape).toBe('code');
    expect(planned.slugState).toBe(slugState);
    expect(planned.plan.unpublish).toEqual([]);
    expect(planned.plan.insert).toEqual([]);
    expect(planned.plan.conflicts).toEqual([]);
    expect([...planned.plan.refresh].sort()).toEqual([...ORIGINALS].sort());
    expect(planned.plan.rename).toHaveLength(47);
    for (const r of planned.plan.rename) {
      const slug = rows.find((x) => x.id === r.id)!.slug;
      expect(r.from, r.id).toBe(mainName(slugAtState(slug, 1)));
      expect(r.to, r.id).toBe(nameOf.get(r.id));
      /* The write is guarded on the slug the project holds, whatever it is. */
      expect(planned.stored.recipes.find(({ recipe }) => recipe.id === r.id)!.recipe.slug, r.id).toBe(slug);
    }
    expect(planned.plan.rename).toContainEqual({ id: 'PP-001', from: 'PP-001-Vivid Nostalgia Film', to: nameOf.get('PP-001') });
  });

  it('leaves the seed as it is once the project holds the code slugs', () => {
    const planned = planForProject(SYNC_SEED, TODAY.map(migrateSlugs));
    if ('refusal' in planned) throw new Error(planned.refusal);
    expect(planned.stored).toBe(SYNC_SEED);
  });

  it.each([
    ['names first, then the migration', (rows: readonly PlanExistingRow[]) => applied(rows, SYNC_SEED).map(migrateSlugs)],
    ['the migration first, then names', (rows: readonly PlanExistingRow[]) => applied(rows.map(migrateSlugs), SYNC_SEED)],
  ])('ends with nothing left to rename: %s', (_label, run) => {
    const next = planForProject(SYNC_SEED, run(TODAY));
    if ('refusal' in next) throw new Error(next.refusal);
    expect(next.slugState).toBe(2);
    expect(next.plan).toEqual({ unpublish: [], rename: [], refresh: [...ORIGINALS], insert: [], conflicts: [] });
  });

  it('inserts a missing seed recipe under the spelling the project holds', () => {
    for (const [, rows, slugState] of states) {
      const p = planForProject(SYNC_SEED, rows.filter((r) => r.id !== 'PP-001'));
      if ('refusal' in p) throw new Error(p.refusal);
      expect(p.plan.insert).toEqual(['PP-001']);
      const [r] = insertRows(p.plan, p.stored);
      expect(r.slug).toBe(slugAtState('pp-001', slugState));
      expect(r.published).toBe(false);
    }
  });

  it('refuses a project holding two spellings of one recipe', () => {
    const twice = planForProject(SYNC_SEED, [...TODAY, row('PP-990', 'pp-001', 'PP-990-Editor Draft', false)]);
    expect(twice).toEqual({
      refusal: expect.stringMatching(/two spellings of 1 recipe\(s\): PP-001 \(pp-001-vivid-nostalgia-film, pp-001\)/),
    });
  });

  it('refuses a project whose recipes sit at different slug generations', () => {
    const half = TODAY.map((r) => (r.id === 'PP-001' ? migrateSlugs(r) : r));
    expect(planForProject(SYNC_SEED, half)).toEqual({ refusal: expect.stringMatching(/different slug generations/) });
  });
});

describe('storedSlugState', () => {
  const recipes = SEED.map(({ recipe }) => recipe);

  it('is the seed’s own state for a project holding none of it', () => {
    expect(storedSlugState(recipes, [])).toEqual({ state: SLUG_MOVES.length });
    expect(storedSlugState(recipes, [row('PP-003', 'withdrawn-pp-003', 'x', false)])).toEqual({ state: 2 });
  });

  it('reads each state off the rows a recipe’s own id holds', () => {
    for (const n of [0, 1, 2]) {
      const rows = recipes.map((r) => row(n === 0 ? `SCL-${r.id}` : r.id, slugAtState(r.slug, n), r.name, true));
      expect(storedSlugState(recipes, rows), String(n)).toEqual({ state: n });
    }
  });

  it('takes no evidence from another id holding a spelling, leaving the conflict to the plan', () => {
    const rows = [...TODAY, row('PP-990', 'mojave-sun', 'PP-990-Editor Draft', false)].filter((r) => r.id !== 'PP-001');
    expect(storedSlugState(recipes, rows)).toEqual({ state: 1 });
  });
});

describe('sync-library.ts', () => {
  const script = readFileSync('scripts/sync-library.ts', 'utf8');
  const planAt = script.indexOf('planForProject(');

  it('plans only through planForProject, so the shape is read before anything else', () => {
    expect(planAt).toBeGreaterThan(-1);
    expect(script).not.toMatch(/planLibrarySync\(|storedShape\(/);
  });

  /* After the plan every id and slug must be the stored one: the raw seed,
     its translations or the code-shaped withdrawn ids would write or guard
     on the other shape. */
  it('writes from the stored seed alone after planning', () => {
    const after = script.slice(planAt + 'planForProject('.length);
    const code = after
      .slice(after.indexOf(');'))
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      .replace(/`[^`]*`|'[^']*'|"[^"]*"/g, "''");
    expect(code).toMatch(/insertRows\(plan, stored\)/);
    expect(code).not.toMatch(/(?<![.\w])(seed|translations|originals|RETIRED_RECIPE_IDS)\b|toRow\(/);
  });

  it('says which shape and which slug spelling it writes', () => {
    expect(script).toMatch(/content holds SCL- ids: writing in that shape; the id migration renames them later/);
    expect(script).toContain('writing in that spelling; ');
    expect(script).toContain('${SLUG_MOVES[slugState].content} renames them later');
  });
});
