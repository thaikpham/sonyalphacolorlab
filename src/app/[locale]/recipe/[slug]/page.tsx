import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';
import { RecipeGallery } from '@/components/recipe-gallery';
import { RecipePalette } from '@/components/recipe-palette';
import { RecipeStructuredData } from '@/components/structured-data';
import { ClTable, PpTable } from '@/components/settings-table';
import { RecipeCommunitySection } from '@/components/recipe-community-section';
import { RecipeLearnMore } from '@/components/content/reverse-links';
import { TweakPanel } from '@/components/tweak-panel';
import { WbShiftPlane } from '@/components/wb-shift-plane';
import { FormattedWb, WbTable } from '@/components/wb-table';
import { MyCameraWarning } from '@/components/my-camera-warning';
import { Link, permanentRedirect, redirect } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { accentCss } from '@/lib/camera/color';
import { CREATIVE_LOOKS } from '@/lib/camera/constants';
import { getSonyCameras } from '@/lib/cameras/data';
import { cameraOptions, cameraWarnings } from '@/lib/cameras/my-camera';
import { listSlugs } from '@/lib/recipes/source';
import { isPermanentMove } from '@/lib/recipes/slug-aliases';
import { resolveRecipeSlug } from '@/lib/recipes/slug-resolve';
import { recipeTitle } from '@/lib/recipes/title';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const OG_LOCALES: Record<Locale, string> = { en: 'en_US', vi: 'vi_VN' };

/* What the database holds, in whichever spelling it holds it. Any other
   spelling still renders on demand — and redirects, below. */
