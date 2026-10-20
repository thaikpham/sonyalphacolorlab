'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminSession } from '@/components/admin-ui/session';
import { AREA, FIELD, FIELD_SM, SELECT, TAG, TAG_NEUTRAL } from '@/components/admin-ui/controls';
import { needsTranslation } from '@/lib/cameras/features';
import { SPEC_ROWS, type SonyCamera } from '@/lib/cameras/types';
import { getSpecMeta } from '@/lib/cameras/spec-meta';
import { subCategoryLabel } from '@/lib/cameras/display';
import { formatPriceVnd, subCategory1Choices, subCategory2Choices } from '@/lib/cameras/taxonomy';
import { CORE_SPEC_KEYS, type HighlightsDraft } from '@/lib/cameras/highlights';
import { categoriesFor, type ProductCategoryId } from '@/lib/admin/category-roles';
import {
  afterSave,
  asDraft,
  choosePlacement,
  highlightsDropped,
  isDirty,
  lines,
  localesEmptied,
  placementDrops,
  priceDigits,
  saveBody,
  withPackaging,
  withPlacement,
  type Draft,
  type Placement,
} from '@/lib/admin/product-draft';

type Props = {
  products: SonyCamera[];
  initialTab?: 'di' | 'pe';
};

/**
 * A question the editor is waiting on, asked in the save bar rather than with
 * `window.confirm`: a move that would drop filled spec values or a camera's
 * highlights, or a save that would empty a locale's feature list. Tied to the
 * draft it was asked about, so switching product cannot answer it for another
 * one.
 */
type Ask =
  | { id: string; kind: 'save'; langs: ('en' | 'vi')[] }
  | { id: string; kind: 'placement'; next: Placement; drops: number; highlights: boolean };

/** The options a select offers, with the stored value kept when it is a legacy one. */
const withStored = (choices: readonly string[], stored: string) =>
  choices.includes(stored) ? [...choices] : [stored, ...choices];

