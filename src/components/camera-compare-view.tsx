'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type { SonyCamera } from '@/lib/cameras/types';
import { featureList, splitFeatures } from '@/lib/cameras/features';
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

  // Admin Spec Editor State
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminEditMode, setIsAdminEditMode] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    camera: SonyCamera;
    specKey: string;
    label: string;
    currentVal: string;
  } | null>(null);
  const [editInputValue, setEditInputValue] = useState('');
  const [isSavingSpec, setIsSavingSpec] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Admin Key Features Editor State
  const [editingFeaturesCamera, setEditingFeaturesCamera] = useState<SonyCamera | null>(null);
  const [featuresViText, setFeaturesViText] = useState('');
  const [featuresEnText, setFeaturesEnText] = useState('');
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);
  const [featuresSaveFeedback, setFeaturesSaveFeedback] = useState<string | null>(null);

  // Check Admin Session on mount
  React.useEffect(() => {
    async function checkAdminSession() {
      try {
        const res = await fetch('/api/admin/session');
        const data = await res.json();
        if (data.isAdmin) {
          setIsAdmin(true);
        }
      } catch {
        // Not admin or offline
      }
    }
    checkAdminSession();
  }, []);

  const openEditModal = (camera: SonyCamera, specKey: string, label: string) => {
    const rawVal = getSpecValue(camera, specKey) ?? '';
    setEditingCell({ camera, specKey, label, currentVal: rawVal });
    setEditInputValue(rawVal);
    setSaveFeedback(null);
  };

  const openFeaturesEditModal = (camera: SonyCamera) => {
    setEditingFeaturesCamera(camera);
    const { en, vi } = splitFeatures(camera.features);
    setFeaturesViText(vi.join('\n'));
    setFeaturesEnText(en.join('\n'));
    setFeaturesSaveFeedback(null);
  };

  const handleSaveFeatures = async () => {
    if (!editingFeaturesCamera) return;
    setIsSavingFeatures(true);
    setFeaturesSaveFeedback(null);

    const viArray = featuresViText.split('\n').map((s) => s.trim()).filter(Boolean);
    const enArray = featuresEnText.split('\n').map((s) => s.trim()).filter(Boolean);

    try {
      const res = await fetch(`/api/admin/products/${editingFeaturesCamera.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: {
            vi: viArray,
            en: enArray,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        editingFeaturesCamera.features = data.features;
        setActiveIds((prev) => [...prev]);

        setFeaturesSaveFeedback('✓ Đã lưu điểm nổi bật vào Supabase!');
        setTimeout(() => {
          setEditingFeaturesCamera(null);
          setFeaturesSaveFeedback(null);
        }, 1200);
      } else {
        setFeaturesSaveFeedback(
          data.error === 'notAdmin'
            ? '❌ Thất bại: Tài khoản không có quyền Admin.'
            : '❌ Lỗi lưu dữ liệu Supabase.',
        );
      }
    } catch {
      setFeaturesSaveFeedback('❌ Lỗi kết nối server.');
    } finally {
      setIsSavingFeatures(false);
    }
  };

  const handleSaveSpec = async () => {
    if (!editingCell) return;
    const { camera, specKey } = editingCell;
    setIsSavingSpec(true);
    setSaveFeedback(null);

    const valToSave = editInputValue.trim() === '' ? null : editInputValue.trim();
    const currentSpecs = (camera.specs as unknown as Record<string, unknown>) || {};
    const updatedSpecs = {
      ...currentSpecs,
      [specKey]: valToSave,
    };

    try {
      const res = await fetch(`/api/admin/products/${camera.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specs: updatedSpecs }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        // Update local camera object so UI reflects changes instantly
        camera.specs = data.specs;
        // Trigger re-render
        setActiveIds((prev) => [...prev]);

        setSaveFeedback('✓ Đã lưu thành công vào Supabase!');
        setTimeout(() => {
          setEditingCell(null);
          setSaveFeedback(null);
        }, 1200);
      } else {
        setSaveFeedback(
          data.error === 'notAdmin'
            ? '❌ Thất bại: Tài khoản không có quyền Admin.'
            : '❌ Lỗi lưu dữ liệu Supabase.',
        );
      }
    } catch {
      setSaveFeedback('❌ Lỗi kết nối server.');
    } finally {
      setIsSavingSpec(false);
    }
  };

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

  const getSectionThemeConfig = (sectionId: string) => {
    switch (sectionId) {
      case 'general':
        return {
          headerBg: 'bg-gradient-to-r from-cyan-950/90 via-[#161b22] to-cyan-950/40 border-l-4 border-cyan-400',
          headerText: 'text-cyan-300',
          border: 'border-cyan-500/30',
          cardBg: 'bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-400/60',
          iconColor: 'text-cyan-400',
        };
      case 'pricing':
        return {
          headerBg: 'bg-gradient-to-r from-sky-950/90 via-[#161b22] to-sky-950/40 border-l-4 border-sky-400',
          headerText: 'text-sky-300',
          border: 'border-sky-500/30',
          cardBg: 'bg-sky-950/20 border-sky-500/30 hover:border-sky-400/60',
          iconColor: 'text-sky-400',
        };
      case 'highlights':
        return {
          headerBg: 'bg-gradient-to-r from-amber-950/90 via-[#161b22] to-amber-950/40 border-l-4 border-amber-400',
          headerText: 'text-amber-300',
          border: 'border-amber-500/30',
          cardBg: 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400/60',
          iconColor: 'text-amber-400',
        };
      case 'sensorOptics':
        return {
          headerBg: 'bg-gradient-to-r from-purple-950/90 via-[#161b22] to-purple-950/40 border-l-4 border-purple-400',
          headerText: 'text-purple-300',
          border: 'border-purple-500/30',
          cardBg: 'bg-purple-950/20 border-purple-500/30 hover:border-purple-400/60',
          iconColor: 'text-purple-400',
        };
      case 'videoIso':
        return {
          headerBg: 'bg-gradient-to-r from-orange-950/90 via-[#161b22] to-orange-950/40 border-l-4 border-orange-400',
          headerText: 'text-orange-300',
          border: 'border-orange-500/30',
          cardBg: 'bg-orange-950/20 border-orange-500/30 hover:border-orange-400/60',
          iconColor: 'text-orange-400',
        };
      case 'afStab':
        return {
          headerBg: 'bg-gradient-to-r from-emerald-950/90 via-[#161b22] to-emerald-950/40 border-l-4 border-emerald-400',
          headerText: 'text-emerald-300',
          border: 'border-emerald-500/30',
          cardBg: 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-400/60',
          iconColor: 'text-emerald-400',
        };
      case 'physical':
        return {
          headerBg: 'bg-gradient-to-r from-rose-950/90 via-[#161b22] to-rose-950/40 border-l-4 border-rose-400',
          headerText: 'text-rose-300',
          border: 'border-rose-500/30',
          cardBg: 'bg-rose-950/20 border-rose-500/30 hover:border-rose-400/60',
          iconColor: 'text-rose-400',
        };
      default:
        return {
          headerBg: 'bg-[#181a20] border-l-4 border-amber-400',
          headerText: 'text-amber-300',
          border: 'border-white/15',
          cardBg: 'bg-white/5 border-white/10 hover:border-amber-400/30',
          iconColor: 'text-amber-400',
        };
    }
  };

  const getTabActiveStyle = (tabId: CompareTabId) => {
    switch (tabId) {
      case 'all':
        return 'bg-white text-black shadow-lg shadow-white/20 scale-[1.02] font-black';
      case 'highlights':
        return 'bg-amber-400 text-black shadow-lg shadow-amber-400/25 scale-[1.02] font-black';
      case 'sensorOptics':
        return 'bg-purple-500 text-white shadow-lg shadow-purple-500/30 scale-[1.02] font-black';
      case 'videoIso':
        return 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-[1.02] font-black';
      case 'afStab':
        return 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-[1.02] font-black';
      case 'physical':
        return 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-[1.02] font-black';
      default:
        return 'bg-amber-400 text-black shadow-lg scale-[1.02] font-black';
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
                    ? getTabActiveStyle(tab.id)
                    : 'bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/10'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Difference & Admin Edit Toggle Controls */}
        <div className="flex items-center gap-2.5 shrink-0 border-t md:border-t-0 border-white/10 pt-3 md:pt-0 flex-wrap">
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

          {/* Admin Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setIsAdminEditMode((prev) => !prev)}
            title="Bật/Tắt chế độ chỉnh sửa thông số Admin trực tiếp"
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border ${
              isAdminEditMode
                ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400/70 ring-1 ring-cyan-400/50 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 text-white/70 hover:text-white border-white/15 hover:bg-white/10'
            }`}
          >
            <span>✏️</span>
            <span>{isAdminEditMode ? 'Tắt sửa Admin' : 'Chỉnh sửa (Admin)'}</span>
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
                  <tr className="bg-gradient-to-r from-cyan-950/90 via-[#181a20] to-cyan-950/40 border-l-4 border-cyan-400 font-mono text-[11px] uppercase tracking-wider text-cyan-300 font-extrabold border-y border-cyan-500/30">
                    <td colSpan={totalCols} className="p-3.5">
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
                          <div className="bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/30 hover:border-cyan-400/60 transition-all shadow-sm flex items-center gap-2">
                            <span className="text-cyan-400 text-sm">📦</span>
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
                          <div className="bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/30 hover:border-cyan-400/60 transition-all flex items-start gap-2 shadow-sm text-xs font-bold text-white">
                            <span className="text-cyan-400 text-sm shrink-0">🏷️</span>
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
                          <div className="bg-cyan-950/20 p-2.5 rounded-xl border border-cyan-500/30 hover:border-cyan-400/60 transition-all flex items-start gap-2 shadow-sm text-xs font-mono text-white/80 font-semibold">
                            <span className="text-cyan-400 text-sm shrink-0">📂</span>
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
                  <tr className="bg-gradient-to-r from-sky-950/90 via-[#181a20] to-sky-950/40 border-l-4 border-sky-400 font-mono text-[11px] uppercase tracking-wider text-sky-300 font-extrabold border-y border-sky-500/30">
                    <td colSpan={totalCols} className="p-3.5">
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
                          <div className="bg-sky-950/20 p-2.5 rounded-xl border border-sky-500/30 hover:border-sky-400/60 transition-all flex items-center gap-2 shadow-sm font-mono text-sm font-extrabold text-sky-400">
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
                          <div className="bg-sky-950/20 p-2.5 rounded-xl border border-sky-500/30 hover:border-sky-400/60 transition-all flex items-center gap-2 shadow-sm font-mono text-xs font-bold text-sky-300">
                            <span className="text-sky-400 text-sm shrink-0">🏷️</span>
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
                  <tr className="bg-gradient-to-r from-amber-950/90 via-[#181a20] to-amber-950/40 border-l-4 border-amber-400 font-mono text-[11px] uppercase tracking-wider text-amber-300 font-extrabold border-y border-amber-500/30">
                    <td colSpan={totalCols} className="p-3.5">
                      ⚡ {t('sectionHighlights')}
                    </td>
                  </tr>

                  <tr className="bg-[#1c1e24] hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-white/80 border-r border-white/10 bg-[#16181d] align-top w-48 sm:w-60 min-w-[12rem] sm:min-w-[15rem]">
                      <div className="flex flex-col gap-1">
                        <span>{t('featuresLabel')}</span>
                        <span className="text-[10px] text-white/40 font-normal">Điểm mạnh sản phẩm</span>
                      </div>
                    </td>
                    {comparedCameras.map((cam) => {
                      const feats = featureList(cam.features, locale);
                      return (
                        <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] min-w-[18rem] align-top">
                          <div className="flex flex-col gap-2">
                            {isAdminEditMode && (
                              <button
                                type="button"
                                onClick={() => openFeaturesEditModal(cam)}
                                className="w-full bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/50 text-amber-200 text-[11px] font-extrabold p-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer mb-1"
                              >
                                <span>✏️</span>
                                <span>Sửa điểm nổi bật (Features)</span>
                              </button>
                            )}

                            {feats.length > 0 ? (
                              <ul className="space-y-2 text-xs text-white/95 font-medium leading-relaxed">
                                {feats.map((feat, idx) => (
                                  <li key={idx} className="flex items-start gap-2.5 whitespace-normal break-words bg-amber-950/20 p-2.5 rounded-xl border border-amber-500/30 shadow-sm hover:border-amber-400/60 transition-all">
                                    <span className="text-amber-400 font-bold shrink-0 text-sm leading-none mt-0.5">⚡</span>
                                    <span className="flex-1 text-[11px] sm:text-xs leading-relaxed">{feat}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="bg-white/[0.02] p-2.5 rounded-xl border border-white/5 text-white/30 text-[11px] font-mono">
                                — Chưa có điểm nổi bật
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {comparedCameras.length < 6 && <td className="p-4 w-[18rem] min-w-[18rem]"></td>}
                  </tr>
                </>
              )}

              {/* DYNAMIC CATEGORIZED SPEC SECTIONS */}
              {activeSpecSections.map((section) => {
                const sectionTheme = getSectionThemeConfig(section.id);
                return (
                  <React.Fragment key={section.id}>
                    {/* Section Title Header */}
                    <tr className={`${sectionTheme.headerBg} font-mono text-[11px] uppercase tracking-wider ${sectionTheme.headerText} font-extrabold border-y ${sectionTheme.border}`}>
                      <td colSpan={totalCols} className="p-3.5">
                        {section.icon} {t(section.labelKey)}
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
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm shrink-0">
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
                                  <div className={`${sectionTheme.cardBg} p-2.5 rounded-xl transition-all flex items-start justify-between gap-2 shadow-sm group/cell`}>
                                    <div className="flex items-start gap-2.5 flex-1">
                                      <span className={`${sectionTheme.iconColor} font-bold shrink-0 text-sm leading-none mt-0.5`}>
                                        {specIcon}
                                      </span>
                                      <span className="flex-1 text-[11px] sm:text-xs text-white/95 font-medium leading-relaxed whitespace-normal break-words">
                                        {formattedVal}
                                      </span>
                                    </div>
                                    {isAdminEditMode && (
                                      <button
                                        type="button"
                                        onClick={() => openEditModal(cam, specKey, t(`specs.${specKey}`))}
                                        title="Chỉnh sửa thông số này"
                                        className="shrink-0 px-2 py-1 rounded-lg bg-cyan-400/20 hover:bg-cyan-400/40 text-cyan-300 border border-cyan-400/50 text-[10px] font-bold transition-all cursor-pointer"
                                      >
                                        ✏️ Sửa
                                      </button>
                                    )}
                                  </div>
                                ) : isAdminEditMode ? (
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(cam, specKey, t(`specs.${specKey}`))}
                                    className="w-full bg-cyan-950/40 hover:bg-cyan-900/60 p-2.5 rounded-xl border border-dashed border-cyan-400/50 text-cyan-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                  >
                                    <span>+</span>
                                    <span>Điền thông số</span>
                                  </button>
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
                );
              })}
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

      {/* Admin Spec Edit Modal */}
      {editingCell && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingCell(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-backdrop-blur font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg font-sans cursor-default animate-lightbox-zoom"
          >
            {/* 7-Color Static Rainbow Glow Halo */}
            <span aria-hidden className="rainbow-glow-bar" />

            <div className="relative z-10 glass w-full rounded-2xl p-6 flex flex-col gap-5 shadow-2xl border border-white/25 bg-[#1a1c22]/95 text-white font-sans">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/15 pb-3 font-sans">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">✏️</span>
                  <div className="flex flex-col">
                    <h3 className="font-extrabold text-sm text-white font-sans">
                      Sửa / Điền thông số sản phẩm (Admin)
                    </h3>
                    <span className="text-xs text-amber-300 font-mono font-bold">
                      {editingCell.camera.name} ({editingCell.camera.sku})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Spec Field Label */}
              <div className="flex flex-col gap-2 font-sans">
                <label className="text-xs font-bold text-white/80 flex items-center gap-1.5 flex-wrap">
                  <span>Mục cần cập nhật:</span>
                  <span className="text-cyan-300 font-extrabold">{editingCell.label}</span>
                  <span className="font-mono text-[10px] text-white/50">({editingCell.specKey})</span>
                </label>
                <textarea
                  rows={3}
                  value={editInputValue}
                  onChange={(e) => setEditInputValue(e.target.value)}
                  placeholder="Nhập giá trị thông số kỹ thuật (ví dụ: Full-Frame Exmor R CMOS BSI)..."
                  className="w-full bg-black/80 border border-white/25 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 rounded-xl p-3 text-xs text-white placeholder:text-white/40 focus:outline-none transition-all font-sans leading-relaxed"
                />
              </div>

              {/* Status Feedback */}
              {saveFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold text-center font-sans ${
                    saveFeedback.startsWith('✓')
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}
                >
                  {saveFeedback}
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/15 font-sans">
                <button
                  type="button"
                  onClick={() => setEditInputValue('')}
                  className="text-xs text-white/60 hover:text-white underline transition-colors cursor-pointer"
                >
                  Xóa trống (Set NULL)
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCell(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isSavingSpec}
                    onClick={handleSaveSpec}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 text-black font-extrabold text-xs sm:text-sm shadow-lg hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer scale-105"
                  >
                    {isSavingSpec ? '⏳ Đang lưu...' : '💾 Lưu vào Supabase'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Features Edit Modal */}
      {editingFeaturesCamera && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingFeaturesCamera(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-backdrop-blur font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl font-sans cursor-default animate-lightbox-zoom"
          >
            {/* 7-Color Static Rainbow Glow Halo */}
            <span aria-hidden className="rainbow-glow-bar" />

            <div className="relative z-10 glass w-full rounded-2xl p-6 flex flex-col gap-5 shadow-2xl border border-white/25 bg-[#1a1c22]/95 text-white font-sans">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/15 pb-3 font-sans">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">⚡</span>
                  <div className="flex flex-col">
                    <h3 className="font-extrabold text-sm text-white font-sans">
                      Sửa điểm nổi bật sản phẩm (Key Features)
                    </h3>
                    <span className="text-xs text-amber-300 font-mono font-bold">
                      {editingFeaturesCamera.name} ({editingFeaturesCamera.sku})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingFeaturesCamera(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Vietnamese Features Input */}
              <div className="flex flex-col gap-2 font-sans">
                <label className="text-xs font-bold text-white/80 flex items-center justify-between">
                  <span>Điểm nổi bật (Tiếng Việt) - Mỗi dòng 1 ý:</span>
                  <span className="text-[10px] text-amber-300 font-mono">vi</span>
                </label>
                <textarea
                  rows={4}
                  value={featuresViText}
                  onChange={(e) => setFeaturesViText(e.target.value)}
                  placeholder="Nhập các điểm mạnh (mỗi dòng một ý)...&#10;Khẩu độ thay đổi từ f/5.6 đến f/8&#10;Thiết kế chống bụi và chống ẩm"
                  className="w-full bg-black/80 border border-white/25 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 rounded-xl p-3 text-xs text-white placeholder:text-white/40 focus:outline-none transition-all font-sans leading-relaxed"
                />
              </div>

              {/* English Features Input */}
              <div className="flex flex-col gap-2 font-sans">
                <label className="text-xs font-bold text-white/80 flex items-center justify-between">
                  <span>Key Features (English) - One per line:</span>
                  <span className="text-[10px] text-sky-300 font-mono">en</span>
                </label>
                <textarea
                  rows={3}
                  value={featuresEnText}
                  onChange={(e) => setFeaturesEnText(e.target.value)}
                  placeholder="Enter key features (one per line)..."
                  className="w-full bg-black/80 border border-white/25 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 rounded-xl p-3 text-xs text-white placeholder:text-white/40 focus:outline-none transition-all font-sans leading-relaxed"
                />
              </div>

              {/* Status Feedback */}
              {featuresSaveFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold text-center font-sans ${
                    featuresSaveFeedback.startsWith('✓')
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}
                >
                  {featuresSaveFeedback}
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/15 font-sans">
                <button
                  type="button"
                  onClick={() => setEditingFeaturesCamera(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSavingFeatures}
                  onClick={handleSaveFeatures}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 text-black font-extrabold text-xs sm:text-sm shadow-lg hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer scale-105"
                >
                  {isSavingFeatures ? '⏳ Đang lưu...' : '💾 Lưu điểm nổi bật'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
