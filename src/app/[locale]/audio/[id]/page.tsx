import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSonyAudio, getSonyAudioById } from '@/lib/audio/data';
import { ProductSpecTable } from '@/components/product-spec-table';
import { SiteHeader } from '@/components/site-header';
import { featureList } from '@/lib/cameras/features';

export async function generateStaticParams() {
  const products = await getSonyAudio();
  return ['en', 'vi'].flatMap((locale) => products.map((p) => ({ locale, id: p.id })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const product = await getSonyAudioById(id);
  if (!product) return { title: 'Product Not Found' };

  const isVi = locale === 'vi';
  return {
    title: `${product.name} · ${isVi ? 'Thông số & Giá' : 'Specs & Price'}`,
    description: isVi
      ? `Thông số kỹ thuật và giá niêm yết ${product.priceFormatted} của ${product.fullName}.`
      : `Specifications and listed price ${product.priceFormatted} for ${product.fullName}.`,
    /* No `openGraph.images`: the FY26 sheets ship no product photography, and
       an OG card pointing at a URL that does not exist renders as a broken
       preview everywhere the link is shared. */
  };
}

export default async function AudioProductPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const product = await getSonyAudioById(id);
  if (!product) notFound();

  const isVi = locale === 'vi';
  const t = await getTranslations('cameras');
  const audioHref = isVi ? '/vi/audio' : '/audio';

  return (
    <div className="min-h-screen flex flex-col bg-void text-ink">
      <SiteHeader />

      {/* A reading layout, like the camera product route — not the browse grid. */}
      <main className="flex-1 w-full max-w-[86rem] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 pb-3">
          <div className="flex items-center gap-2 text-meta text-ink-muted">
            <Link href={isVi ? '/vi/colorlab' : '/colorlab'} className="hover:text-accent-400 transition-colors">
              ColorLab
            </Link>
            <span className="text-ink-faint">/</span>
            <Link href={audioHref} className="hover:text-accent-400 transition-colors">
              {t('audioTitle')}
            </Link>
            <span className="text-ink-faint">/</span>
            <span className="text-ink font-semibold">{product.name}</span>
          </div>

          <Link href={audioHref} className="btn-glass inline-flex items-center gap-1.5 shrink-0">
            {t('backToCatalog')}
          </Link>
        </div>

        {/* No photo column here. The camera route leads with a product shot;
            these sheets publish none, and a full-width empty white panel reads
            as an image that failed to load rather than as one that was never
            published. The identity panel takes the full width instead. */}
        <section className="surface flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-2 flex-wrap">
            {/* The product kind reads as an accent tint, not a hue of its own:
                the signal colours name what a piece of content *is*, and one
                of them spent on "headphones" stops classifying anything. */}
            <span className="px-3 py-1 rounded-sm text-label font-semibold tracking-[0.08em] uppercase bg-accent-500/25 text-white">
              {t('catAudio')}
            </span>
            {/* Catalogue data, so never uppercased — the series names run past
                three words and Vietnamese diacritics need the ascender room. */}
            <span className="px-3 py-1 rounded-sm text-label font-semibold bg-white/10 text-ink">
              {product.subCategory1}
            </span>
            {product.subCategory2 && (
              <span className="px-3 py-1 rounded-sm text-label font-semibold bg-white/10 text-ink-muted">
                {product.subCategory2}
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

          {/* A seam, not a line: the price is a separate block from the
              identity above it. */}
          <hr className="seam" />

          <div className="flex flex-col gap-1.5">
            <span className="label">{t('priceLabel')}</span>
            {/* An emphasised number — accent 400, the on-dark text step — and
                `tabular-nums` because it lines up with the catalogue column. */}
            <span className="text-title-2 sm:text-title-1 font-extrabold text-accent-400 leading-none tabular-nums">
              {product.priceFormatted}
            </span>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="surface p-5 flex flex-col gap-3">
            {/* h2, not h3: the product name in the hero is the only heading
                above this one, and h1 → h3 is a level skip. */}
            <h2 className="text-title-3 font-semibold text-ink tracking-[-0.02em]">
              {t('featuresLabel')}
            </h2>
            <ul className="flex flex-col gap-2.5 text-body-sm text-ink-muted leading-relaxed">
              {featureList(product.features, locale).map((feat, idx) => (
                <li key={idx} className="row-tint flex items-start gap-2.5 p-3">
                  <span className="text-accent-400 shrink-0 leading-none">•</span>
                  <span className="flex-1">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {product.specs && <ProductSpecTable specs={product.specs} locale={locale} />}
        </div>
      </main>

      <div className="w-full max-w-[86rem] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <hr className="seam" />
      </div>

      <footer className="meta w-full py-6 text-center">
        {t('footerAudioRoute')}
      </footer>
    </div>
  );
}
