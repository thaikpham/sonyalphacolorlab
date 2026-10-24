import { describe, expect, it } from 'vitest';
import { planLibrarySync, type PlanExistingRow, type PlanSeedRecipe } from './library-plan';

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
      [row('SCL-PP-003', 'caspian-blue', 'SCL-PP-003: Caspian Blue', true), row('SCL-PP-004', 'tuscan-ochre', 'x', false)],
      ['SCL-PP-003', 'SCL-PP-004', 'SCL-PP-005'],
      new Set(),
    );
    expect(plan.unpublish).toEqual(['SCL-PP-003']);
    expect(plan.rename).toEqual([]);
    expect(plan.insert).toEqual([]);
  });

  it('skips a withdrawn id even if the seed still carried it', () => {
    const plan = planLibrarySync(
      [seed('SCL-PP-003', 'caspian-blue', 'PP-003-Anything Else')],
      [row('SCL-PP-003', 'caspian-blue', 'SCL-PP-003: Caspian Blue', false)],
      ['SCL-PP-003'],
      new Set(),
    );
    expect(plan).toEqual({ unpublish: [], rename: [], refresh: [], insert: [], conflicts: [] });
  });

  it('renames a published recipe and changes nothing else about it', () => {
    const plan = planLibrarySync(
      [seed('SCL-PP-001', 'mojave-sun', 'PP-001-Vivid Nostalgia Film')],
      [row('SCL-PP-001', 'mojave-sun', 'SCL-PP-001: Mojave Sun', true)],
      [],
      new Set(),
    );
    expect(plan.rename).toEqual([{ id: 'SCL-PP-001', from: 'SCL-PP-001: Mojave Sun', to: 'PP-001-Vivid Nostalgia Film' }]);
    expect(plan.refresh).toEqual([]);
  });

  it('leaves a recipe whose name already matches', () => {
    const plan = planLibrarySync(
      [seed('SCL-CL-001', 'fl-raoul-rutnam', 'CL-001-Film Hard Faded')],
      [row('SCL-CL-001', 'fl-raoul-rutnam', 'CL-001-Film Hard Faded', true)],
      [],
      new Set(),
    );
    expect(plan).toEqual({ unpublish: [], rename: [], refresh: [], insert: [], conflicts: [] });
  });

  it('refreshes an unpublished original whole, and only renames a published one', () => {
    const plan = planLibrarySync(
      [seed('SCL-PP-048', 'hue-silk', 'PP-048-Soft Clean Portrait'), seed('SCL-PP-049', 'clear-day', 'PP-049-Clean Natural Daylight')],
      [
        row('SCL-PP-048', 'hue-silk', 'SCL-PP-048: Huế Silk', false),
        row('SCL-PP-049', 'clear-day', 'SCL-PP-049: Clear Day', true),
      ],
      [],
      new Set(['SCL-PP-048', 'SCL-PP-049']),
    );
    expect(plan.refresh).toEqual(['SCL-PP-048']);
    expect(plan.rename).toEqual([{ id: 'SCL-PP-049', from: 'SCL-PP-049: Clear Day', to: 'PP-049-Clean Natural Daylight' }]);
  });

  it('inserts what the project lacks', () => {
    const plan = planLibrarySync(
      [seed('SCL-PP-071', 'silver-hard-muted', 'PP-071-Silver Hard Muted')],
      [],
      [],
      new Set(['SCL-PP-071']),
    );
    expect(plan.insert).toEqual(['SCL-PP-071']);
  });

  it.each([false, true])(
    'reports an id the project holds under another slug (published: %s) instead of touching it',
    (published) => {
      /* An editor's draft that nextRecipeId numbered SCL-PP-071 before the
         sync ran: it is not the original, so neither refresh nor rename. */
      const plan = planLibrarySync(
        [seed('SCL-PP-071', 'silver-hard-muted', 'PP-071-Silver Hard Muted')],
        [row('SCL-PP-071', 'editor-draft', 'SCL-PP-071: Editor Draft', published)],
        [],
        new Set(['SCL-PP-071']),
      );
      expect(plan.conflicts).toEqual([
        { id: 'SCL-PP-071', slug: 'silver-hard-muted', heldBy: 'SCL-PP-071 (as editor-draft)' },
      ]);
      expect(plan.refresh).toEqual([]);
      expect(plan.rename).toEqual([]);
      expect(plan.insert).toEqual([]);
    },
  );

  it('never refreshes a published original, only renames it', () => {
    const plan = planLibrarySync(
      [seed('SCL-PP-048', 'hue-silk', 'PP-048-Soft Clean Portrait')],
      [row('SCL-PP-048', 'hue-silk', 'SCL-PP-048: Huế Silk', true)],
      [],
      new Set(['SCL-PP-048']),
    );
    expect(plan.refresh).toEqual([]);
    expect(plan.rename.map((r) => r.id)).toEqual(['SCL-PP-048']);
  });

  it('reports a slug another id already holds instead of skipping it', () => {
    const plan = planLibrarySync(
      [seed('SCL-PP-071', 'hue-silk', 'PP-071-Silver Hard Muted')],
      [row('SCL-PP-048', 'hue-silk', 'x', false)],
      [],
      new Set(['SCL-PP-071']),
    );
    expect(plan.conflicts).toEqual([{ id: 'SCL-PP-071', slug: 'hue-silk', heldBy: 'SCL-PP-048' }]);
    expect(plan.insert).toEqual([]);
  });
});