export async function generateStaticParams() {
  return (await listSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: Locale }>;
}): Promise<Metadata> {
  const { slug: requested, locale } = await params;
  const resolved = await resolveRecipeSlug(requested, locale);
  if (!resolved) return {};
  /* The page redirects a former or not-yet-migrated spelling; the canonical
     is the one it redirects to. */
  const { recipe, slug } = resolved;

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
      // og:locale is language_TERRITORY; scrapers may ignore a bare 'vi'.
      locale: OG_LOCALES[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALES[l]),
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string; locale: Locale }>;
}) {
  const { slug: requested, locale } = await params;
  setRequestLocale(locale);

  const [resolved, t, tBrowse, products] = await Promise.all([
    resolveRecipeSlug(requested, locale),
    getTranslations('recipe'),
    getTranslations('browse'),
    getSonyCameras(),
  ]);
  if (!resolved) notFound();
  const { recipe, slug } = resolved;
  /* A slug the recipe had, or will have once the content migration runs,
     lands on the one the catalogue holds now. Permanent only from a former
     slug to the current one: the reverse is the unmigrated database, and a
     cached 308 that way would loop once the migration turns it round. */
  if (slug !== requested) {
    const to = { href: `/recipe/${slug}`, locale };
    if (isPermanentMove(requested, slug)) permanentRedirect(to);
    redirect(to);
  }

  /* What each camera choice has to say about this recipe, worked out here so
     the page stays prerendered: the cookie is read in the browser, by the
     island, never by this render (ADR 0006). */
  const warnings = cameraWarnings(recipe, cameraOptions(products));

  const accent = accentCss(recipe.accent);
  const title = recipeTitle(recipe.name);
  /* Where this recipe browses: its situations, its style and its tone, each
     a link into the catalogue narrowed to that value. These replaced the tag
     list — tags are provenance ("sri-lanka"), kept in the data for search and
     no longer shown (D9). Not `.label`: "Phong cảnh & thiên nhiên" is four
     words, and uppercase stops at three. */
  const browseChips = [
    ...recipe.situations.map((id) => ({
      key: `situation:${id}`,
      href: `/colorlab/${id}`,
      label: tBrowse(`situations.${id}`),
    })),
    { key: 'style', href: `/colorlab?style=${recipe.style}`, label: tBrowse(`styles.${recipe.style}`) },
    { key: 'tone', href: `/colorlab?tone=${recipe.tone}`, label: tBrowse(`tones.${recipe.tone}`) },
  ];
  const look =
    recipe.format === 'cl' ? CREATIVE_LOOKS.find((l) => l.code === recipe.settings.look) : null;
  const shareUrl = `${SITE_URL}${
    locale === routing.defaultLocale ? '' : `/${locale}`
  }/recipe/${slug}`;

  return (
    <div style={{ '--accent': accent } as React.CSSProperties}>
      <SiteHeader />
      <RecipeStructuredData recipe={recipe} locale={locale} url={shareUrl} />

      <main className="mx-auto w-full max-w-[160rem] flex-1 inset-safe pb-24">
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
            {/* Not uppercase: vi is four words, and uppercase is capped at
                three because Vietnamese diacritics need the ascender room. */}
            <span>{t('back')}</span>
          </Link>
        </nav>

        {/* Full-Bleed 2-Column Grid (Header + Collage Gallery on Left vs WB + Parameters on Right) */}
        {/* Half and half at lg, 7/5 from xl. At 1024px a 5/12 column with
            gap-12 is about 342px inside its card, and ParamRow's fixed 9rem +
            8.5rem tracks left its effect text about 6px — rule 4's collapse. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 xl:gap-12 items-start">
          {/* Left Column: Header Info + Photographic Collage Gallery */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-8">
            {/* Recipe Header & Description */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                {/* The name carries the code now (`PP-048-Soft Clean
                    Portrait`). A row still on the old `SCL-PP-048: Huế Silk`
                    shape — until the library sync reaches production — keeps
                    its code here, since its title drops it. */}
                {recipe.name.includes(': ') && (
                  <span className="chip label text-ink">
                    {recipe.id}
                  </span>
                )}
                {/* The code is uppercase on the camera; the Look's name is not,
                    and in `.label` "BW (Black & White)" ran to four words. */}
                {look && (
                  <span className="chip label bg-accent-900 text-accent-200">
                    CL: {look.code} <span className="normal-case">({look.label})</span>
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

              {/* The reader's camera, when it cannot install this recipe or
                  may not: an accuracy line, one per reason. Empty until the
                  browser has read the cookie, and then usually still empty. */}
              <div className="mt-4 empty:hidden">
                <MyCameraWarning warnings={warnings} />
              </div>

              {/* The recipe's colour, read off its settings: the same nine
                  swatches as its card, named, with the one accuracy line the
                  palette needs (it is not a camera preview). */}
              <div className="mt-6">
                <RecipePalette palette={recipe.palette} tone={recipe.tone} style={recipe.style} variant="page" light={recipe.light} />
              </div>

              {/* Situations, style and tone, each a way back into the catalogue. */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 pt-4">
                <ul className="flex flex-wrap gap-2">
                  {browseChips.map((chip) => (
                    <li key={chip.key}>
                      <Link href={chip.href} className="chip chip-action text-ink">
                        {chip.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Photographic Collage Gallery & User URL Contribution */}
            <RecipeGallery slug={slug} title={title} />

            {/* AI Tweak Section */}
            <TweakPanel
              slug={slug}
              locale={locale}
              format={recipe.format}
              currentWb={recipe.whiteBalance}
              currentSettings={recipe.settings}
            />

            {/* Community Comments, Proposals & Heart Voting */}
            <RecipeCommunitySection
              recipeSlug={slug}
              recipeFormat={recipe.format}
              currentSettings={recipe.settings}
              currentWb={recipe.whiteBalance}
            />
          </div>

          {/* Right Column: White Balance (Top) + Exact Camera Settings Tables */}
          <div className="lg:col-span-6 xl:col-span-5 lg:sticky lg:top-24 flex flex-col gap-6">
            {/* White Balance Core Engine (Top of Parameters Column) */}
            {/* p-5 matches ParamBlock deliberately. This card and the parameter
                tables stack in one column, so a different padding put every WB
                row 4px right of every Picture Profile row below it — one shared
                left edge down the whole column instead. */}
            <section className="surface p-5">
              <div className="flex flex-col gap-4">
                <h2 className="text-title-3 font-semibold text-ink">White Balance Shift</h2>

                {/* The readout sits beside the plane rather than above it: the
                    plane is only 16rem wide and left a dead half-column here.
                    Except while this column is narrow — lg up to 2xl — where the
                    `1fr` beside 16rem was about 62px for a ~190px readout and
                    the page scrolled sideways. */}
                <div className="grid gap-4 sm:grid-cols-[16rem_1fr] lg:grid-cols-1 2xl:grid-cols-[16rem_1fr] sm:items-center sm:gap-6">
                  <WbShiftPlane recipes={[recipe]} />
                  <div className="min-w-0">
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
              {/* An h2 over the tables' h3s; it was an h3 above their h2s. Not
                  `.label`: vi "Cài đặt máy ảnh" is four words. */}
              <h2 className="mb-3 text-label font-semibold text-ink-faint">{t('paramsLabel')}</h2>
              {recipe.format === 'pp' ? (
                <PpTable s={recipe.settings} locale={locale} />
              ) : (
                <ClTable s={recipe.settings} locale={locale} />
              )}
            </div>

            {/* What the rows above mean, and what has been written about this
                recipe — computed from the published pages, never authored
                here (ADR 0002). */}
            <RecipeLearnMore recipeId={recipe.id} format={recipe.format} locale={locale} />
          </div>
        </div>
      </main>
    </div>
  );
}