/** The catalogue's category enum, read back through the message catalogue. */
const CATEGORY_KEY: Record<SonyCamera['category'], 'catCamera' | 'catLens' | 'catAccessory' | 'catAudio'> = {
  camera: 'catCamera',
  lens: 'catLens',
  accessory: 'catAccessory',
  audio: 'catAudio',
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

export function AdminEditor({ products: initialProducts, initialTab }: Props) {
  const t = useTranslations('admin');
  const tSpec = useTranslations('cameras.specs');
  const tCore = useTranslations('cameras.coreSpecs');
  /* The catalogue's reader-facing sub-category labels — the stored values
     mix the two languages, and stay the values sent. */
  const tCam = useTranslations('cameras');
  const subLabel = (value: string) => subCategoryLabel(value, tCam);
  /* One probe for the whole department, run by `<AdminShell>` above. This
     component renders only once the gate has opened, so it may assume an admin
     from its first line — the "checking", "not an admin" and "cannot verify"
     screens are the shell's now. */
  const { role: adminRole, authed } = useAdminSession();

  const [products, setProducts] = useState<SonyCamera[]>(initialProducts);
  /* The tab a click asked for, or null while nobody has asked. Derived below
     rather than synced in an effect: the role arrives from the session after
     the first paint, and writing it into state there is a cascading render
     that renders the wrong division once before correcting itself. */
  const [pickedTab, setPickedTab] = useState<'di' | 'pe' | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  /* The open draft's version lost to a save made elsewhere (409 staleEdit).
     The message tells the operator to reopen the product; this is what lets
     clicking the product that is already open actually reload it. */
  const [stale, setStale] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  const askCancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState<'' | 'saving' | 'translating' | 'creating'>('');
  /* `ok` is a save or a create; `note` is the machine-translation caveat,
     which must stay visible while its output is unsaved — that is when it
     matters. */
  const [status, setStatus] = useState<{ kind: 'ok' | 'note' | 'err'; msg: string } | null>(null);
  /* The product the editor is on right now, for answers that arrive late — an
     open, a translation, a save. State would be the closure's copy, which is
     the product the request was made for, not the one on screen now. */
  const onProduct = useRef<string | null>(null);

  // Specs Sheet View Mode & Clipboard State
  const [specViewMode, setSpecViewMode] = useState<'sheet' | 'markdown'>('sheet');
  const [copiedMd, setCopiedMd] = useState(false);

  // New Product Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pickedCat, setPickedCat] = useState<ProductCategoryId | null>(null);
  const [pickedSub1, setPickedSub1] = useState<string | null>(null);
  const [newSub2, setNewSub2] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPriceVnd, setNewPriceVnd] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newGalleryUrls, setNewGalleryUrls] = useState('');
  const [newFeaturesEn, setNewFeaturesEn] = useState('');
  const [newFeaturesVi, setNewFeaturesVi] = useState('');
  const [createError, setCreateError] = useState('');

  /* The role wins over the URL, and both lose to a click.
     `canManageCategory()` refuses a PE admin's write to a DI product
     server-side, so honouring `?division=di` for them would render a whole
     screen of controls that cannot save. A single-division admin cannot pick
     the other tab anyway — the buttons below refuse. */
  const activeTab: 'di' | 'pe' =
    adminRole === 'pe' ? 'pe' : adminRole === 'di' ? 'di' : (pickedTab ?? initialTab ?? 'di');

  /* Only the categories a create could save, defaulting to the open
     division's. The form used to offer all four to every role and start on
     `camera`, so a PE admin's first create always answered 403. Derived, like
     the tab, because the role arrives after the first paint. */
  const allowedCats = categoriesFor(adminRole);
  const fallbackCat: ProductCategoryId = activeTab === 'pe' ? 'audio' : 'camera';
  const newCat: ProductCategoryId =
    pickedCat && allowedCats.includes(pickedCat)
      ? pickedCat
      : allowedCats.includes(fallbackCat)
        ? fallbackCat
        : allowedCats[0];
  /* The placement comes from the catalogue's taxonomy, the same lists the
     routes validate against: free text here filed products under values no
     public chip filters by. */
  const newSub1Choices = subCategory1Choices(newCat);
  const newSub1 = pickedSub1 && newSub1Choices.includes(pickedSub1) ? pickedSub1 : (newSub1Choices[0] ?? '');
  const newSub2Choices = subCategory2Choices(newCat, newSub1);
  const newSub2Valid = newSub2Choices.includes(newSub2) ? newSub2 : '';

  /* What the open product may be refiled as: the role's categories within
     the open division, so a save can never move it out of the list it is in.
     A PE admin has one — audio — and sees it as text, not as a select. */
  const divisionCats = allowedCats.filter((c) => (activeTab === 'pe' ? c === 'audio' : c !== 'audio'));

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? null,
    [products, selectedId],
  );

  /* Whether a save would change anything — the same diff the save sends, so
     the warning and the button can never disagree about it. */
  const dirty = isDirty(draft, selected);

  /* The question on screen, only while its draft is the one open. */
  const pending = ask && draft && ask.id === draft.id ? ask : null;
  useEffect(() => {
    if (pending) askCancel.current?.focus();
  }, [pending]);

  /* The one guard against losing work on a reload or a closed tab. Nothing
     autosaves. Switching product or division asks in `confirmDiscard()`. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const confirmDiscard = () => !dirty || window.confirm(t('discardConfirm'));

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

  /* Every code the routes answer with has a message under `admin.errors`;
     the lookup asks the catalogue rather than a hand-kept list. The list this
     replaces stopped at ten codes and sent everything else — a write freeze, a
     content outage, a missing second factor, a refused category — to `failed`,
     which reads "Dịch không thành công" (translation failed) under the SAVE
     button. The fallback is per call: a save that fails for an unknown reason
     is a failed save, not a failed translation. */
  const err = (code: string, fallback: 'saveFailed' | 'failed' = 'saveFailed') => {
    if (t.has(`errors.${code}`)) return t(`errors.${code}`);
    console.warn('[admin] unknown error code:', code);
    return t(`errors.${fallback}`);
  };

  /**
   * Opens a product from the admin read, never from the page's copy.
   *
   * The page renders the public catalogue: cached for up to a minute, frozen
   * for as long as the tab stays open, and without `updated_at`, which the
   * save has to name. The draft and its version come from this one read so
   * they describe the same row; the page's copy only lends the seed packaging
   * the admin read deliberately leaves out (`withPackaging`).
   */
  const open = async (p: SonyCamera) => {
    onProduct.current = p.id;
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(p.id)}`, { headers: authed() });
      const data = (await res.json()) as {
        ok?: boolean;
        product?: SonyCamera;
        updatedAt?: string | null;
        error?: string;
      };
      if (onProduct.current !== p.id) return;
      if (!res.ok || !data.ok || !data.product) {
        setStatus({ kind: 'err', msg: err(data.error ?? 'contentUnavailable') });
        return;
      }
      const stored = withPackaging(data.product, p);
      setProducts((prev) => prev.map((x) => (x.id === stored.id ? stored : x)));
      setDraft(asDraft(stored, data.updatedAt ?? null));
    } catch {
      if (onProduct.current === p.id) setStatus({ kind: 'err', msg: err('contentUnavailable') });
    }
  };

  const select = (p: SonyCamera) => {
    if (p.id === selectedId && draft && !stale) return;
    if (!confirmDiscard()) return;
    setSelectedId(p.id);
    setDraft(null);
    setAsk(null);
    setCopiedMd(false);
    setStale(false);
    void open(p);
  };

  const pickTab = (tab: 'di' | 'pe') => {
    if (!confirmDiscard()) return;
    setPickedTab(tab);
    setSelectedId(null);
    setDraft(null);
    setAsk(null);
    setStatus(null);
    onProduct.current = null;
  };

  const setHl = (side: 'en' | 'vi', patch: Partial<HighlightsDraft['en']>) =>
    setDraft((d) => (d ? { ...d, hl: { ...d.hl, [side]: { ...d.hl[side], ...patch } } } : d));

  /** One field of the draft, written through the functional form so an edit
      can never land on a draft that has since been replaced. */
  const setField = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setSpec = (field: string, value: string) =>
    setDraft((d) => (d ? { ...d, specs: { ...d.specs, [field]: value } } : d));

  /** Refiles the draft. A move that changes the spec kind and would drop
      filled values asks first, naming how many — and so does one that takes a
      camera out of the category, which the route clears the highlights of. */
  const place = (change: Partial<Placement>) => {
    if (!draft || !selected || draft.id !== selected.id) return;
    const next = choosePlacement(draft, change);
    const drops = placementDrops(draft, selected, next).length;
    const highlights = highlightsDropped(draft, selected, next);
    if (drops > 0 || highlights) {
      setAsk({ id: draft.id, kind: 'placement', next, drops, highlights });
      return;
    }
    const id = draft.id;
    setDraft((d) => (d && d.id === id ? withPlacement(d, next) : d));
  };

  /* A yes waits while a request is out: "Save anyway" during a translation
     ran two requests at once, and the first to finish re-enabled Save while
     the PATCH was still in flight. */
  const answer = (go: boolean) => {
    const q = pending;
    if (go && busy !== '') return;
    setAsk(null);
    if (!go || !q) return;
    if (q.kind === 'save') void save(true);
    else setDraft((d) => (d && d.id === q.id ? withPlacement(d, q.next) : d));
  };

  const translate = async (target: 'en' | 'vi') => {
    if (!draft) return;
    /* The draft the translation is FOR. Claude takes seconds; switching
       product in that time used to put this product's whole draft back under
       the next one, and Save then wrote it there. */
    const id = draft.id;
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
      if (onProduct.current !== id) return;
      if (!res.ok || !data.ok || !data.lines) {
        setStatus({ kind: 'err', msg: err(data.error ?? 'failed', 'failed') });
      } else {
        const text = data.lines.join('\n');
        setDraft((d) => (d && d.id === id ? { ...d, [target]: text } : d));
        setStatus({ kind: 'note', msg: t('translateNote') });
      }
    } catch {
      if (onProduct.current === id) setStatus({ kind: 'err', msg: err('failed', 'failed') });
    } finally {
      setBusy('');
    }
  };

  /** `confirmed` once the operator has agreed to empty a feature list. */
  const save = async (confirmed = false) => {
    /* One request at a time. A second PATCH would name the version the first
       one is replacing, and answer 409 staleEdit for a save that landed. */
    if (busy !== '') return;
    if (!draft || !selected || draft.id !== selected.id) return;
    /* A save once emptied a locale's whole feature list and nothing asked. */
    const emptied = localesEmptied(draft);
    if (!confirmed && emptied.length > 0) {
      setAsk({ id: draft.id, kind: 'save', langs: emptied });
      return;
    }
    setAsk(null);
    /* What was sent, kept to tell an untouched draft from one edited while
       the request was out — see `afterSave()`. */
    const sent = draft;
    const product = selected;
    setBusy('saving');
    setStatus(null);

    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        headers: authed(),
        /* Only what changed, and the version it changed — see `changes()`.
           A row saved elsewhere since this one was opened answers 409
           `staleEdit` rather than being reverted. */
        body: JSON.stringify(saveBody(sent, product)),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        product?: SonyCamera;
        updatedAt?: string | null;
        project?: string | null;
      };
      if (!res.ok || !data.ok || !data.product) {
        if (onProduct.current === sent.id) {
          if (data.error === 'staleEdit') setStale(true);
          setStatus({ kind: 'err', msg: err(data.error ?? 'saveFailed') });
        }
      } else {
        /* The stored row replaces the local one WHOLE, and the draft is rebuilt
           from it. This used to merge four fields back by hand — name, full
           name, image, gallery — and leave `features` and `specs` as they were
           before the save. Reopening the product then showed the old bullets
           and the old specs, and saving again from that screen wrote them back
           over the edit that had just succeeded. */
        const stored = withPackaging(data.product, product);
        setProducts((prev) => prev.map((p) => (p.id === stored.id ? stored : p)));
        setDraft((d) => afterSave(d, sent, stored, data.updatedAt ?? null));
        if (onProduct.current === stored.id) {
          setStatus({
            kind: 'ok',
            msg: data.project ? t('savedTo', { project: data.project }) : t('saved'),
          });
        }
      }
    } catch {
      if (onProduct.current === sent.id) setStatus({ kind: 'err', msg: err('saveFailed') });
    } finally {
      setBusy('');
    }
  };

  const handleCategoryChange = (cat: ProductCategoryId) => {
    setPickedCat(cat);
    setPickedSub1(null);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newName.trim()) {
      setCreateError(err('nameRequired'));
      return;
    }
    if (newCat !== 'audio' && !newSku.trim()) {
      setCreateError(err('skuRequired'));
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
          subCategory1: newSub1,
          subCategory2: newSub2Valid,
          /* A number; the route writes the catalogue's own price text. */
          priceVnd: Number(newPriceVnd || '0'),
          url: newUrl.trim(),
          imageUrl: primaryImg,
          galleryUrls: galleryList,
          features: { en: lines(newFeaturesEn), vi: lines(newFeaturesVi) },
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        product?: SonyCamera;
        updatedAt?: string | null;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.product) {
        setCreateError(err(data.error ?? 'saveFailed'));
      } else {
        const created = data.product;
        setProducts((prev) => [created, ...prev]);
        setIsCreateOpen(false);
        /* Opened straight from the answer, which carries the new row's
           version — unless that would throw away edits to the product open
           behind the modal, which the operator is asked about first. */
        if (confirmDiscard()) {
          onProduct.current = created.id;
          setSelectedId(created.id);
          setDraft(asDraft(created, data.updatedAt ?? null));
          setAsk(null);
          setCopiedMd(false);
          setStatus({ kind: 'ok', msg: t('createdSuccess') });
        }
        setNewSku('');
        setNewName('');
        setNewFullName('');
        setNewPriceVnd('');
        setNewSub2('');
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
    if (!selected || !draft || !draft.specKind) return '';
    const fields = SPEC_ROWS[draft.specKind];
    let md = `### ${selected.fullName} (${selected.sku})\n\n`;
    md += `| ${t('colField')} | ${t('colValue')} |\n`;
    md += `| --- | --- |\n`;

    for (const field of fields) {
      const label = tSpec.has(field) ? tSpec(field) : field;
      const val = (draft.specs[field] ?? '').trim() || tSpec('specsNotPublished');
      md += `| **${label}** | ${val} |\n`;
    }

    if (draft.source) {
      md += `| **${t('specsSourceLabel')}** | [${draft.source}](${draft.source}) |\n`;
    }

    return md;
  }, [selected, draft, t, tSpec]);

  const copyMarkdown = () => {
    if (!generatedMarkdownTable) return;
    navigator.clipboard.writeText(generatedMarkdownTable);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  /* The save bar's one line of state: an error or the translation caveat
     first, then unsaved edits, then the last success — "Đã lưu" beside fields
     edited since would be untrue. */
  const shown =
    status && status.kind !== 'ok'
      ? status
      : dirty
        ? { kind: 'dirty' as const, msg: t('unsaved') }
        : status;

  return (
    <main className="flex-1 w-full max-w-[110rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
      {/* No visible page header: the nav already names the section, and the
          create action lives in the sticky save bar and the list column. */}
      <h1 className="sr-only">{t('title')}</h1>

      {/* Category Division Navigation Tabs & Admin Role Badge */}
      <div className="surface flex flex-wrap items-center justify-between gap-4 p-3.5">
        {/* Category Switcher Tabs — the rut is sunken, the choice is a fill. */}
        <div className="surface-sunken flex items-center gap-1 p-1">
          <button
            type="button"
            onClick={() => {
              if (adminRole === 'pe') return;
              pickTab('di');
            }}
            disabled={adminRole === 'pe'}
            className={`px-4 min-h-[var(--layout-touch-target)] rounded-sm text-body-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'di' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
            } ${adminRole === 'pe' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={adminRole === 'pe' ? t('tabLockedToPe') : undefined}
          >
            {t('tabDi')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (adminRole === 'di') return;
              pickTab('pe');
            }}
            disabled={adminRole === 'di'}
            className={`px-4 min-h-[var(--layout-touch-target)] rounded-sm text-body-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'pe' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
            } ${adminRole === 'di' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title={adminRole === 'di' ? t('tabLockedToDi') : undefined}
          >
            {t('tabPe')}
          </button>
        </div>

        {/* Role Badge — one signal per row: violet for the whole catalogue,
            accent for DI, cyan for PE, and only ever one of the three. */}
        <div className="flex items-center gap-2">
          <span className="label">{t('roleLabel')}</span>
          {adminRole === 'super' && (
            <span className={`${TAG} bg-proposal/15 text-proposal`}>{t('roleSuper')}</span>
          )}
          {adminRole === 'di' && (
            <span className={`${TAG} bg-accent-400/15 text-accent-400`}>{t('roleDi')}</span>
          )}
          {adminRole === 'pe' && (
            <span className={`${TAG} bg-community/15 text-community`}>{t('rolePe')}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* The review queue: a film ground, surface cards on it, and the item
            being edited tinted `proposal` — a fill, never a stroke. On desktop
            it is sticky and as tall as the viewport, so the list scrolls on its
            own and shows as many products as the screen can hold. */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 bg-glass p-4 rounded-lg lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]">
          <div className="flex items-center justify-between gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className={FIELD}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="label tabular-nums">{t('productCount', { count: filtered.length })}</span>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="text-label font-semibold text-accent-400 cursor-pointer"
            >
              {t('createProductBtn')}
            </button>
          </div>
          <ul className="flex flex-col gap-2.5 max-h-[34rem] lg:max-h-none lg:flex-1 lg:min-h-0 scroll-area">
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
                    <span className={`${TAG_NEUTRAL} shrink-0`}>{t(CATEGORY_KEY[p.category])}</span>
                  </div>
                  <span className="block text-meta text-ink-muted truncate">{p.sku}</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-meta text-ink-faint truncate">{p.subCategory1}</span>
                    <span
                      className={`text-label font-semibold shrink-0 ${
                        needsTranslation(p.features) ? 'text-danger' : 'text-community'
                      }`}
                    >
                      {needsTranslation(p.features) ? t('needsVi') : t('complete')}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Editor */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-5">
          {!selected ? (
            <div className="surface p-8 flex flex-col items-center gap-4 text-center">
              <p className="text-body text-ink-muted">{t('selectPrompt')}</p>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="btn-accent cursor-pointer"
              >
                {t('createProductBtn')}
              </button>
            </div>
          ) : !draft ? (
            /* Between the click and the admin read's answer — or after it
               failed, which is its own state and never an empty form: a draft
               without a version could not be saved. */
            <div className="surface p-8 flex flex-col items-center gap-4 text-center">
              {status?.kind === 'err' ? (
                <>
                  <p role="status" className="text-body text-danger">{status.msg}</p>
                  <button type="button" onClick={() => void open(selected)} className="btn-glass cursor-pointer">
                    {t('retry')}
                  </button>
                </>
              ) : (
                <p className="text-body text-ink-muted">{t('loadingProduct')}</p>
              )}
            </div>
          ) : (
            <>
              {/* SAVE BAR — sticky at the top of the editor column, level with
                  the sticky product list, so saving never means scrolling back
                  up past a long spec sheet. The ground-coloured strip above it
                  hides the form scrolling through the 16px gap. */}
              <div className="surface-raised sticky top-4 z-20 flex items-center justify-between gap-4 flex-wrap px-5 py-3 before:absolute before:inset-x-0 before:bottom-full before:h-4 before:bg-void">
                <span className="text-body-sm font-semibold text-ink truncate min-w-0">{selected.name}</span>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* The save state is text, never a coloured field or a border. */}
                  {shown && (
                    <span
                      role="status"
                      className={`text-label font-semibold ${
                        shown.kind === 'err' ? 'text-danger' : shown.kind === 'dirty' ? 'text-ink-muted' : 'text-community'
                      }`}
                    >
                      {shown.msg}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(true)}
                    className="btn-glass gap-1.5 cursor-pointer"
                  >
                    {t('createProductBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={busy !== '' || !dirty || !!pending}
                    className="btn-accent disabled:opacity-40 cursor-pointer"
                  >
                    {busy === 'saving' ? t('saving') : t('save')}
                  </button>
                </div>

                {/* The editor's own confirm, on the bar that is always in
                    view — never a browser dialog. */}
                {pending && (
                  <div
                    role="alertdialog"
                    aria-labelledby="ask-title"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') answer(false);
                    }}
                    className="basis-full flex items-center justify-between gap-4 flex-wrap"
                  >
                    <p id="ask-title" className="text-body-sm font-semibold text-ink">
                      {pending.kind === 'save'
                        ? t('featuresEmptiedTitle', { which: pending.langs.length > 1 ? 'both' : pending.langs[0] })
                        : [
                            pending.drops > 0 ? t('specKindChangeTitle', { count: pending.drops }) : '',
                            pending.highlights ? t('highlightsDropTitle') : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                    </p>
                    <div className="flex items-center gap-3">
                      <button ref={askCancel} type="button" onClick={() => answer(false)} className="btn-glass cursor-pointer">
                        {t('cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => answer(true)}
                        disabled={busy !== ''}
                        className="btn-accent disabled:opacity-40 cursor-pointer"
                      >
                        {pending.kind === 'save' ? t('featuresEmptiedBtn') : t('specKindChangeBtn')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Product Basic Info & Gallery Images Section */}
              <div className="surface p-5 flex flex-col gap-4">
                <h2 className="label text-proposal">{t('basicInfoHeading')}</h2>

                <div className="seam" />

                {/* Where the product is filed, and what it is sold as. The
                    choices are the catalogue's taxonomy — the values the
                    public filters match — with a legacy stored value kept as
                    an option so an untouched row still saves as it is. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2">
                    {divisionCats.length > 1 ? (
                      <>
                        <label htmlFor="prod-category" className="label">
                          {t('categoryLabel')}
                        </label>
                        <select
                          id="prod-category"
                          value={draft.category}
                          onChange={(e) => place({ category: e.target.value as ProductCategoryId })}
                          className={SELECT}
                        >
                          {withStored(divisionCats, draft.category).map((c) => (
                            <option key={c} value={c}>
                              {t(CATEGORY_KEY[c as ProductCategoryId])}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <span className="label">{t('categoryLabel')}</span>
                        <span className="min-h-[var(--layout-touch-target)] flex items-center text-body text-ink">
                          {t(CATEGORY_KEY[draft.category])}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="prod-sub1" className="label">
                      {t('subCategory1Label')}
                    </label>
                    <select
                      id="prod-sub1"
                      value={draft.subCategory1}
                      onChange={(e) => place({ subCategory1: e.target.value })}
                      className={SELECT}
                    >
                      {withStored(subCategory1Choices(draft.category), draft.subCategory1).map((v) => (
                        <option key={v} value={v}>
                          {subLabel(v)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="prod-sub2" className="label">
                      {t('subCategory2Label')}
                    </label>
                    <select
                      id="prod-sub2"
                      value={draft.subCategory2}
                      onChange={(e) => place({ subCategory2: e.target.value })}
                      className={SELECT}
                    >
                      {withStored(['', ...subCategory2Choices(draft.category, draft.subCategory1)], draft.subCategory2).map(
                        (v) => (
                          <option key={v || 'none'} value={v}>
                            {v ? subLabel(v) : t('subCategoryNone')}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="prod-sku" className="label">
                      {t('skuLabel')}
                    </label>
                    <input
                      id="prod-sku"
                      type="text"
                      value={draft.sku}
                      onChange={(e) => setField({ sku: e.target.value })}
                      className={FIELD}
                      placeholder={t('placeholderSku')}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="prod-price" className="label">
                      {t('priceVndLabel')}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="prod-price"
                        type="text"
                        inputMode="numeric"
                        value={draft.priceVnd}
                        onChange={(e) => setField({ priceVnd: priceDigits(e.target.value) })}
                        className={`${FIELD} tabular-nums`}
                        placeholder={t('placeholderPriceVnd')}
                      />
                      {/* What the catalogue will store and show — derived by
                          the route, never typed. */}
                      <output htmlFor="prod-price" className="shrink-0 text-body-sm text-ink-muted tabular-nums">
                        {formatPriceVnd(Number(draft.priceVnd || '0'))}
                      </output>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="prod-url" className="label">
                      {t('urlLabel')}
                    </label>
                    <input
                      id="prod-url"
                      type="url"
                      inputMode="url"
                      value={draft.url}
                      onChange={(e) => setField({ url: e.target.value })}
                      className={FIELD}
                      placeholder={t('placeholderStoreUrl')}
                    />
                  </div>
                </div>

                <div className="seam" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Product Name Inputs */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="prod-name" className="label">
                        {t('nameLabel')}
                      </label>
                      <input
                        id="prod-name"
                        type="text"
                        value={draft.name}
                        onChange={(e) => setField({ name: e.target.value })}
                        className={FIELD}
                        placeholder={t('placeholderName')}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="prod-fullname" className="label">
                        {t('fullNameLabel')}
                      </label>
                      <input
                        id="prod-fullname"
                        type="text"
                        value={draft.fullName}
                        onChange={(e) => setField({ fullName: e.target.value })}
                        className={FIELD}
                        placeholder={t('placeholderFullName')}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="prod-imageurl" className="label">
                        {t('primaryImageLabel')}
                      </label>
                      <input
                        id="prod-imageurl"
                        type="text"
                        value={draft.imageUrl}
                        onChange={(e) => setField({ imageUrl: e.target.value })}
                        className={FIELD}
                        placeholder={t('placeholderImageUrl')}
                      />
                    </div>
                  </div>

                  {/* Gallery Image URLs Textarea */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="prod-galleryurls" className="label">
                        {t('galleryUrlsLabel')}
                      </label>
                      <span className={`${TAG_NEUTRAL} tabular-nums`}>
                        {t('photosCount', { count: lines(draft.galleryUrls).length })}
                      </span>
                    </div>
                    <textarea
                      id="prod-galleryurls"
                      value={draft.galleryUrls}
                      onChange={(e) => setField({ galleryUrls: e.target.value })}
                      rows={6}
                      className={AREA}
                      placeholder={t('placeholderGallery')}
                    />
                  </div>
                </div>

                {/* Live Thumbnail Preview Grid */}
                {lines(draft.galleryUrls).length > 0 && (
                  <div className="flex flex-col gap-3 mt-1">
                    <div className="seam" />
                    <span className="label">{t('galleryPreviewHeading')}</span>
                    <div className="flex items-center gap-2 pb-2 scroll-silent overflow-x-auto">
                      {lines(draft.galleryUrls).map((url, idx) => (
                        <div key={idx} className="relative group shrink-0 w-16 h-16 rounded-md overflow-hidden bg-sunken shadow-[var(--elevation-spec)]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- previews unsaved admin-entered URLs before allowlist validation. */}
                          <img src={url} alt={t('galleryThumbAlt', { n: idx + 1 })} className="w-full h-full object-cover" />
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
                    <h2 className="label text-proposal">{t('featuresHeading')}</h2>
                    {/* Sentence case, not `uppercase`: a subcategory such as
                        "Tai nghe Inzone" is three words and carries
                        diacritics, and only `.label` may be uppercase. */}
                    <span className={TAG_NEUTRAL}>
                      {t(CATEGORY_KEY[draft.category])} · {subLabel(draft.subCategory1)}
                    </span>
                  </div>
                  <span className="meta">{t('featuresHint')}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['en', 'vi'] as const).map((side) => (
                    <div key={side} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`feat-${side}`} className="label">
                          {side === 'en' ? t('featuresEn') : t('featuresVi')}
                        </label>
                        <button
                          type="button"
                          onClick={() => translate(side)}
                          disabled={busy !== ''}
                          className="chip chip-action disabled:opacity-40"
                        >
                          {busy === 'translating'
                            ? t('translating')
                            : side === 'vi'
                              ? t('translateToVi')
                              : t('translateToEn')}
                        </button>
                      </div>
                      <textarea
                        id={`feat-${side}`}
                        value={draft[side]}
                        onChange={(e) => {
                          const text = e.target.value;
                          setDraft((d) => (d ? { ...d, [side]: text } : d));
                        }}
                        rows={9}
                        className={AREA}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Only while the product is, and stays, a camera — a move out
                  of the category takes the highlights editor with it. */}
              {selected.category === 'camera' && draft.category === 'camera' && (
                <div className="surface p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="label text-proposal">{t('highlightsHeading')}</h2>
                    <span className="meta">{t('highlightsHint')}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['en', 'vi'] as const).map((side) => (
                      <div key={side} className="flex flex-col gap-3">
                        <label htmlFor={`hl-${side}`} className="label">
                          {side === 'en' ? t('featuresEn') : t('featuresVi')}
                        </label>
                        <textarea
                          id={`hl-${side}`}
                          value={draft.hl[side].points}
                          onChange={(e) => setHl(side, { points: e.target.value })}
                          rows={8}
                          className={AREA}
                        />
                        <span className="label">{t('coreSpecsHeading')}</span>
                        {CORE_SPEC_KEYS.map((key) => (
                          <label key={key} className="flex flex-col gap-1">
                            <span className="meta">{tCore(key)}</span>
                            <input
                              value={draft.hl[side].specs[key]}
                              onChange={(e) => setHl(side, { specs: { ...draft.hl[side].specs, [key]: e.target.value } })}
                              className={FIELD_SM}
                            />
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CORE SPECS SECTION: GOOGLE SHEET & MARKDOWN EDITOR */}
              <div className="surface p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="label text-proposal">{t('specsHeading')}</h2>

                  {/* Mode Selector Tabs */}
                  <div className="surface-sunken flex items-center gap-1 p-1">
                    <button
                      type="button"
                      onClick={() => setSpecViewMode('sheet')}
                      className={`px-3 min-h-[var(--layout-touch-target)] rounded-sm text-body-sm font-semibold transition-colors cursor-pointer ${
                        specViewMode === 'sheet' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {t('sheetModeBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpecViewMode('markdown')}
                      className={`px-3 min-h-[var(--layout-touch-target)] rounded-sm text-body-sm font-semibold transition-colors cursor-pointer ${
                        specViewMode === 'markdown' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {t('markdownModeBtn')}
                    </button>
                  </div>
                </div>

                <div className="seam" />

                {/* The sheet is the draft's kind — the stored block's, or for a
                    product with none, the one its placement names — so the
                    five accessories that shipped without a block can take one. */}
                {!draft.specKind ? (
                  <p className="text-body-sm text-ink-muted">{t('noSpecBlock')}</p>
                ) : specViewMode === 'sheet' ? (
                  /* GOOGLE SHEET SPREADSHEET TABLE GRID */
                  <div className="flex flex-col gap-3">
                    <p className="meta leading-relaxed">{t('specsEmptyHint')}</p>

                    {/* Rows separate by an alternating film, never by a rule. */}
                    <div className="overflow-x-auto rounded-md bg-glass">
                      <table className="w-full text-left text-body-sm border-collapse">
                        <thead>
                          <tr className="label bg-glass">
                            <th className="py-3 px-3 w-12 text-center font-semibold">{t('colIndex')}</th>
                            <th className="py-3 px-4 w-48 font-semibold">{t('colField')}</th>
                            <th className="py-3 px-3 w-20 text-center font-semibold">{t('colType')}</th>
                            <th className="py-3 px-4 font-semibold">{t('colValue')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SPEC_ROWS[draft.specKind].map((field, idx) => {
                            const meta = getSpecMeta(field);
                            const val = draft.specs[field] ?? '';
                            const label = tSpec.has(field) ? tSpec(field) : field;

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
                                  <span className={`inline-block ${TAG_NEUTRAL}`}>
                                    {meta.type === 'dropdown'
                                      ? t('typeDropdown')
                                      : meta.type === 'number'
                                        ? t('typeNumber')
                                        : meta.type === 'url'
                                          ? t('typeUrl')
                                          : t('typeText')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4">
                                  {meta.type === 'dropdown' && meta.options ? (
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={meta.options.includes(val) ? val : val ? '__custom' : ''}
                                        onChange={(e) => {
                                          const chosen = e.target.value;
                                          if (chosen !== '__custom') setSpec(field, chosen);
                                        }}
                                        className={FIELD_SM}
                                      >
                                        <option value="">{t('notPublishedOption')}</option>
                                        {meta.options.map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                        {!meta.options.includes(val) && val && (
                                          <option value="__custom">{t('otherOption', { value: val })}</option>
                                        )}
                                      </select>
                                      {(!meta.options.includes(val) || val === '') && (
                                        <input
                                          type="text"
                                          value={val}
                                          onChange={(e) => setSpec(field, e.target.value)}
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
                                        onChange={(e) => setSpec(field, e.target.value)}
                                        placeholder={meta.placeholder}
                                        className={`${FIELD_SM} tabular-nums`}
                                      />
                                      {meta.unit && <span className={TAG_NEUTRAL}>{meta.unit}</span>}
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={(e) => setSpec(field, e.target.value)}
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
                                {t('specsSourceLabel')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-block ${TAG_NEUTRAL}`}>{t('typeUrl')}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <input
                                  type="url"
                                  value={draft.source}
                                  onChange={(e) => setField({ source: e.target.value })}
                                  placeholder={t('placeholderSourceUrl')}
                                  className={FIELD_SM}
                                />
                                {draft.source && (
                                  <a
                                    href={draft.source}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="chip chip-action shrink-0"
                                  >
                                    {t('openSource')}
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
                    <div className="flex items-center justify-end gap-4 flex-wrap">
                      <button
                        type="button"
                        onClick={copyMarkdown}
                        className="btn-glass gap-1.5 cursor-pointer"
                      >
                        {copiedMd ? t('copiedMarkdown') : t('copyMarkdown')}
                      </button>
                    </div>

                    <pre className="surface-sunken p-4 text-body-sm text-ink-muted overflow-x-auto leading-relaxed">
                      {generatedMarkdownTable}
                    </pre>
                  </div>
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
                <h3 className="text-title-3 font-semibold text-ink">{t('createModalTitle')}</h3>
                <p className="meta">{t('createModalSub')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                aria-label={t('close')}
                className="w-11 min-h-[var(--layout-touch-target)] shrink-0 rounded-md bg-glass-raised hover:bg-ink/10 text-ink-muted shadow-[var(--elevation-spec)] flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="seam" />

            <form onSubmit={handleCreateProduct} className="flex flex-col gap-5">
              {/* Category & SubCategory Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-glass p-4 rounded-lg">
                <div className="flex flex-col gap-2">
                  <label className="label">{t('categoryLabel')} *</label>
                  <select
                    value={newCat}
                    onChange={(e) => handleCategoryChange(e.target.value as ProductCategoryId)}
                    className={SELECT}
                  >
                    {allowedCats.map((c) => (
                      <option key={c} value={c}>
                        {t(CATEGORY_KEY[c])}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{t('subCategory1Label')} *</label>
                  <select
                    value={newSub1}
                    onChange={(e) => setPickedSub1(e.target.value)}
                    className={SELECT}
                  >
                    {newSub1Choices.map((opt) => (
                      <option key={opt} value={opt}>
                        {subLabel(opt)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{t('subCategory2Label')}</label>
                  <select value={newSub2Valid} onChange={(e) => setNewSub2(e.target.value)} className={SELECT}>
                    {['', ...newSub2Choices].map((opt) => (
                      <option key={opt || 'none'} value={opt}>
                        {opt ? subLabel(opt) : t('subCategoryNone')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="label">{t('skuLabel')} {newCat !== 'audio' && '*'}</label>
                  <input
                    type="text"
                    required={newCat !== 'audio'}
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder={t('placeholderSku')}
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{t('nameLabel')} *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('placeholderName')}
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="label">{t('fullNameLabel')} *</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder={t('placeholderFullName')}
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="new-price" className="label">{t('priceVndLabel')}</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="new-price"
                      type="text"
                      inputMode="numeric"
                      value={newPriceVnd}
                      onChange={(e) => setNewPriceVnd(priceDigits(e.target.value))}
                      placeholder={t('placeholderPriceVnd')}
                      className={`${FIELD} tabular-nums`}
                    />
                    <output htmlFor="new-price" className="shrink-0 text-body-sm text-ink-muted tabular-nums">
                      {formatPriceVnd(Number(newPriceVnd || '0'))}
                    </output>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="label">{t('urlLabel')}</label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder={t('placeholderStoreUrl')}
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="label">{t('imageUrlLabel')}</label>
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder={t('placeholderImageUrl')}
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="label">{t('galleryUrlsLabel')}</label>
                  <textarea
                    value={newGalleryUrls}
                    onChange={(e) => setNewGalleryUrls(e.target.value)}
                    rows={4}
                    placeholder={t('placeholderGallery')}
                    className={AREA}
                  />
                </div>
              </div>

              <div className="seam" />

              {/* Key Features Input (EN & VI) */}
              <div className="flex flex-col gap-3">
                <span className="label text-proposal">
                  {t('featuresHeading')} ({t('featuresHint')})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="label">{t('featuresEn')}</label>
                    <textarea
                      value={newFeaturesEn}
                      onChange={(e) => setNewFeaturesEn(e.target.value)}
                      rows={5}
                      className={AREA}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="label">{t('featuresVi')}</label>
                    <textarea
                      value={newFeaturesVi}
                      onChange={(e) => setNewFeaturesVi(e.target.value)}
                      rows={5}
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
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy === 'creating'}
                  className="btn-accent disabled:opacity-40 cursor-pointer"
                >
                  {busy === 'creating' ? t('creating') : t('createSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
