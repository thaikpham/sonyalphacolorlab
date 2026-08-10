'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { SonyCamera } from '@/lib/cameras/types';

interface ProductDetailModalProps {
  product: SonyCamera | null;
  onClose: () => void;
  isCompared: boolean;
  onToggleCompare: (id: string) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  isCompared,
  onToggleCompare,
}: ProductDetailModalProps) {
  const t = useTranslations('cameras');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!product) return null;

  const getCategoryBadgeColor = (cat: SonyCamera['category']) => {
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

  // Derive ideal use cases based on product sub-categories & features
  const getIdealUseCases = () => {
    const cases: string[] = [];
    if (product.category === 'camera') {
      if (product.subCategory2.includes('Cinema Line') || product.name.includes('FX')) {
        cases.push('Quay phim Điện ảnh & TV Commercial', 'Sáng tạo Nội dung Chuyên nghiệp');
      } else if (product.subCategory2.includes('Vlog') || product.name.includes('ZV')) {
        cases.push('Quay Video Vlogging & Livestream', 'Sáng tạo Nội dung Cá nhân');
      } else if (product.name.includes('R') || product.name.includes('1')) {
        cases.push('Chụp Ảnh Chân dung & Thương mại', 'In ấn Khổ lớn & Studio');
      } else {
        cases.push('Chụp Ảnh & Quay Phim Đa năng', 'Du lịch & Sự kiện');
      }
    } else if (product.category === 'lens') {
      if (product.subCategory2.includes('GM') || product.name.includes('GM')) {
        cases.push('Chất lượng Quang học G Master Đỉnh cao', 'Độ phân giải & Bokeh Thượng hạng');
      } else {
        cases.push('Nhiếp ảnh & Quay phim Chất lượng cao', 'Nhẹ gọn & Linh hoạt');
      }
    } else {
      cases.push('Thu âm Thu tiếng Chuyên nghiệp', 'Phụ kiện Hỗ trợ Tối ưu cho Máy ảnh Sony');
    }
    return cases;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-backdrop-blur select-none font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-4xl max-h-[90dvh] rounded-3xl p-6 sm:p-8 overflow-y-auto flex flex-col gap-6 shadow-2xl border border-white/25 cursor-default font-sans bg-[#1c1d22]/95"
      >
        {/* Modal Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/15 pb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs border ${getCategoryBadgeColor(product.category)}`}>
                {product.category.toUpperCase()}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/15 text-white border border-white/25 shadow-sm">
                {product.subCategory1}
              </span>
              {product.subCategory2 && (
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-400/10 text-amber-300 border border-amber-400/25">
                  {product.subCategory2}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans mt-1">
              {product.name}
            </h2>
            <span className="text-xs sm:text-sm text-white/80 font-medium font-sans">
              {product.fullName}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Hero Product Section: Large Image & Price + Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Product Showcase Photo on Clean White Background */}
          <div className="relative w-full aspect-[4/3] rounded-2xl bg-white border border-white/20 p-6 flex items-center justify-center shadow-xl overflow-hidden">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-contain p-4"
              unoptimized
            />
          </div>

          {/* Pricing & Sales Breakdown */}
          <div className="flex flex-col gap-5 bg-[#25262c] p-5 sm:p-6 rounded-2xl border border-white/15 shadow-lg">
            {/* SKU & Price */}
            <div className="flex flex-col gap-1.5 border-b border-white/10 pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-white/60 font-mono">
                {t('skuLabel')} & {t('priceLabel')}
              </span>
              <span className="font-mono text-xs font-bold text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/25 w-fit">
                {product.sku}
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-sky-400 drop-shadow-sm mt-1">
                {product.priceFormatted}
              </span>
            </div>

            {/* Ideal Use Cases */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-white/70 font-sans">
                💡 {t('idealUseCaseLabel')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {getIdealUseCases().map((useCase, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 text-white border border-white/15"
                  >
                    • {useCase}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => onToggleCompare(product.id)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  isCompared
                    ? 'bg-amber-400 text-black shadow-lg scale-105'
                    : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                }`}
              >
                {isCompared ? t('removeFromCompare') : t('addToCompare')}
              </button>

              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-white text-black font-extrabold text-xs text-center hover:bg-white/90 transition-all shadow-md cursor-pointer"
              >
                {t('officialUrl')}
              </a>
            </div>
          </div>
        </div>

        {/* Detailed Scientific Specifications Breakdown */}
        <div className="flex flex-col gap-4 pt-2">
          {/* Key Features Section */}
          <div className="bg-[#25262c] p-5 rounded-2xl border border-white/15 shadow-lg flex flex-col gap-3">
            <h3 className="font-extrabold text-sm uppercase text-amber-300 font-mono tracking-wider flex items-center gap-2">
              ⚡ {t('specFeatures')}
            </h3>

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-white/95 font-medium leading-relaxed">
              {product.features.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2.5 bg-black/40 p-3 rounded-xl border border-white/10">
                  <span className="text-emerald-400 font-bold shrink-0 text-base leading-none">•</span>
                  <span className="flex-1">{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
