import type { Recipe } from '../camera/schema';

/**
 * A recipe as the editor sees it: the validated recipe plus the two columns
 * that are the row's and not the recipe's.
 *
 * `legacyId` is the original sonycolorlab id, kept to generate the cutover
 * redirects. It is never editable — the whole point of retaining it is that it
 * records what a URL used to be.
 */
export type RecipeRecord = {
  recipe: Recipe;
  legacyId: string | null;
  updatedAt: string;
};
