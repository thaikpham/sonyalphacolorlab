import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';
import { RecipeGallery } from '@/components/recipe-gallery';
import { RecipeStructuredData } from '@/components/structured-data';
import { ClTable, PpTable } from '@/components/settings-table';
import { RecipeCommunitySection } from '@/components/recipe-community-section';
import { TweakPanel } from '@/components/tweak-panel';
import { WbShiftPlane } from '@/components/wb-shift-plane';
import { FormattedWb, WbTable } from '@/components/wb-table';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { accentCss } from '@/lib/camera/color';
import { CREATIVE_LOOKS } from '@/lib/camera/constants';
import { getRecipe, listSlugs } from '@/lib/recipes/source';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export async function generateStaticParams() {
  return (await listSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: Locale }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const recipe = await getRecipe(slug, locale);
  if (!recipe) return {};

  const path = locale === routing.defaultLocale ? `/recipe/${slug}` : `/${locale}/recipe/${slug}`;

  return {
    title: recipe.name,
    description: recipe.description,
    alternates: {
      canonical: path,
      // Tells search engines the two locales are the same recipe, not
      // duplicate content.
      languages: Object.fromEntries(
        routing.locales.map((l) => [
          l,
          l === routing.defaultLocale ? `/recipe/${slug}` : `/${l}/recipe/${slug}`,
        ]),
      ),
    },
    openGraph: {
      type: 'article',
      title: recipe.name,
      description: recipe.description,
      url: path,
      siteName: 'Alpha ColorLab',
      locale,
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string; locale: Locale }>;
}) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  const [recipe, t] = await Promise.all([getRecipe(slug, locale), getTranslations('recipe')]);
  if (!recipe) notFound();

  const accent = accentCss(recipe.accent);
  const title = recipe.name.split(': ').slice(1).join(': ') || recipe.name;
  const look =
    recipe.format === 'cl' ? CREATIVE_LOOKS.find((l) => l.code === recipe.settings.look) : null;
  const shareUrl = `${SITE_URL}${
    locale === routing.defaultLocale ? '' : `/${locale}`
  }/recipe/${slug}`;

  return (
    <div style={{ '--accent': accent } as React.CSSProperties}>
      <SiteHeader />
      <RecipeStructuredData recipe={recipe} locale={locale} url={shareUrl} />

      <main className="mx-auto w-full max-w-[160rem] flex-1 inset-safe pb-24 px-4 sm:px-8 lg:px-12">
        {/* Top Back Navigation */}
        <nav className="py-6">
          {/* Back to the catalogue this recipe belongs to, not the launcher. */}
          <Link
            href="/colorlab"
            className="btn-glass group gap-2.5 px-4 text-label cursor-pointer"
          >
            {/* 4-Square 2x2 Grid Icon */}
            <svg
              className="w-3.5 h-3.5 fill-current shrink-0 opacity-80 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" />
              <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" />
              <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" />
              <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" />
            </svg>
            <span className="uppercase tracking-wider">{t('back')}</span>
          </Link>
        </nav>

        {/* Full-Bleed 2-Column Grid (Header + Collage Gallery on Left vs WB + Parameters on Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column (Lg 7/12): Header Info + Photographic Collage Gallery */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            {/* Recipe Header & Description */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="chip label text-ink">
                  {recipe.id}
                </span>
                {look && (
                  <span className="chip label bg-accent-900 text-accent-200">
                    CL: {look.code} ({look.label})
                  </span>
                )}
                {recipe.format === 'pp' && (
                  <span className="chip label bg-accent-900 text-accent-200">
                    PICTURE PROFILE
                  </span>
                )}
              </div>

              <h1 className="text-title-1 sm:text-display font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">
                {title}
              </h1>

              <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-muted text-body sm:text-body-lg">
                {recipe.description}
              </p>

              {/* Recipe Tags & Share Actions */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 pt-4">
                {recipe.tags.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {recipe.tags.map((tag) => (
                      <li key={tag}>
                        <Link
                          href={`/?tag=${tag}`}
                          className="chip chip-action label"
                        >
                          #{tag}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Photographic Collage Gallery & User URL Contribution */}
            <RecipeGallery slug={slug} images={recipe.images} title={title} />

            {/* AI Tweak Section */}
            <TweakPanel
              slug={slug}
              locale={locale}
              currentWb={recipe.whiteBalance}
              currentSettings={recipe.settings}
            />

            {/* Community Comments, Proposals & Heart Voting */}
            <RecipeCommunitySection
              recipeSlug={slug}
              recipeTitle={title}
              recipeFormat={recipe.format}
              currentSettings={recipe.settings}
              currentWb={recipe.whiteBalance}
            />
          </div>

          {/* Right Column (Lg 5/12): White Balance (Top) + Exact Camera Settings Tables */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 flex flex-col gap-6">
            {/* White Balance Core Engine (Top of Parameters Column) */}
            {/* p-5 matches ParamBlock deliberately. This card and the parameter
                tables stack in one column, so a different padding put every WB
                row 4px right of every Picture Profile row below it — one shared
                left edge down the whole column instead. */}
            <section className="surface p-5">
              <div className="flex flex-col gap-4">
                <div>
                  <span className="label">{t('wbEngineLabel')}</span>
                  <h2 className="text-title-3 font-semibold text-ink mt-0.5">
                    White Balance Shift
                  </h2>
                </div>

                {/* The readout sits beside the plane rather than above it: the
                    plane is only 16rem wide and left a dead half-column here. */}
                <div className="grid gap-4 sm:grid-cols-[16rem_1fr] sm:items-center sm:gap-6">
                  <WbShiftPlane recipes={[recipe]} caption={false} />
                  <div>
                    <FormattedWb wb={recipe.whiteBalance} className="text-title-2 font-extrabold" />
                  </div>
                </div>

                {/* Full width, so its three columns line up with the parameter
                    tables below instead of being crushed into a side column. */}
                <WbTable wb={recipe.whiteBalance} locale={locale} />
              </div>
            </section>

            {/* Camera Parameters Setup Table */}
            <div>
              <h3 className="label mb-3">{t('paramsLabel')}</h3>
              {recipe.format === 'pp' ? (
                <PpTable s={recipe.settings} locale={locale} />
              ) : (
                <ClTable s={recipe.settings} locale={locale} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
