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

/**
 * The four treatments this screen repeats.
 *
 * A control is SUNKEN — black 35% with an inset shadow and no stroke — which is
 * what the ~40 stroked inputs in this file became. A tag is a
 * 13px chip on a white film; it is written out rather than using `.chip` where
 * the tint has to say what the row *is*, because `.chip` is unlayered CSS and
 * silently beats a `text-*` utility on its own element.
 */
const TAG = 'text-label font-semibold px-2.5 py-1 rounded-sm shadow-[var(--elevation-spec)]';
const TAG_NEUTRAL = `${TAG} bg-white/[0.08] text-ink-muted`;
const FIELD =
  'w-full px-4 min-h-[var(--layout-touch-target)] surface-sunken text-body text-ink placeholder:text-ink-faint';
const FIELD_SM =
  'w-full px-3 min-h-[var(--layout-touch-target)] surface-sunken text-body-sm text-ink placeholder:text-ink-faint';
const AREA =
  'w-full px-4 py-3 surface-sunken text-body text-ink leading-relaxed resize-y placeholder:text-ink-faint';

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
  }, [authed, initialTab]);

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
        <h1 className="text-title-1 font-extrabold tracking-[-0.02em] text-ink">{tSafe('gateTitle', 'Chỉ dành cho admin')}</h1>
        <p className="text-body text-ink-muted leading-relaxed">{tSafe('gateBody', 'Đăng nhập bằng địa chỉ admin')}</p>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-title-1 font-extrabold text-ink tracking-[-0.02em]">{tSafe('title', 'Quản trị sản phẩm')}</h1>
          <p className="meta">{tSafe('subtitle', 'Sửa thông số và tính năng sản phẩm')}</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {email && (
            <span className="meta">
              {tSafe('signedInAs', 'Đang đăng nhập: {email}', { email })}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="btn-accent gap-1.5 cursor-pointer"
          >
            {tSafe('createProductBtn', '＋ Thêm sản phẩm mới')}
          </button>
        </div>
      </header>

      <div className="seam" />

      {/* Category Division Navigation Tabs & Admin Role Badge */}
      <div className="surface flex flex-wrap items-center justify-between gap-4 p-3.5">
        {/* Category Switcher Tabs — the rut is sunken, the choice is a fill. */}
        <div className="surface-sunken flex items-center gap-1 p-1">
          <button
            type="button"
            onClick={() => {
              if (adminRole === 'pe') return;
              setActiveTab('di');
              setSelectedId(null);
              setDraft(null);
            }}
            disabled={adminRole === 'pe'}
            className={`px-4 min-h-[var(--layout-touch-target)] rounded-sm text-body-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'di' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
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
            className={`px-4 min-h-[var(--layout-touch-target)] rounded-sm text-body-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'pe' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
            } ${adminRole === 'di' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={adminRole === 'di' ? 'Tài khoản của bạn có quyền quản lý ngành hàng DI' : undefined}
          >
            <span>🎧</span>
            <span>PE · Personal Entertainment (Âm thanh & Loa)</span>
          </button>
        </div>

        {/* Role Badge — one signal per row: violet for the whole catalogue,
            accent for DI, cyan for PE, and only ever one of the three. */}
        <div className="flex items-center gap-2">
          <span className="label">Phân quyền:</span>
          {adminRole === 'super' && (
            <span className={`${TAG} bg-proposal/15 text-proposal`}>
              👑 SUPER DEV (Quản lý toàn bộ trang web)
            </span>
          )}
          {adminRole === 'di' && (
            <span className={`${TAG} bg-accent-400/15 text-accent-400`}>
              📷 DI ADMIN (Digital Imaging)
            </span>
          )}
          {adminRole === 'pe' && (
            <span className={`${TAG} bg-community/15 text-community`}>
              🎧 PE ADMIN (Personal Entertainment)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* The review queue: a white 2.2% ground, surface cards on it, and the
            item being edited tinted `proposal` — a fill, never a stroke. */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 bg-white/[0.022] p-4 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tSafe('searchPlaceholder', 'Lọc theo tên, SKU...')}
              className={FIELD}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="label tabular-nums">
              {tSafe('productCount', '{count} sản phẩm', { count: filtered.length })}
            </span>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="text-label font-semibold text-accent-400 cursor-pointer"
            >
              {tSafe('createProductBtn', '＋ Thêm sản phẩm mới')}
            </button>
          </div>
          <ul className="flex flex-col gap-2.5 max-h-[34rem] scroll-area">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => select(p)}
                  className={`w-full text-left flex flex-col gap-2 px-4 py-3.5 cursor-pointer transition-colors ${
                    p.id === selectedId
                      ? 'surface-selected [--selected-hue:var(--color-proposal)]'
                      : 'surface'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="block text-body-sm font-semibold text-ink truncate">{p.name}</span>
                    <span className={`${TAG_NEUTRAL} uppercase shrink-0`}>{p.category}</span>
                  </div>
                  <span className="block text-meta text-ink-muted truncate">{p.sku}</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-meta text-ink-faint truncate">{p.subCategory1}</span>
                    <span
                      className={`text-label font-semibold shrink-0 ${
                        needsTranslation(p.features) ? 'text-danger' : 'text-community'
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
            <div className="surface p-8 flex flex-col items-center gap-4 text-center">
              <p className="text-body text-ink-muted">{tSafe('selectPrompt', 'Chọn một sản phẩm bên trái để bắt đầu sửa.')}</p>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="btn-accent cursor-pointer"
              >
                {tSafe('createProductBtn', '＋ Thêm sản phẩm mới')}
              </button>
            </div>
          ) : (
            <>
              {/* Product Basic Info & Gallery Images Section */}
              <div className="surface p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h2 className="label text-proposal">
                      🏷️ {tSafe('basicInfoHeading', 'Tên sản phẩm & Bộ sưu tập ảnh')}
                    </h2>
                    <span className={`${TAG_NEUTRAL} uppercase`}>SKU: {selected.sku || 'N/A'}</span>
                  </div>
                  <span className="meta">
                    {tSafe('basicInfoHint', 'Chỉnh sửa tên hiển thị, tên đầy đủ và danh sách URL ảnh minh họa.')}
                  </span>
                </div>

                <div className="seam" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Product Name Inputs */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="prod-name" className="label">
                        {tSafe('nameLabel', 'Tên ngắn hiển thị (Name)')}
                      </label>
                      <input
                        id="prod-name"
                        type="text"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className={FIELD}
                        placeholder="Ví dụ: FX3, WH-1000XM5, A7 IV..."
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="prod-fullname" className="label">
                        {tSafe('fullNameLabel', 'Tên đầy đủ chính thức (Full Name)')}
                      </label>
                      <input
                        id="prod-fullname"
                        type="text"
                        value={draft.fullName}
                        onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                        className={FIELD}
                        placeholder="Ví dụ: Máy ảnh Sony Cinema Line FX3..."
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="prod-imageurl" className="label">
                        {tSafe('primaryImageLabel', 'URL ảnh đại diện chính (Primary Image URL)')}
                      </label>
                      <input
                        id="prod-imageurl"
                        type="text"
                        value={draft.imageUrl}
                        onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                        className={FIELD}
                        placeholder="https://static.bhphoto.com/images/..."
                      />
                    </div>
                  </div>

                  {/* Gallery Image URLs Textarea */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="prod-galleryurls" className="label">
                        {tSafe('galleryUrlsLabel', 'Danh sách URL ảnh minh họa / Gallery (Mỗi URL 1 dòng)')}
                      </label>
                      <span className={`${TAG_NEUTRAL} tabular-nums`}>
                        {lines(draft.galleryUrls).length} {tSafe('photosCount', 'ảnh')}
                      </span>
                    </div>
                    <textarea
                      id="prod-galleryurls"
                      value={draft.galleryUrls}
                      onChange={(e) => setDraft({ ...draft, galleryUrls: e.target.value })}
                      rows={6}
                      className={AREA}
                      placeholder="https://static.bhphoto.com/images/images1000x1000/1.jpg&#10;https://static.bhphoto.com/images/images1000x1000/2.jpg"
                    />
                  </div>
                </div>

                {/* Live Thumbnail Preview Grid */}
                {lines(draft.galleryUrls).length > 0 && (
                  <div className="flex flex-col gap-3 mt-1">
                    <div className="seam" />
                    <span className="label">
                      🖼️ {tSafe('galleryPreviewHeading', 'Xem trước ảnh minh họa trong Gallery:')}
                    </span>
                    <div className="flex items-center gap-2 pb-2 scroll-silent overflow-x-auto">
                      {lines(draft.galleryUrls).map((url, idx) => (
                        <div key={idx} className="relative group shrink-0 w-16 h-16 rounded-md overflow-hidden bg-sunken shadow-[var(--elevation-spec)]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- previews unsaved admin-entered URLs before allowlist validation. */}
                          <img src={url} alt={`Gallery thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0 inset-x-0 bg-void/75 text-meta text-ink text-center tabular-nums">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Features section */}
              <div className="surface p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h2 className="label text-proposal">
                      ⚡ {tSafe('featuresHeading', 'Tính năng nổi bật')}
                    </h2>
                    <span className={`${TAG_NEUTRAL} uppercase`}>
                      {selected.category} · {selected.subCategory1}
                    </span>
                  </div>
                  <span className="meta">{tSafe('featuresHint', 'Mỗi dòng một ý.')}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['en', 'vi'] as const).map((side) => (
                    <div key={side} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`feat-${side}`} className="label">
                          {tSafe(side === 'en' ? 'featuresEn' : 'featuresVi', side === 'en' ? 'Tiếng Anh' : 'Tiếng Việt')}
                        </label>
                        <button
                          type="button"
                          onClick={() => translate(side)}
                          disabled={busy !== ''}
                          className="chip chip-action disabled:opacity-40"
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
                        className={AREA}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* CORE SPECS SECTION: GOOGLE SHEET & MARKDOWN EDITOR */}
              <div className="surface p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <h2 className="label text-proposal">{tSafe('specsHeading', 'Thông số cốt lõi')}</h2>
                    <span className={TAG_NEUTRAL}>Google Sheet &amp; Markdown Grid</span>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="surface-sunken flex items-center gap-1 p-1">
                    <button
                      type="button"
                      onClick={() => setSpecViewMode('sheet')}
                      className={`px-3 min-h-[var(--layout-touch-target)] rounded-sm text-body-sm font-semibold transition-colors cursor-pointer ${
                        specViewMode === 'sheet' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {tSafe('sheetModeBtn', '📊 Bảng tính Google Sheet')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecViewMode('markdown')}
                      className={`px-3 min-h-[var(--layout-touch-target)] rounded-sm text-body-sm font-semibold transition-colors cursor-pointer ${
                        specViewMode === 'markdown' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {tSafe('markdownModeBtn', '📝 Xem & Sao chép Markdown')}
                    </button>
                  </div>
                </div>

                <div className="seam" />

                {!selected.specs ? (
                  <p className="text-body-sm text-danger">{tSafe('noSpecBlock', 'Sản phẩm này chưa có khối thông số.')}</p>
                ) : specViewMode === 'sheet' ? (
                  /* GOOGLE SHEET SPREADSHEET TABLE GRID */
                  <div className="flex flex-col gap-3">
                    <p className="meta leading-relaxed">
                      {tSafe('specsEmptyHint', 'Để trống ô mà nguồn không công bố — nó sẽ hiện "nguồn không công bố".')}
                    </p>

                    {/* Rows separate by an alternating film, never by a rule. */}
                    <div className="overflow-x-auto rounded-md bg-white/[0.022]">
                      <table className="w-full text-left text-body-sm border-collapse">
                        <thead>
                          <tr className="label bg-white/[0.04]">
                            <th className="py-3 px-3 w-12 text-center font-semibold">
                              {tSafe('colIndex', 'STT')}
                            </th>
                            <th className="py-3 px-4 w-48 font-semibold">
                              {tSafe('colField', 'Thông số (Field)')}
                            </th>
                            <th className="py-3 px-3 w-20 text-center font-semibold">
                              {tSafe('colType', 'Loại')}
                            </th>
                            <th className="py-3 px-4 font-semibold">{tSafe('colValue', 'Giá trị (Value / Input Control)')}</th>
                          </tr>
                        </thead>
                        <tbody>
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
                              <tr key={field} className={idx % 2 === 1 ? 'row-tint' : ''}>
                                <td className="py-2.5 px-3 text-center text-meta text-ink-faint tabular-nums">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="flex flex-col">
                                    <span className="text-body-sm font-semibold text-ink">
                                      {label}
                                    </span>
                                    <span className="text-meta text-ink-faint">
                                      {field}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {/* The field's input type is metadata, not a
                                      signal: one neutral chip for all four. */}
                                  <span className={`inline-block ${TAG_NEUTRAL} uppercase`}>
                                    {meta.type === 'dropdown'
                                      ? tSafe('typeDropdown', 'DROP')
                                      : meta.type === 'number'
                                        ? tSafe('typeNumber', 'NUM')
                                        : meta.type === 'url'
                                          ? tSafe('typeUrl', 'URL')
                                          : tSafe('typeText', 'TEXT')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4">
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
                                        className={FIELD_SM}
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
                                          className={`${FIELD_SM} flex-1`}
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
                                        className={`${FIELD_SM} tabular-nums`}
                                      />
                                      {meta.unit && <span className={TAG_NEUTRAL}>{meta.unit}</span>}
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
                                      className={FIELD_SM}
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Source URL Row */}
                          <tr className="row-tint">
                            <td className="py-2.5 px-3 text-center text-meta text-ink-faint">
                              ★
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="text-body-sm font-semibold text-ink">
                                {tSafe('specsSourceLabel', 'Trang nguồn')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-block ${TAG_NEUTRAL} uppercase`}>
                                {tSafe('typeUrl', 'URL')}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <input
                                  type="url"
                                  value={draft.source}
                                  onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                                  placeholder="https://www.sony.com.vn/..."
                                  className={FIELD_SM}
                                />
                                {draft.source && (
                                  <a
                                    href={draft.source}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="chip chip-action shrink-0"
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
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <span className="meta">
                        Bảng Markdown định dạng GFM có thể sao chép trực tiếp:
                      </span>
                      <button
                        type="button"
                        onClick={copyMarkdown}
                        className="btn-glass gap-1.5 cursor-pointer"
                      >
                        {copiedMd ? tSafe('copiedMarkdown', '✓ Đã sao chép!') : tSafe('copyMarkdown', '📋 Sao chép Markdown')}
                      </button>
                    </div>

                    <pre className="surface-sunken p-4 text-body-sm text-ink-muted overflow-x-auto leading-relaxed">
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
                  className="btn-accent disabled:opacity-40 cursor-pointer"
                >
                  {busy === 'saving' ? tSafe('saving', 'Đang lưu…') : tSafe('save', 'Lưu vào Supabase')}
                </button>
                {/* The save state is text, never a coloured field or a border. */}
                {status && (
                  <span
                    role="status"
                    className={`text-label font-semibold ${status.kind === 'ok' ? 'text-community' : 'text-danger'}`}
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
          className="fixed inset-0 z-50 bg-void/85 backdrop-blur-[30px] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
        >
          {/* The sheet is the second raised layer. No stroke: the 40px blur and
              the specular highlight are what separate it from the page. */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-raised w-full max-w-3xl max-h-[90dvh] p-6 flex flex-col gap-5 cursor-default scroll-area"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-title-3 font-semibold text-ink">{tSafe('createModalTitle', 'Thêm sản phẩm mới')}</h3>
                <p className="meta">{tSafe('createModalSub', 'Phân loại theo Category & SubCategory, khởi tạo thông số và lưu vào Supabase.')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="w-11 min-h-[var(--layout-touch-target)] shrink-0 rounded-md bg-white/[0.08] hover:bg-white/[0.13] text-ink-muted shadow-[var(--elevation-spec)] flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="seam" />

            <form onSubmit={handleCreateProduct} className="flex flex-col gap-5">
              {/* Category & SubCategory Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/[0.022] p-4 rounded-lg">
                <div className="flex flex-col gap-2">
                  <label className="label">{tSafe('categoryLabel', 'Danh mục (Category)')} *</label>
                  <select
                    value={newCat}
                    onChange={(e) => handleCategoryChange(e.target.value as 'camera' | 'lens' | 'accessory')}
                    className={FIELD}
                  >
                    <option value="camera">{tSafe('catCamera', 'Máy ảnh (Camera)')}</option>
                    <option value="lens">{tSafe('catLens', 'Ống kính (Lens)')}</option>
                    <option value="accessory">{tSafe('catAccessory', 'Phụ kiện (Accessory)')}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{tSafe('subCategory1Label', 'Phân nhóm chính (SubCategory 1)')} *</label>
                  <select
                    value={newSub1}
                    onChange={(e) => setNewSub1(e.target.value)}
                    className={FIELD}
                  >
                    {SUB1_OPTIONS[newCat].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{tSafe('subCategory2Label', 'Phân nhóm phụ (SubCategory 2)')}</label>
                  <input
                    type="text"
                    value={newSub2}
                    onChange={(e) => setNewSub2(e.target.value)}
                    placeholder="VD: Alpha 7 Series, G Master..."
                    className={FIELD}
                  />
                </div>
              </div>

              {/* Product Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="label">{tSafe('skuLabel', 'Mã SKU sản phẩm')} *</label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="VD: ILCE-7M5/BQ hoặc SEL2470GM2"
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{tSafe('nameLabel', 'Tên ngắn sản phẩm')} *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="VD: 7 V hoặc FE 24-70mm f/2.8 GM II"
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="label">{tSafe('fullNameLabel', 'Tên đầy đủ sản phẩm')} *</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="VD: Máy ảnh Sony Alpha 7 V (Thân máy) chính hãng"
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{tSafe('priceVndLabel', 'Giá niêm yết (VND)')}</label>
                  <input
                    type="number"
                    value={newPriceVnd || ''}
                    onChange={(e) => setNewPriceVnd(Number(e.target.value))}
                    placeholder="VD: 59900000"
                    className={`${FIELD} tabular-nums`}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{tSafe('priceFormattedLabel', 'Giá hiển thị')}</label>
                  <input
                    type="text"
                    value={newPriceFormatted}
                    onChange={(e) => setNewPriceFormatted(e.target.value)}
                    placeholder="VD: 59.990.000 ₫"
                    className={`${FIELD} tabular-nums`}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{tSafe('urlLabel', 'Link trang sản phẩm (Sony Store URL)')}</label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://www.sony.com.vn/electronics/..."
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="label">{tSafe('imageUrlLabel', 'Link ảnh sản phẩm đại diện chính (Primary Image URL)')}</label>
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="/logo.png hoặc URL ảnh CDN"
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="label">{tSafe('galleryUrlsLabel', 'Danh sách URL ảnh minh họa / Gallery (Mỗi URL 1 dòng)')}</label>
                  <textarea
                    value={newGalleryUrls}
                    onChange={(e) => setNewGalleryUrls(e.target.value)}
                    rows={4}
                    placeholder="https://static.bhphoto.com/images/1.jpg&#10;https://static.bhphoto.com/images/2.jpg"
                    className={AREA}
                  />
                </div>
              </div>

              <div className="seam" />

              {/* Key Features Input (EN & VI) */}
              <div className="flex flex-col gap-3">
                <span className="label text-proposal">{tSafe('featuresHeading', 'Tính năng nổi bật')} ({tSafe('featuresHint', 'Mỗi dòng một ý.')})</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="label">{tSafe('featuresEn', 'Tiếng Anh')}</label>
                    <textarea
                      value={newFeaturesEn}
                      onChange={(e) => setNewFeaturesEn(e.target.value)}
                      rows={5}
                      placeholder="Mỗi dòng 1 tính năng tiếng Anh..."
                      className={AREA}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="label">{tSafe('featuresVi', 'Tiếng Việt')}</label>
                    <textarea
                      value={newFeaturesVi}
                      onChange={(e) => setNewFeaturesVi(e.target.value)}
                      rows={5}
                      placeholder="Mỗi dòng 1 tính năng tiếng Việt..."
                      className={AREA}
                    />
                  </div>
                </div>
              </div>

              {/* The form's error is the hint turning rose — never a red field. */}
              {createError && (
                <p className="text-body-sm text-danger">{createError}</p>
              )}

              <div className="seam" />

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn-glass cursor-pointer"
                >
                  {tSafe('cancel', 'Hủy')}
                </button>
                <button
                  type="submit"
                  disabled={busy === 'creating'}
                  className="btn-accent disabled:opacity-40 cursor-pointer"
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
