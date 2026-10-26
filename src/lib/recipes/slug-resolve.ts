import 'server-only';
import { getRecipe, type Locale, type RecipeView } from './source';
import { slugAliases } from './slug-aliases';

export type ResolvedRecipe = {
  readonly recipe: RecipeView;
  /** The slug the catalogue holds the recipe under — what a link should say. */
  readonly slug: string;
};

/**
 * The published recipe a requested slug means, under whichever spelling the
 * catalogue holds it: the slug itself, else its former or its current
 * spelling (`slugAliases`). Null when none is a published recipe.
 *
 * This is how the recipe route and its share card work in both states of the
 * content plane. Before its migration it holds `mojave-sun`, and a link to
 * `pp-001-vivid-nostalgia-film` (a card on a migrated page, the `?id=` map)
 * finds it through the reverse direction; after, the reverse. The slug asked
 * for is tried first, so a slug the catalogue holds costs one read, and
 * `getRecipe` is cached per request and per catalogue tag either way.
 */
export async function resolveRecipeSlug(slug: string, locale: Locale): Promise<ResolvedRecipe | null> {
  for (const candidate of slugAliases(slug)) {
    const recipe = await getRecipe(candidate, locale);
    if (recipe) return { recipe, slug: recipe.slug };
  }
  return null;
}
