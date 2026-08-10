'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ProductCategory, SonyCamera } from '@/lib/cameras/types';

interface CameraWikiViewProps {
  initialCameras: SonyCamera[];
}

export function CameraWikiView({ initialCameras }: CameraWikiViewProps) {
  const t = useTranslations('cameras');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('all');
  const [selectedSub1, setSelectedSub1] = useState<string>('all');
  const [selectedSub2, setSelectedSub2] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price-desc' | 'price-asc' | 'name' | 'sku'>('price-desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

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
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.fullName.toLowerCase().includes(q) ||
          c.sku.toLowerCase().includes(q) ||
          c.subCategory1.toLowerCase().includes(q) ||
          c.subCategory2.toLowerCase().includes(q) ||
          c.features.some((f) => f.toLowerCase().includes(q)),
      );
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
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const comparedCameraObjects = useMemo(() => {
    return initialCameras.filter((c) => selectedForCompare.includes(c.id));
  }, [initialCameras, selectedForCompare]);

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

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      {/* Header Title & Description */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">{t('title')}</h1>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/15 text-white border border-white/25 shadow-sm">
            {filteredCameras.length} products
          </span>
        </div>
        <p className="text-xs sm:text-sm text-white/90 max-w-3xl leading-relaxed font-sans">{t('subtitle')}</p>
      </div>

      {/* Control Bar: Search, Category Tabs, Sub-category filters, Sort, View Switcher */}
      <div className="glass p-4 rounded-2xl flex flex-col gap-4 shadow-xl font-sans border border-white/15">
        {/* Search Input */}
        <div className="relative w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-black/80 border border-white/25 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-amber-400/60 transition-all font-sans font-medium"
          />
          <span className="absolute left-3.5 top-3 text-white/60 text-sm select-none">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-white/70 hover:text-white text-xs px-2 py-0.5 rounded bg-white/15 font-sans font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Main Category Tabs */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-white/15 pb-3 font-sans">
          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.key);
                  setSelectedSub1('all');
                  setSelectedSub2('all');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 font-sans ${
                  selectedCategory === cat.key
                    ? 'bg-white text-black shadow-lg scale-105 font-extrabold'
                    : 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white border border-white/15'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-black/70 border border-white/20 ml-auto font-sans">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title={t('viewTable')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans ${
                viewMode === 'table' ? 'bg-white/30 text-white shadow-md' : 'text-white/60 hover:text-white'
              }`}
            >
              📋 {t('viewTable')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title={t('viewGrid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans ${
                viewMode === 'grid' ? 'bg-white/30 text-white shadow-md' : 'text-white/60 hover:text-white'
              }`}
            >
              🔲 {t('viewGrid')}
            </button>
          </div>
        </div>

        {/* Sub-Category Filters & Sort Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs font-sans">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Sub-category 1 (Format / Sensor / Type) */}
            <div className="flex items-center gap-1.5">
              <span className="text-white/80 font-bold font-sans">{t('subCategoryLabel')}:</span>
              <select
                value={selectedSub1}
                onChange={(e) => {
                  setSelectedSub1(e.target.value);
                  setSelectedSub2('all');
                }}
                className="px-3 py-1.5 rounded-xl bg-black/80 border border-white/25 text-xs text-white font-bold focus:outline-none cursor-pointer font-sans"
              >
                <option value="all">{t('sub1All')}</option>
                {availableSub1List.map((sub1) => (
                  <option key={sub1} value={sub1}>
                    {sub1}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-category 2 (Series / Line) */}
            {availableSub2List.length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedSub2}
                  onChange={(e) => setSelectedSub2(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-black/80 border border-white/25 text-xs text-white font-bold focus:outline-none cursor-pointer font-sans"
                >
                  <option value="all">{t('sub2All')}</option>
                  {availableSub2List.map((sub2) => (
                    <option key={sub2} value={sub2}>
                      {sub2}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-white/80 font-bold hidden sm:inline font-sans">{t('sortBy')}:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 rounded-xl bg-black/80 border border-white/25 text-xs text-white font-bold focus:outline-none cursor-pointer font-sans"
            >
              <option value="price-desc">{t('sortPriceDesc')}</option>
              <option value="price-asc">{t('sortPriceAsc')}</option>
              <option value="name">{t('sortName')}</option>
              <option value="sku">{t('sortSku')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredCameras.length === 0 ? (
        <div className="glass p-12 rounded-2xl text-center flex flex-col items-center justify-center gap-3 font-sans border border-white/15">
          <span className="text-3xl">📷</span>
          <h3 className="text-base font-bold text-white font-sans">{t('emptyTitle')}</h3>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedSub1('all');
              setSelectedSub2('all');
            }}
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

                      {/* Photo & Name (Product image on clean WHITE background) */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-white border border-white/30 p-1 flex items-center justify-center shadow-md">
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
                            <span className="font-extrabold text-sm text-white font-sans">{cam.name}</span>
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
                          {cam.features.map((feat, idx) => (
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
                className={`p-4.5 rounded-2xl flex flex-col justify-between gap-4 border transition-all font-sans backdrop-blur-md ${
                  isChecked
                    ? 'border-amber-400/70 bg-amber-500/20 shadow-[0_0_30px_rgba(251,191,36,0.25)]'
                    : 'bg-[#28292e] border-white/15 hover:border-white/40 hover:bg-[#303138] shadow-xl'
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

                  {/* Photo on Clean WHITE Background */}
                  <div className="relative w-full aspect-[4/3] rounded-xl bg-white border border-white/20 p-3 flex items-center justify-center mb-3.5 shadow-md overflow-hidden">
                    <Image
                      src={cam.imageUrl}
                      alt={cam.name}
                      fill
                      className="object-contain p-2"
                      unoptimized
                    />
                  </div>

                  {/* Name & SKU */}
                  <div className="flex flex-col gap-1 mb-3 font-sans">
                    <h4 className="font-extrabold text-base text-white font-sans tracking-tight">{cam.name}</h4>
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
                    {cam.features.map((feat, idx) => (
                      <li key={idx} className="text-xs text-white/90 font-medium flex items-start gap-2 font-sans leading-snug">
                        <span className="text-emerald-400 font-bold shrink-0 text-sm leading-none">•</span>
                        <span className="line-clamp-2 font-sans">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Price & Link */}
                <div className="pt-3 border-t border-white/15 flex items-center justify-between gap-2">
                  <span className="font-mono text-base font-extrabold text-sky-400 drop-shadow-sm">
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

      {/* Floating Compare Action Bar */}
      {selectedForCompare.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass px-5 py-3.5 rounded-2xl border border-white/30 shadow-2xl flex items-center gap-5 animate-fade-in backdrop-blur-xl font-sans">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-white font-sans">
              {t('compareBarTitle', { count: selectedForCompare.length })}
            </span>
            <span className="text-xs text-white/70 hidden sm:inline font-sans">
              ({t('maxCompareHint')})
            </span>
          </div>

          <div className="flex items-center gap-2 font-sans">
            <button
              type="button"
              onClick={() => setSelectedForCompare([])}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white/80 hover:text-white transition-colors cursor-pointer font-sans"
            >
              {t('clearCompare')}
            </button>
            <button
              type="button"
              onClick={() => setIsCompareModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-white/90 transition-all shadow-lg cursor-pointer font-sans scale-105"
            >
              ⚡ {t('compareBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Spec Comparison Modal */}
      {isCompareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsCompareModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-8 animate-backdrop-blur select-none font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-5xl max-h-[90dvh] rounded-2xl p-5 sm:p-6 overflow-y-auto flex flex-col gap-6 shadow-2xl border border-white/20 cursor-default font-sans"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/15 pb-4 font-sans">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚡</span>
                <h3 className="font-extrabold text-lg text-white font-sans">
                  {t('compareBtn')} ({comparedCameraObjects.length} products)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer font-sans"
              >
                ✕
              </button>
            </div>

            {/* Side-by-Side Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 font-sans">
              {comparedCameraObjects.map((cam) => (
                <div key={cam.id} className="bg-[#28292e] p-4 rounded-xl flex flex-col gap-3 border border-white/20 shadow-xl font-sans backdrop-blur-md">
                  {/* Photo on Clean WHITE Background */}
                  <div className="relative w-full aspect-[4/3] rounded-xl bg-white border border-white/20 p-2 flex items-center justify-center shadow-md overflow-hidden">
                    <Image
                      src={cam.imageUrl}
                      alt={cam.name}
                      fill
                      className="object-contain p-1"
                      unoptimized
                    />
                  </div>

                  {/* Name & Price */}
                  <div className="font-sans">
                    <h4 className="font-extrabold text-base text-white font-sans">{cam.name}</h4>
                    <span className="font-mono text-xs font-bold text-amber-300 block mb-1">{cam.sku}</span>
                    <span className="font-mono text-base font-extrabold text-sky-400 drop-shadow-sm">{cam.priceFormatted}</span>
                  </div>

                  {/* Category Badges */}
                  <div className="flex flex-wrap gap-1 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${getCategoryBadgeColor(cam.category)}`}>
                      {cam.category.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/15 text-white border border-white/25">
                      {cam.subCategory1}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="pt-2 border-t border-white/15 font-sans">
                    <span className="text-[10px] font-extrabold uppercase text-white/70 block mb-1.5 font-sans">
                      {t('featuresLabel')}
                    </span>
                    <ul className="space-y-1 text-xs text-white/90 font-medium font-sans">
                      {cam.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1 font-sans">
                          <span className="text-emerald-400 font-bold shrink-0">•</span>
                          <span className="font-sans leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Link */}
                  <div className="mt-auto pt-3 font-sans">
                    <a
                      href={cam.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white border border-white/20 transition-colors font-sans"
                    >
                      {t('officialUrl')}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
