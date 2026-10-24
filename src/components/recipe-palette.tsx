import { getTranslations } from 'next-intl/server';
import type { Palette, Swatch, SwatchId } from '@/lib/camera/palette';
import type { StyleId, ToneId } from '@/lib/recipes/taxonomy';

/**
 * A recipe's palette: the nine swatches `paletteFor` grades from its own
 * settings, laid out the same way everywhere so a column means the same thing
 * on every card.
 *
 * Left, the neutral ramp stacked highlight / mid / shadow — where tone, black
 * level, knee and the white-balance cast read without a hue in the way. Right,
 * six vertical bars in hue order — red, skin, yellow, foliage, sky, blossom —
 * where saturation, Color Depth and Color Phase show. No gaps and no strokes:
 * adjacency is the divider (CLAUDE.md rule 4), and the card's radius clips it.
 *
 * Nothing is written on the swatches. Type over an arbitrary colour is the one
 * contrast the system cannot guarantee, so the card's text stays on the card's
 * own surface below, and the page's swatch names sit under the strip.
 *
 * It is a reading of the settings, never a preview of what the camera records
 * (`palette.ts`), which is why the page carries one accuracy line under it.
 */

const RAMP: readonly SwatchId[] = ['highlight', 'mid', 'shadow'];
const BARS: readonly SwatchId[] = ['red', 'skin', 'yellow', 'foliage', 'sky', 'blossom'];

const byId = (palette: Palette): Record<SwatchId, Swatch> =>
  Object.fromEntries(palette.map((s) => [s.id, s])) as Record<SwatchId, Swatch>;

export async function RecipePalette({
  palette,
  tone,
  style,
  variant,
  light = null,
}: {
  palette: Palette;
  tone: ToneId;
  style: StyleId;
  variant: 'card' | 'page';
  /** Kelvin the palette was read under, when it is not daylight (`RecipeView.light`). */
  light?: number | null;
}) {
  const [t, tBrowse] = await Promise.all([getTranslations('palette'), getTranslations('browse')]);
  const swatch = byId(palette);
  const label = t('label', { tone: tBrowse(`tones.${tone}`), style: tBrowse(`styles.${style}`) });

  const grid = (
    <div
      role="img"
      aria-label={label}
      className={`grid w-full grid-cols-[1fr_3fr] ${variant === 'card' ? 'h-full' : 'h-40 sm:h-48'}`}
    >
      <div className="grid grid-rows-3">
        {RAMP.map((id) => (
          <span key={id} style={{ background: swatch[id].css }} />
        ))}
      </div>
      <div className="grid grid-cols-6">
        {BARS.map((id) => (
          <span key={id} style={{ background: swatch[id].css }} />
        ))}
      </div>
    </div>
  );

  if (variant === 'card') return grid;

  return (
    <figure className="flex flex-col gap-3">
      {/* Radius on a plain wrapper: a `.surface` here would make `rounded-*`
          dead, and the strip needs no elevation — it is the content. */}
      <div className="overflow-hidden rounded-[var(--radius-lg)]">{grid}</div>
      <figcaption className="flex flex-col gap-2">
        {/* The ramp's names stack the way its swatches do — highlight, mid,
            shadow — so on a phone a name never runs into the first hue's. The
            hue names are one short word each in both locales (Leaf, Pink), so
            they fit a phone's ~42px column at the 13px floor. */}
        <ul className="grid grid-cols-[1fr_3fr]">
          <li className="flex flex-col">
            {RAMP.map((id) => (
              <span key={id} className="meta truncate">
                {t(`swatches.${id}`)}
              </span>
            ))}
          </li>
          <li className="grid grid-cols-6 content-start">
            {BARS.map((id) => (
              <span key={id} className="meta truncate">
                {t(`swatches.${id}`)}
              </span>
            ))}
          </li>
        </ul>
        <p className="meta">{t('note')}</p>
        {/* Also an accuracy line: a night or tungsten recipe is read under the
            light it was built for, and the palette would mislead without it. */}
        {light ? <p className="meta">{t('light', { kelvin: light })}</p> : null}
      </figcaption>
    </figure>
  );
}
