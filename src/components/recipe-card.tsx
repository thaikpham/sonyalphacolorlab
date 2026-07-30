import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { accentCss } from '@/lib/camera/color';
import { CREATIVE_LOOKS } from '@/lib/camera/constants';
import { FormattedWb } from './wb-table';
import type { RecipeView } from '@/lib/recipes/source';

const lookLabel = (code: string) => CREATIVE_LOOKS.find((l) => l.code === code)?.label ?? code;

/**
 * Grid card. Name and White Balance sit bottom-left over the photograph.
 * Direct link to the recipe detail page.
 */
export function RecipeCard({ recipe }: { recipe: RecipeView }) {
  const accent = accentCss(recipe.accent);
  const title = recipe.name.split(': ').slice(1).join(': ') || recipe.name;

  return (
    <Link
      href={`/recipe/${recipe.slug}`}
      className="group relative block overflow-hidden rounded-[var(--radius-glass)] focus-visible:outline-2 transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-[1.02] shadow-md hover:shadow-[0_16px_45px_-12px_rgba(0,0,0,0.85)] cursor-pointer"
      style={{ '--accent': accent } as React.CSSProperties}
    >
      {/* Accent Glow Backdrop on Hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-2 rounded-[var(--radius-glass)] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl z-0"
        style={{
          background: `radial-gradient(circle at 50% 100%, color-mix(in oklch, ${accent} 40%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative aspect-[4/5] w-full overflow-hidden z-10">
        {recipe.images.length > 0 ? (
          <Image
            src={recipe.images[0]}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 2100px) 25vw, 20vw"
            className="object-cover transition-all duration-500 ease-out group-hover:scale-108 group-hover:brightness-105"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-108"
            style={{
              background: `
                radial-gradient(120% 90% at 22% 12%, color-mix(in oklch, ${accent} 42%, transparent), transparent 60%),
                radial-gradient(90% 80% at 85% 88%, color-mix(in oklch, ${accent} 22%, transparent), transparent 65%),
                oklch(18% 0.02 265)`,
            }}
          />
        )}

        {/* Scrim: guarantees contrast for the overlay text */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-3/5 transition-opacity duration-300 group-hover:opacity-95"
          style={{
            background:
              'linear-gradient(to top, oklch(8% 0.01 265 / 0.95), oklch(8% 0.01 265 / 0.6) 45%, transparent)',
          }}
        />

        {/* Format marker badge (top-right) */}
        <span className="eyebrow absolute right-3 top-3 rounded-full px-2.5 py-1 glass-flat !text-ink-muted transition-all duration-300 group-hover:bg-white group-hover:!text-void group-hover:font-bold group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(255,255,255,0.4)]">
          {recipe.format === 'cl' ? recipe.settings.look : 'PP'}
        </span>

        {/* Overlay: name + WB */}
        <div className="absolute inset-x-0 bottom-0 p-4 text-left flex flex-col justify-end transition-transform duration-300">
          <p className="eyebrow !text-ink-faint transition-colors duration-300 group-hover:text-ink-muted">
            {recipe.id}
          </p>

          <h3 className="mt-1 text-[0.975rem] font-semibold leading-tight text-ink transition-all duration-300 group-hover:translate-x-1 group-hover:text-white">
            {title}
          </h3>

          <div className="mt-1.5 transition-all duration-300 group-hover:translate-x-1">
            <FormattedWb wb={recipe.whiteBalance} className="text-xs" />
          </div>

          {recipe.format === 'cl' && (
            <p className="eyebrow mt-1 transition-all duration-300 group-hover:translate-x-1 group-hover:text-ink">
              {lookLabel(recipe.settings.look)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
