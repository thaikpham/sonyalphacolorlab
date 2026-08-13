'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth-context';
import { splitFeatures, needsTranslation } from '@/lib/cameras/features';
import { SPEC_ROWS, type SonyCamera } from '@/lib/cameras/types';
import { getSpecMeta } from '@/lib/cameras/spec-meta';

type Props = {
  products: SonyCamera[];
  initialTab?: 'di' | 'pe';
};

type Draft = {
  name: string;
  fullName: string;
  imageUrl: string;
  galleryUrls: string;
  en: string;
  vi: string;
  specs: Record<string, string>;
  source: string;
};

const asDraft = (p: SonyCamera): Draft => {
  const f = splitFeatures(p.features);
  const specs: Record<string, string> = {};
  const row = (p.specs ?? {}) as unknown as Record<string, string | null>;
  if (p.specs) for (const k of SPEC_ROWS[p.specs.kind]) specs[k] = row[k] ?? '';
  return {
    name: p.name ?? '',
    fullName: p.fullName ?? '',
    imageUrl: p.imageUrl ?? '',
    galleryUrls: (p.galleryUrls ?? []).join('\n'),
    en: f.en.join('\n'),
    vi: f.vi.join('\n'),
    specs,
    source: p.specs?.specsSource ?? '',
  };
};

const lines = (s?: string | null) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

const SUB1_OPTIONS: Record<'camera' | 'lens' | 'accessory', string[]> = {
  camera: ['Mirrorless Full-Frame', 'Mirrorless APS-C', 'Cinema Line', 'Compact', 'PTZ Camera'],
  lens: ['FE-mount (Full-Frame)', 'E-mount (APS-C)', 'Cinema Lens', 'Teleconverter'],
  accessory: ['Audio', 'Power', 'Grip & Mount', 'Adaptor'],
};

