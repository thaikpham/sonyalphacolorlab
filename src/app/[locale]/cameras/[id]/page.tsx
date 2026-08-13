import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getSonyCameraById, getSonyCameras } from '@/lib/cameras/data';
import { ProductCommunityDrawer } from '@/components/product-community-drawer';
import { SUBREDDIT_HANDLE } from '@/lib/reddit/config';
import { SiteHeader } from '@/components/site-header';
import { ProductSpecTable } from '@/components/product-spec-table';
import { ProductGalleryViewer } from '@/components/product-gallery-viewer';
import { featureList } from '@/lib/cameras/features';

export async function generateStaticParams() {
  const cameras = await getSonyCameras();
  const locales = ['en', 'vi'];
  return locales.flatMap((locale) =>
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
  const camera = await getSonyCameraById(id);
  if (!camera) return { title: 'Product Not Found' };

  const isVi = locale === 'vi';
  /* The real community, not a per-product handle. An earlier draft advertised
     `r/7iv-sev` in the page title — a plausible-looking address that 404s on
     reddit.com, and one that search engines would have indexed. */
  const handle = SUBREDDIT_HANDLE;
  return {
    title: `${camera.name} (${camera.sku}) · ${isVi ? `Thông số & ${handle}` : `Specs & ${handle}`}`,
    description: isVi
      ? `Thông số kỹ thuật chính hãng, giá niêm yết ${camera.priceFormatted}, tính năng nổi bật và thảo luận ${handle} của ${camera.fullName}.`
      : `Official specs, pricing ${camera.priceFormatted}, key features, and ${handle} discussion for ${camera.fullName}.`,
    openGraph: {
      title: `${camera.name} — Alpha ColorLab · ${handle}`,
      description: featureList(camera.features, locale).slice(0, 3).join(' · '),
      images: [{ url: camera.imageUrl }],
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

  const isVi = locale === 'vi';
  const messages = await getMessages();
  const t = await getTranslations('cameras');

  const clientMessages = {
    auth: messages.auth,
    cameras: messages.cameras,
    community: messages.community,
    language: messages.language,
    nav: messages.nav,
    recipe: messages.recipe,
    search: messages.search,
    tweak: messages.tweak,
  };

  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'camera':
        return 'bg-amber-400/25 text-amber-200 border-amber-400/50 shadow-sm font-extrabold';
      case 'lens':
        return 'bg-sky-400/25 text-sky-200 border-sky-400/50 shadow-sm font-extrabold';
      case 'accessory':
        return 'bg-emerald-400/25 text-emerald-200 border-emerald-400/50 shadow-sm font-extrabold';
      default:
        return 'bg-white/20 text-white border-white/30 font-bold';
    }
  };

  return (
    <NextIntlClientProvider messages={clientMessages}>
      <div className="min-h-screen flex flex-col bg-[#0b0d12] text-white font-sans">
        <SiteHeader />

        {/* A product page is a reading layout, not the browse grid. At the
            catalogue's `max-w-[160rem]` every spec row stretched to ~1370px and
            the label/value pair sat a screen apart. */}
        <main className="flex-1 w-full max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col gap-5">
          {/* Top Breadcrumb & Navigation */}
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-xs text-slate-100 font-mono font-bold">
              {/* The crumb is labelled "ColorLab", so it goes to ColorLab —
                  `/` is the launcher now and would read as a broken trail. */}
              <Link
                href={isVi ? '/vi/colorlab' : '/colorlab'}
                className="hover:text-amber-300 transition-colors"
              >
                ColorLab
              </Link>
              <span>/</span>
              <Link href={isVi ? '/vi/cameras' : '/cameras'} className="hover:text-amber-300 transition-colors">
                {t('title')}
              </Link>
              <span>/</span>
              <span className="text-amber-300 font-bold">{product.name}</span>
            </div>

            <Link
              href={isVi ? '/vi/cameras' : '/cameras'}
              className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 shadow-sm shrink-0"
            >
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

            <div className="lg:col-span-8 flex flex-col gap-4 bg-[#1c1d22] p-5 sm:p-6 rounded-2xl border border-white/15 shadow-lg">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs border ${getCategoryBadgeColor(product.category)}`}>
                  {product.category.toUpperCase()}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/15 text-white border border-white/25 shadow-sm">
                  {product.subCategory1}
                </span>
                {product.subCategory2 && (
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {product.subCategory2}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold text-white tracking-tight font-sans">
                  {product.name}
                </h1>
                <p className="text-sm sm:text-[1rem] text-slate-100 font-semibold font-sans leading-relaxed">
                  {product.fullName}
                </p>
              </div>

              <div className="mt-auto pt-4 border-t border-white/10 flex flex-wrap items-end gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.65rem] font-mono font-extrabold uppercase tracking-wider text-amber-200">
                    {t('skuLabel')}
                  </span>
                  <span className="font-mono text-xs font-extrabold text-amber-300 bg-amber-400/20 px-2.5 py-1 rounded border border-amber-400/40 w-fit">
                    {product.sku}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[0.65rem] font-mono font-extrabold uppercase tracking-wider text-amber-200">
                    {t('priceLabel')}
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-black text-sky-300 drop-shadow-sm leading-none">
                    {product.priceFormatted}
                  </span>
                </div>

                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto py-2.5 px-5 rounded-xl bg-white text-black font-extrabold text-xs text-center hover:bg-white/90 transition-all shadow-md cursor-pointer"
                >
                  {t('officialUrl')}
                </a>
              </div>
            </div>
          </section>

          {/* Dual-Pane Layout: Left specs & features, Right community drawer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Features & Specifications */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* Key Features Section */}
              <div className="bg-[#1c1d22] p-5 rounded-2xl border border-white/15 shadow-lg flex flex-col gap-3">
                <h3 className="font-extrabold text-sm uppercase text-amber-300 font-mono tracking-wider flex items-center gap-2">
                  ⚡ {t('featuresLabel')}
                </h3>

                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-white/95 font-medium leading-relaxed">
                  {featureList(product.features, locale).map((feat: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2.5 bg-black/40 p-3 rounded-xl border border-white/10">
                      <span className="text-emerald-400 font-bold shrink-0 text-[1rem] leading-none">•</span>
                      <span className="flex-1">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Scientific Specs Table */}
              {product.specs && <ProductSpecTable specs={product.specs} locale={locale} />}
            </div>

            {/* Right Column: real topics from the subreddit, bound by product link.
                Height follows the viewport instead of a fixed `42rem`: against a
                1519px left column that magic number left 847px of empty page,
                and a sticky rail that fills the screen never shows the gap. */}
            <div className="lg:col-span-5 h-[36rem] lg:h-[calc(100dvh-7rem)] lg:sticky lg:top-24">
              <ProductCommunityDrawer product={product} />
            </div>
          </div>
        </main>

        <footer className="w-full py-6 text-center text-xs text-white/40 border-t border-white/10 font-mono mt-6">
          Alpha ColorLab · Dedicated Product Route for {product.name}
        </footer>
      </div>
    </NextIntlClientProvider>
  );
}
