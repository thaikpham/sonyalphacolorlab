'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { CameraCategory, SonyCamera } from '@/lib/cameras/types';

interface CameraWikiViewProps {
  initialCameras: SonyCamera[];
}

export function CameraWikiView({ initialCameras }: CameraWikiViewProps) {
  const t = useTranslations('cameras');
  const [selectedCategory, setSelectedCategory] = useState<CameraCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price-desc' | 'price-asc' | 'name' | 'sku'>('price-desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Categories list
  const categories: { key: CameraCategory; label: string }[] = [
    { key: 'all', label: t('catAll') },
    { key: 'full-frame', label: t('catFullFrame') },
    { key: 'aps-c', label: t('catApsC') },
    { key: 'cinema-line', label: t('catCinemaLine') },
    { key: 'vlog', label: t('catVlog') },
  ];

  // Filtering & Sorting
  const filteredCameras = useMemo(() => {
    let result = [...initialCameras];

    if (selectedCategory !== 'all') {
      result = result.filter((c) => c.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.fullName.toLowerCase().includes(q) ||
          c.sku.toLowerCase().includes(q) ||
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
  }, [initialCameras, selectedCategory, searchQuery, sortBy]);

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
      case 'full-frame':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'aps-c':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'cinema-line':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'vlog':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-white/10 text-white/80 border-white/20';
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header Title & Description */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{t('title')}</h1>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-white/90 border border-white/15">
            {filteredCameras.length} models
          </span>
        </div>
        <p className="text-xs sm:text-sm text-ink-muted max-w-3xl leading-relaxed">{t('subtitle')}</p>
      </div>

      {/* Control Bar: Search, Category Tabs, Sort, View Switcher */}
      <div className="glass p-4 rounded-2xl flex flex-col gap-4 shadow-xl">
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
              className="absolute right-3 top-2.5 text-white/50 hover:text-white text-xs px-2 py-0.5 rounded bg-white/10"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Tabs & View Options */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.key
                    ? 'bg-white text-black font-bold shadow-md'
                    : 'bg-white/5 text-white/70 hover:bg-white/15 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sort & View Mode Switcher */}
          <div className="flex items-center gap-3 ml-auto shrink-0">
            {/* Sort Select */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60 hidden sm:inline">{t('sortBy')}:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-1.5 rounded-xl bg-black/70 border border-white/20 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="price-desc">{t('sortPriceDesc')}</option>
                <option value="price-asc">{t('sortPriceAsc')}</option>
                <option value="name">{t('sortName')}</option>
                <option value="sku">{t('sortSku')}</option>
              </select>
            </div>

            {/* View Switcher Buttons */}
            <div className="flex items-center p-1 rounded-xl bg-black/60 border border-white/15">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title={t('viewTable')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white'
                }`}
              >
                📋 {t('viewTable')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title={t('viewGrid')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white'
                }`}
              >
                🔲 {t('viewGrid')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredCameras.length === 0 ? (
        <div className="glass p-12 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
          <span className="text-3xl">📷</span>
          <h3 className="text-base font-bold text-white">{t('emptyTitle')}</h3>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="text-xs font-semibold text-community hover:underline mt-1"
          >
            {t('emptyAction')}
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="glass rounded-2xl overflow-hidden shadow-2xl border border-white/10">
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
              <tbody className="divide-y divide-white/5">
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

                      {/* Photo & Name */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center p-1">
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
                            <span className="font-bold text-sm text-white">{cam.name}</span>
                            <span className="text-[11px] text-white/60 line-clamp-1">{cam.fullName}</span>
                          </div>
                        </div>
                      </td>

                      {/* SKU Code */}
                      <td className="p-3.5 font-mono text-[11px] text-white/80 whitespace-nowrap">
                        {cam.sku}
                      </td>

                      {/* Category Badge */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border ${getCategoryBadgeColor(
                            cam.category,
                          )}`}
                        >
                          {cam.category.toUpperCase()}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="p-3.5 font-mono text-sm font-bold text-amber-300 whitespace-nowrap">
                        {cam.priceFormatted}
                      </td>

                      {/* Features */}
                      <td className="p-3.5">
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-white/70">
                          {cam.features.map((feat, idx) => (
                            <li key={idx} className="truncate max-w-md">
                              {feat}
                            </li>
                          ))}
                        </ul>
                      </td>

                      {/* Sony Link */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <a
                          href={cam.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-white/60 hover:text-white underline font-semibold transition-colors"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCameras.map((cam) => {
            const isChecked = selectedForCompare.includes(cam.id);
            return (
              <div
                key={cam.id}
                className={`glass p-4 rounded-2xl flex flex-col justify-between gap-4 border transition-all ${
                  isChecked
                    ? 'border-amber-400/50 bg-amber-500/10 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div>
                  {/* Top Bar: Category & Checkbox */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${getCategoryBadgeColor(
                        cam.category,
                      )}`}
                    >
                      {cam.category.toUpperCase()}
                    </span>

                    <label className="flex items-center gap-1.5 text-xs text-white/80 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCompare(cam.id)}
                        className="w-4 h-4 rounded bg-black/60 border-white/30 text-community focus:ring-0 cursor-pointer"
                      />
                      <span>{t('compare')}</span>
                    </label>
                  </div>

                  {/* Photo */}
                  <div className="relative w-full aspect-[4/3] rounded-xl bg-black/40 border border-white/10 p-3 flex items-center justify-center mb-3">
                    <Image
                      src={cam.imageUrl}
                      alt={cam.name}
                      fill
                      className="object-contain p-2"
                      unoptimized
                    />
                  </div>

                  {/* Name & SKU */}
                  <div className="flex flex-col gap-1 mb-3">
                    <h4 className="font-bold text-base text-white">{cam.name}</h4>
                    <span className="font-mono text-[10px] text-white/50">{cam.sku}</span>
                    <p className="text-xs text-white/70 line-clamp-2 mt-0.5">{cam.fullName}</p>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-1 mb-4">
                    {cam.features.map((feat, idx) => (
                      <li key={idx} className="text-[11px] text-white/60 flex items-start gap-1.5">
                        <span className="text-community shrink-0">•</span>
                        <span className="line-clamp-2">{feat}</span>
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
                    className="text-xs font-semibold text-white/80 hover:text-white underline transition-colors"
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass px-5 py-3 rounded-2xl border border-white/20 shadow-2xl flex items-center gap-4 animate-fade-in backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              {t('compareBarTitle', { count: selectedForCompare.length })}
            </span>
            <span className="text-[11px] text-white/50 hidden sm:inline">
              ({t('maxCompareHint')})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedForCompare([])}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              {t('clearCompare')}
            </button>
            <button
              type="button"
              onClick={() => setIsCompareModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-all shadow-lg cursor-pointer"
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
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-8 animate-backdrop-blur select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-5xl max-h-[90dvh] rounded-2xl p-5 sm:p-6 overflow-y-auto flex flex-col gap-6 shadow-2xl border border-white/20 cursor-default"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚡</span>
                <h3 className="font-bold text-lg text-white">
                  {t('compareBtn')} ({comparedCameraObjects.length} models)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Side-by-Side Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {comparedCameraObjects.map((cam) => (
                <div key={cam.id} className="glass p-4 rounded-xl flex flex-col gap-3 border border-white/10">
                  {/* Photo */}
                  <div className="relative w-full aspect-[4/3] rounded-lg bg-black/50 p-2 flex items-center justify-center">
                    <Image
                      src={cam.imageUrl}
                      alt={cam.name}
                      fill
                      className="object-contain p-1"
                      unoptimized
                    />
                  </div>

                  {/* Name & Price */}
                  <div>
                    <h4 className="font-bold text-base text-white">{cam.name}</h4>
                    <span className="font-mono text-[10px] text-white/50 block mb-1">{cam.sku}</span>
                    <span className="font-mono text-sm font-bold text-amber-300">{cam.priceFormatted}</span>
                  </div>

                  {/* Category Badge */}
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getCategoryBadgeColor(cam.category)}`}>
                      {cam.category.toUpperCase()}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-[10px] font-bold uppercase text-white/40 block mb-1.5">
                      {t('featuresLabel')}
                    </span>
                    <ul className="space-y-1 text-xs text-white/80">
                      {cam.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-community shrink-0">•</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Link */}
                  <div className="mt-auto pt-3">
                    <a
                      href={cam.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
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
