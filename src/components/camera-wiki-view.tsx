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
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'lens':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'accessory':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-white/10 text-white/80 border-white/20';
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      {/* Header Title & Description */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">{t('title')}</h1>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-white/90 border border-white/15">
            {filteredCameras.length} products
          </span>
        </div>
        <p className="text-xs sm:text-sm text-ink-muted max-w-3xl leading-relaxed font-sans">{t('subtitle')}</p>
      </div>

      {/* Control Bar: Search, Category Tabs, Sub-category filters, Sort, View Switcher */}
      <div className="glass p-4 rounded-2xl flex flex-col gap-4 shadow-xl font-sans">
        {/* Search Input */}
        <div className="relative w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-black/60 border border-white/15 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 transition-all font-sans"
          />
          <span className="absolute left-3.5 top-3 text-white/40 text-sm select-none">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-white/50 hover:text-white text-xs px-2 py-0.5 rounded bg-white/10 font-sans"
            >
              ✕
            </button>
          )}
        </div>

        {/* Main Category Tabs */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-white/10 pb-3 font-sans">
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
                    ? 'bg-white text-black shadow-lg scale-105 font-bold'
                    : 'bg-white/5 text-white/70 hover:bg-white/15 hover:text-white border border-white/10'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-black/60 border border-white/15 ml-auto font-sans">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title={t('viewTable')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans ${
                viewMode === 'table' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white'
              }`}
            >
              📋 {t('viewTable')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title={t('viewGrid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans ${
                viewMode === 'grid' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white'
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
              <span className="text-white/50 font-sans">{t('subCategoryLabel')}:</span>
              <select
                value={selectedSub1}
                onChange={(e) => {
                  setSelectedSub1(e.target.value);
                  setSelectedSub2('all');
                }}
                className="px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-xs text-white focus:outline-none cursor-pointer font-sans"
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
                  className="px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-xs text-white focus:outline-none cursor-pointer font-sans"
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
            <span className="text-white/50 hidden sm:inline font-sans">{t('sortBy')}:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-xs text-white focus:outline-none cursor-pointer font-sans"
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
        <div className="glass p-12 rounded-2xl text-center flex flex-col items-center justify-center gap-3 font-sans">
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
            className="text-xs font-semibold text-community hover:underline mt-1 font-sans"
          >
            {t('emptyAction')}
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="glass rounded-2xl overflow-hidden shadow-2xl border border-white/10 font-sans">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-white/90">
              <thead className="bg-black/60 text-[11px] uppercase tracking-wider text-white/60 font-mono border-b border-white/10 select-none">
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
                  <th scope="col" className="p-3.5 min-w-[16rem]">
                    {t('featuresLabel')}
                  </th>
                  <th scope="col" className="p-3.5 text-right w-24">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {filteredCameras.map((cam) => {
                  const isChecked = selectedForCompare.includes(cam.id);
                  return (
                    <tr
                      key={cam.id}
                      className={`hover:bg-white/5 transition-colors ${
                        isChecked ? 'bg-white/10' : ''
                      }`}
                    >
                      {/* Checkbox for Compare */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCompare(cam.id)}
                          className="w-4 h-4 rounded bg-black/60 border-white/30 text-community focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Photo & Name (Product image on clean WHITE background) */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-white border border-white/20 p-1 flex items-center justify-center shadow-sm">
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
                            <span className="font-bold text-sm text-white font-sans">{cam.name}</span>
                            <span className="text-[11px] text-white/60 line-clamp-1 font-sans">{cam.fullName}</span>
                          </div>
                        </div>
                      </td>

                      {/* SKU Code */}
                      <td className="p-3.5 font-mono text-[11px] text-white/80 whitespace-nowrap">
                        {cam.sku}
                      </td>

                      {/* Main Category Badge */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border ${getCategoryBadgeColor(
                            cam.category,
                          )}`}
                        >
                          {cam.category.toUpperCase()}
                        </span>
                      </td>

                      {/* Sub-categories */}
                      <td className="p-3.5 whitespace-nowrap font-sans">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-white/90 font-sans">{cam.subCategory1}</span>
                          {cam.subCategory2 && (
                            <span className="text-[10px] text-white/50 font-mono">{cam.subCategory2}</span>
                          )}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="p-3.5 font-mono text-sm font-bold text-amber-300 whitespace-nowrap">
                        {cam.priceFormatted}
                      </td>

                      {/* Features */}
                      <td className="p-3.5 font-sans">
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-white/70 font-sans">
                          {cam.features.map((feat, idx) => (
                            <li key={idx} className="truncate max-w-md font-sans">
                              {feat}
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
                          className="text-[11px] text-white/60 hover:text-white underline font-semibold transition-colors font-sans"
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
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 font-sans">
          {filteredCameras.map((cam) => {
            const isChecked = selectedForCompare.includes(cam.id);
            return (
              <div
                key={cam.id}
                className={`p-4 rounded-2xl flex flex-col justify-between gap-4 border transition-all font-sans backdrop-blur-md ${
                  isChecked
                    ? 'border-amber-400/60 bg-amber-500/15 shadow-[0_0_25px_rgba(251,191,36,0.2)]'
                    : 'bg-[#28292e]/95 border-white/12 hover:border-white/30 hover:bg-[#2e3037]/95 shadow-lg'
                }`}
              >
                <div>
                  {/* Top Bar: Badges & Checkbox */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${getCategoryBadgeColor(
                          cam.category,
                        )}`}
                      >
                        {cam.category.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white/80 border border-white/15">
                        {cam.subCategory1}
                      </span>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-white/80 cursor-pointer select-none shrink-0 font-sans">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCompare(cam.id)}
                        className="w-4 h-4 rounded bg-black/60 border-white/30 text-community focus:ring-0 cursor-pointer"
                      />
                      <span>{t('compare')}</span>
                    </label>
                  </div>

                  {/* Photo on Clean WHITE Background */}
                  <div className="relative w-full aspect-[4/3] rounded-xl bg-white border border-white/20 p-3 flex items-center justify-center mb-3 shadow-inner overflow-hidden">
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
                    <h4 className="font-bold text-base text-white font-sans">{cam.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-white/50">{cam.sku}</span>
                      {cam.subCategory2 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/60 font-mono">
                          {cam.subCategory2}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/70 line-clamp-2 mt-0.5 font-sans">{cam.fullName}</p>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-1 mb-4 font-sans">
                    {cam.features.map((feat, idx) => (
                      <li key={idx} className="text-[11px] text-white/60 flex items-start gap-1.5 font-sans">
                        <span className="text-community shrink-0">•</span>
                        <span className="line-clamp-2 font-sans">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Price & Link */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-amber-300">
                    {cam.priceFormatted}
                  </span>
                  <a
                    href={cam.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-white/80 hover:text-white underline transition-colors font-sans"
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass px-5 py-3 rounded-2xl border border-white/20 shadow-2xl flex items-center gap-4 animate-fade-in backdrop-blur-xl font-sans">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white font-sans">
              {t('compareBarTitle', { count: selectedForCompare.length })}
            </span>
            <span className="text-[11px] text-white/50 hidden sm:inline font-sans">
              ({t('maxCompareHint')})
            </span>
          </div>

          <div className="flex items-center gap-2 font-sans">
            <button
              type="button"
              onClick={() => setSelectedForCompare([])}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-colors cursor-pointer font-sans"
            >
              {t('clearCompare')}
            </button>
            <button
              type="button"
              onClick={() => setIsCompareModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-all shadow-lg cursor-pointer font-sans"
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
            <div className="flex items-center justify-between border-b border-white/10 pb-4 font-sans">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚡</span>
                <h3 className="font-bold text-lg text-white font-sans">
                  {t('compareBtn')} ({comparedCameraObjects.length} products)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition-all cursor-pointer font-sans"
              >
                ✕
              </button>
            </div>

            {/* Side-by-Side Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 font-sans">
              {comparedCameraObjects.map((cam) => (
                <div key={cam.id} className="bg-[#28292e]/95 p-4 rounded-xl flex flex-col gap-3 border border-white/15 shadow-xl font-sans backdrop-blur-md">
                  {/* Photo on Clean WHITE Background */}
                  <div className="relative w-full aspect-[4/3] rounded-xl bg-white border border-white/20 p-2 flex items-center justify-center shadow-inner overflow-hidden">
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
                    <h4 className="font-bold text-base text-white font-sans">{cam.name}</h4>
                    <span className="font-mono text-[10px] text-white/50 block mb-1">{cam.sku}</span>
                    <span className="font-mono text-sm font-bold text-amber-300">{cam.priceFormatted}</span>
                  </div>

                  {/* Category Badges */}
                  <div className="flex flex-wrap gap-1 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getCategoryBadgeColor(cam.category)}`}>
                      {cam.category.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white/80 border border-white/15">
                      {cam.subCategory1}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="pt-2 border-t border-white/10 font-sans">
                    <span className="text-[10px] font-bold uppercase text-white/40 block mb-1.5 font-sans">
                      {t('featuresLabel')}
                    </span>
                    <ul className="space-y-1 text-xs text-white/80 font-sans">
                      {cam.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1 font-sans">
                          <span className="text-community shrink-0">•</span>
                          <span className="font-sans">{feat}</span>
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
                      className="block w-full text-center py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors font-sans"
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
