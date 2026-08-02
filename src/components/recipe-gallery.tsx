'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { OPEN_PROPOSAL_EVENT, OPEN_TWEAK_EVENT } from '@/lib/community/events';
import {
  getLocalCredits,
  getLocalPhotos,
  getServerCredits,
  getServerPhotos,
  setLocalCredit,
  setLocalPhotos,
  subscribeLocalPhotos,
  type PhotoCredit,
} from '@/lib/community/local-photos';

interface RecipeGalleryProps {
  slug: string;
  images: string[];
  title: string;
}

/**
 * One of the three offers under the collage, as an app icon.
 *
 * Same squircle as the ecosystem launcher — `.app-tile-shell` and `.app-tile`
 * are shared, not re-implemented — so the two rows of tiles on the site read as
 * one language. Only the glow colour differs, and it comes from `--card-accent`
 * so a tile cannot end up half one colour and half another.
 *
 * The `title` attribute carries the longer description that the old card
 * printed under its heading. Losing the visible line is the point of the
 * redesign; losing the sentence is not.
 */
function ActionTile({
  accent,
  icon,
  label,
  description,
  expanded,
  onClick,
}: {
  accent: 'community' | 'proposal' | 'ai';
  icon: string;
  label: string;
  description: string;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      title={description}
      className="group flex flex-col items-center gap-2.5 cursor-pointer font-sans"
      style={{ '--card-accent': `var(--color-${accent})` } as React.CSSProperties}
    >
      <div className="app-tile-shell w-16 h-16 sm:w-20 sm:h-20">
        <span aria-hidden className="accent-glow" />
        <div className="app-tile w-full h-full flex items-center justify-center">
          <span aria-hidden className="text-2xl sm:text-3xl leading-none">
            {icon}
          </span>
        </div>
      </div>

      {/* Two lines of height are reserved whether or not the label needs them.
          "Propose & vote new version" wraps and the other two do not, so
          without this the three tiles have three different footprints and
          anything laid out against them inherits the ragged edge. */}
      <span className="action-tile-label flex items-start justify-center min-h-[2rem] sm:min-h-[2.125rem] text-[11px] sm:text-xs font-bold text-ink text-center leading-snug max-w-[7.5rem]">
        {label}
      </span>
    </button>
  );
}

/**
 * Photographic collage gallery with community contributions, author credits, and full-screen slider lightbox.
 */
