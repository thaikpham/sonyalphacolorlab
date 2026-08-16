import { signed } from '@/lib/camera/format';
import type { RecipeView } from '@/lib/recipes/source';

/** One chip on a recipe card: which dial it reports, and what that dial reads. */
export type RecipeChip = { readonly slot: string; readonly value: string };

/**
 * The three chips on a recipe card: what the camera is set to, and what the
 * white balance is. Nothing derived, nothing invented.
 *
 * Each chip carries a SLOT, and the slot — never the value — is its React key.
 * Two dials are allowed to read the same thing: `S-Cinetone` is a legal value of
 * both `PP_GAMMA` and `PP_COLOR_MODE`, and 9 of the catalogue's 46 Picture
 * Profile recipes set both to it. Keyed by value those two chips collided, and
 * React resolves a duplicate key by dropping one — so those nine cards rendered
 * two chips instead of three and lost the Color Mode. It warns in development
 * and says nothing in production: nothing threw, nothing failed a build, and the
 * gallery just told the reader less than it knew.
 *
 * Showing the same value twice is not the bug. Both dials really are on
 * S-Cinetone, and saying so is what the card is for.
 *
 * This lives in `lib/` rather than beside the card because it is pure data
 * mapping, and because importing the component pulls `next/navigation` in
 * through the i18n `Link` — which does not resolve in the test environment, so
 * the rule could not be tested where it was written.
 */
export function recipeChips(recipe: RecipeView): readonly RecipeChip[] {
  return recipe.format === 'pp'
    ? [
        { slot: 'gamma', value: recipe.settings.gamma },
        { slot: 'colorMode', value: recipe.settings.colorMode },
        { slot: 'wb', value: recipe.wbLabel },
      ]
    : [
        { slot: 'look', value: recipe.settings.look },
        { slot: 'contrast', value: `Contrast ${signed(recipe.settings.contrast)}` },
        { slot: 'wb', value: `WB ${recipe.wbLabel}` },
      ];
}
