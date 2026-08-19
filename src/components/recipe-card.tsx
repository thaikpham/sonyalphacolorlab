import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { accentCss } from '@/lib/camera/color';
import type { RecipeView } from '@/lib/recipes/source';
import { recipeChips } from '@/lib/recipes/chips';

/**
 * Grid card: a 210px photograph, then the recipe's identity underneath.
 *
 * The photograph no longer carries the text. Type over an arbitrary frame is
 * the one contrast the system cannot guarantee — every scrim strong enough to
 * fix it also hid the picture — so the name, the chips and the tags sit on the
 * card's own surface, where `ink` / `ink-faint` mean what they say.
 *
 * `.surface` is the whole elevation: white 5% film, blur 30, elevation 1 and
 * the 1px specular highlight that stands in for the border. It is unlayered
 * CSS, so `bg-*`, `rounded-*` and `shadow-*` on this element would be silently
 * dead — the radius, fill and shadow all come from the class, deliberately.
 */
export function RecipeCard({ recipe }: { recipe: RecipeView }) {
  const accent = accentCss(recipe.accent);

  /* The two formats are mutually exclusive on the camera (rule 2), so the
     format is what a reader sorts by first — it gets a signal colour, and the
     two names stay in English because they are Sony menu items, not copy
     (rule 3, same as `structured-data.tsx`). */
  const isPp = recipe.format === 'pp';
  const kind = isPp ? 'Picture Profile' : 'Creative Look';
  const chips = recipeChips(recipe);

  return (
    <Link
      href={`/recipe/${recipe.slug}`}
      prefetch={true}
      className="surface block overflow-hidden transition-transform duration-200 ease-out hover:-translate-y-1"
      /* Scopes ::selection inside the card to this recipe's own colour. */
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <div className="relative h-[210px] w-full overflow-hidden">
        {recipe.images.length > 0 ? (
          <Image
            src={recipe.images[0]}
            alt={recipe.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 2100px) 25vw, 20vw"
            className="object-cover"
          />
        ) : (
          /* Only a minority of the catalogue is photographed. The rest show
             the field this recipe's own colour science produces, which is
             information, not a placeholder. */
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(120% 90% at 22% 12%, color-mix(in oklch, ${accent} 42%, transparent), transparent 60%),
                radial-gradient(90% 80% at 85% 88%, color-mix(in oklch, ${accent} 22%, transparent), transparent 65%),
                oklch(18% 0.02 265)`,
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-[11px] px-5 pt-[19px] pb-[22px]">
        <span
          className={`text-label font-semibold uppercase tracking-[0.08em] ${
            isPp ? 'text-proposal' : 'text-community'
          }`}
        >
          {kind}
        </span>

        <h3 className="text-title-3 font-semibold leading-tight text-ink">{recipe.name}</h3>

        <div className="flex flex-wrap gap-[7px] text-label font-medium text-ink">
          {chips.map((chip) => (
            <span
              key={chip.slot}
              className="rounded-sm bg-white/8 px-[11px] py-1.5 shadow-[var(--elevation-spec)]"
            >
              {chip.value}
            </span>
          ))}
        </div>

        {/* Every tag, in the seed's own order. Some recipes carry nine of
            them, so it is clamped rather than truncated in the data — two
            lines is the card's rhythm, and the recipe page lists them all. */}
        <p className="meta line-clamp-2">{recipe.tags.join(' · ')}</p>
      </div>
    </Link>
  );
}
