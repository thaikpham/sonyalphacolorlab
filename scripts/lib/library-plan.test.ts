import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { idShapeMismatch, planLibrarySync, type PlanExistingRow, type PlanSeedRecipe } from './library-plan';

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

describe('idShapeMismatch', () => {
  it('stops the sync while the content project still holds SCL- ids', () => {
    const why = idShapeMismatch(['PP-001', 'CL-001'], ['SCL-PP-001', 'SCL-PP-003', 'SCL-CL-001', 'SCL-CL-002']);
    expect(why).toMatch(/still holds 4 SCL- id\(s\) \(SCL-PP-001, SCL-PP-003, SCL-CL-001, …\)/);
    expect(why).toMatch(/Apply the content migration first/);
  });

  it('stops on one stray SCL- id among migrated rows', () => {
    expect(idShapeMismatch(['PP-001'], ['PP-001', 'SCL-PP-090'])).toMatch(/1 SCL- id\(s\) \(SCL-PP-090\)/);
  });

  it('stops the other way round too: a stale seed against a migrated project', () => {
    expect(idShapeMismatch(['SCL-PP-001'], ['PP-001'])).toMatch(/seed:emit/);
  });

  it('lets the sync plan when both are in one shape, or the project is empty', () => {
    expect(idShapeMismatch(['PP-001', 'CL-045'], ['PP-001', 'PP-003', 'CL-045'])).toBeNull();
    expect(idShapeMismatch(['PP-001'], [])).toBeNull();
  });

  it('is what the script asks before it plans', () => {
    const script = readFileSync('scripts/sync-library.ts', 'utf8');
    const guard = script.indexOf('idShapeMismatch(');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(script.indexOf('planLibrarySync('));
  });
});
