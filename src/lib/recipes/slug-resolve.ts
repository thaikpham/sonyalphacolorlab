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
 * catalogue holds it: the slug itself, else any other spelling it has had
 * (`slugAliases`, newest first). Null when none is a published recipe.
 *
 * This is how the recipe route, its share card and `/api/tweak` work in every
 * state of the content plane. Today it holds `pp-001-vivid-nostalgia-film`,
 * and a link to `pp-001` (a card on a migrated page, the `?id=` map) or to
 * `mojave-sun` (a link shared years ago) finds it; after 20261028000000 it
 * holds `pp-001`, and both older spellings find that. The slug asked for is
 * tried first, so a slug the catalogue holds costs one read, and `getRecipe`
 * is cached per request and per catalogue tag either way.
 */
export async function resolveRecipeSlug(slug: string, locale: Locale): Promise<ResolvedRecipe | null> {
  for (const candidate of slugAliases(slug)) {
    const recipe = await getRecipe(candidate, locale);
    if (recipe) return { recipe, slug: recipe.slug };
  }
  return null;
}