export function RecipeGallery({ slug, images, title }: RecipeGalleryProps) {
  const t = useTranslations('recipe');

  const localPhotos = useSyncExternalStore(
    subscribeLocalPhotos,
    useCallback(() => getLocalPhotos(slug), [slug]),
    getServerPhotos,
  );

  /* Read through the store like the photos are, not with a bare call during
     render: that returned `{}` on the server and real data on the client, and
     never re-rendered when a credit was added. */
  const localCredits = useSyncExternalStore(
    subscribeLocalPhotos,
    useCallback(() => getLocalCredits(slug), [slug]),
    getServerCredits,
  );

  const [remotePhotos, setRemotePhotos] = useState<string[]>([]);
  const [remoteCredits, setRemoteCredits] = useState<Record<string, PhotoCredit>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Contribution Form state
  const [inputUrl, setInputUrl] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorSocial, setAuthorSocial] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Pull community photos & credits shared by other people from Supabase
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/community-photos?slug=${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.photos)) {
          setRemotePhotos(data.photos.filter((p: unknown): p is string => typeof p === 'string'));
        }
        if (data?.ok && Array.isArray(data.credits)) {
          const map: Record<string, PhotoCredit> = {};
          for (const c of data.credits) {
            if (c?.url && typeof c.url === 'string') map[c.url] = c;
          }
          setRemoteCredits(map);
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.error('Failed to load community photos:', err);
        }
      });
    return () => controller.abort();
  }, [slug]);

  const userPhotos = useMemo(
    () => [...new Set([...remotePhotos, ...localPhotos])],
    [remotePhotos, localPhotos],
  );

  const allPhotos = useMemo(() => [...new Set([...images, ...userPhotos])], [images, userPhotos]);

  const nextPhoto = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null && allPhotos.length > 0 ? (prev + 1) % allPhotos.length : null));
  }, [allPhotos.length]);

  const prevPhoto = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null && allPhotos.length > 0 ? (prev - 1 + allPhotos.length) % allPhotos.length : null));
  }, [allPhotos.length]);

  // Keyboard navigation (Arrow keys to slide, Escape to close)
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextPhoto();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        prevPhoto();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxIndex, nextPhoto, prevPhoto]);

  const handleUrlChange = (val: string) => {
    setInputUrl(val);
    setErrorMsg(null);
    const trimmed = val.trim();
    setPreviewUrl(
      trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : null,
    );
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = inputUrl.trim();
    const cleanName = authorName.trim();
    const cleanSocial = authorSocial.trim();

    if (!cleanUrl) {
      setErrorMsg(t('errUrlRequired'));
      return;
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMsg(t('errUrlScheme'));
      return;
    }
    if (cleanSocial && !cleanSocial.startsWith('http://') && !cleanSocial.startsWith('https://')) {
      setErrorMsg(t('errSocialScheme'));
      return;
    }

    // Save credit & photo locally
    setLocalPhotos(slug, [...new Set([cleanUrl, ...localPhotos])]);
    if (cleanName || cleanSocial) {
      setLocalCredit(slug, {
        url: cleanUrl,
        authorName: cleanName || undefined,
        authorSocial: cleanSocial || undefined,
      });
    }

    setInputUrl('');
    setAuthorName('');
    setAuthorSocial('');
    setPreviewUrl(null);
    setIsFormOpen(false);

    try {
      const res = await fetch('/api/community-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          imageUrl: cleanUrl,
          authorName: cleanName || undefined,
          authorSocial: cleanSocial || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error ?? t('errShareFailed'));
      }
    } catch {
      setErrorMsg(t('errShareFailed'));
    }
  };

  const handleDeleteUserPhoto = (photoToDelete: string) => {
    setLocalPhotos(
      slug,
      localPhotos.filter((p) => p !== photoToDelete),
    );
  };

  const handleContributePhotoClick = () => {
    const willOpen = !isFormOpen;
    setIsFormOpen(willOpen);
    if (!willOpen) return;
    // One frame, so the form exists to scroll to.
    requestAnimationFrame(() => {
      document
        .getElementById('contribute-photo-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  /* The proposal form lives in a sibling section with no shared parent state, so
     the button asks for it by event rather than lifting the whole editor up. */
  const handleProposeVersionClick = () => {
    window.dispatchEvent(new CustomEvent(OPEN_PROPOSAL_EVENT));
  };

  /* The AI panel renders nothing until asked for, so this cannot just scroll to
     it — there is no element to scroll to. Same sibling-component problem as
     the proposal editor, solved the same way; the panel does its own scrolling
     and focusing once it has mounted. */
  const handleTweakAiClick = () => {
    window.dispatchEvent(new CustomEvent(OPEN_TWEAK_EVENT));
  };

  const allCredits = useMemo(() => ({ ...remoteCredits, ...localCredits }), [remoteCredits, localCredits]);
  const currentLightboxSrc = lightboxIndex !== null ? allPhotos[lightboxIndex] : null;
  const currentLightboxCredit: PhotoCredit | undefined = currentLightboxSrc
    ? allCredits[currentLightboxSrc]
    : undefined;

  return (
    <section className="mt-8">
      {/* Asymmetrical Prime Photographic Collage Grid */}
      {allPhotos.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-6">
          {allPhotos.map((src, i) => {
            const isLocalPhoto = localPhotos.includes(src);
            const isUserPhoto = userPhotos.includes(src);
            const isHeroTile = i === 0;
            const credit = allCredits[src];

            return (
              <li
                key={src}
                className={`group relative ${
                  isHeroTile ? 'sm:col-span-2 lg:col-span-2 sm:row-span-2' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  aria-label={t('zoomPhoto', { index: i + 1, title })}
                  className={`group relative block w-full overflow-hidden rounded-[var(--radius-glass)] cursor-zoom-in transition-all duration-300 shadow-md hover:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.85)] ${
                    isHeroTile ? 'aspect-[4/3] sm:aspect-[16/10] h-full min-h-[18rem]' : 'aspect-[4/3]'
                  }`}
                >
                  <Image
                    src={src}
                    alt={`${title} — frame ${i + 1}`}
                    fill
                    sizes={
                      isHeroTile
                        ? '(max-width: 1024px) 100vw, 50vw'
                        : '(max-width: 1024px) 50vw, 25vw'
                    }
                    priority={isHeroTile}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    unoptimized={isUserPhoto}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 sm:p-4">
                    <span className="self-start text-[10px] font-sans font-bold px-2.5 py-1 rounded-full bg-black/70 text-white backdrop-blur-md uppercase tracking-wider shadow-sm">
                      {isHeroTile
                        ? t('featuredShot')
                        : isUserPhoto
                          ? t('tagCommunity')
                          : t('frame', { index: i + 1 })}
                    </span>

                    <div className="flex items-end justify-between text-xs text-white/90">
                      <div>
                        <span className="font-mono text-[11px] block truncate max-w-[80%]">{title}</span>
                        {credit?.authorName && (
                          <span className="eyebrow text-[10px] text-community block mt-0.5">
                            📸 {t('photoBy')} {credit.authorName}
                          </span>
                        )}
                      </div>
                      <span className="font-bold underline text-[11px] shrink-0">{t('zoom')} ↗</span>
                    </div>
                  </div>
                </button>

                {isLocalPhoto && (
                  <button
                    type="button"
                    title={t('deletePhoto')}
                    aria-label={t('deletePhotoAt', { index: i + 1 })}
                    onClick={() => handleDeleteUserPhoto(src)}
                    /* Shown outright where there is no hover to reveal it with,
                       revealed on hover where there is. It was `opacity-0
                       group-hover:opacity-100` with `group` on the *sibling*
                       image button, so it never appeared at all. */
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-7 h-7 rounded-full bg-danger/85 hover:bg-danger text-white flex items-center justify-center text-xs transition-opacity backdrop-blur-md shadow-md opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <span aria-hidden>✕</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Empty State */}
      {allPhotos.length === 0 && !isFormOpen && (
        <div className="glass p-8 rounded-2xl text-center flex flex-col items-center justify-center gap-3 mb-6">
          <p className="text-sm text-ink-muted max-w-md">
            {t.rich('galleryEmpty', {
              b: (chunks) => <strong className="text-ink">{chunks}</strong>,
            })}
          </p>
        </div>
      )}

      {/* Contribute a photo · propose a version · tweak with AI.

          `items-start`, so a label that wraps to two lines cannot drag its
          neighbours' tiles down with it — the three icons stay on one line
          whatever the locale does to the text.

          `mt-16 mb-0`, which looks lopsided and is not. The two neighbours are
          not symmetric: above is the collage, a sibling inside this section, so
          its `mb-6` collapses with whatever margin sits here and the gap is
          simply the larger of the two. Below is the next section — a sibling in
          a `flex flex-col gap-8` parent, where margins do not collapse at all,
          so its own `mt-8` stacks on the parent's 32px gap and the gap can
          never be less than 64px. Matching that 64 on top is what makes the row
          sit evenly between them, and it is the same rhythm as every other
          block boundary in this column.

          So: if the parent's `gap-8` or the sections' `mt-8` ever change, this
          number has to change with them. */}
      <div className="flex items-start justify-center gap-8 sm:gap-14 mt-16 mb-0">
        <ActionTile
          accent="community"
          icon="📷"
          label={t('contributePhoto')}
          /* This tile toggles, so the tooltip says what the next press does. */
          description={isFormOpen ? t('cancel') : t('contributePhotoDesc')}
          expanded={isFormOpen}
          onClick={handleContributePhotoClick}
        />

        <ActionTile
          accent="proposal"
          icon="🗳️"
          label={t('proposeVersion')}
          description={t('proposeVersionDesc')}
          onClick={handleProposeVersionClick}
        />

        <ActionTile
          accent="ai"
          icon="✨"
          label={t('tweakAi')}
          description={t('tweakAiDesc')}
          onClick={handleTweakAiClick}
        />
      </div>

      {/* User Image Contribution Form with Author Credit & Social Link Inputs */}
      {isFormOpen && (
        <form
          id="contribute-photo-form"
          onSubmit={handleAddPhoto}
          /* The separation from the tiles above lives here, not on the row —
             the row runs to `mb-0` so that when this form is closed it is the
             section's last child and its own margin cannot widen the gap to the
             next section. */
          className="glass p-5 sm:p-6 rounded-2xl mt-6 mb-0 animate-fade-in flex flex-col gap-4 shadow-2xl"
        >
          <h4 className="font-sans text-white font-bold text-sm tracking-wide flex items-center gap-2">
            <span>📷</span>
            <span>{t('formTitle')}</span>
          </h4>

          {/* 1. Image URL (Required) */}
          <div>
            <label htmlFor="photo-url-input" className="block mb-1.5 text-white/90 text-xs font-semibold font-sans">
              {t('urlLabel')} <span className="text-danger">*</span>
            </label>
            <input
              id="photo-url-input"
              type="url"
              value={inputUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={t('urlPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl bg-black/70 border-0 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 font-sans transition-all shadow-inner"
              required
            />
          </div>

          {/* 2. Contributor Name & Social Network Link (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="author-name-input" className="block mb-1.5 text-white/80 text-xs font-semibold font-sans">
                {t('authorLabel')}
              </label>
              <input
                id="author-name-input"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder={t('authorPlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl bg-black/70 border-0 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 font-sans transition-all shadow-inner"
              />
            </div>

            <div>
              <label htmlFor="author-social-input" className="block mb-1.5 text-white/80 text-xs font-semibold font-sans">
                {t('socialLabel')}
              </label>
              <input
                id="author-social-input"
                type="url"
                value={authorSocial}
                onChange={(e) => setAuthorSocial(e.target.value)}
                placeholder="https://instagram.com/username"
                className="w-full px-4 py-2.5 rounded-xl bg-black/70 border-0 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 font-sans transition-all shadow-inner"
              />
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs text-danger mt-1">
              {errorMsg}
            </p>
          )}

          {/* Live Preview Card */}
          {previewUrl && (
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-xs text-white/70">{t('previewLabel')}</span>
              <div className="relative w-full aspect-[16/9] max-h-48 overflow-hidden rounded-xl bg-black/60 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user URL */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() =>
                    setErrorMsg(t('errPreviewLoad'))
                  }
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setErrorMsg(null);
                setPreviewUrl(null);
              }}
              className="font-sans text-xs font-semibold text-white/70 hover:text-white px-3 py-1.5 transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="font-sans bg-white !text-black px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              {t('addToGallery')}
            </button>
          </div>
        </form>
      )}

      {/* Lightbox Zoom Filmstrip Slider Modal */}
      {lightboxIndex !== null && currentLightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('lightboxLabel')}
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl animate-backdrop-blur flex flex-col items-center justify-between p-4 sm:p-8 cursor-zoom-out select-none"
        >
          {/* Header Bar */}
          <div
            className="w-full max-w-5xl flex items-center justify-between z-20 glass px-4 py-2.5 rounded-2xl cursor-default shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="eyebrow text-xs text-ink font-bold truncate">{title}</span>
              <span className="eyebrow text-[10px] px-2 py-0.5 rounded bg-white/15 text-white font-mono shrink-0">
                {t('frame', { index: lightboxIndex + 1 })} / {allPhotos.length}
              </span>
            </div>

            <button
              type="button"
              autoFocus
              onClick={() => setLightboxIndex(null)}
              aria-label={t('close')}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition-all hover:scale-105 cursor-pointer shrink-0"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>

          {/* Filmstrip Carousel Container */}
          <div className="relative w-full max-w-7xl max-h-[78dvh] flex items-center justify-center gap-3 sm:gap-6 my-auto px-2">
            {/* Left Preview Film Tile (Previous Photo) */}
            {allPhotos.length > 1 && (
              <button
                type="button"
                aria-label={t('prev')}
                title={t('prevTitle')}
                onClick={(e) => {
                  e.stopPropagation();
                  prevPhoto();
                }}
                className="hidden md:flex flex-col items-center justify-center shrink-0 w-32 lg:w-44 aspect-[4/3] rounded-2xl overflow-hidden bg-black/60 opacity-40 hover:opacity-85 scale-80 hover:scale-90 transition-all duration-300 ease-out cursor-pointer shadow-2xl group backdrop-blur-md relative"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary URL */}
                <img
                  src={allPhotos[(lightboxIndex - 1 + allPhotos.length) % allPhotos.length]}
                  alt="Previous Frame Preview"
                  className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center justify-start p-3">
                  <span className="text-white text-2xl font-bold drop-shadow-lg group-hover:-translate-x-0.5 transition-transform">
                    ‹
                  </span>
                </div>
                <span className="eyebrow absolute bottom-2 left-2 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-white/80">
                  #{(lightboxIndex - 1 + allPhotos.length) % allPhotos.length + 1}
                </span>
              </button>
            )}

            {/* Mobile Previous Button */}
            {allPhotos.length > 1 && (
              <button
                type="button"
                aria-label={t('prev')}
                onClick={(e) => {
                  e.stopPropagation();
                  prevPhoto();
                }}
                className="md:hidden absolute left-2 z-30 w-10 h-10 rounded-full glass-flat text-white flex items-center justify-center text-xl active:scale-95 transition-all shadow-xl cursor-pointer"
              >
                ‹
              </button>
            )}

            {/* Main Center Active High-Res Photo */}
            <div
              className="relative flex-1 max-w-4xl h-full flex flex-col items-center justify-center z-20 cursor-zoom-out"
              onClick={() => setLightboxIndex(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary URL */}
              <img
                key={currentLightboxSrc}
                src={currentLightboxSrc}
                alt={`${title} — Frame ${lightboxIndex + 1}`}
                className="max-w-full max-h-[72dvh] object-contain rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.95),0_0_40px_rgba(255,255,255,0.08)] animate-lightbox-zoom"
              />

              {/* Author Credit Badge Overlay in Lightbox */}
              {currentLightboxCredit?.authorName && (
                <div
                  className="mt-3 glass px-3.5 py-1.5 rounded-full text-xs font-mono flex items-center gap-2 shadow-lg cursor-default"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-community">📸 {t('photoBy')}</span>
                  {currentLightboxCredit.authorSocial ? (
                    <a
                      href={currentLightboxCredit.authorSocial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-community underline underline-offset-2 font-bold transition-colors flex items-center gap-1"
                    >
                      <span>{currentLightboxCredit.authorName}</span>
                      <span>↗</span>
                    </a>
                  ) : (
                    <span className="text-white font-bold">{currentLightboxCredit.authorName}</span>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Next Button */}
            {allPhotos.length > 1 && (
              <button
                type="button"
                aria-label={t('next')}
                onClick={(e) => {
                  e.stopPropagation();
                  nextPhoto();
                }}
                className="md:hidden absolute right-2 z-30 w-10 h-10 rounded-full glass-flat text-white flex items-center justify-center text-xl active:scale-95 transition-all shadow-xl cursor-pointer"
              >
                ›
              </button>
            )}

            {/* Right Preview Film Tile (Next Photo) */}
            {allPhotos.length > 1 && (
              <button
                type="button"
                aria-label={t('next')}
                title={t('nextTitle')}
                onClick={(e) => {
                  e.stopPropagation();
                  nextPhoto();
                }}
                className="hidden md:flex flex-col items-center justify-center shrink-0 w-32 lg:w-44 aspect-[4/3] rounded-2xl overflow-hidden bg-black/60 opacity-40 hover:opacity-85 scale-80 hover:scale-90 transition-all duration-300 ease-out cursor-pointer shadow-2xl group backdrop-blur-md relative"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary URL */}
                <img
                  src={allPhotos[(lightboxIndex + 1) % allPhotos.length]}
                  alt="Next Frame Preview"
                  className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-black/60 to-transparent flex items-center justify-end p-3">
                  <span className="text-white text-2xl font-bold drop-shadow-lg group-hover:translate-x-0.5 transition-transform">
                    ›
                  </span>
                </div>
                <span className="eyebrow absolute bottom-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-white/80">
                  #{(lightboxIndex + 1) % allPhotos.length + 1}
                </span>
              </button>
            )}
          </div>

          {/* Filmstrip Thumbnail Track & Navigation Bar */}
          <div
            className="w-full max-w-5xl flex items-center justify-between flex-wrap gap-3 z-20 glass px-4 py-2 rounded-2xl text-[11px] font-mono text-ink-muted cursor-default shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Filmstrip Thumbnails Row */}
            <div className="flex items-center gap-2 overflow-x-auto py-0.5 max-w-full scrollbar-none">
              {allPhotos.map((thumbSrc, idx) => (
                <button
                  key={thumbSrc}
                  type="button"
                  aria-label={t('goTo', { index: idx + 1 })}
                  onClick={() => setLightboxIndex(idx)}
                  className={`relative shrink-0 w-12 h-9 rounded-lg overflow-hidden transition-all duration-300 cursor-pointer ${
                    idx === lightboxIndex
                      ? 'scale-110 shadow-[0_0_12px_rgba(255,255,255,0.6)] ring-2 ring-white'
                      : 'opacity-40 hover:opacity-80 hover:scale-105'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary URL */}
                  <img
                    src={thumbSrc}
                    alt={`Thumb ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            <span className="text-ink-faint hidden lg:inline">
              {t('lightboxHint')}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
