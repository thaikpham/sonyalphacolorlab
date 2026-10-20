import type { Recipe } from '@/lib/camera/schema';
import type { RecipeRecord } from '@/lib/recipes/admin-types';

/**
 * The recipe editor's open draft, and the rules for what happens to it.
 *
 * Pure and outside the component so they can be executed in a test — the
 * suite runs in Node with no DOM — the same split `lib/admin/product-draft.ts`
 * makes for the product editor. Every defect these fix was a question of which
 * copy of a recipe was on screen after an answer arrived, not of how the form
 * looked.
 */

export type { RecipeRecord };

export type Editing = {
  /** The row as stored when it was opened or last saved. Never edited: it is
      what Unpublish is offered from and what "unsaved" is measured against. */
  stored: RecipeRecord;
  /** What the form shows. */
  draft: Recipe;
  /** The Tags box as typed, or null while it shows `draft.tags`. Held as text
      because normalising per keystroke ate every comma and trailing hyphen,
      so a second tag — or the placeholder's own `golden-hour` — could not be
      typed left to right. */
  tagText: string | null;
};

export const opened = (stored: RecipeRecord): Editing => ({
  stored,
  draft: stored.recipe,
  tagText: null,
});

/** By identity: every edit replaces `draft`, and only an answer resets it. */
export const isDirty = (e: Editing | null): boolean =>
  e !== null && (e.draft !== e.stored.recipe || e.tagText !== null);

/**
 * One tag, folded to what `RECIPE_TAG_RE` accepts.
 *
 * The same folding as `slugifyRecipe` (which is server-only, beside the
 * database calls), so a Vietnamese tag keeps its words: `Đêm phố` is
 * `dem-pho`, where stripping non-ASCII made it `m-ph`. `recipe-draft.test.ts`
 * holds the two to the same output.
 */
export function normaliseTag(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The Tags box, comma-separated, into tags: empty and repeated ones dropped. */
export function parseTags(text: string): string[] {
  return [...new Set(text.split(',').map(normaliseTag).filter(Boolean))];
}

/** The draft with the Tags box applied — what a save sends. */
export const committed = (e: Editing): Recipe =>
  e.tagText === null ? e.draft : { ...e.draft, tags: parseTags(e.tagText) };

/**
 * A save's answer, applied to whatever is open NOW rather than to what was
 * sent.
 *
 * The fields and the list stay live while a save is out. Replacing the draft
 * unconditionally overwrote whatever was typed meanwhile and marked it saved,
 * and opening another recipe mid-save snapped the editor back to the first.
 * So the stored copy moves on when the answer is for the open recipe, and the
 * draft follows only if nobody has touched it since it was sent.
 */
export function afterSave(
  current: Editing | null,
  sent: Editing,
  fresh: RecipeRecord,
): Editing | null {
  if (!current || current.stored.recipe.id !== fresh.recipe.id) return current;
  const untouched = current.draft === sent.draft && current.tagText === sent.tagText;
  return untouched ? opened(fresh) : { ...current, stored: fresh };
}
