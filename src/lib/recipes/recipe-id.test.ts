import { describe, expect, it } from 'vitest';
import seed from '../../../data/recipes.seed.json';
import { recipeSchema, type Recipe } from '../camera/schema';
import { buildUniverse, entriesReferencing, resolveRefs, unknownRefs } from '../content/relations';
import { EMPTY_META } from '../lab/meta';
import type { Article, ArticleMeta } from '../lab/types';
import { recipeDoc } from '../search/documents';
import { recipeIdAliases, recipeIdKey } from './recipe-id';
import { matchesQuery } from './source';
import { designedLightFor, taxonomyFor } from './taxonomy-assign';

/*
 * The ids move from `SCL-PP-001` to `PP-001` through a content migration the
 * owner applies by hand. Everything that looks a recipe up by id must give the
 * same answer either side of it — the git manifest, related links written
 * before the rename, and search for the code readers already know.
 */

const recipes: Recipe[] = (seed as unknown[]).map((r) => recipeSchema.parse(r));
/* The seed is code-shaped; this is the same row as an unmigrated content
   project still stores it. */
const unmigrated = (r: Recipe): Recipe => ({ ...r, id: `SCL-${recipeIdKey(r.id)}` });

describe('recipeIdKey', () => {
  it('gives the code shape for either spelling', () => {
    expect(recipeIdKey('SCL-PP-001')).toBe('PP-001');
    expect(recipeIdKey('PP-001')).toBe('PP-001');
    expect(recipeIdAliases('PP-009')).toEqual(['PP-009', 'SCL-PP-009']);
    expect(recipeIdAliases('SCL-CL-013')).toEqual(['CL-013', 'SCL-CL-013']);
  });
});

describe('the taxonomy manifest across the rename', () => {
  it('assigns every seed recipe the same situations, style and tone in both id shapes', () => {
    for (const r of recipes) {
      expect(taxonomyFor(unmigrated(r)), r.id).toEqual(taxonomyFor(r));
    }
  });

  it('keeps the designed light of every seed recipe', () => {
    for (const r of recipes) {
      expect(designedLightFor(unmigrated(r).id), r.id).toBe(designedLightFor(r.id));
    }
    /* The manifest does name some lights, so the loop above is not vacuous. */
    expect(recipes.some((r) => designedLightFor(unmigrated(r).id) !== null)).toBe(true);
  });
});

const page = (id: string, meta: Partial<ArticleMeta> = {}): Article => ({
  id,
  kind: 'article',
  topic: 'color',
  level: 'newbie',
  archetype: 'explainer',
  read: '',
  title: `Title ${id}`,
  dek: '',
  blocks: [],
  meta: { ...EMPTY_META, ...meta },
});

describe('related links across the rename', () => {
  const summary = (id: string) => ({ id, slug: 'pp-001', name: 'PP-001-Vivid Nostalgia Film', format: 'pp' as const, wbLabel: '7000K' });

  it('resolves an old-shape ref against a renamed catalogue, and the reverse', () => {
    const newCatalogue = buildUniverse({ entries: [], recipes: [summary('PP-001')], products: [] });
    expect(resolveRefs([{ kind: 'recipe', id: 'SCL-PP-001' }], newCatalogue)).toHaveLength(1);
    const oldCatalogue = buildUniverse({ entries: [], recipes: [summary('SCL-PP-001')], products: [] });
    expect(resolveRefs([{ kind: 'recipe', id: 'PP-001' }], oldCatalogue)).toHaveLength(1);
  });

  it('finds the pages that reference a recipe in either shape', () => {
    const a = page('a', { related: [{ kind: 'recipe', id: 'SCL-PP-001' }] });
    expect(entriesReferencing({ kind: 'recipe', id: 'PP-001' }, [a])).toEqual([a]);
    const b = page('b', { related: [{ kind: 'recipe', id: 'PP-001' }] });
    expect(entriesReferencing({ kind: 'recipe', id: 'SCL-PP-001' }, [b])).toEqual([b]);
  });

  it('does not report a ref as unknown because of its spelling', () => {
    const meta = { ...EMPTY_META, related: [{ kind: 'recipe' as const, id: 'SCL-PP-001' }] };
    const known = { recipes: new Set(['PP-001']), products: new Set<string>(), pages: new Map() };
    expect(unknownRefs(meta, known)).toEqual([]);
  });
});

describe('search across the rename', () => {
  const pp009 = recipes.find((r) => r.id === 'PP-009');

  it('finds a recipe by either code, whichever shape it is stored in', () => {
    expect(pp009).toBeDefined();
    for (const r of [pp009!, unmigrated(pp009!)]) {
      expect(matchesQuery(r, 'SCL-PP-009'), r.id).toBe(true);
      expect(matchesQuery(r, 'PP-009'), r.id).toBe(true);
      expect(matchesQuery(r, 'scl pp 009'), r.id).toBe(true);
    }
  });

  it('makes both codes exact hits in the search index', () => {
    const doc = (r: Recipe) =>
      recipeDoc({ ...r, wbLabel: '', description: '', look: r.format === 'cl' ? r.settings.look : undefined }, 'en');
    for (const r of [pp009!, unmigrated(pp009!)]) {
      expect(doc(r).exact).toEqual(expect.arrayContaining(['pp009', 'sclpp009']));
    }
  });
});
