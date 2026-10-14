import { describe, expect, it } from 'vitest';
import recipesSeed from '../../../../data/recipes.seed.json';
import { slugifyRecipe } from '@/lib/recipes/admin-store';
import { RECIPE_TAG_RE, type Recipe } from '@/lib/camera/schema';
import {
  afterSave,
  committed,
  isDirty,
  normaliseTag,
  opened,
  parseTags,
  type RecipeRecord,
} from './recipe-draft';

/**
 * The recipe editor's draft rules, executed. The component's wiring to them is
 * pinned from its source in `recipe-admin.test.ts`.
 */

const seed = recipesSeed as unknown as Recipe[];
const A = seed.find((r) => r.format === 'pp')!;
const B = seed.find((r) => r.format === 'cl')!;
const rec = (recipe: Recipe, updatedAt = 'v1'): RecipeRecord => ({ recipe, legacyId: null, updatedAt });

describe('tags', () => {
  it('can be typed left to right: the box keeps its text until it is committed', () => {
    /* The input re-normalised every keystroke, so the comma after "warm"
       vanished as it was typed and "golden-" lost its hyphen. */
    let e = opened(rec({ ...A, tags: [] }));
    let text = '';
    for (const ch of 'warm, golden-hour') {
      text += ch;
      e = { ...e, tagText: text };
      expect(e.tagText).toBe(text);
    }
    expect(committed(e).tags).toEqual(['warm', 'golden-hour']);
  });

  it('fold Vietnamese the way a slug does, rather than dropping letters', () => {
    expect(normaliseTag('Đêm phố')).toBe('dem-pho');
    expect(normaliseTag('chân dung')).toBe('chan-dung');
    for (const s of ['Đêm phố', 'Công Thức Mùa Hè', '  Golden   Hour ', 'FX3 — Night / Neon', '35mm f/1.4']) {
      expect(normaliseTag(s), s).toBe(slugifyRecipe(s));
    }
  });

  it('drop empty and repeated tags, and every one meets the schema', () => {
    const tags = parseTags('warm, , Warm,  golden-hour ,, ---, đêm');
    expect(tags).toEqual(['warm', 'golden-hour', 'dem']);
    for (const t of tags) expect(t).toMatch(RECIPE_TAG_RE);
  });

  it('leave the draft alone while the box is untouched', () => {
    const e = opened(rec(A));
    expect(committed(e)).toBe(A);
    expect(isDirty(e)).toBe(false);
    expect(isDirty({ ...e, tagText: A.tags.join(', ') })).toBe(true);
  });
});

describe('a save’s answer', () => {
  const fresh = rec({ ...A, name: 'Stored' }, 'v2');

  it('replaces an untouched draft with the stored row', () => {
    const sent = { ...opened(rec(A)), draft: { ...A, name: 'Sent' } };
    const next = afterSave(sent, sent, fresh)!;
    expect(next.draft).toBe(fresh.recipe);
    expect(isDirty(next)).toBe(false);
  });

  it('keeps what was typed while the save was out, and keeps it unsaved', () => {
    const sent = { ...opened(rec(A)), draft: { ...A, name: 'Sent' } };
    const typing = { ...sent, draft: { ...A, name: 'Sent, then more' } };
    const next = afterSave(typing, sent, fresh)!;
    expect(next.draft.name).toBe('Sent, then more');
    expect(next.stored).toBe(fresh);
    expect(isDirty(next)).toBe(true);
  });

  it('keeps a Tags box that was being typed in', () => {
    const sent = opened(rec(A));
    const next = afterSave({ ...sent, tagText: 'new' }, sent, fresh)!;
    expect(next.tagText).toBe('new');
  });

  it('does not pull the editor back to a recipe it has left', () => {
    const sent = { ...opened(rec(A)), draft: { ...A, name: 'Sent' } };
    const other = opened(rec(B));
    expect(afterSave(other, sent, fresh)).toBe(other);
    expect(afterSave(null, sent, fresh)).toBeNull();
  });
});