export function AdminEditor({ products: initialProducts, initialTab }: Props) {
  const t = useTranslations('admin');
  const tSpec = useTranslations('cameras.specs');
  const { accessToken } = useAuth();

  // Helper for safe translation key lookup supporting interpolations to prevent intl formatting errors
  const tSafe = useCallback(
    (key: string, fallback: string, values?: Record<string, unknown>) => {
      try {
        if (t.has(key as never)) return t(key as never, values as never);
      } catch {
        // Fallback if key missing or formatting error occurs
      }
      let res = fallback;
      if (values) {
        for (const [k, v] of Object.entries(values)) {
          res = res.replace(`{${k}}`, String(v));
        }
      }
      return res;
    },
    [t],
  );

  const [products, setProducts] = useState<SonyCamera[]>(initialProducts);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [adminRole, setAdminRole] = useState<'super' | 'di' | 'pe'>('super');
  const [activeTab, setActiveTab] = useState<'di' | 'pe'>(initialTab ?? 'di');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'' | 'saving' | 'translating' | 'creating'>('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // Specs Sheet View Mode & Clipboard State
  const [specViewMode, setSpecViewMode] = useState<'sheet' | 'markdown'>('sheet');
  const [copiedMd, setCopiedMd] = useState(false);

  // New Product Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCat, setNewCat] = useState<'camera' | 'lens' | 'accessory'>('camera');
  const [newSub1, setNewSub1] = useState('Mirrorless Full-Frame');
  const [newSub2, setNewSub2] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPriceVnd, setNewPriceVnd] = useState<number>(0);
  const [newPriceFormatted, setNewPriceFormatted] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newGalleryUrls, setNewGalleryUrls] = useState('');
  const [newFeaturesEn, setNewFeaturesEn] = useState('');
  const [newFeaturesVi, setNewFeaturesVi] = useState('');
  const [createError, setCreateError] = useState('');

  const authed = useCallback(
    (extra: HeadersInit = {}) => {
      const token = accessToken();
      return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
    },
    [accessToken],
  );

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/session', { headers: authed() });
        const data = (await res.json()) as { isAdmin: boolean; email?: string; role?: 'super' | 'di' | 'pe' };
        if (!live) return;
        setIsAdmin(data.isAdmin);
        setEmail(data.email ?? '');
        const role = data.role ?? 'super';
        setAdminRole(role);
        if (role === 'pe') setActiveTab('pe');
        else if (role === 'di') setActiveTab('di');
        else if (initialTab) setActiveTab(initialTab);
      } catch {
        if (live) setIsAdmin(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [authed]);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? null,
    [products, selectedId],
  );

  const categoryFiltered = useMemo(() => {
    if (activeTab === 'di') {
      return products.filter((p) => p.category !== 'audio');
    }
    return products.filter((p) => p.category === 'audio');
  }, [products, activeTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categoryFiltered;
    return categoryFiltered.filter((p) =>
      [p.name, p.sku, p.fullName, p.category, p.subCategory1].some((v) => v.toLowerCase().includes(q)),
    );
  }, [categoryFiltered, query]);

  const select = (p: SonyCamera) => {
    setSelectedId(p.id);
    setDraft(asDraft(p));
    setStatus(null);
    setCopiedMd(false);
  };

  const err = (code: string) => {
    const known = [
      'notAdmin', 'notConfigured', 'saveFailed', 'badRequest', 'notFound',
      'noSpecBlock', 'rateLimited', 'mismatch', 'declined', 'failed',
    ];
    return tSafe(`errors.${known.includes(code) ? code : 'failed'}`, 'Thao tác thất bại');
  };

  const translate = async (target: 'en' | 'vi') => {
    if (!draft) return;
    const source = lines(target === 'vi' ? draft.en : draft.vi);
    if (source.length === 0) return;
    setBusy('translating');
    setStatus(null);
    try {
      const res = await fetch('/api/admin/translate', {
        method: 'POST',
        headers: authed(),
        body: JSON.stringify({ lines: source, target }),
      });
      const data = (await res.json()) as { ok?: boolean; lines?: string[]; error?: string };
      if (!res.ok || !data.ok || !data.lines) {
        setStatus({ kind: 'err', msg: err(data.error ?? 'failed') });
      } else {
        setDraft({ ...draft, [target]: data.lines.join('\n') });
        setStatus({ kind: 'ok', msg: tSafe('translateNote', 'Bản dịch máy. Hãy đọc lại trước khi lưu.') });
      }
    } catch {
      setStatus({ kind: 'err', msg: err('failed') });
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    if (!draft || !selected) return;
    setBusy('saving');
    setStatus(null);

    const galleryList = lines(draft.galleryUrls);
    const primaryImg = draft.imageUrl.trim() || galleryList[0] || selected.imageUrl;

    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: authed(),
        body: JSON.stringify({
          name: draft.name.trim() || selected.name,
          fullName: draft.fullName.trim() || selected.fullName,
          imageUrl: primaryImg,
          galleryUrls: galleryList,
          features: { en: lines(draft.en), vi: lines(draft.vi) },
          ...(selected.specs ? { specs: { ...draft.specs, specsSource: draft.source } } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus({ kind: 'err', msg: err(data.error ?? 'saveFailed') });
      } else {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === selected.id
              ? {
                  ...p,
                  name: draft.name.trim() || p.name,
                  fullName: draft.fullName.trim() || p.fullName,
                  imageUrl: primaryImg,
                  galleryUrls: galleryList,
                }
              : p,
          ),
        );
        setStatus({ kind: 'ok', msg: tSafe('saved', 'Đã lưu') });
      }
    } catch {
      setStatus({ kind: 'err', msg: err('saveFailed') });
    } finally {
      setBusy('');
    }
  };

  const handleCategoryChange = (cat: 'camera' | 'lens' | 'accessory') => {
    setNewCat(cat);
    setNewSub1(SUB1_OPTIONS[cat][0]);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newSku.trim() || !newName.trim()) {
      setCreateError(err('badRequest'));
      return;
    }

    setBusy('creating');
    try {
      const galleryList = lines(newGalleryUrls);
      const primaryImg = newImageUrl.trim() || galleryList[0] || '/logo.png';

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: authed(),
        body: JSON.stringify({
          sku: newSku.trim(),
          name: newName.trim(),
          fullName: newFullName.trim() || newName.trim(),
          category: newCat,
          subCategory1: newSub1.trim(),
          subCategory2: newSub2.trim(),
          priceVnd: Number(newPriceVnd) || 0,
          priceFormatted: newPriceFormatted.trim(),
          url: newUrl.trim(),
          imageUrl: primaryImg,
          galleryUrls: galleryList,
          features: { en: lines(newFeaturesEn), vi: lines(newFeaturesVi) },
        }),
      });

      const data = (await res.json()) as { ok?: boolean; product?: SonyCamera; error?: string };
      if (!res.ok || !data.ok || !data.product) {
        setCreateError(err(data.error ?? 'saveFailed'));
      } else {
        const created = data.product;
        setProducts((prev) => [created, ...prev]);
        select(created);
        setIsCreateOpen(false);
        setStatus({ kind: 'ok', msg: tSafe('createdSuccess', 'Đã tạo sản phẩm thành công!') });
        setNewSku('');
        setNewName('');
        setNewFullName('');
        setNewPriceVnd(0);
        setNewPriceFormatted('');
        setNewUrl('');
        setNewImageUrl('');
        setNewGalleryUrls('');
        setNewFeaturesEn('');
        setNewFeaturesVi('');
      }
    } catch {
      setCreateError(err('saveFailed'));
    } finally {
      setBusy('');
    }
  };

  // Markdown table generator for current product specs
  const generatedMarkdownTable = useMemo(() => {
    if (!selected || !selected.specs || !draft) return '';
    const fields = SPEC_ROWS[selected.specs.kind];
    let md = `### ${selected.fullName} (${selected.sku})\n\n`;
    md += `| ${tSafe('colField', 'Thông số')} | ${tSafe('colValue', 'Giá trị')} |\n`;
    md += `| --- | --- |\n`;

    for (const field of fields) {
      let label = field;
      try {
        if (tSpec.has(field as never)) label = tSpec(field as never);
      } catch {
        label = field;
      }
      const notPub = tSpec.has('specsNotPublished' as never) ? tSpec('specsNotPublished' as never) : 'Nguồn không công bố';
      const val = (draft.specs[field] ?? '').trim() || notPub;
      md += `| **${label}** | ${val} |\n`;
    }

    if (draft.source) {
      md += `| **${tSafe('specsSourceLabel', 'Nguồn')}** | [${draft.source}](${draft.source}) |\n`;
    }

    return md;
  }, [selected, draft, tSafe, tSpec]);

  const copyMarkdown = () => {
    if (!generatedMarkdownTable) return;
    navigator.clipboard.writeText(generatedMarkdownTable);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  if (isAdmin === false) {
    return (
      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-20 text-center flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold text-white">{tSafe('gateTitle', 'Chỉ dành cho admin')}</h1>
        <p className="text-sm text-slate-100 font-medium leading-relaxed">{tSafe('gateBody', 'Đăng nhập bằng địa chỉ admin')}</p>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{tSafe('title', 'Quản trị sản phẩm')}</h1>
          <p className="text-sm text-slate-100 font-medium">{tSafe('subtitle', 'Sửa thông số và tính năng sản phẩm')}</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {email && (
            <span className="font-mono text-xs font-bold text-amber-300">
              {tSafe('signedInAs', 'Đang đăng nhập: {email}', { email })}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            {tSafe('createProductBtn', '＋ Thêm sản phẩm mới')}
          </button>
        </div>
      </header>

      {/* Category Division Navigation Tabs & Admin Role Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-[#1c1d22] border border-white/15 shadow-lg">
        {/* Category Switcher Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-black/70 border border-white/20 font-sans">
          <button
            type="button"
            onClick={() => {
              if (adminRole === 'pe') return;
              setActiveTab('di');
              setSelectedId(null);
              setDraft(null);
            }}
            disabled={adminRole === 'pe'}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all font-sans flex items-center gap-2 ${
              activeTab === 'di'
                ? 'bg-amber-400 text-black font-extrabold shadow-md'
                : 'text-white/60 hover:text-white'
            } ${adminRole === 'pe' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={adminRole === 'pe' ? 'Tài khoản của bạn có quyền quản lý ngành hàng PE' : undefined}
          >
            <span>📷</span>
            <span>DI · Digital Imaging (Máy ảnh & Ống kính)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (adminRole === 'di') return;
              setActiveTab('pe');
              setSelectedId(null);
              setDraft(null);
            }}
            disabled={adminRole === 'di'}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all font-sans flex items-center gap-2 ${
              activeTab === 'pe'
                ? 'bg-cyan-400 text-black font-extrabold shadow-md'
                : 'text-white/60 hover:text-white'
            } ${adminRole === 'di' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={adminRole === 'di' ? 'Tài khoản của bạn có quyền quản lý ngành hàng DI' : undefined}
          >
            <span>🎧</span>
            <span>PE · Personal Entertainment (Âm thanh & Loa)</span>
          </button>
        </div>

        {/* Role Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 font-mono text-xs">
          <span className="text-white/60">Phân quyền:</span>
          {adminRole === 'super' && (
            <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold">
              👑 SUPER DEV (Quản lý toàn bộ trang web)
            </span>
          )}
          {adminRole === 'di' && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
              📷 DI ADMIN (Digital Imaging)
            </span>
          )}
          {adminRole === 'pe' && (
            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold">
              🎧 PE ADMIN (Personal Entertainment)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Product list */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 bg-[#1c1d22] p-4 rounded-2xl border border-white/15">
          <div className="flex items-center justify-between gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tSafe('searchPlaceholder', 'Lọc theo tên, SKU...')}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium text-xs placeholder:text-slate-300"
            />
          </div>
          <div className="flex items-center justify-between text-[0.65rem] font-bold text-slate-300">
            <span>{tSafe('productCount', '{count} sản phẩm', { count: filtered.length })}</span>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="text-amber-300 hover:underline cursor-pointer"
            >
              {tSafe('createProductBtn', '＋ Thêm sản phẩm mới')}
            </button>
          </div>
          <ul className="flex flex-col gap-1 max-h-[34rem] overflow-y-auto scrollbar-thin">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => select(p)}
                  className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                    p.id === selectedId
                      ? 'bg-amber-400/20 border-amber-400/50'
                      : 'bg-black/30 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-bold text-white truncate">{p.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/70 uppercase shrink-0">
                      {p.category}
                    </span>
                  </div>
                  <span className="block font-mono text-[0.65rem] text-slate-300 truncate">{p.sku}</span>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <span className="text-[9px] font-mono text-slate-400 truncate">{p.subCategory1}</span>
                    <span
                      className={`font-mono text-[0.6rem] font-bold ${
                        needsTranslation(p.features) ? 'text-amber-300' : 'text-emerald-300'
                      }`}
                    >
                      {needsTranslation(p.features)
                        ? tSafe('needsVi', 'Thiếu tiếng Việt')
                        : tSafe('complete', 'Đủ hai ngôn ngữ')}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Editor */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-5">
          {!selected || !draft ? (
            <div className="bg-[#1c1d22] p-8 rounded-2xl border border-white/15 flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-slate-100 font-medium">{tSafe('selectPrompt', 'Chọn một sản phẩm bên trái để bắt đầu sửa.')}</p>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 transition-all cursor-pointer shadow-lg"
              >
                {tSafe('createProductBtn', '＋ Thêm sản phẩm mới')}
              </button>
            </div>
          ) : (
            <>
              {/* Product Basic Info & Gallery Images Section */}
              <div className="bg-[#1c1d22] p-5 rounded-2xl border border-white/15 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-sm uppercase text-amber-300 font-mono tracking-wider">
                      🏷️ {tSafe('basicInfoHeading', 'Tên sản phẩm & Bộ sưu tập ảnh')}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/80 uppercase">
                      SKU: {selected.sku || 'N/A'}
                    </span>
                  </div>
                  <span className="text-[0.65rem] text-slate-300 font-medium">
                    {tSafe('basicInfoHint', 'Chỉnh sửa tên hiển thị, tên đầy đủ và danh sách URL ảnh minh họa.')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Product Name Inputs */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="prod-name" className="font-mono text-[0.65rem] font-extrabold uppercase tracking-wider text-amber-300">
                        {tSafe('nameLabel', 'Tên ngắn hiển thị (Name)')}
                      </label>
                      <input
                        id="prod-name"
                        type="text"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-bold text-xs"
                        placeholder="Ví dụ: FX3, WH-1000XM5, A7 IV..."
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="prod-fullname" className="font-mono text-[0.65rem] font-extrabold uppercase tracking-wider text-amber-300">
                        {tSafe('fullNameLabel', 'Tên đầy đủ chính thức (Full Name)')}
                      </label>
                      <input
                        id="prod-fullname"
                        type="text"
                        value={draft.fullName}
                        onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium text-xs"
                        placeholder="Ví dụ: Máy ảnh Sony Cinema Line FX3..."
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="prod-imageurl" className="font-mono text-[0.65rem] font-extrabold uppercase tracking-wider text-sky-300">
                        {tSafe('primaryImageLabel', 'URL ảnh đại diện chính (Primary Image URL)')}
                      </label>
                      <input
                        id="prod-imageurl"
                        type="text"
                        value={draft.imageUrl}
                        onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium text-xs"
                        placeholder="https://static.bhphoto.com/images/..."
                      />
                    </div>
                  </div>

                  {/* Gallery Image URLs Textarea */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="prod-galleryurls" className="font-mono text-[0.65rem] font-extrabold uppercase tracking-wider text-sky-300">
                        {tSafe('galleryUrlsLabel', 'Danh sách URL ảnh minh họa / Gallery (Mỗi URL 1 dòng)')}
                      </label>
                      <span className="text-[10px] font-mono text-slate-300 font-bold bg-white/10 px-2 py-0.5 rounded">
                        {lines(draft.galleryUrls).length} {tSafe('photosCount', 'ảnh')}
                      </span>
                    </div>
                    <textarea
                      id="prod-galleryurls"
                      value={draft.galleryUrls}
                      onChange={(e) => setDraft({ ...draft, galleryUrls: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-mono text-xs leading-relaxed resize-y placeholder:text-slate-300"
                      placeholder="https://static.bhphoto.com/images/images1000x1000/1.jpg&#10;https://static.bhphoto.com/images/images1000x1000/2.jpg"
                    />
                  </div>
                </div>

                {/* Live Thumbnail Preview Grid */}
                {lines(draft.galleryUrls).length > 0 && (
                  <div className="flex flex-col gap-2 mt-1 pt-3 border-t border-white/10">
                    <span className="font-mono text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-300">
                      🖼️ {tSafe('galleryPreviewHeading', 'Xem trước ảnh minh họa trong Gallery:')}
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {lines(draft.galleryUrls).map((url, idx) => (
                        <div key={idx} className="relative group shrink-0 w-16 h-16 rounded-xl border border-white/20 overflow-hidden bg-black/60">
                          <img src={url} alt={`Gallery thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] font-mono text-white text-center py-0.5">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Features section */}
              <div className="bg-[#1c1d22] p-5 rounded-2xl border border-white/15 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-sm uppercase text-amber-300 font-mono tracking-wider">
                      ⚡ {tSafe('featuresHeading', 'Tính năng nổi bật')}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/80 uppercase">
                      {selected.category} · {selected.subCategory1}
                    </span>
                  </div>
                  <span className="text-[0.65rem] text-slate-300 font-medium">{tSafe('featuresHint', 'Mỗi dòng một ý.')}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['en', 'vi'] as const).map((side) => (
                    <div key={side} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`feat-${side}`}
                          className="font-mono text-[0.65rem] font-extrabold uppercase tracking-wider text-sky-300"
                        >
                          {tSafe(side === 'en' ? 'featuresEn' : 'featuresVi', side === 'en' ? 'Tiếng Anh' : 'Tiếng Việt')}
                        </label>
                        <button
                          type="button"
                          onClick={() => translate(side)}
                          disabled={busy !== ''}
                          className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white text-[0.65rem] font-bold border border-white/20"
                        >
                          {busy === 'translating'
                            ? tSafe('translating', 'Đang dịch…')
                            : tSafe(side === 'vi' ? 'translateToVi' : 'translateToEn', side === 'vi' ? 'Dịch sang tiếng Việt' : 'Dịch sang tiếng Anh')}
                        </button>
                      </div>
                      <textarea
                        id={`feat-${side}`}
                        value={draft[side]}
                        onChange={(e) => setDraft({ ...draft, [side]: e.target.value })}
                        rows={9}
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-white font-medium text-xs leading-relaxed resize-y"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* CORE SPECS SECTION: GOOGLE SHEET & MARKDOWN EDITOR */}
              <div className="bg-[#1c1d22] p-5 rounded-2xl border border-white/15 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="font-extrabold text-sm uppercase text-sky-300 font-mono tracking-wider">
                      📊 {tSafe('specsHeading', 'Thông số cốt lõi')}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                      Google Sheet & Markdown Grid
                    </span>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/15">
                    <button
                      type="button"
                      onClick={() => setSpecViewMode('sheet')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        specViewMode === 'sheet'
                          ? 'bg-amber-400 text-black shadow'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tSafe('sheetModeBtn', '📊 Bảng tính Google Sheet')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecViewMode('markdown')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        specViewMode === 'markdown'
                          ? 'bg-amber-400 text-black shadow'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tSafe('markdownModeBtn', '📝 Xem & Sao chép Markdown')}
                    </button>
                  </div>
                </div>

                {!selected.specs ? (
                  <p className="text-xs text-amber-300 font-bold">{tSafe('noSpecBlock', 'Sản phẩm này chưa có khối thông số.')}</p>
                ) : specViewMode === 'sheet' ? (
                  /* GOOGLE SHEET SPREADSHEET TABLE GRID */
                  <div className="flex flex-col gap-3">
                    <p className="text-[0.65rem] text-slate-300 font-medium leading-relaxed">
                      {tSafe('specsEmptyHint', 'Để trống ô mà nguồn không công bố — nó sẽ hiện "nguồn không công bố".')}
                    </p>

                    <div className="overflow-x-auto rounded-xl border border-white/15 bg-black/40 scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#22242b] border-b border-white/15 text-slate-300 font-mono text-[11px] uppercase">
                            <th className="py-2.5 px-3 w-12 text-center border-r border-white/10">
                              {tSafe('colIndex', 'STT')}
                            </th>
                            <th className="py-2.5 px-4 w-48 border-r border-white/10">
                              {tSafe('colField', 'Thông số (Field)')}
                            </th>
                            <th className="py-2.5 px-3 w-20 text-center border-r border-white/10">
                              {tSafe('colType', 'Loại')}
                            </th>
                            <th className="py-2.5 px-4">{tSafe('colValue', 'Giá trị (Value / Input Control)')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10 font-sans">
                          {SPEC_ROWS[selected.specs.kind].map((field, idx) => {
                            const meta = getSpecMeta(field);
                            const val = draft.specs[field] ?? '';
                            let label = field;
                            try {
                              if (tSpec.has(field as never)) label = tSpec(field as never);
                            } catch {
                              label = field;
                            }

                            return (
                              <tr key={field} className="hover:bg-white/5 transition-colors">
                                <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-400 border-r border-white/10">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-4 border-r border-white/10">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-white text-xs">
                                      {label}
                                    </span>
                                    <span className="font-mono text-[9px] text-slate-400">
                                      {field}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center border-r border-white/10">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold uppercase ${
                                      meta.type === 'dropdown'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : meta.type === 'number'
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : meta.type === 'url'
                                            ? 'bg-purple-500/20 text-purple-300'
                                            : 'bg-sky-500/20 text-sky-300'
                                    }`}
                                  >
                                    {meta.type === 'dropdown'
                                      ? tSafe('typeDropdown', 'DROP')
                                      : meta.type === 'number'
                                        ? tSafe('typeNumber', 'NUM')
                                        : meta.type === 'url'
                                          ? tSafe('typeUrl', 'URL')
                                          : tSafe('typeText', 'TEXT')}
                                  </span>
                                </td>
                                <td className="py-2 px-4">
                                  {meta.type === 'dropdown' && meta.options ? (
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={meta.options.includes(val) ? val : val ? '__custom' : ''}
                                        onChange={(e) => {
                                          const chosen = e.target.value;
                                          if (chosen !== '__custom') {
                                            setDraft({
                                              ...draft,
                                              specs: { ...draft.specs, [field]: chosen },
                                            });
                                          }
                                        }}
                                        className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                                      >
                                        <option value="">-- Chưa công bố --</option>
                                        {meta.options.map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                        {!meta.options.includes(val) && val && (
                                          <option value="__custom">
                                            Khác: {val}
                                          </option>
                                        )}
                                      </select>
                                      {(!meta.options.includes(val) || val === '') && (
                                        <input
                                          type="text"
                                          value={val}
                                          onChange={(e) =>
                                            setDraft({
                                              ...draft,
                                              specs: { ...draft.specs, [field]: e.target.value },
                                            })
                                          }
                                          placeholder={meta.placeholder}
                                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                                        />
                                      )}
                                    </div>
                                  ) : meta.type === 'number' ? (
                                    <div className="flex items-center gap-2 max-w-xs">
                                      <input
                                        type="text"
                                        value={val}
                                        onChange={(e) =>
                                          setDraft({
                                            ...draft,
                                            specs: { ...draft.specs, [field]: e.target.value },
                                          })
                                        }
                                        placeholder={meta.placeholder}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                                      />
                                      {meta.unit && (
                                        <span className="font-mono text-xs text-amber-300 font-bold bg-white/10 px-2 py-1 rounded">
                                          {meta.unit}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={(e) =>
                                        setDraft({
                                          ...draft,
                                          specs: { ...draft.specs, [field]: e.target.value },
                                        })
                                      }
                                      placeholder={meta.placeholder}
                                      className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Source URL Row */}
                          <tr className="bg-white/[0.02]">
                            <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-400 border-r border-white/10">
                              ★
                            </td>
                            <td className="py-2 px-4 border-r border-white/10">
                              <span className="font-bold text-amber-300 text-xs">
                                {tSafe('specsSourceLabel', 'Trang nguồn')}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center border-r border-white/10">
                              <span className="inline-block px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold uppercase bg-purple-500/20 text-purple-300">
                                {tSafe('typeUrl', 'URL')}
                              </span>
                            </td>
                            <td className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <input
                                  type="url"
                                  value={draft.source}
                                  onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                                  placeholder="https://www.sony.com.vn/..."
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                                />
                                {draft.source && (
                                  <a
                                    href={draft.source}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sky-300 text-xs font-bold shrink-0 border border-white/15 flex items-center gap-1"
                                    title="Mở trang nguồn trong tab mới"
                                  >
                                    🔗 Mở link
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* MARKDOWN TABLE VIEW MODE */
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium">
                        Bảng Markdown định dạng GFM có thể sao chép trực tiếp:
                      </span>
                      <button
                        type="button"
                        onClick={copyMarkdown}
                        className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs transition-all cursor-pointer shadow flex items-center gap-1.5"
                      >
                        {copiedMd ? tSafe('copiedMarkdown', '✓ Đã sao chép!') : tSafe('copyMarkdown', '📋 Sao chép Markdown')}
                      </button>
                    </div>

                    <pre className="p-4 rounded-xl bg-black/80 border border-white/20 text-amber-300 font-mono text-xs overflow-x-auto leading-relaxed scrollbar-thin">
                      {generatedMarkdownTable}
                    </pre>
                  </div>
                )}
              </div>

              {/* SAVE BUTTON & STATUS */}
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy !== ''}
                  className="py-2.5 px-6 rounded-xl bg-white text-black font-extrabold text-xs hover:bg-white/90 disabled:opacity-40 shadow-lg cursor-pointer"
                >
                  {busy === 'saving' ? tSafe('saving', 'Đang lưu…') : tSafe('save', 'Lưu vào Supabase')}
                </button>
                {status && (
                  <span
                    role="status"
                    className={`text-xs font-bold ${status.kind === 'ok' ? 'text-emerald-300' : 'text-amber-300'}`}
                  >
                    {status.msg}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* CREATE NEW PRODUCT MODAL */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsCreateOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-3xl max-h-[90dvh] rounded-2xl p-6 flex flex-col gap-5 shadow-2xl border border-white/20 bg-[#181a1f] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-white">{tSafe('createModalTitle', 'Thêm sản phẩm mới')}</h3>
                <p className="text-xs text-slate-300">{tSafe('createModalSub', 'Phân loại theo Category & SubCategory, khởi tạo thông số và lưu vào Supabase.')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="flex flex-col gap-4 font-sans text-xs">
              {/* Category & SubCategory Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/40 p-4 rounded-xl border border-white/10">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-amber-300 text-[11px]">{tSafe('categoryLabel', 'Danh mục (Category)')} *</label>
                  <select
                    value={newCat}
                    onChange={(e) => handleCategoryChange(e.target.value as 'camera' | 'lens' | 'accessory')}
                    className="w-full px-3 py-2 rounded-lg bg-[#22242a] border border-white/20 text-white font-bold text-xs"
                  >
                    <option value="camera">{tSafe('catCamera', 'Máy ảnh (Camera)')}</option>
                    <option value="lens">{tSafe('catLens', 'Ống kính (Lens)')}</option>
                    <option value="accessory">{tSafe('catAccessory', 'Phụ kiện (Accessory)')}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-amber-300 text-[11px]">{tSafe('subCategory1Label', 'Phân nhóm chính (SubCategory 1)')} *</label>
                  <select
                    value={newSub1}
                    onChange={(e) => setNewSub1(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#22242a] border border-white/20 text-white font-bold text-xs"
                  >
                    {SUB1_OPTIONS[newCat].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-300 text-[11px]">{tSafe('subCategory2Label', 'Phân nhóm phụ (SubCategory 2)')}</label>
                  <input
                    type="text"
                    value={newSub2}
                    onChange={(e) => setNewSub2(e.target.value)}
                    placeholder="VD: Alpha 7 Series, G Master..."
                    className="w-full px-3 py-2 rounded-lg bg-[#22242a] border border-white/20 text-white text-xs"
                  />
                </div>
              </div>

              {/* Product Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-white/90">{tSafe('skuLabel', 'Mã SKU sản phẩm')} *</label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="VD: ILCE-7M5/BQ hoặc SEL2470GM2"
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-white/90">{tSafe('nameLabel', 'Tên ngắn sản phẩm')} *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="VD: 7 V hoặc FE 24-70mm f/2.8 GM II"
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white text-xs font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="font-bold text-white/90">{tSafe('fullNameLabel', 'Tên đầy đủ sản phẩm')} *</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="VD: Máy ảnh Sony Alpha 7 V (Thân máy) chính hãng"
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-white/90">{tSafe('priceVndLabel', 'Giá niêm yết (VND)')}</label>
                  <input
                    type="number"
                    value={newPriceVnd || ''}
                    onChange={(e) => setNewPriceVnd(Number(e.target.value))}
                    placeholder="VD: 59900000"
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-white/90">{tSafe('priceFormattedLabel', 'Giá hiển thị')}</label>
                  <input
                    type="text"
                    value={newPriceFormatted}
                    onChange={(e) => setNewPriceFormatted(e.target.value)}
                    placeholder="VD: 59.990.000 ₫"
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-white/90">{tSafe('urlLabel', 'Link trang sản phẩm (Sony Store URL)')}</label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://www.sony.com.vn/electronics/..."
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="font-bold text-white/90">{tSafe('imageUrlLabel', 'Link ảnh sản phẩm đại diện chính (Primary Image URL)')}</label>
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="/logo.png hoặc URL ảnh CDN"
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="font-bold text-sky-300">{tSafe('galleryUrlsLabel', 'Danh sách URL ảnh minh họa / Gallery (Mỗi URL 1 dòng)')}</label>
                  <textarea
                    value={newGalleryUrls}
                    onChange={(e) => setNewGalleryUrls(e.target.value)}
                    rows={4}
                    placeholder="https://static.bhphoto.com/images/1.jpg&#10;https://static.bhphoto.com/images/2.jpg"
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white font-mono text-xs"
                  />
                </div>
              </div>

              {/* Key Features Input (EN & VI) */}
              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                <span className="font-bold text-amber-300">{tSafe('featuresHeading', 'Tính năng nổi bật')} ({tSafe('featuresHint', 'Mỗi dòng một ý.')})</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-bold text-sky-300 uppercase">{tSafe('featuresEn', 'Tiếng Anh')}</label>
                    <textarea
                      value={newFeaturesEn}
                      onChange={(e) => setNewFeaturesEn(e.target.value)}
                      rows={5}
                      placeholder="Mỗi dòng 1 tính năng tiếng Anh..."
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-bold text-sky-300 uppercase">{tSafe('featuresVi', 'Tiếng Việt')}</label>
                    <textarea
                      value={newFeaturesVi}
                      onChange={(e) => setNewFeaturesVi(e.target.value)}
                      rows={5}
                      placeholder="Mỗi dòng 1 tính năng tiếng Việt..."
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {createError && (
                <p className="text-amber-300 text-xs font-bold">{createError}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/15">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  {tSafe('cancel', 'Hủy')}
                </button>
                <button
                  type="submit"
                  disabled={busy === 'creating'}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs disabled:opacity-40 cursor-pointer shadow-lg transition-all"
                >
                  {busy === 'creating' ? tSafe('creating', 'Đang tạo…') : tSafe('createSubmit', 'Tạo & Lưu sản phẩm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
