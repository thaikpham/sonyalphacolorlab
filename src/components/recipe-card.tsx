import { Link } from '@/i18n/navigation';
import { accentCss } from '@/lib/camera/color';
import type { RecipeView } from '@/lib/recipes/source';
import type { SituationId } from '@/lib/recipes/taxonomy';
import { recipeTitle } from '@/lib/recipes/title';
import { RecipeColorField } from './recipe-color-field';
import { RecipePhoto } from './recipe-photo';

/**
 * Grid card: a 210px photograph, then the recipe's identity underneath.
 *
 * The photograph no longer carries the text. Type over an arbitrary frame is
 * the one contrast the system cannot guarantee — every scrim strong enough to
 * fix it also hid the picture — so the format, the name and the situations sit
 * on the card's own surface, where `ink` / `ink-faint` mean what they say.
 *
 * Three lines and no more (D10, Q4). The format is a plain `.label` in
 * `ink-faint` — it used to borrow `community` cyan and `proposal` violet, and
 * a signal colour classifies content, never decorates a format. The parameter
 * chips and the tag line are gone: the dials are on the recipe page, where
 * they have room to be explained, and the tags were provenance ("sri-lanka"),
 * not purpose. The name drops its `SCL-xx-000:` code on the card only; the
 * recipe page still shows the code in its own chip.
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
  const kind = recipe.format === 'pp' ? 'Picture Profile' : 'Creative Look';
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
      <div className="relative h-[210px] w-full overflow-hidden">
        {recipe.images.length > 0 ? (
          /* Falls back to the same field on its own if the photograph does not
             arrive — Storage answers `402` for the whole catalogue while the
             project's egress quota is spent, and a grid of broken-image boxes
             reads as a broken site. */
          <RecipePhoto
            src={recipe.images[0]}
            alt={recipe.name}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 2100px) 25vw, 20vw"
            accent={accent}
          />
        ) : (
          /* Only a minority of the catalogue is photographed. The rest show
             the field this recipe's own colour science produces, which is
             information, not a placeholder. */
          <RecipeColorField accent={accent} />
        )}
      </div>

      <div className="flex flex-col gap-2 px-5 pt-[19px] pb-[22px]">
        <span className="label">{kind}</span>

        <h3 className="text-title-3 font-semibold leading-tight text-ink">{recipeTitle(recipe.name)}</h3>

        {situations ? <p className="meta line-clamp-1">{situations}</p> : null}
      </div>
    </Link>
  );
}
