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

/**
 * One row of the compare grid.
 *
 * `value` is the ordinary case: one string per product, or `null` where the
 * catalogue publishes no figure — which renders as an em dash and never as an
 * empty cell. `node` is for the two rows whose cell is more than one string.
 */
interface CompareRowDef {
  key: string;
  label: string;
  value?: (cam: SonyCamera) => string | null;
  node?: (cam: SonyCamera) => React.ReactNode;
  /** The difference filter never hides this row (the key-features block). */
  always?: boolean;
}

/**
 * The grid's column head: 13px/600 uppercase, 0.06em — a hair tighter than
 * `.label`'s 0.08em, because these run across a wide matrix rather than
 * standing alone over a block.
 */
const COL_HEAD = 'text-label font-semibold uppercase tracking-[0.06em] text-ink-faint';

/**
 * The geometry of a chip, restated.
 *
 * `.chip` is unlayered CSS written *after* `.surface-selected` in globals.css,
 * so the two cannot be combined on one element: the chip's own white film and
 * `ink-muted` colour would win the cascade and the selection would vanish. A
 * selected chip therefore takes the geometry from here and the fill from
 * `.surface-selected`, with pure white text over the tinted field.
 */
const CHIP_GEOMETRY =
  'inline-flex items-center gap-1.5 px-3 min-h-[var(--layout-touch-target)] ' +
  'text-label font-semibold cursor-pointer transition-colors';

const CHIP_SELECTED = `${CHIP_GEOMETRY} surface-selected text-white`;

/** The small square control that closes or removes. */
const ICON_BUTTON =
  'inline-flex items-center justify-center w-9 h-9 pointer-coarse:w-11 pointer-coarse:h-11 ' +
  'rounded-sm bg-white/[0.08] hover:bg-white/[0.13] text-ink-muted hover:text-ink ' +
  'shadow-[var(--elevation-spec)] transition-colors cursor-pointer';

/**
 * Category names come from the catalogue's own enum, read back through the
 * message catalogue rather than upper-cased in place.
 */
const CATEGORY_LABEL_KEY: Record<string, string> = {
  camera: 'catCamera',
  lens: 'catLens',
  accessory: 'catAccessory',
  audio: 'catAudio',
};

/** What the catalogue does not publish. Never a blank cell. */
const EM_DASH = '—';

