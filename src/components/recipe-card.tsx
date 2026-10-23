import { Link } from '@/i18n/navigation';
import { accentCss } from '@/lib/camera/color';
import { FORMAT_LABELS } from '@/lib/camera/constants';
import type { RecipeView } from '@/lib/recipes/source';
import type { SituationId } from '@/lib/recipes/taxonomy';
import { recipeTitle } from '@/lib/recipes/title';
import { RecipePalette } from './recipe-palette';

/**
 * Grid card: the recipe's palette in a 210px slot, then its identity
 * underneath. No recipe carries a photograph — pictures come only from
 * readers, on the recipe page — so the thumbnail is the nine swatches its own
 * settings grade (`paletteFor`), the same layout on every card so a column
 * means the same thing across the grid.
 *
 * The format, the name and the situations sit on the card's own surface,
 * where `ink` / `ink-faint` mean what they say.
 *
 * Three lines and no more (D10, Q4). The format is a plain `.label` in
 * `ink-faint` — it used to borrow `community` cyan and `proposal` violet, and
 * a signal colour classifies content, never decorates a format. The parameter
 * chips and the tag line are gone: the dials are on the recipe page, where
 * they have room to be explained, and the tags were provenance ("sri-lanka"),
 * not purpose. The name is the recipe's code and mood (`PP-048-Soft Clean
 * Portrait`); a row still on its old `SCL-PP-048: Huế Silk` shape until the
 * library sync runs shows its title without the code.
 *
 * `.surface` is the whole elevation: white 5% film, blur 30, elevation 1 and
 * the 1px specular highlight that stands in for the border. It is unlayered
 * CSS, so `bg-*`, `rounded-*` and `shadow-*` on this element would be silently
 * dead — the radius, fill and shadow all come from the class, deliberately.
 */
export function RecipeCard({
  recipe,
  situationLabels,
}: {
  recipe: RecipeView;
  /** `browse.situations.*` in the reader's locale, resolved once by the page. */
  situationLabels: Readonly<Record<SituationId, string>>;
}) {
  const accent = accentCss(recipe.accent);

  /* The two formats are mutually exclusive on the camera (rule 2), and the two
     names stay in English because they are Sony menu items, not copy (rule 3,
     same as `structured-data.tsx`). */
  const kind = FORMAT_LABELS[recipe.format];
  const situations = recipe.situations.map((s) => situationLabels[s]).join(' · ');

  return (
    /* No `prefetch={true}`. The recipe route renders on demand, so an eager
       prefetch is not a cheap cache warm — it is a full server render, and each
       one costs its own round trip to Supabase. The list page renders a card
       per recipe, so one visit to /colorlab fanned out into a server render of
       every recipe page in the catalogue, for pages the reader never opened.
       That is what put 5,373 requests a day on /rest/v1/recipes, ~95% of them
       for nobody. Link's default (auto) prefetches only the loading boundary of
       a dynamic route, which is the behaviour this wanted all along. */
    <Link
      href={`/recipe/${recipe.slug}`}
      className="surface block overflow-hidden transition-transform duration-200 ease-out hover:-translate-y-1"
      /* Scopes ::selection inside the card to this recipe's own colour. */
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <div className="h-[210px] w-full overflow-hidden">
        <RecipePalette palette={recipe.palette} tone={recipe.tone} style={recipe.style} variant="card" />
      </div>

      <div className="flex flex-col gap-2 px-5 pt-[19px] pb-[22px]">
        <span className="label">{kind}</span>

        <h3 className="text-title-3 font-semibold leading-tight text-ink">{recipeTitle(recipe.name)}</h3>

        {situations ? <p className="meta line-clamp-1">{situations}</p> : null}
      </div>
    </Link>
  );
}
