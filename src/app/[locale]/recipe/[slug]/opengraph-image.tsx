import { ImageResponse } from 'next/og';
import { accentHex } from '@/lib/camera/color';
import { CREATIVE_LOOKS } from '@/lib/camera/constants';
import type { Locale } from '@/i18n/routing';
import { listSlugs } from '@/lib/recipes/source';
import { resolveRecipeSlug } from '@/lib/recipes/slug-resolve';
import { recipeTitle } from '@/lib/recipes/title';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function generateStaticParams() {
  return (await listSlugs()).map((slug) => ({ slug }));
}

/**
 * The card Facebook, Messenger and Zalo render when someone shares a recipe.
 *
 * Built from the recipe's own data: the accent is derived from its White
 * Balance, the WB value is the headline, because that is what a photographer
 * actually wants to see before opening the link, and the palette — the nine
 * swatches the recipe's card shows — runs along the bottom. No recipe carries
 * a photograph, so this is the picture. Each swatch's `hex` is emitted from
 * the same gamut-mapped value as its on-screen `oklch()`, so the share card
 * and the grid agree. No copy on it: the palette's accuracy line lives on the
 * recipe page, and Satori's default font has no Vietnamese subset.
 *
 * ImageResponse supports a subset of CSS — flexbox only, no `gap` shorthand
 * quirks, and every element with more than one child needs an explicit
 * `display: flex`.
 */
export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string; locale: Locale }>;
}) {
  const { slug, locale } = await params;
  /* Resolved like the page: a card asked for under a former spelling, or
     under the new one before the content migration, still draws the recipe. */
  const recipe = (await resolveRecipeSlug(slug, locale))?.recipe ?? null;

  if (!recipe) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#07080B',
            color: '#F4F5F8',
            fontSize: 56,
          }}
        >
          Alpha ColorLab
        </div>
      ),
      size,
    );
  }

  // Hex, not oklch(): Satori ignores oklch() silently, producing a colourless card.
  const accent = accentHex(recipe.accent);
  const title = recipeTitle(recipe.name);
  /* A row still on the old `SCL-PP-048: Huế Silk` shape shows its code above
     the title, which drops it; the new name carries the code itself. */
  const legacyName = recipe.name.includes(': ');
  const look =
    recipe.format === 'cl' ? CREATIVE_LOOKS.find((l) => l.code === recipe.settings.look) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#07080B',
          // Heavier than the on-screen accent on purpose: this card competes
          // in a social feed at thumbnail size, where the UI's subtle wash
          // disappears entirely.
          backgroundImage: `radial-gradient(1100px 700px at 8% -12%, ${accent}d0, ${accent}00 60%), radial-gradient(820px 620px at 98% 112%, ${accent}a0, ${accent}00 58%)`,
          color: '#F4F5F8',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 6, opacity: 0.65 }}>
            ALPHA · COLORLAB
          </div>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 4, opacity: 0.65 }}>
            {recipe.format === 'cl' ? recipe.settings.look : 'PICTURE PROFILE'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {legacyName && (
            <div style={{ display: 'flex', fontSize: 24, letterSpacing: 5, opacity: 0.6 }}>
              {recipe.id}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 600, marginTop: 12 }}>
            {title}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 46,
              marginTop: 28,
              color: accent,
              letterSpacing: -1,
            }}
          >
            {recipe.wbLabel}
          </div>
          {look && (
            <div style={{ display: 'flex', fontSize: 26, marginTop: 14, opacity: 0.7 }}>
              Creative Look {look.code} · {look.label}
            </div>
          )}
        </div>

        {/* The palette, in the card's order: the neutral ramp, then the six
            hues. No `gap` — Satori's support is partial — and no strokes. */}
        <div style={{ display: 'flex', height: 64, borderRadius: 20, overflow: 'hidden' }}>
          {recipe.palette.map((swatch) => (
            <div key={swatch.id} style={{ display: 'flex', flexGrow: 1, background: swatch.hex }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
