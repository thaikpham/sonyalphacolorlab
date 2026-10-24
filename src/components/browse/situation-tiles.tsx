import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { accentCss } from '@/lib/camera/color';
import { colorlabPath, visibleSituations } from '@/lib/recipes/browse';
import type { RecipeView } from '@/lib/recipes/source';

/** How many recipe colours a tile's band shows. */
const BAND_SWATCHES = 8;

/**
 * The landing grid: one tile per situation with enough recipes to be worth a
 * page (`MIN_SITUATION_RECIPES`).
 *
 * A tile is a name, a count and a band of the colours its recipes produce —
 * never a photograph. The owner's rule (D3): a photograph says what one person
 * shot, not what the recipes are for, and the band is each recipe's own colour
 * science (`accentFor`), so it is information rather than decoration. One
 * stripe per recipe, the first eight, in catalogue order.
 */
export async function SituationTiles({ recipes }: { recipes: readonly RecipeView[] }) {
  const [t, tHome] = await Promise.all([getTranslations('browse'), getTranslations('home')]);
  const visible = visibleSituations(recipes);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="browse-by-situation" className="flex flex-col gap-4">
      <h2 id="browse-by-situation" className="text-title-3 font-semibold text-ink">
        {t('bySituation')}
      </h2>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {visible.map((id) => {
          const own = recipes.filter((r) => r.situations.includes(id));
          return (
            <li key={id}>
              <Link
                href={colorlabPath(id)}
                className="surface block overflow-hidden transition-transform duration-200 ease-out hover:-translate-y-1"
              >
                <div aria-hidden className="flex h-16 w-full">
                  {own.slice(0, BAND_SWATCHES).map((r) => (
                    <span key={r.id} className="flex-1" style={{ background: accentCss(r.accent) }} />
                  ))}
                </div>
                <div className="flex flex-col gap-1 px-4 pt-3 pb-4">
                  <h3 className="text-body font-semibold leading-tight text-ink text-pretty">{t(`situations.${id}`)}</h3>
                  <p className="meta tabular-nums">{tHome('resultCount', { count: own.length })}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
