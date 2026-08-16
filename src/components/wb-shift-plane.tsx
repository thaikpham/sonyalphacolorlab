import { getTranslations } from 'next-intl/server';
import { accentCss, shiftPosition } from '@/lib/camera/color';
import type { RecipeView } from '@/lib/recipes/source';

/**
 * The collection plotted on the camera's own White Balance Shift grid.
 *
 * Axes match what the camera shows: B←→A horizontally, G←→M vertically, seven
 * steps out from neutral in each direction. Every recipe is one mark, coloured
 * by its own accent, so the shape of the collection is legible at a glance —
 * this set leans amber, and you can see that without reading a single number.
 *
 * Not decoration: the position of every mark is the recipe's real shift value.
 */
export async function WbShiftPlane({
  recipes,
  caption = true,
}: {
  recipes: RecipeView[];
  /** Off when the plane shows a single recipe, where a tally says nothing. */
  caption?: boolean;
}) {
  const t = await getTranslations('home');
  const size = 200;
  const half = size / 2;
  const pad = 14;
  const reach = half - pad;

  const marks = recipes.map((r) => {
    const { x, y } = shiftPosition(r.whiteBalance);
    return {
      id: r.id,
      cx: half + x * reach,
      // +y is magenta, which sits at the bottom of the camera's grid.
      cy: half + y * reach,
      fill: accentCss(r.accent),
      neutral: x === 0 && y === 0,
    };
  });

  const shifted = marks.filter((m) => !m.neutral).length;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-auto max-w-[16rem]"
        role="img"
        aria-label={`White Balance Shift grid showing ${recipes.length} recipes, ${shifted} of them shifted away from neutral`}
      >
        {/* Step rings, every 2 steps of the 7-step axis. */}
        {[2, 4, 6].map((step) => (
          <rect
            key={step}
            x={half - (reach * step) / 7}
            y={half - (reach * step) / 7}
            width={(reach * step * 2) / 7}
            height={(reach * step * 2) / 7}
            fill="none"
            stroke="oklch(100% 0 0 / 0.05)"
            strokeWidth="1"
          />
        ))}

        {/* Axes */}
        <line x1={pad} y1={half} x2={size - pad} y2={half} stroke="oklch(100% 0 0 / 0.12)" strokeWidth="1" />
        <line x1={half} y1={pad} x2={half} y2={size - pad} stroke="oklch(100% 0 0 / 0.12)" strokeWidth="1" />

        {/* Axis letters, in the camera's own orientation. */}
        <g fill="oklch(54% 0.016 265)" fontSize="9" fontFamily="var(--font-sans)" letterSpacing="0.1em">
          <text x={half} y={9} textAnchor="middle">G</text>
          <text x={half} y={size - 2} textAnchor="middle">M</text>
          <text x={3} y={half + 3}>B</text>
          <text x={size - 8} y={half + 3}>A</text>
        </g>

        {marks.map((m) => (
          <circle
            key={m.id}
            cx={m.cx}
            cy={m.cy}
            r={m.neutral ? 1.6 : 2.6}
            fill={m.neutral ? 'oklch(54% 0.016 265)' : m.fill}
            opacity={m.neutral ? 0.5 : 0.85}
          />
        ))}
      </svg>
      {caption && (
        <figcaption className="label mt-3">
          {t('planeCaption', { count: recipes.length, shifted })}
        </figcaption>
      )}
    </figure>
  );
}