export function CameraCompareView({ initialCameras, selectedIds }: CameraCompareViewProps) {
  const t = useTranslations('cameras');
  const locale = useLocale();
  const router = useRouter();

  const [activeIds, setActiveIds] = useState<string[]>(selectedIds);

  /**
   * The catalogue this view renders.
   *
   * Held in state because the two admin editors below write to it. They used to
   * assign straight into the camera object — `camera.specs = data.specs` — and
   * then force a repaint with `setActiveIds([...prev])`. That worked only by
   * side effect: the new array identity invalidated the memo underneath, which
   * re-read the object that had just been mutated behind React's back.
   *
   * It is also a prop, so the write landed in the Server Component's payload:
   * the same array backs the RSC cache, and an edit that failed to persist
   * still looked saved until a hard reload. Replacing one row immutably keeps
   * every other row's identity stable, so nothing else re-renders either.
   */
  const [cameras, setCameras] = useState<SonyCamera[]>(initialCameras);
  const [syncedCameras, setSyncedCameras] = useState<SonyCamera[]>(initialCameras);
  if (syncedCameras !== initialCameras) {
    // A navigation delivered a fresh catalogue; adopt it and drop local edits,
    // which are already persisted server-side by the time they are visible.
    setSyncedCameras(initialCameras);
    setCameras(initialCameras);
  }

  /** Replaces one product, leaving every other row's identity untouched. */
  const patchCamera = (id: string, patch: Partial<SonyCamera>) =>
    setCameras((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchAddQuery, setSearchAddQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CompareTabId>('all');
  const [onlyDiffs, setOnlyDiffs] = useState(false);

  // Admin Spec Editor State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<'super' | 'di' | 'pe'>('super');
  const [isAdminEditMode, setIsAdminEditMode] = useState(false);
  /**
   * Both conditions, everywhere an edit affordance is drawn.
   *
   * Deriving rather than gating on the toggle alone means the session check is
   * the single source of truth: if it has not answered yet, or comes back
   * negative, no pencil renders even when the toggle was somehow left on.
   */
  const canEditSpecs = isAdmin && isAdminEditMode;

  const canEditCamera = (cam: SonyCamera) => {
    if (!canEditSpecs) return false;
    if (adminRole === 'super') return true;
    if (adminRole === 'di') return cam.category !== 'audio';
    if (adminRole === 'pe') return cam.category === 'audio';
    return false;
  };

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
          setAdminRole(data.role ?? 'super');
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
        patchCamera(editingFeaturesCamera.id, { features: data.features });
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
        // Reflect the saved value immediately, without a refetch.
        patchCamera(camera.id, { specs: data.specs });
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
    return cameras.filter((c) => activeIds.includes(c.id));
  }, [cameras, activeIds]);

  const canAddMore = comparedCameras.length < 6;

  const totalCols = useMemo(() => {
    return comparedCameras.length + (comparedCameras.length < 6 ? 2 : 1);
  }, [comparedCameras.length]);

  // Unselected cameras available to add
  const availableToAdd = useMemo(() => {
    const remaining = cameras.filter((c) => !activeIds.includes(c.id));
    if (!searchAddQuery.trim()) return remaining;
    const q = searchAddQuery.trim().toLowerCase();
    return remaining.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.sku.toLowerCase().includes(q) ||
        c.subCategory1.toLowerCase().includes(q),
    );
  }, [cameras, activeIds, searchAddQuery]);

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

  const activeSpecSections = useMemo(() => {
    return getActiveSpecSections(comparedCameras, activeTab);
  }, [comparedCameras, activeTab]);

  const tabs: { id: CompareTabId; label: string }[] = [
    { id: 'all', label: t('tabAll') },
    { id: 'highlights', label: t('tabHighlights') },
    { id: 'sensorOptics', label: t('tabSensorOptics') },
    { id: 'videoIso', label: t('tabVideoIso') },
    { id: 'afStab', label: t('tabAfStab') },
    { id: 'physical', label: t('tabPhysical') },
  ];

  /** One admin affordance, used by every spec cell the current role may edit. */
  const specEditButton = (cam: SonyCamera, specKey: string, label: string, filled: boolean) => (
    <button
      type="button"
      onClick={() => openEditModal(cam, specKey, label)}
      title="Chỉnh sửa thông số này"
      className="chip chip-action"
    >
      {filled ? 'Sửa' : 'Điền thông số'}
    </button>
  );

  /**
   * The grid, as blocks of rows.
   *
   * Built as data rather than as six near-identical `<tr>` blocks so the
   * alternating tint can count rows inside a block, and so one cell recipe —
   * right-aligned, tabular, em dash where the catalogue publishes nothing —
   * covers every row. Which blocks appear is exactly the previous behaviour:
   * the tab decides, `getActiveSpecSections` filters the spec groups, and the
   * difference toggle drops rows every product agrees on.
   */
  const blocks: { id: string; label: string; rows: CompareRowDef[] }[] = [];

  if (activeTab === 'all' || activeTab === 'sensorOptics') {
    blocks.push({
      id: 'general',
      label: t('specCategory'),
      rows: [
        {
          key: 'category',
          label: t('categoryLabel'),
          value: (cam) => t(CATEGORY_LABEL_KEY[cam.category] ?? 'catAll'),
        },
        { key: 'subCategory1', label: t('specSub1'), value: (cam) => cam.subCategory1 },
        { key: 'subCategory2', label: t('specSub2'), value: (cam) => cam.subCategory2 },
      ],
    });
  }

  if (activeTab === 'all') {
    blocks.push({
      id: 'pricing',
      label: `${t('priceLabel')} · ${t('skuLabel')}`,
      rows: [
        { key: 'priceFormatted', label: t('specPrice'), value: (cam) => cam.priceFormatted },
        { key: 'sku', label: t('specSku'), value: (cam) => cam.sku },
      ],
    });
  }

  if (activeTab === 'all' || activeTab === 'highlights') {
    blocks.push({
      id: 'highlights',
      label: t('sectionHighlights'),
      rows: [
        {
          key: 'features',
          label: t('featuresLabel'),
          always: true,
          node: (cam) => {
            const feats = featureList(cam.features, locale);
            return (
              <div className="flex flex-col items-end gap-1.5">
                {canEditCamera(cam) && (
                  <button
                    type="button"
                    onClick={() => openFeaturesEditModal(cam)}
                    className="chip chip-action"
                  >
                    Sửa điểm nổi bật (Features)
                  </button>
                )}
                {feats.length > 0 ? (
                  feats.map((feat, idx) => (
                    <span key={idx} className="block leading-relaxed">
                      {feat}
                    </span>
                  ))
                ) : (
                  <span className="text-ink-faint">{EM_DASH}</span>
                )}
              </div>
            );
          },
        },
      ],
    });
  }

  for (const section of activeSpecSections) {
    const rows: CompareRowDef[] = section.specKeys
      .filter((specKey) => comparedCameras.some((c) => getSpecValue(c, specKey) !== null))
      .map((specKey) => {
        const label = t(`specs.${specKey}`);
        return {
          key: specKey,
          label,
          node: (cam) => {
            const rawVal = getSpecValue(cam, specKey);
            const formattedVal = rawVal ? translateSpecValue(specKey, rawVal, locale) : null;
            return (
              <div className="flex flex-col items-end gap-1.5">
                <span className={formattedVal ? undefined : 'text-ink-faint'}>
                  {formattedVal ?? EM_DASH}
                </span>
                {canEditCamera(cam) && specEditButton(cam, specKey, label, Boolean(formattedVal))}
              </div>
            );
          },
        };
      });
    if (rows.length > 0) blocks.push({ id: section.id, label: t(section.labelKey), rows });
  }

  /* The difference filter, applied once over the whole grid rather than per
     block, so a block whose every row agrees disappears with its head. */
  const visibleBlocks = blocks
    .map((block) => ({
      ...block,
      rows: block.rows.filter(
        (row) => !onlyDiffs || row.always || isSpecDifferent(comparedCameras, row.key),
      ),
    }))
    .filter((block) => block.rows.length > 0);

  return (
    <div className="w-full flex flex-col gap-6 pb-16">
      {/* Page head — the label says how many, the title says which. */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/${locale}/cameras`} className="btn-glass">
            {t('backToCatalog')}
          </Link>

          <button type="button" onClick={() => window.print()} className="btn-glass cursor-pointer">
            {t('printCompare')}
          </button>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2 min-w-0">
            <span className="label">{t('compareSummary', { count: comparedCameras.length })}</span>
            <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">
              {comparedCameras.map((c) => c.name).join(' · ')}
            </h1>
          </div>

          {/* What the accent and the em dash mean, said once. */}
          <p className="text-body-sm text-ink-muted max-w-[44ch] sm:text-right">
            {t('compareLegend')}
          </p>
        </div>
      </div>

      {/* Controls — a segmented rut for the sections, chips for the toggles. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="surface-sunken p-1.5 flex items-center gap-1 overflow-x-auto scroll-silent">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap ${
                  isActive ? CHIP_SELECTED : `${CHIP_GEOMETRY} text-ink-muted hover:text-ink`
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            aria-pressed={onlyDiffs}
            onClick={() => setOnlyDiffs((prev) => !prev)}
            className={onlyDiffs ? CHIP_SELECTED : 'chip chip-action'}
          >
            {onlyDiffs ? t('highlightDiffs') : t('showAllSpecs')}
          </button>

          {/* Admin Mode Toggle Button — only for a verified admin session.
              `isAdmin` was fetched and then never read, so every visitor was
              offered this toggle and could open the edit modals. The PATCH
              route rejects them (`notAdmin`), so nothing leaked; what they got
              was admin chrome that answered every save with an error. */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={isAdminEditMode}
                onClick={() => setIsAdminEditMode((prev) => !prev)}
                title="Bật/Tắt chế độ chỉnh sửa thông số Admin trực tiếp"
                className={isAdminEditMode ? CHIP_SELECTED : 'chip chip-action'}
              >
                {isAdminEditMode ? 'Tắt sửa Admin' : 'Chỉnh sửa (Admin)'}
              </button>
              <span className="chip">
                {adminRole === 'super'
                  ? 'Super Dev'
                  : adminRole === 'di'
                    ? 'DI Admin'
                    : 'PE Admin'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* The compare grid — one panel, no rules, alternating tint. */}
      <div className="surface px-4 pt-3 pb-4">
        <div className="overflow-x-auto scroll-area">
          <table className="w-full text-left table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[15rem] min-w-[11rem]" />
              {comparedCameras.map((cam) => (
                <col key={cam.id} className="w-[14rem] min-w-[12rem]" />
              ))}
              {canAddMore && <col className="w-[14rem] min-w-[12rem]" />}
            </colgroup>

            {/* Head — the spec column reads left, every product reads right. */}
            <thead className="sticky top-0 z-20">
              <tr>
                <th
                  scope="col"
                  className={`${COL_HEAD} px-4 py-3 text-left align-bottom bg-void/85 backdrop-blur-[30px]`}
                >
                  {t('sensorLabel')}
                </th>

                {comparedCameras.map((cam) => (
                  <th
                    key={cam.id}
                    scope="col"
                    className="px-4 py-3 align-bottom text-right bg-void/85 backdrop-blur-[30px]"
                  >
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => router.push(`/cameras/${cam.id}`)}
                        className="text-title-3 font-semibold tracking-[-0.02em] text-ink hover:text-accent-400 transition-colors cursor-pointer text-right"
                      >
                        {cam.name}
                      </button>

                      <div className="flex items-center gap-2">
                        {cam.url && (
                          <a
                            href={cam.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-meta font-semibold text-accent-400"
                          >
                            Sony ↗
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => removeCamera(cam.id)}
                          title={t('removeProduct')}
                          aria-label={t('removeProduct')}
                          className={ICON_BUTTON}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </th>
                ))}

                {/* Slot to Add More Products (Up to 6) */}
                {canAddMore && (
                  <th
                    scope="col"
                    className="px-4 py-3 align-bottom text-right bg-void/85 backdrop-blur-[30px]"
                  >
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(true)}
                      className="btn-glass w-full cursor-pointer"
                    >
                      {t('addMoreToCompare')}
                    </button>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {visibleBlocks.map((block) => (
                <React.Fragment key={block.id}>
                  <tr>
                    <td colSpan={totalCols} className="px-4 pt-6 pb-2">
                      <span className="label">{block.label}</span>
                    </td>
                  </tr>

                  {block.rows.map((row, idx) => {
                    const isDiff = isSpecDifferent(comparedCameras, row.key);
                    return (
                      <tr key={row.key} className={idx % 2 === 0 ? 'row-tint' : undefined}>
                        <th
                          scope="row"
                          className="px-4 py-3 text-left align-top text-body-sm font-normal text-ink-muted"
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            <span>{row.label}</span>
                            {isDiff && <span className="chip">{t('diffBadge')}</span>}
                          </span>
                        </th>

                        {comparedCameras.map((cam) => (
                          <td
                            key={cam.id}
                            className="px-4 py-3 align-top text-right text-body-sm text-ink tabular-nums"
                          >
                            {row.node ? (
                              row.node(cam)
                            ) : (
                              row.value?.(cam) || <span className="text-ink-faint">{EM_DASH}</span>
                            )}
                          </td>
                        ))}

                        {canAddMore && <td className="px-4 py-3" />}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sony Specialist — a second panel, not a second visual language. */}
      <div className="surface p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-title-3 font-semibold text-ink">{t('aiSpecialistTitle')}</h2>
          <p className="meta">{t('aiSpecialistSub')}</p>
        </div>

        <div className="seam" />

        {/* Quick Suggestion Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scroll-silent">
          {[t('quickPrompt1'), t('quickPrompt2'), t('quickPrompt3')].map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => askAiSpecialist(prompt)}
              className="chip chip-action whitespace-nowrap"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat History Box */}
        <div className="surface-sunken flex flex-col gap-3 max-h-[22rem] p-4 scroll-area">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] gap-1 ${
                msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              <span className="meta">
                {msg.sender === 'user' ? t('chatYou') : t('aiSpecialistTitle')}
              </span>
              <div
                className={`p-3.5 text-body-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'surface-selected text-white'
                    : 'rounded-sm bg-white/[0.06] text-ink shadow-[var(--elevation-spec)] whitespace-pre-wrap'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isAiLoading && (
            <div className="mr-auto items-start flex flex-col gap-1">
              <span className="meta">{t('aiSpecialistTitle')}</span>
              <div className="p-3.5 rounded-sm bg-white/[0.06] text-ink-muted text-body-sm shadow-[var(--elevation-spec)]">
                {t('aiThinking')}
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
            className="surface-sunken flex-1 min-w-0 px-4 py-3 text-body text-ink placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={!userQuestion.trim() || isAiLoading}
            className="btn-accent shrink-0 disabled:opacity-40 cursor-pointer"
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
          className="fixed inset-0 z-50 bg-void/85 backdrop-blur-[30px] flex items-center justify-center p-4 inset-safe pb-safe animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-raised w-full max-w-2xl max-h-[80dvh] p-6 flex flex-col gap-4 cursor-default"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-title-3 font-semibold text-ink">{t('selectProductTitle')}</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                aria-label={t('closeDialog')}
                className={ICON_BUTTON}
              >
                ✕
              </button>
            </div>

            <div className="seam" />

            <input
              type="text"
              value={searchAddQuery}
              onChange={(e) => setSearchAddQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="surface-sunken w-full px-4 py-3 text-body text-ink placeholder:text-ink-faint"
            />

            <div className="flex-1 flex flex-col gap-1 scroll-area">
              {availableToAdd.map((cam, idx) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => addCamera(cam.id)}
                  className={`w-full text-left p-3 rounded-sm flex items-center justify-between gap-3 cursor-pointer transition-colors hover:bg-white/[0.06] ${
                    idx % 2 === 0 ? 'row-tint' : ''
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-sm bg-white p-1 flex items-center justify-center shrink-0">
                      <Image
                        src={cam.imageUrl}
                        alt={cam.name}
                        width={40}
                        height={40}
                        className="object-contain"
                      />
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="text-body-sm font-semibold text-ink truncate">
                        {cam.name}
                      </span>
                      <span className="meta truncate">{cam.sku}</span>
                    </span>
                  </span>
                  <span className="text-body-sm font-semibold text-accent-400 tabular-nums shrink-0">
                    {cam.priceFormatted}
                  </span>
                </button>
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
          className="fixed inset-0 z-50 bg-void/85 backdrop-blur-[30px] flex flex-col items-center justify-center p-4 inset-safe pb-safe animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-raised w-full max-w-lg p-6 flex flex-col gap-5 cursor-default"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-title-3 font-semibold text-ink">
                  Sửa / Điền thông số sản phẩm (Admin)
                </h2>
                <span className="meta">
                  {editingCell.camera.name} ({editingCell.camera.sku})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                aria-label={t('closeDialog')}
                className={ICON_BUTTON}
              >
                ✕
              </button>
            </div>

            <div className="seam" />

            {/* Spec Field Label */}
            <div className="flex flex-col gap-2">
              <label className="text-body-sm text-ink-muted flex items-center gap-1.5 flex-wrap">
                <span>Mục cần cập nhật:</span>
                <span className="font-semibold text-ink">{editingCell.label}</span>
                <span className="meta">({editingCell.specKey})</span>
              </label>
              <textarea
                rows={3}
                value={editInputValue}
                onChange={(e) => setEditInputValue(e.target.value)}
                placeholder="Nhập giá trị thông số kỹ thuật (ví dụ: Full-Frame Exmor R CMOS BSI)..."
                className="surface-sunken w-full p-3 text-body text-ink placeholder:text-ink-faint leading-relaxed"
              />
            </div>

            {/* Status Feedback */}
            {saveFeedback && (
              <p
                className={`text-body-sm font-semibold ${
                  saveFeedback.startsWith('✓') ? 'text-community' : 'text-danger'
                }`}
              >
                {saveFeedback}
              </p>
            )}

            <div className="seam" />

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setEditInputValue('')}
                className="text-body-sm font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
              >
                Xóa trống (Set NULL)
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="btn-glass cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSavingSpec}
                  onClick={handleSaveSpec}
                  className="btn-accent disabled:opacity-50 cursor-pointer"
                >
                  {isSavingSpec ? 'Đang lưu...' : 'Lưu vào Supabase'}
                </button>
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
          className="fixed inset-0 z-50 bg-void/85 backdrop-blur-[30px] flex flex-col items-center justify-center p-4 inset-safe pb-safe animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-raised w-full max-w-xl p-6 flex flex-col gap-5 cursor-default"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-title-3 font-semibold text-ink">
                  Sửa điểm nổi bật sản phẩm (Key Features)
                </h2>
                <span className="meta">
                  {editingFeaturesCamera.name} ({editingFeaturesCamera.sku})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingFeaturesCamera(null)}
                aria-label={t('closeDialog')}
                className={ICON_BUTTON}
              >
                ✕
              </button>
            </div>

            <div className="seam" />

            {/* Vietnamese Features Input */}
            <div className="flex flex-col gap-2">
              <label className="text-body-sm text-ink-muted flex items-center justify-between gap-3">
                <span>Điểm nổi bật (Tiếng Việt) - Mỗi dòng 1 ý:</span>
                <span className="label">vi</span>
              </label>
              <textarea
                rows={4}
                value={featuresViText}
                onChange={(e) => setFeaturesViText(e.target.value)}
                placeholder="Nhập các điểm mạnh (mỗi dòng một ý)...&#10;Khẩu độ thay đổi từ f/5.6 đến f/8&#10;Thiết kế chống bụi và chống ẩm"
                className="surface-sunken w-full p-3 text-body text-ink placeholder:text-ink-faint leading-relaxed"
              />
            </div>

            {/* English Features Input */}
            <div className="flex flex-col gap-2">
              <label className="text-body-sm text-ink-muted flex items-center justify-between gap-3">
                <span>Key Features (English) - One per line:</span>
                <span className="label">en</span>
              </label>
              <textarea
                rows={3}
                value={featuresEnText}
                onChange={(e) => setFeaturesEnText(e.target.value)}
                placeholder="Enter key features (one per line)..."
                className="surface-sunken w-full p-3 text-body text-ink placeholder:text-ink-faint leading-relaxed"
              />
            </div>

            {/* Status Feedback */}
            {featuresSaveFeedback && (
              <p
                className={`text-body-sm font-semibold ${
                  featuresSaveFeedback.startsWith('✓') ? 'text-community' : 'text-danger'
                }`}
              >
                {featuresSaveFeedback}
              </p>
            )}

            <div className="seam" />

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingFeaturesCamera(null)}
                className="btn-glass cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingFeatures}
                onClick={handleSaveFeatures}
                className="btn-accent disabled:opacity-50 cursor-pointer"
              >
                {isSavingFeatures ? 'Đang lưu...' : 'Lưu điểm nổi bật'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
