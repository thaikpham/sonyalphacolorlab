'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type { SonyCamera } from '@/lib/cameras/types';
import { featureList } from '@/lib/cameras/features';
import { translateSpecValue } from '@/lib/cameras/spec-values';
import {
  type CompareTabId,
  SPEC_SECTION_GROUPS,
  SPEC_ICONS,
  getSpecValue,
  isSpecDifferent,
  getActiveSpecSections,
} from '@/lib/cameras/compare-grouping';

interface CameraCompareViewProps {
  initialCameras: SonyCamera[];
  selectedIds: string[];
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'specialist';
  text: string;
}

export function CameraCompareView({ initialCameras, selectedIds }: CameraCompareViewProps) {
  const t = useTranslations('cameras');
  const locale = useLocale();
  const router = useRouter();

  const [activeIds, setActiveIds] = useState<string[]>(selectedIds);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchAddQuery, setSearchAddQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CompareTabId>('all');
  const [onlyDiffs, setOnlyDiffs] = useState(false);

  // AI Chatbot State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'specialist',
      text: t('aiSpecialistGreeting'),
    },
  ]);
  const [userQuestion, setUserQuestion] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Selected camera objects
  const comparedCameras = useMemo(() => {
    return initialCameras.filter((c) => activeIds.includes(c.id));
  }, [initialCameras, activeIds]);

  const totalCols = useMemo(() => {
    return comparedCameras.length + (comparedCameras.length < 6 ? 2 : 1);
  }, [comparedCameras.length]);

  // Unselected cameras available to add
  const availableToAdd = useMemo(() => {
    const remaining = initialCameras.filter((c) => !activeIds.includes(c.id));
    if (!searchAddQuery.trim()) return remaining;
    const q = searchAddQuery.trim().toLowerCase();
    return remaining.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.sku.toLowerCase().includes(q) ||
        c.subCategory1.toLowerCase().includes(q),
    );
  }, [initialCameras, activeIds, searchAddQuery]);

  const removeCamera = (id: string) => {
    const next = activeIds.filter((item) => item !== id);
    setActiveIds(next);
    if (next.length > 0) {
      router.replace(`/cameras/compare?ids=${next.join(',')}`);
    } else {
      router.push(`/cameras`);
    }
  };

  const addCamera = (id: string) => {
    if (activeIds.length >= 6) return;
    const next = [...activeIds, id];
    setActiveIds(next);
    setIsAddModalOpen(false);
    setSearchAddQuery('');
    router.replace(`/cameras/compare?ids=${next.join(',')}`);
  };

  const askAiSpecialist = async (questionText: string) => {
    if (!questionText.trim() || isAiLoading || comparedCameras.length === 0) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: questionText.trim(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setUserQuestion('');
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/cameras/ai-specialist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: activeIds,
          question: questionText.trim(),
          locale,
        }),
      });

      const data = await res.json();
      if (data.answer) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: 'specialist',
            text: data.answer,
          },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: 'specialist',
            text: t('aiErrorResponse'),
          },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'specialist',
          text: t('aiConnectionError'),
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
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

  const activeSpecSections = useMemo(() => {
    return getActiveSpecSections(comparedCameras, activeTab);
  }, [comparedCameras, activeTab]);

  const tabs: { id: CompareTabId; label: string; icon: string }[] = [
    { id: 'all', label: t('tabAll'), icon: '🔲' },
    { id: 'highlights', label: t('tabHighlights'), icon: '⚡' },
    { id: 'sensorOptics', label: t('tabSensorOptics'), icon: '📷' },
    { id: 'videoIso', label: t('tabVideoIso'), icon: '🎥' },
    { id: 'afStab', label: t('tabAfStab'), icon: '🎯' },
    { id: 'physical', label: t('tabPhysical'), icon: '📐' },
  ];

  return (
    <div className="w-full flex flex-col gap-6 font-sans pb-16">
      {/* Navigation Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link
            href={`/${locale}/cameras`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all cursor-pointer"
          >
            {t('backToCatalog')}
          </Link>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-amber-300 bg-amber-400/10 px-3 py-1.5 rounded-xl border border-amber-400/30">
              {t('compareSummary', { count: comparedCameras.length })}
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white font-bold text-xs border border-white/15 transition-all cursor-pointer"
            >
              🖨️ {t('printCompare')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t('comparePageTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-white/70 truncate">
            {comparedCameras.map((c) => c.name).join('  vs  ')}
          </p>
        </div>
      </div>

      {/* Pocket-Guide Inspired Category Filter Tab Bar & Controls */}
      <div className="glass p-3 sm:p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border border-white/15 shadow-xl bg-[#181a1f]/90">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20 scale-[1.02]'
                    : 'bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/10'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Difference Toggle Filter */}
        <div className="flex items-center gap-3 shrink-0 border-t md:border-t-0 border-white/10 pt-3 md:pt-0">
          <button
            type="button"
            onClick={() => setOnlyDiffs((prev) => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
              onlyDiffs
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/60 ring-1 ring-amber-400/40'
                : 'bg-white/5 text-white/70 hover:text-white border-white/15 hover:bg-white/10'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${onlyDiffs ? 'bg-amber-400 animate-pulse' : 'bg-white/30'}`} />
            <span>{onlyDiffs ? t('highlightDiffs') : t('showAllSpecs')}</span>
          </button>
        </div>
      </div>

      {/* Main Side-by-Side Spec Matrix */}
      <div className="glass rounded-2xl overflow-hidden shadow-2xl border border-white/15 font-sans bg-[#131519]">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem]" />
              {comparedCameras.map((cam) => (
                <col key={cam.id} className="w-[18rem] min-w-[18rem]" />
              ))}
              {comparedCameras.length < 6 && <col className="w-[18rem] min-w-[18rem]" />}
            </colgroup>

            {/* Header Row: Sticky Product Cards */}
            <thead className="bg-[#1a1c22] sticky top-0 z-20 border-b border-white/15 shadow-md">
              <tr>
                <th scope="col" className="p-4 w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem] bg-[#1a1c22] border-r border-white/10 align-middle">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] font-extrabold uppercase text-amber-400/90 tracking-wider">
                      Sản phẩm
                    </span>
                    <span className="text-xs text-white/50 font-normal">
                      So sánh song song
                    </span>
                  </div>
                </th>

                {comparedCameras.map((cam) => (
                  <th key={cam.id} scope="col" className="p-4 w-[18rem] min-w-[18rem] bg-[#1a1c22] border-r border-white/10 align-top">
                    <div className="relative bg-[#23252c] p-4 rounded-xl flex flex-col gap-3 shadow-lg h-full justify-between border border-white/10">
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeCamera(cam.id)}
                        title="Xóa sản phẩm"
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer z-10"
                      >
                        ✕
                      </button>

                      {/* Photo on Clean WHITE Background */}
                      <div
                        onClick={() => router.push(`/cameras/${cam.id}`)}
                        className="relative w-full aspect-[4/3] rounded-xl bg-white p-2 flex items-center justify-center shadow-md overflow-hidden cursor-pointer group shrink-0"
                      >
                        <Image
                          src={cam.imageUrl}
                          alt={cam.name}
                          fill
                          className="object-contain p-2 group-hover:scale-105 transition-transform"
                          unoptimized
                        />
                      </div>

                      {/* Info */}
                      <div
                        onClick={() => router.push(`/cameras/${cam.id}`)}
                        className="flex flex-col gap-1 cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] border ${getCategoryBadgeColor(cam.category)}`}>
                            {cam.category.toUpperCase()}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-sm text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                          {cam.name}
                        </h3>
                        <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/25 w-fit truncate">
                          {cam.sku}
                        </span>
                        <span className="font-mono text-sm font-extrabold text-sky-400 mt-0.5">
                          {cam.priceFormatted}
                        </span>
                      </div>

                      {/* Sony Link */}
                      <a
                        href={cam.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                      >
                        Sony ↗
                      </a>
                    </div>
                  </th>
                ))}

                {/* Slot to Add More Products (Up to 6) */}
                {comparedCameras.length < 6 && (
                  <th scope="col" className="p-4 w-[18rem] min-w-[18rem] bg-[#1a1c22] align-top">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(true)}
                      className="w-full h-full min-h-[16rem] rounded-xl border-2 border-dashed border-white/20 hover:border-amber-400/60 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-3 p-4 transition-all cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-amber-400/20 text-white group-hover:text-amber-300 flex items-center justify-center text-xl font-bold transition-all">
                        +
                      </div>
                      <span className="text-xs font-bold text-white/70 group-hover:text-white transition-colors">
                        {t('addMoreToCompare')}
                      </span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10 text-xs text-white">
              {/* GENERAL INFO SECTION */}
              {(activeTab === 'all' || activeTab === 'sensorOptics') && (
                <>
                  <tr className="bg-[#181a20] font-mono text-[11px] uppercase tracking-wider text-amber-300 font-extrabold border-y border-white/15">
                    <td colSpan={totalCols} className="p-3.5 bg-[#181a20]">
                      📂 {t('specCategory')}
                    </td>
                  </tr>

                  {/* Category Row */}
                  {(!onlyDiffs || isSpecDifferent(comparedCameras, 'category')) && (
                    <tr className="bg-[#1c1e24] hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white/80 border-r border-white/10 bg-[#16181d] align-top w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem]">
                        {t('categoryLabel')}
                      </td>
                      {comparedCameras.map((cam) => (
                        <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] min-w-[18rem] align-top">
                          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 shadow-sm flex items-center gap-2">
                            <span className="text-amber-400 text-sm">📦</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${getCategoryBadgeColor(cam.category)}`}>
                              {cam.category.toUpperCase()}
                            </span>
                          </div>
                        </td>
                      ))}
                      {comparedCameras.length < 6 && <td className="p-4 w-[18rem] min-w-[18rem]"></td>}
                    </tr>
                  )}

                  {/* SubCategory 1 Row */}
                  {(!onlyDiffs || isSpecDifferent(comparedCameras, 'subCategory1')) && (
                    <tr className="bg-[#1c1e24] hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white/80 border-r border-white/10 bg-[#16181d] align-top w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem]">
                        {t('specSub1')}
                      </td>
                      {comparedCameras.map((cam) => (
                        <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] min-w-[18rem] align-top">
                          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 hover:border-amber-400/30 transition-all flex items-start gap-2 shadow-sm text-xs font-bold text-white">
                            <span className="text-amber-400 text-sm shrink-0">🏷️</span>
                            <span className="flex-1 leading-relaxed">{cam.subCategory1}</span>
                          </div>
                        </td>
                      ))}
                      {comparedCameras.length < 6 && <td className="p-4 w-[18rem] min-w-[18rem]"></td>}
                    </tr>
                  )}

                  {/* SubCategory 2 Row */}
                  {(!onlyDiffs || isSpecDifferent(comparedCameras, 'subCategory2')) && (
                    <tr className="bg-[#1c1e24] hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white/80 border-r border-white/10 bg-[#16181d] align-top w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem]">
                        {t('specSub2')}
                      </td>
                      {comparedCameras.map((cam) => (
                        <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] min-w-[18rem] align-top">
                          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 hover:border-amber-400/30 transition-all flex items-start gap-2 shadow-sm text-xs font-mono text-white/80 font-semibold">
                            <span className="text-amber-400 text-sm shrink-0">📂</span>
                            <span className="flex-1 leading-relaxed">{cam.subCategory2 || '—'}</span>
                          </div>
                        </td>
                      ))}
                      {comparedCameras.length < 6 && <td className="p-4 w-[18rem] min-w-[18rem]"></td>}
                    </tr>
                  )}
                </>
              )}

              {/* PRICING & CODES SECTION */}
              {activeTab === 'all' && (
                <>
                  <tr className="bg-[#181a20] font-mono text-[11px] uppercase tracking-wider text-amber-300 font-extrabold border-y border-white/15">
                    <td colSpan={totalCols} className="p-3.5 bg-[#181a20]">
                      💳 {t('priceLabel')} & {t('skuLabel')}
                    </td>
                  </tr>

                  {/* Price Row */}
                  {(!onlyDiffs || isSpecDifferent(comparedCameras, 'priceFormatted')) && (
                    <tr className="bg-[#1c1e24] hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white/80 border-r border-white/10 bg-[#16181d] align-top w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem]">
                        {t('specPrice')}
                      </td>
                      {comparedCameras.map((cam) => (
                        <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] min-w-[18rem] align-top">
                          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 hover:border-sky-400/40 transition-all flex items-center gap-2 shadow-sm font-mono text-sm font-extrabold text-sky-400">
                            <span className="text-sky-400 text-sm shrink-0">💳</span>
                            <span>{cam.priceFormatted}</span>
                          </div>
                        </td>
                      ))}
                      {comparedCameras.length < 6 && <td className="p-4 w-[18rem] min-w-[18rem]"></td>}
                    </tr>
                  )}

                  {/* SKU Row */}
                  {(!onlyDiffs || isSpecDifferent(comparedCameras, 'sku')) && (
                    <tr className="bg-[#1c1e24] hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white/80 border-r border-white/10 bg-[#16181d] align-top w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem]">
                        {t('specSku')}
                      </td>
                      {comparedCameras.map((cam) => (
                        <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] min-w-[18rem] align-top">
                          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 hover:border-amber-400/30 transition-all flex items-center gap-2 shadow-sm font-mono text-xs font-bold text-amber-300">
                            <span className="text-amber-400 text-sm shrink-0">🏷️</span>
                            <span className="truncate">{cam.sku}</span>
                          </div>
                        </td>
                      ))}
                      {comparedCameras.length < 6 && <td className="p-4 w-[18rem] min-w-[18rem]"></td>}
                    </tr>
                  )}
                </>
              )}

              {/* KEY FEATURES SECTION */}
              {(activeTab === 'all' || activeTab === 'highlights') && (
                <>
                  <tr className="bg-[#181a20] font-mono text-[11px] uppercase tracking-wider text-amber-300 font-extrabold border-y border-white/15">
                    <td colSpan={totalCols} className="p-3.5 bg-[#181a20]">
                      {t('sectionHighlights')}
                    </td>
                  </tr>

                  <tr className="bg-[#1c1e24] hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-white/80 border-r border-white/10 bg-[#16181d] align-top w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem]">
                      <div className="flex flex-col gap-1">
                        <span>{t('featuresLabel')}</span>
                        <span className="text-[10px] text-white/40 font-normal">Điểm mạnh sản phẩm</span>
                      </div>
                    </td>
                    {comparedCameras.map((cam) => (
                      <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] min-w-[18rem] align-top">
                        <ul className="space-y-2 text-xs text-white/95 font-medium leading-relaxed">
                          {featureList(cam.features, locale).map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 whitespace-normal break-words bg-white/5 p-2.5 rounded-xl border border-white/10 shadow-sm hover:border-amber-400/30 transition-all">
                              <span className="text-amber-400 font-bold shrink-0 text-sm leading-none mt-0.5">⚡</span>
                              <span className="flex-1 text-[11px] sm:text-xs leading-relaxed">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    ))}
                    {comparedCameras.length < 6 && <td className="p-4 w-[18rem] min-w-[18rem]"></td>}
                  </tr>
                </>
              )}

              {/* DYNAMIC CATEGORIZED SPEC SECTIONS */}
              {activeSpecSections.map((section) => (
                <React.Fragment key={section.id}>
                  {/* Section Title Header */}
                  <tr className="bg-[#181a20] font-mono text-[11px] uppercase tracking-wider text-amber-300 font-extrabold border-y border-white/15">
                    <td colSpan={totalCols} className="p-3.5 bg-[#181a20]">
                      {t(section.labelKey)}
                    </td>
                  </tr>

                  {section.specKeys.map((specKey) => {
                    const isDiff = isSpecDifferent(comparedCameras, specKey);

                    // Skip if onlyDiffs toggle is enabled and this row has no diffs
                    if (onlyDiffs && !isDiff) return null;

                    // Skip if all cameras have null for this spec
                    const hasAnyValue = comparedCameras.some(
                      (c) => getSpecValue(c, specKey) !== null,
                    );
                    if (!hasAnyValue) return null;

                    const specIcon = SPEC_ICONS[specKey] || '⚡';

                    return (
                      <tr
                        key={specKey}
                        className={`transition-colors ${
                          isDiff
                            ? 'bg-amber-500/10 hover:bg-amber-500/15'
                            : 'bg-[#1c1e24] hover:bg-white/5'
                        }`}
                      >
                        <td className="p-4 font-bold text-white/80 border-r border-white/10 bg-[#16181d] align-top w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem]">
                          <div className="flex items-center justify-between gap-2">
                            <span>{t(`specs.${specKey}`)}</span>
                            {isDiff && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                                {t('diffBadge')}
                              </span>
                            )}
                          </div>
                        </td>

                        {comparedCameras.map((cam) => {
                          const rawVal = getSpecValue(cam, specKey);
                          const formattedVal = rawVal
                            ? translateSpecValue(specKey, rawVal, locale)
                            : null;

                          return (
                            <td
                              key={cam.id}
                              className="p-4 border-r border-white/10 w-[18rem] min-w-[18rem] align-top"
                            >
                              {formattedVal ? (
                                <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 hover:border-amber-400/30 transition-all flex items-start gap-2.5 shadow-sm">
                                  <span className="text-amber-400 font-bold shrink-0 text-sm leading-none mt-0.5">
                                    {specIcon}
                                  </span>
                                  <span className="flex-1 text-[11px] sm:text-xs text-white/95 font-medium leading-relaxed whitespace-normal break-words">
                                    {formattedVal}
                                  </span>
                                </div>
                              ) : (
                                <div className="bg-white/[0.02] p-2.5 rounded-xl border border-white/5 text-white/30 text-[11px] font-mono">
                                  —
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {comparedCameras.length < 6 && <td className="p-4 w-[18rem] min-w-[18rem]"></td>}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SONY AI SPECIALIST CHATBOT INTEGRATION */}
      <div className="glass p-6 rounded-2xl flex flex-col gap-5 border border-white/20 shadow-2xl bg-[#181a1f]/90">
        <div className="flex items-center gap-3 border-b border-white/15 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-xl shrink-0">
            🤖
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-extrabold text-white">{t('aiSpecialistTitle')}</h2>
            <p className="text-xs text-white/70">{t('aiSpecialistSub')}</p>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[t('quickPrompt1'), t('quickPrompt2'), t('quickPrompt3')].map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => askAiSpecialist(prompt)}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/15 text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
            >
              💡 {prompt}
            </button>
          ))}
        </div>

        {/* Chat History Box */}
        <div className="flex flex-col gap-3 max-h-[22rem] overflow-y-auto p-4 rounded-xl bg-black/60 border border-white/15 font-sans">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${
                msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              <span className="text-[10px] font-mono text-white/50 mb-1">
                {msg.sender === 'user' ? 'Bạn' : 'Sony Specialist AI'}
              </span>
              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-amber-500/20 text-white border border-amber-400/40 rounded-tr-none'
                    : 'bg-white/10 text-white/95 border border-white/15 rounded-tl-none whitespace-pre-wrap'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isAiLoading && (
            <div className="mr-auto items-start flex flex-col">
              <span className="text-[10px] font-mono text-white/50 mb-1">Sony Specialist AI</span>
              <div className="p-3.5 rounded-2xl bg-white/10 text-white/70 text-xs border border-white/15 flex items-center gap-2 animate-pulse">
                <span>🤖 Đang phân tích kỹ thuật các mẫu máy...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            askAiSpecialist(userQuestion);
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={userQuestion}
            onChange={(e) => setUserQuestion(e.target.value)}
            placeholder={t('askSpecialistPlaceholder')}
            className="flex-1 px-4 py-3 rounded-xl bg-black/80 border border-white/20 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-amber-400/60 font-medium"
          />
          <button
            type="submit"
            disabled={!userQuestion.trim() || isAiLoading}
            className="px-5 py-3 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-white/90 disabled:opacity-40 transition-all shadow-md cursor-pointer shrink-0"
          >
            {t('sendQuestion')}
          </button>
        </form>
      </div>

      {/* Modal Add Item to Compare */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsAddModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-2xl max-h-[80dvh] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl border border-white/20 bg-[#181a1f]"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <h3 className="font-extrabold text-[1rem] text-white">{t('selectProductTitle')}</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={searchAddQuery}
              onChange={(e) => setSearchAddQuery(e.target.value)}
              placeholder="Tìm kiếm máy ảnh / ống kính muốn thêm..."
              className="w-full px-4 py-2.5 rounded-xl bg-black/80 border border-white/20 text-xs text-white placeholder:text-white/50 focus:outline-none"
            />

            <div className="flex-1 overflow-y-auto divide-y divide-white/10 pr-1">
              {availableToAdd.map((cam) => (
                <div
                  key={cam.id}
                  onClick={() => addCamera(cam.id)}
                  className="py-3 px-3 hover:bg-white/10 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
                      <Image
                        src={cam.imageUrl}
                        alt={cam.name}
                        width={40}
                        height={40}
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-white">{cam.name}</span>
                      <span className="font-mono text-[10px] text-amber-300">{cam.sku}</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-sky-400">{cam.priceFormatted}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
