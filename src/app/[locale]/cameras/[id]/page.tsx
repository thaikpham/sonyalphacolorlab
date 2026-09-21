import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getSonyCameraById, getSonyCameras } from '@/lib/cameras/data';
import { PRODUCT_KIND_LABEL_KEY, priceLabel, subCategoryLabel } from '@/lib/cameras/display';
import { SiteHeader } from '@/components/site-header';
import { ProductSpecTable } from '@/components/product-spec-table';
import { ProductGalleryViewer } from '@/components/product-gallery-viewer';
import { featureList } from '@/lib/cameras/features';

export async function generateStaticParams() {
  const cameras = await getSonyCameras();
  return routing.locales.flatMap((locale) =>
    cameras.map((camera) => ({
      locale,
      id: camera.id,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'cameras' });
  const camera = await getSonyCameraById(id);
  if (!camera) return { title: t('productNotFound') };

  const pathFor = (l: string) =>
    l === routing.defaultLocale ? `/cameras/${id}` : `/${l}/cameras/${id}`;
  return {
    title: t('productMetaTitle', { name: camera.name, sku: camera.sku }),
    description: t('productMetaDescription', {
      price: priceLabel(camera, t),
      fullName: camera.fullName,
    }),
    alternates: {
      canonical: pathFor(locale),
      languages: Object.fromEntries(routing.locales.map((l) => [l, pathFor(l)])),
    },
    openGraph: {
      title: `${camera.name} — Alpha ColorLab`,
      description: featureList(camera.features, locale).slice(0, 3).join(' · '),
      images: [{ url: camera.imageUrl }],
      locale,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const product = await getSonyCameraById(id);
  if (!product) notFound();

  /* No nested NextIntlClientProvider: the layout already sends `cameras`, and
     a provider given `messages` replaces the inherited set rather than merging
     with it — a subset here silently dropped every other namespace. */
  const t = await getTranslations('cameras');

  /* Product kind is not a signal. `community`, `proposal`, `ai` and `danger`
     name what a piece of content *is*, so borrowing one of them for "lens"
     would make the only classification colours in the ecosystem mean two
     different things. The three kinds separate on steps of the accent ramp
     instead — the same move the ink ramp makes for emphasis — and the fill is
     a tint, never a stroke. Body text on the strongest tint is pure white. */
  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'camera':
        return 'bg-accent-500/25 text-white';
      case 'lens':
        return 'bg-accent-500/15 text-ink';
      case 'accessory':
        return 'bg-white/10 text-ink-muted';
      default:
        return 'bg-white/10 text-ink';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-void text-ink">
      <SiteHeader />

      {/* A product page is a reading layout, not the browse grid. At the
          catalogue's `max-w-[160rem]` every spec row stretched to ~1370px and
          the label/value pair sat a screen apart. */}
      <main className="flex-1 w-full max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col gap-5">
        {/* Top Breadcrumb & Navigation */}
        <div className="flex items-center justify-between gap-4 pb-3">
          <div className="flex items-center gap-2 text-meta text-ink-muted">
            {/* The crumb is labelled "ColorLab", so it goes to ColorLab —
                `/` is the launcher now and would read as a broken trail. */}
            <Link href="/colorlab" className="hover:text-accent-400 transition-colors">
              ColorLab
            </Link>
            <span className="text-ink-faint">/</span>
            <Link href="/cameras" className="hover:text-accent-400 transition-colors">
              {t('title')}
            </Link>
            <span className="text-ink-faint">/</span>
            <span className="text-ink font-semibold">{product.name}</span>
          </div>

          <Link href="/cameras" className="btn-glass inline-flex items-center gap-1.5 shrink-0">
            {t('backToCatalog')}
          </Link>
        </div>

        {/* Hero: photo and identity are one band across the full width, and the
            identity panel is `h-full` with the commerce strip pushed down by
            `mt-auto`. Side by side in a half-width column the price card came
            out 221px tall against a 522px photo and `items-center` split the
            300px difference into dead space above and below it. */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-4 w-full">
            <ProductGalleryViewer
              primaryImageUrl={product.imageUrl}
              galleryUrls={product.galleryUrls}
              productName={product.name}
            />
          </div>

          <div className="surface lg:col-span-8 flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-3 py-1 rounded-sm text-label font-semibold tracking-[0.08em] uppercase ${getCategoryBadgeColor(product.category)}`}
              >
                {t(PRODUCT_KIND_LABEL_KEY[product.category] ?? 'catAll')}
              </span>
              {/* The sub-categories are catalogue data, not our copy, so they
                  are never uppercased: a Vietnamese series name loses its
                  diacritic room, and the strings run past three words. */}
              <span className="px-3 py-1 rounded-sm text-label font-semibold bg-white/10 text-ink">
                {subCategoryLabel(product.subCategory1, t)}
              </span>
              {product.subCategory2 && (
                <span className="px-3 py-1 rounded-sm text-label font-semibold bg-white/10 text-ink-muted">
                  {subCategoryLabel(product.subCategory2, t)}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <h1 className="text-title-1 sm:text-display font-extrabold text-ink tracking-[-0.02em] leading-tight">
                {product.name}
              </h1>
              <p className="text-body sm:text-body-lg text-ink-muted leading-relaxed">
                {product.fullName}
              </p>
            </div>

            {/* The commerce strip is a genuinely separate block from the
                identity above it, so it gets a seam — light fading out at
                both ends — rather than a hairline across the panel.

                `mt-auto` lives on the wrapper, not on the <hr>: `.seam` is
                unlayered CSS and its `margin: 0` beats any margin utility on
                the same element. */}
            <div className="mt-auto flex flex-col gap-4">
              <hr className="seam" />

              <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1.5">
                  <span className="label">{t('skuLabel')}</span>
                  <span className="text-body-sm font-semibold text-ink bg-white/10 px-2.5 py-1 rounded-sm w-fit">
                    {product.sku}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="label">{t('priceLabel')}</span>
                  {/* An emphasised number: accent step 400, the on-dark text
                      step. `tabular-nums` because the price sits in a column
                      with the catalogue's other prices. */}
                  <span className="text-title-2 sm:text-title-1 font-extrabold text-accent-400 leading-none tabular-nums">
                    {priceLabel(product, t)}
                  </span>
                </div>

                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent ml-auto inline-flex items-center cursor-pointer"
                >
                  {t('officialUrl')}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* One column. This was a 7/5 grid with a Reddit community drawer in
            the right half; the drawer is gone, and a 7-of-12 column with five
            empty columns beside it is a layout still holding a shape for
            something that no longer exists. Specs take the full width. */}
        <div className="flex flex-col gap-5">
          {/* Key Features Section */}
          <div className="surface p-5 flex flex-col gap-3">
            {/* h2, not h3: the only heading above this one is the product
                name in the hero, and h1 → h3 is a level skip. */}
            <h2 className="text-title-3 font-semibold text-ink tracking-[-0.02em]">
              {t('featuresLabel')}
            </h2>

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-body-sm text-ink-muted leading-relaxed">
              {featureList(product.features, locale).map((feat: string, idx: number) => (
                <li key={idx} className="row-tint flex items-start gap-2.5 p-3">
                  <span className="text-accent-400 shrink-0 leading-none">•</span>
                  <span className="flex-1">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Scientific Specs Table */}
          {product.specs && <ProductSpecTable specs={product.specs} locale={locale} />}
        </div>
      </main>

      <div className="w-full max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <hr className="seam" />
      </div>

      <footer className="meta w-full py-6 text-center">
        {t('footerCameraRoute', { name: product.name })}
      </footer>
    </div>
  );
}
