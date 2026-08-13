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
    <div className="min-h-screen flex flex-col bg-[#0b0d12] text-white font-sans">
      <SiteHeader />

      {/* A reading layout, like the camera product route — not the browse grid. */}
      <main className="flex-1 w-full max-w-[86rem] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-xs text-slate-100 font-mono font-bold">
            <Link href={isVi ? '/vi/colorlab' : '/colorlab'} className="hover:text-amber-300 transition-colors">
              ColorLab
            </Link>
            <span>/</span>
            <Link href={audioHref} className="hover:text-amber-300 transition-colors">
              {t('audioTitle')}
            </Link>
            <span>/</span>
            <span className="text-amber-300 font-bold">{product.name}</span>
          </div>

          <Link
            href={audioHref}
            className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20 shadow-sm shrink-0"
          >
            {t('backToCatalog')}
          </Link>
        </div>

        {/* No photo column here. The camera route leads with a product shot;
            these sheets publish none, and a full-width empty white panel reads
            as an image that failed to load rather than as one that was never
            published. The identity panel takes the full width instead. */}
        <section className="flex flex-col gap-4 bg-[#1c1d22] p-5 sm:p-6 rounded-2xl border border-white/15 shadow-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs border bg-fuchsia-400/25 text-fuchsia-200 border-fuchsia-400/50 font-extrabold">
              {t('catAudio')}
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
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold text-white tracking-tight">
              {product.name}
            </h1>
            <p className="text-sm sm:text-[1rem] text-slate-100 font-semibold leading-relaxed">
              {product.fullName}
            </p>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-col gap-1.5">
            <span className="text-[0.65rem] font-mono font-extrabold uppercase tracking-wider text-amber-200">
              {t('priceLabel')}
            </span>
            <span className="font-mono text-2xl sm:text-3xl font-black text-sky-300 drop-shadow-sm leading-none">
              {product.priceFormatted}
            </span>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="bg-[#1c1d22] p-5 rounded-2xl border border-white/15 shadow-lg flex flex-col gap-3">
            <h3 className="font-extrabold text-sm uppercase text-amber-300 font-mono tracking-wider flex items-center gap-2">
              ⚡ {t('featuresLabel')}
            </h3>
            <ul className="flex flex-col gap-2.5 text-xs text-white/95 font-medium leading-relaxed">
              {featureList(product.features, locale).map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2.5 bg-black/40 p-3 rounded-xl border border-white/10">
                  <span className="text-emerald-400 font-bold shrink-0 text-[1rem] leading-none">•</span>
                  <span className="flex-1">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {product.specs && <ProductSpecTable specs={product.specs} locale={locale} />}
        </div>
      </main>

      <footer className="w-full py-6 text-center text-xs text-white/40 border-t border-white/10 font-mono mt-6">
        Alpha ColorLab · Sony Headphone &amp; Speaker Wiki
      </footer>
    </div>
  );
}
