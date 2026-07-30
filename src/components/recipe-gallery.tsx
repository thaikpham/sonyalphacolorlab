'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import {
  getLocalCredits,
  getLocalPhotos,
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
 * Photographic collage gallery with community contributions, author credits, and full-screen slider lightbox.
 */
export function RecipeGallery({ slug, images, title }: RecipeGalleryProps) {
  const localPhotos = useSyncExternalStore(
    subscribeLocalPhotos,
    useCallback(() => getLocalPhotos(slug), [slug]),
    getServerPhotos,
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
      setErrorMsg('Vui lòng nhập đường dẫn URL ảnh hợp lệ.');
      return;
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMsg('URL ảnh phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    if (cleanSocial && !cleanSocial.startsWith('http://') && !cleanSocial.startsWith('https://')) {
      setErrorMsg('Link trang cá nhân phải bắt đầu bằng http:// hoặc https://');
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
        setErrorMsg(
          data?.error ?? 'Ảnh đã lưu trên máy bạn nhưng chưa chia sẻ được với cộng đồng.',
        );
      }
    } catch {
      setErrorMsg('Ảnh đã lưu trên máy bạn nhưng chưa chia sẻ được với cộng đồng.');
    }
  };

  const handleDeleteUserPhoto = (photoToDelete: string) => {
    setLocalPhotos(
      slug,
      localPhotos.filter((p) => p !== photoToDelete),
    );
  };

  const localCredits = getLocalCredits(slug);
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
                className={`relative ${
                  isHeroTile ? 'sm:col-span-2 lg:col-span-2 sm:row-span-2' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  aria-label={`Phóng to ảnh ${i + 1} của ${title}`}
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
                      {isHeroTile ? 'FEATURED SHOT' : isUserPhoto ? 'COMMUNITY' : `FRAME #${i + 1}`}
                    </span>

                    <div className="flex items-end justify-between text-xs text-white/90">
                      <div>
                        <span className="font-mono text-[11px] block truncate max-w-[80%]">{title}</span>
                        {credit?.authorName && (
                          <span className="eyebrow text-[10px] text-emerald-300 block mt-0.5">
                            📸 Photo by: {credit.authorName}
                          </span>
                        )}
                      </div>
                      <span className="font-bold underline text-[11px] shrink-0">Phóng to ↗</span>
                    </div>
                  </div>
                </button>

                {isLocalPhoto && (
                  <button
                    type="button"
                    title="Xóa ảnh đóng góp"
                    aria-label={`Xóa ảnh đóng góp ${i + 1}`}
                    onClick={() => handleDeleteUserPhoto(src)}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center text-xs transition-opacity backdrop-blur-md shadow-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
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
            Chưa có ảnh mẫu cho công thức này. Hãy nhấp nút{' '}
            <strong className="text-ink">Đóng góp ảnh</strong> bên dưới để tải lên tấm ảnh đầu tiên
            từ máy ảnh Sony Alpha của bạn!
          </p>
        </div>
      )}

      {/* Header & Contribution Button (positioned below photos) */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="eyebrow text-xs tracking-widest uppercase flex items-center gap-2">
            <span>📸</span>
            <span>COLLAGE GALLERY &amp; COMMUNITY PHOTOS</span>
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            {allPhotos.length} ảnh mẫu · Đóng góp ảnh chụp từ máy Sony Alpha của bạn
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          aria-expanded={isFormOpen}
          className={`eyebrow px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-lg relative overflow-hidden group ${
            isFormOpen
              ? 'glass-flat text-ink-muted hover:text-white hover:border-white/40'
              : 'bg-void/90 text-white border border-[oklch(85%_0.3_140_/_0.6)] shadow-[0_0_20px_oklch(85%_0.3_140_/_0.3)] hover:shadow-[0_0_30px_oklch(85%_0.3_140_/_0.6)] hover:border-[oklch(85%_0.3_140)] animate-float-gentle hover:scale-105 active:scale-95'
          }`}
        >
          <span className="text-sm shrink-0">📷</span>
          <span className="tracking-wider text-white font-bold">
            {isFormOpen ? 'Hủy' : 'Đóng góp ảnh'}
          </span>
        </button>
      </div>

      {/* User Image Contribution Form with Author Credit & Social Link Inputs */}
      {isFormOpen && (
        <form
          onSubmit={handleAddPhoto}
          className="glass p-5 sm:p-6 rounded-2xl mb-6 animate-fade-in flex flex-col gap-4 shadow-2xl"
        >
          <h4 className="font-sans text-white font-bold text-sm tracking-wide flex items-center gap-2">
            <span>📷</span>
            <span>Đóng góp ảnh mẫu mới</span>
          </h4>

          {/* 1. Image URL (Required) */}
          <div>
            <label htmlFor="photo-url-input" className="block mb-1.5 text-white/90 text-xs font-semibold font-sans">
              URL ảnh mẫu (Direct Image URL) <span className="text-red-400">*</span>
            </label>
            <input
              id="photo-url-input"
              type="url"
              value={inputUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://images.unsplash.com/photo-... hoặc https://..."
              className="w-full px-4 py-2.5 rounded-xl bg-black/70 border-0 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 font-sans transition-all shadow-inner"
              required
            />
          </div>

          {/* 2. Contributor Name & Social Network Link (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="author-name-input" className="block mb-1.5 text-white/80 text-xs font-semibold font-sans">
                Tên nhiếp ảnh gia / Author Credit (Không bắt buộc)
              </label>
              <input
                id="author-name-input"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn A / Alex Pham"
                className="w-full px-4 py-2.5 rounded-xl bg-black/70 border-0 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 font-sans transition-all shadow-inner"
              />
            </div>

            <div>
              <label htmlFor="author-social-input" className="block mb-1.5 text-white/80 text-xs font-semibold font-sans">
                Link Social Network (Instagram, FB...) (Không bắt buộc)
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
            <p role="alert" className="text-xs text-red-400 mt-1">
              {errorMsg}
            </p>
          )}

          {/* Live Preview Card */}
          {previewUrl && (
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-xs text-white/70">Xem trước ảnh (Live Preview):</span>
              <div className="relative w-full aspect-[16/9] max-h-48 overflow-hidden rounded-xl bg-black/60 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user URL */}
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() =>
                    setErrorMsg('Không thể tải ảnh từ URL này. Vui lòng kiểm tra lại đường dẫn.')
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
              Hủy
            </button>
            <button
              type="submit"
              className="font-sans bg-white !text-black px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Thêm vào bộ sưu tập
            </button>
          </div>
        </form>
      )}

      {/* Lightbox Zoom Filmstrip Slider Modal */}
      {lightboxIndex !== null && currentLightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ảnh phóng to"
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
                FRAME #{lightboxIndex + 1} / {allPhotos.length}
              </span>
            </div>

            <button
              type="button"
              autoFocus
              onClick={() => setLightboxIndex(null)}
              aria-label="Đóng"
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
                aria-label="Ảnh trước"
                title="Ảnh trước (Phím ←)"
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
                aria-label="Ảnh trước"
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
                  <span className="text-emerald-400">📸 Photo by:</span>
                  {currentLightboxCredit.authorSocial ? (
                    <a
                      href={currentLightboxCredit.authorSocial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-emerald-300 underline underline-offset-2 font-bold transition-colors flex items-center gap-1"
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
                aria-label="Ảnh tiếp theo"
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
                aria-label="Ảnh tiếp theo"
                title="Ảnh tiếp theo (Phím →)"
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
                  aria-label={`Chuyển đến ảnh ${idx + 1}`}
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
              Phím ← → hoặc nhấp ảnh 2 bên để lướt · Nhấn ESC hoặc nhấp bên ngoài để thoát
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
