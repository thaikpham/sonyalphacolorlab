'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import type { SonyCamera } from '@/lib/cameras/types';
import { ProductDetailModal } from '@/components/product-detail-modal';

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
  const [detailProduct, setDetailProduct] = useState<SonyCamera | null>(null);

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
    // Update URL query string
    if (next.length > 0) {
      router.replace(`/${locale}/cameras/compare?ids=${next.join(',')}`);
    } else {
      router.push(`/${locale}/cameras`);
    }
  };

  const addCamera = (id: string) => {
    if (activeIds.length >= 6) return;
    const next = [...activeIds, id];
    setActiveIds(next);
    setIsAddModalOpen(false);
    setSearchAddQuery('');
    router.replace(`/${locale}/cameras/compare?ids=${next.join(',')}`);
  };

  const toggleCompare = (id: string) => {
    if (activeIds.includes(id)) {
      removeCamera(id);
    } else {
      addCamera(id);
    }
  };

  const askAiSpecialist = async (questionText: string) => {
    if (!questionText.trim() || isAiLoading || comparedCameras.length === 0) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
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
            id: (Date.now() + 1).toString(),
            sender: 'specialist',
            text: data.answer,
          },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'specialist',
            text: 'Rất tiếc, đã xảy ra lỗi khi tạo câu trả lời. Vui lòng thử lại!',
          },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'specialist',
          text: 'Không thể kết nối tới máy chủ tư vấn.',
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

  return (
    <div className="w-full flex flex-col gap-8 font-sans pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link
            href={`/${locale}/cameras`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all cursor-pointer"
          >
            {t('backToCatalog')}
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white font-bold text-xs border border-white/15 transition-all cursor-pointer"
          >
            🖨️ {t('printCompare')}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t('comparePageTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-white/70">
            {comparedCameras.map((c) => c.name).join('  vs  ')}
          </p>
        </div>
      </div>

      {/* Main Side-by-Side Spec Matrix */}
      <div className="glass rounded-2xl overflow-hidden shadow-2xl border border-white/15 font-sans">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-48 sm:w-56" />
              {comparedCameras.map((cam) => (
                <col key={cam.id} className="w-[18rem]" />
              ))}
              {comparedCameras.length < 6 && <col className="w-[18rem]" />}
            </colgroup>

            {/* Header Row: Sticky Product Cards */}
            <thead className="bg-[#1e2025] sticky top-0 z-20 border-b border-white/15">
              <tr>
                <th scope="col" className="p-4 w-48 sm:w-56 bg-[#1e2025] border-r border-white/10 text-xs font-extrabold uppercase text-white/60 font-mono">
                  {t('sensorLabel')}
                </th>

                {comparedCameras.map((cam) => (
                  <th key={cam.id} scope="col" className="p-4 w-[18rem] bg-[#1e2025] border-r border-white/10 align-top">
                    <div className="relative bg-[#28292e] p-4 rounded-xl flex flex-col gap-3 border border-white/20 shadow-lg h-full justify-between">
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeCamera(cam.id)}
                        title="Xóa sản phẩm"
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer z-10"
                      >
                        ✕
                      </button>

                      {/* Photo on Clean WHITE Background (Click opens Detail Modal) */}
                      <div
                        onClick={() => setDetailProduct(cam)}
                        className="relative w-full aspect-[4/3] rounded-xl bg-white border border-white/20 p-2 flex items-center justify-center shadow-md overflow-hidden cursor-pointer group shrink-0"
                      >
                        <Image
                          src={cam.imageUrl}
                          alt={cam.name}
                          fill
                          className="object-contain p-2 group-hover:scale-105 transition-transform"
                          unoptimized
                        />
                      </div>

                      {/* Info (Click opens Detail Modal) */}
                      <div
                        onClick={() => setDetailProduct(cam)}
                        className="flex flex-col gap-1 cursor-pointer group"
                      >
                        <h3 className="font-extrabold text-sm text-white group-hover:text-amber-300 transition-colors line-clamp-1">{cam.name}</h3>
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
                  <th scope="col" className="p-4 w-[18rem] bg-[#1e2025] align-top">
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
              {/* SECTION 1: GENERAL INFO */}
              <tr className="bg-black/60 font-mono text-[11px] uppercase tracking-wider text-amber-300/90 font-extrabold">
                <td colSpan={comparedCameras.length + (comparedCameras.length < 6 ? 2 : 1)} className="p-3">
                  📂 {t('specCategory')}
                </td>
              </tr>

              {/* Category Row */}
              <tr className="bg-[#28292e]/90 hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-white/70 border-r border-white/10 bg-[#222429]">
                  {t('categoryLabel')}
                </td>
                {comparedCameras.map((cam) => (
                  <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem]">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getCategoryBadgeColor(cam.category)}`}>
                      {cam.category.toUpperCase()}
                    </span>
                  </td>
                ))}
                {comparedCameras.length < 6 && <td className="p-4 w-[18rem]"></td>}
              </tr>

              {/* Sensor / Format Row */}
              <tr className="bg-[#28292e]/90 hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-white/70 border-r border-white/10 bg-[#222429]">
                  {t('specSub1')}
                </td>
                {comparedCameras.map((cam) => (
                  <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] font-bold text-white">
                    {cam.subCategory1}
                  </td>
                ))}
                {comparedCameras.length < 6 && <td className="p-4 w-[18rem]"></td>}
              </tr>

              {/* Series Row */}
              <tr className="bg-[#28292e]/90 hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-white/70 border-r border-white/10 bg-[#222429]">
                  {t('specSub2')}
                </td>
                {comparedCameras.map((cam) => (
                  <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] font-mono text-white/80 font-semibold">
                    {cam.subCategory2 || '—'}
                  </td>
                ))}
                {comparedCameras.length < 6 && <td className="p-4 w-[18rem]"></td>}
              </tr>

              {/* SECTION 2: PRICING & CODES */}
              <tr className="bg-black/60 font-mono text-[11px] uppercase tracking-wider text-amber-300/90 font-extrabold">
                <td colSpan={comparedCameras.length + (comparedCameras.length < 6 ? 2 : 1)} className="p-3">
                  💳 {t('priceLabel')} & {t('skuLabel')}
                </td>
              </tr>

              {/* Price Row */}
              <tr className="bg-[#28292e]/90 hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-white/70 border-r border-white/10 bg-[#222429]">
                  {t('specPrice')}
                </td>
                {comparedCameras.map((cam) => (
                  <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] font-mono text-base font-extrabold text-sky-400">
                    {cam.priceFormatted}
                  </td>
                ))}
                {comparedCameras.length < 6 && <td className="p-4 w-[18rem]"></td>}
              </tr>

              {/* SKU Row */}
              <tr className="bg-[#28292e]/90 hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-white/70 border-r border-white/10 bg-[#222429]">
                  {t('specSku')}
                </td>
                {comparedCameras.map((cam) => (
                  <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] font-mono font-bold text-amber-300 truncate">
                    {cam.sku}
                  </td>
                ))}
                {comparedCameras.length < 6 && <td className="p-4 w-[18rem]"></td>}
              </tr>

              {/* SECTION 3: KEY FEATURES & HIGHLIGHTS */}
              <tr className="bg-black/60 font-mono text-[11px] uppercase tracking-wider text-amber-300/90 font-extrabold">
                <td colSpan={comparedCameras.length + (comparedCameras.length < 6 ? 2 : 1)} className="p-3">
                  ⚡ {t('specFeatures')}
                </td>
              </tr>

              {/* Features List Row */}
              <tr className="bg-[#28292e]/90 hover:bg-white/5 transition-colors">
                <td className="p-4 font-bold text-white/70 border-r border-white/10 bg-[#222429]">
                  {t('featuresLabel')}
                </td>
                {comparedCameras.map((cam) => (
                  <td key={cam.id} className="p-4 border-r border-white/10 w-[18rem] align-top">
                    <ul className="space-y-2 text-xs text-white/95 font-medium leading-relaxed">
                      {cam.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 whitespace-normal break-words">
                          <span className="text-emerald-400 font-bold shrink-0 text-sm leading-none">•</span>
                          <span className="flex-1">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
                {comparedCameras.length < 6 && <td className="p-4 w-[18rem]"></td>}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SONY AI SPECIALIST CHATBOT INTEGRATION */}
      <div className="glass p-6 rounded-2xl flex flex-col gap-5 border border-white/20 shadow-2xl bg-[#1e2025]/90">
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
            className="glass w-full max-w-2xl max-h-[80dvh] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl border border-white/20"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <h3 className="font-extrabold text-base text-white">{t('selectProductTitle')}</h3>
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

      {/* Product Specification Detail Modal */}
      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        isCompared={detailProduct ? activeIds.includes(detailProduct.id) : false}
        onToggleCompare={(id) => toggleCompare(id)}
      />
    </div>
  );
}
