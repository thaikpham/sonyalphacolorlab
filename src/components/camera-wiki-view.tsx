'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { ProductCategory, SonyCamera } from '@/lib/cameras/types';
import { featureList, splitFeatures } from '@/lib/cameras/features';
import { calculateMatchScore } from '@/lib/search/fuzzy-search';

interface CameraWikiViewProps {
  initialCameras: SonyCamera[];
}

export function CameraWikiView({ initialCameras }: CameraWikiViewProps) {
  const t = useTranslations('cameras');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCategory = (searchParams?.get('cat') as ProductCategory) || 'all';
  const selectedSub1 = searchParams?.get('sub1') || 'all';
  const selectedSub2 = searchParams?.get('sub2') || 'all';
  const searchQuery = searchParams?.get('q') || '';
  const sortBy = (searchParams?.get('sort') as 'price-desc' | 'price-asc' | 'name' | 'sku') || 'price-desc';
  const viewMode = (searchParams?.get('view') as 'table' | 'grid') || 'grid';

  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const updateWikiParam = (patch: Record<string, string>) => {
    const params = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === 'all' || (key === 'sort' && value === 'price-desc') || (key === 'view' && value === 'grid')) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.push(qs ? `/cameras?${qs}` : '/cameras', { scroll: false });
  };

  /* A product opens its own page. It used to open a modal and fake the URL with
     pushState, which left the address bar pointing at a page that had never
     rendered — reload or share the link and you got the bare catalogue. */
  const openProduct = (cam: SonyCamera) => router.push(`/cameras/${cam.id}`);

  // Main Categories
  const categories: { key: ProductCategory; label: string; icon: string }[] = [
    { key: 'all', label: t('catAll'), icon: '📦' },
    { key: 'camera', label: t('catCamera'), icon: '📷' },
    { key: 'lens', label: t('catLens'), icon: '🔍' },
    { key: 'accessory', label: t('catAccessory'), icon: '🎙️' },
  ];

  // Dynamically compute sub-categories available for current main category selection
  const availableSub1List = useMemo(() => {
    let prods = initialCameras;
    if (selectedCategory !== 'all') {
      prods = prods.filter((p) => p.category === selectedCategory);
    }
    const set1 = new Set<string>();
    for (const p of prods) {
      if (p.subCategory1) set1.add(p.subCategory1);
    }
    return Array.from(set1).sort();
  }, [initialCameras, selectedCategory]);

  const availableSub2List = useMemo(() => {
    let prods = initialCameras;
    if (selectedCategory !== 'all') {
      prods = prods.filter((p) => p.category === selectedCategory);
    }
    if (selectedSub1 !== 'all') {
      prods = prods.filter((p) => p.subCategory1 === selectedSub1);
    }
    const set2 = new Set<string>();
    for (const p of prods) {
      if (p.subCategory2) set2.add(p.subCategory2);
    }
    return Array.from(set2).sort();
  }, [initialCameras, selectedCategory, selectedSub1]);

  // Filtering & Sorting
  const filteredCameras = useMemo(() => {
    let result = [...initialCameras];

    if (selectedCategory !== 'all') {
      result = result.filter((c) => c.category === selectedCategory);
    }

    if (selectedSub1 !== 'all') {
      result = result.filter((c) => c.subCategory1 === selectedSub1);
    }

    if (selectedSub2 !== 'all') {
      result = result.filter((c) => c.subCategory2 === selectedSub2);
    }

    if (searchQuery.trim()) {
      result = result
        .map((c) => ({
          camera: c,
          score: calculateMatchScore(searchQuery, [
            c.name,
            c.fullName,
            c.sku,
            c.subCategory1,
            c.subCategory2,
            ...splitFeatures(c.features).en,
            ...splitFeatures(c.features).vi,
          ]),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.camera);
    }

    switch (sortBy) {
      case 'price-desc':
        result.sort((a, b) => b.priceVnd - a.priceVnd);
        break;
      case 'price-asc':
        result.sort((a, b) => a.priceVnd - b.priceVnd);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'sku':
        result.sort((a, b) => a.sku.localeCompare(b.sku));
        break;
    }

    return result;
  }, [initialCameras, selectedCategory, selectedSub1, selectedSub2, searchQuery, sortBy]);

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 6) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const comparedCameraObjects = useMemo(() => {
    return initialCameras.filter((c) => selectedForCompare.includes(c.id));
  }, [initialCameras, selectedForCompare]);

  const navigateToComparePage = () => {
    if (selectedForCompare.length === 0) return;
    setIsConfirmModalOpen(false);
    router.push(`/cameras/compare?ids=${selectedForCompare.join(',')}`);
  };

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

  const hasActiveWikiFilters = selectedCategory !== 'all' || selectedSub1 !== 'all' || selectedSub2 !== 'all' || Boolean(searchQuery);

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      {/* Active Filter Chips Bar (renders only when filters are active) */}
      {hasActiveWikiFilters && (
        <div className="flex items-center gap-2 flex-wrap px-1 font-sans text-xs">
          {selectedCategory !== 'all' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/35 flex items-center gap-1.5">
              <span>{t(selectedCategory === 'camera' ? 'catCamera' : selectedCategory === 'lens' ? 'catLens' : 'catAccessory')}</span>
              <button
                type="button"
                onClick={() => updateWikiParam({ cat: 'all' })}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ✕
              </button>
            </span>
          )}

          {selectedSub1 !== 'all' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/15 text-white border border-white/25 flex items-center gap-1.5">
              <span>{selectedSub1}</span>
              <button
                type="button"
                onClick={() => updateWikiParam({ sub1: 'all' })}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ✕
              </button>
            </span>
          )}

          {selectedSub2 !== 'all' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/15 text-white border border-white/25 flex items-center gap-1.5">
              <span>{selectedSub2}</span>
              <button
                type="button"
                onClick={() => updateWikiParam({ sub2: 'all' })}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ✕
              </button>
            </span>
          )}

          {searchQuery && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/25 text-amber-200 border border-amber-400/40 flex items-center gap-1.5">
              <span>&quot;{searchQuery}&quot;</span>
              <button
                type="button"
                onClick={() => updateWikiParam({ q: '' })}
                className="hover:text-white ml-0.5 cursor-pointer"
              >
                ✕
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={() => router.push('/cameras', { scroll: false })}
            className="text-white/60 hover:text-white underline underline-offset-2 ml-1 text-xs font-semibold cursor-pointer"
          >
            {t('emptyAction')}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {filteredCameras.length === 0 ? (
        <div className="glass p-12 rounded-2xl text-center flex flex-col items-center justify-center gap-3 font-sans border border-white/15">
          <span className="text-3xl">📷</span>
          <h3 className="text-[1rem] font-bold text-white font-sans">{t('emptyTitle')}</h3>
          <button
            type="button"
            onClick={() => router.push('/cameras', { scroll: false })}
            className="text-xs font-bold text-amber-300 hover:underline mt-1 font-sans"
          >
            {t('emptyAction')}
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="glass rounded-2xl overflow-hidden shadow-2xl border border-white/15 font-sans">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-white">
              <thead className="bg-black/80 text-[11px] uppercase tracking-wider text-white/80 font-mono border-b border-white/15 select-none font-bold">
                <tr>
                  <th scope="col" className="p-3.5 text-center w-12">
                    {t('compare')}
                  </th>
                  <th scope="col" className="p-3.5">
                    {t('actionLabel')}
                  </th>
                  <th scope="col" className="p-3.5">
                    {t('skuLabel')}
                  </th>
                  <th scope="col" className="p-3.5">
                    {t('categoryLabel')}
                  </th>
                  <th scope="col" className="p-3.5">
                    {t('subCategoryLabel')}
                  </th>
                  <th scope="col" className="p-3.5">
                    {t('priceLabel')}
                  </th>
                  <th scope="col" className="p-3.5 min-w-[28rem] lg:min-w-[36rem]">
                    {t('featuresLabel')}
                  </th>
                  <th scope="col" className="p-3.5 text-right w-24">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 font-sans">
                {filteredCameras.map((cam) => {
                  const isChecked = selectedForCompare.includes(cam.id);
                  return (
                    <tr
                      key={cam.id}
                      className={`hover:bg-white/10 transition-colors ${
                        isChecked ? 'bg-amber-500/20' : 'bg-[#28292e]/80'
                      }`}
                    >
                      {/* Checkbox for Compare */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCompare(cam.id)}
                          className="w-4 h-4 rounded bg-black/60 border-white/40 text-community focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Photo & Name (click opens the product page) */}
                      <td className="p-3.5">
                        <div
                          onClick={() => openProduct(cam)}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-white border border-white/30 p-1 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <Image
                              src={cam.imageUrl}
                              alt={cam.name}
                              width={56}
                              height={56}
                              className="object-contain max-h-full"
                              unoptimized
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-sm text-white group-hover:text-amber-300 transition-colors font-sans">{cam.name}</span>
                            <span className="text-[11px] text-white/90 font-medium line-clamp-1 font-sans">{cam.fullName}</span>
                          </div>
                        </div>
                      </td>

                      {/* SKU Code */}
                      <td className="p-3.5 font-mono text-xs font-bold text-amber-300 whitespace-nowrap">
                        {cam.sku}
                      </td>

                      {/* Main Category Badge */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] border ${getCategoryBadgeColor(
                            cam.category,
                          )}`}
                        >
                          {cam.category.toUpperCase()}
                        </span>
                      </td>

                      {/* Sub-categories */}
                      <td className="p-3.5 whitespace-nowrap font-sans">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-white font-sans">{cam.subCategory1}</span>
                          {cam.subCategory2 && (
                            <span className="text-[10px] text-white/70 font-mono font-semibold">{cam.subCategory2}</span>
                          )}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="p-3.5 font-mono text-sm font-extrabold text-sky-400 whitespace-nowrap drop-shadow-sm">
                        {cam.priceFormatted}
                      </td>

                      {/* Features (Expanded width with word-wrap) */}
                      <td className="p-3.5 font-sans min-w-[28rem] lg:min-w-[36rem]">
                        <ul className="space-y-1.5 text-xs text-white/95 font-medium leading-relaxed">
                          {featureList(cam.features, locale).map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2 whitespace-normal break-words font-sans">
                              <span className="text-emerald-400 font-bold shrink-0 text-sm leading-none">•</span>
                              <span className="flex-1 font-sans">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </td>

                      {/* Sony Link */}
                      <td className="p-3.5 text-right whitespace-nowrap font-sans">
                        <a
                          href={cam.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-white font-bold hover:text-amber-300 underline underline-offset-2 transition-colors font-sans"
                        >
                          Sony ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View (18% Middle Gray cards with High Contrast Text) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4 font-sans">
          {filteredCameras.map((cam) => {
            const isChecked = selectedForCompare.includes(cam.id);
            return (
              <div
                key={cam.id}
                className={`p-4.5 rounded-2xl flex flex-col justify-between gap-4 transition-all font-sans backdrop-blur-md ${
                  isChecked
                    ? 'border-2 border-amber-400/70 bg-amber-500/20 shadow-[0_0_30px_rgba(251,191,36,0.25)]'
                    : 'bg-[#28292e] hover:bg-[#303138] shadow-xl'
                }`}
              >
                <div>
                  {/* Top Bar: Badges & Checkbox */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] border ${getCategoryBadgeColor(
                          cam.category,
                        )}`}
                      >
                        {cam.category.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/15 text-white border border-white/25 shadow-sm">
                        {cam.subCategory1}
                      </span>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-white font-bold cursor-pointer select-none shrink-0 font-sans hover:text-amber-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCompare(cam.id)}
                        className="w-4 h-4 rounded bg-black/70 border-white/40 text-community focus:ring-0 cursor-pointer"
                      />
                      <span>{t('compare')}</span>
                    </label>
                  </div>

                  {/* Photo on Clean WHITE Background (click opens the product page) */}
                  <div
                    onClick={() => openProduct(cam)}
                    className="relative w-full aspect-[4/3] rounded-xl bg-white p-3 flex items-center justify-center mb-3.5 shadow-md overflow-hidden cursor-pointer group"
                  >
                    <Image
                      src={cam.imageUrl}
                      alt={cam.name}
                      fill
                      className="object-contain p-2 group-hover:scale-105 transition-transform"
                      unoptimized
                    />
                  </div>

                  {/* Name & SKU (click opens the product page) */}
                  <div
                    onClick={() => openProduct(cam)}
                    className="flex flex-col gap-1 mb-3 font-sans cursor-pointer group"
                  >
                    <h4 className="font-extrabold text-[1rem] text-white group-hover:text-amber-300 transition-colors font-sans tracking-tight">
                      {cam.name}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/25">
                        {cam.sku}
                      </span>
                      {cam.subCategory2 && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/15 text-white border border-white/20">
                          {cam.subCategory2}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/90 font-medium line-clamp-2 mt-1 font-sans leading-relaxed">{cam.fullName}</p>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-1.5 mb-4 font-sans">
                    {featureList(cam.features, locale).map((feat, idx) => (
                      <li key={idx} className="text-xs text-white/90 font-medium flex items-start gap-2 font-sans leading-snug">
                        <span className="text-emerald-400 font-bold shrink-0 text-sm leading-none">•</span>
                        <span className="line-clamp-2 font-sans">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Price & Link */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[1rem] font-extrabold text-sky-400 drop-shadow-sm">
                    {cam.priceFormatted}
                  </span>
                  <a
                    href={cam.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-white hover:text-amber-300 underline underline-offset-2 transition-colors font-sans"
                  >
                    Sony ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Compare Action Overlay Layer (Pure Fixed Top Overlay with 7-Color Rainbow Glow) */}
      {selectedForCompare.length > 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center animate-fade-in font-sans">
          {/* 7-Color Spinning Rainbow Glow Layer */}
          <span aria-hidden className="rainbow-glow-bar" />

          {/* Main Floating Glass Bar */}
          <div className="relative z-10 bg-[#1c1d22]/95 px-6 py-4 rounded-2xl border-2 border-amber-400/80 shadow-[0_20px_60px_rgba(0,0,0,0.95)] flex items-center gap-6 backdrop-blur-2xl font-sans">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚡</span>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold text-white font-sans">
                  {t('compareBarTitle', { count: selectedForCompare.length })}
                </span>
                <span className="text-xs text-white/70 hidden sm:inline font-sans">
                  ({t('maxCompareHint')})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-sans">
              <button
                type="button"
                onClick={() => setSelectedForCompare([])}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white/70 hover:text-white underline transition-colors cursor-pointer font-sans"
              >
                {t('clearCompare')}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-extrabold text-xs sm:text-sm hover:brightness-110 transition-all shadow-xl cursor-pointer font-sans scale-105"
              >
                ⚡ {t('compareBtn')} ({selectedForCompare.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B&H Style Pop-up Confirmation Modal */}
      {isConfirmModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsConfirmModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-6 animate-backdrop-blur select-none font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90dvh] font-sans cursor-default animate-lightbox-zoom"
          >
            {/* 7-Color Static Rainbow Glow Layer */}
            <span aria-hidden className="rainbow-glow-bar" />

            <div className="relative z-10 glass w-full h-full rounded-2xl p-6 flex flex-col gap-6 shadow-2xl border border-white/25 font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/15 pb-4 font-sans">
              <div className="flex flex-col gap-1">
                <h3 className="font-extrabold text-xl text-white font-sans">
                  {t('compareConfirmTitle')} ({comparedCameraObjects.length})
                </h3>
                <p className="text-xs text-white/70 font-sans">
                  {t('compareConfirmSub')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer font-sans"
              >
                ✕
              </button>
            </div>

            {/* Selected Product Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 overflow-y-auto max-h-[60dvh] p-1 font-sans">
              {comparedCameraObjects.map((cam) => (
                <div
                  key={cam.id}
                  className="relative bg-[#28292e] p-3 rounded-xl flex flex-col gap-2.5 border border-white/20 shadow-lg font-sans"
                >
                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => toggleCompare(cam.id)}
                    title="Xóa sản phẩm"
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer z-10"
                  >
                    ✕
                  </button>

                  {/* Photo on Clean WHITE Background */}
                  <div
                    onClick={() => openProduct(cam)}
                    className="relative w-full aspect-[4/3] rounded-lg bg-white border border-white/20 p-2 flex items-center justify-center shadow-sm overflow-hidden cursor-pointer"
                  >
                    <Image
                      src={cam.imageUrl}
                      alt={cam.name}
                      fill
                      className="object-contain p-1"
                      unoptimized
                    />
                  </div>

                  {/* Name & SKU */}
                  <div className="flex flex-col gap-0.5 font-sans">
                    <h4
                      onClick={() => openProduct(cam)}
                      className="font-extrabold text-xs text-white line-clamp-2 leading-snug cursor-pointer hover:text-amber-300"
                    >
                      {cam.name}
                    </h4>
                    <span className="font-mono text-[10px] font-bold text-amber-300 truncate">{cam.sku}</span>
                    <span className="font-mono text-xs font-extrabold text-sky-400 mt-0.5">{cam.priceFormatted}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Action Bar */}
            <div className="pt-4 border-t border-white/15 flex items-center justify-between gap-4 font-sans">
              <button
                type="button"
                onClick={() => {
                  setSelectedForCompare([]);
                  setIsConfirmModalOpen(false);
                }}
                className="text-xs font-bold text-white/70 hover:text-white underline transition-colors cursor-pointer"
              >
                {t('clearCompare')}
              </button>

              <button
                type="button"
                onClick={navigateToComparePage}
                className="px-6 py-3 rounded-xl bg-white text-black font-extrabold text-xs sm:text-sm hover:bg-white/90 transition-all shadow-xl cursor-pointer scale-105"
              >
                {t('compareItemsBtn', { count: selectedForCompare.length })}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
