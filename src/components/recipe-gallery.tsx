'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { OPEN_PROPOSAL_EVENT, OPEN_TWEAK_EVENT } from '@/lib/community/events';
import { isCommunityErrorCode } from '@/lib/community/errors';
import { useAuth } from '@/components/auth-context';
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

/*
 * The three offer icons.
 *
 * They used to be sRGB gradient illustrations — emerald, fuchsia and amber,
 * eleven hex literals between them, three of which were a competitor's
 * signature hue. They are now single-colour glyphs drawn in `currentColor`,
 * so each one takes the signal colour of the offer it belongs to
 * (`community` / `proposal` / `ai`) and cannot drift a shade from it. Depth
 * comes from opacity, and the cut-outs are the ground colour.
 */

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden focusable="false">
      {/* Viewfinder bump */}
      <path
        d="M17 12C17 9.79086 18.7909 8 21 8H27C29.2091 8 31 9.79086 31 12V14H17V12Z"
        fill="currentColor"
        opacity="0.55"
      />
      {/* Body */}
      <rect x="6" y="12" width="36" height="26" rx="7" fill="currentColor" opacity="0.9" />
      {/* Shutter lamp */}
      <circle cx="35" cy="19" r="2" fill="var(--color-void)" opacity="0.7" />
      {/* Lens barrel, then the element inside it */}
      <circle cx="24" cy="25" r="9.5" fill="var(--color-void)" opacity="0.65" />
      <circle cx="24" cy="25" r="5.5" fill="currentColor" />
    </svg>
  );
}

function VoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden focusable="false">
      {/* Ballot paper */}
      <path
        d="M17 9C17 7.34315 18.3431 6 20 6H28C29.6569 6 31 7.34315 31 9V20H17V9Z"
        fill="currentColor"
        opacity="0.4"
      />
      {/* The vote itself */}
      <path
        d="M24 17.4c-3.5-2.5-5.3-4.2-5.3-6.1a2.85 2.85 0 0 1 5.3-1.5 2.85 2.85 0 0 1 5.3 1.5c0 1.9-1.8 3.6-5.3 6.1Z"
        fill="currentColor"
      />
      {/* Box, lid rim, slot */}
      <rect x="6" y="21" width="36" height="19" rx="6" fill="currentColor" opacity="0.9" />
      <rect x="4" y="17" width="40" height="7" rx="3.5" fill="currentColor" opacity="0.55" />
      <rect x="16" y="19" width="16" height="3" rx="1.5" fill="var(--color-void)" opacity="0.85" />
    </svg>
  );
}

function AiSparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden focusable="false">
      <path
        d="M22 5C22 14.5 14.5 22 5 22C14.5 22 22 29.5 22 39C22 29.5 29.5 22 39 22C29.5 22 22 14.5 22 5Z"
        fill="currentColor"
      />
      <path
        d="M35 3C35 7.5 38.5 11 43 11C38.5 11 35 14.5 35 19C35 14.5 31.5 11 27 11C31.5 11 35 7.5 35 3Z"
        fill="currentColor"
        opacity="0.6"
      />
      <circle cx="9" cy="37" r="2" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

/** Signal colour per offer — the whole reason these three read as different. */
const OFFER_TINT = {
  community: 'text-community',
  proposal: 'text-proposal',
  ai: 'text-ai',
} as const;

/**
 * One of the three offers under the collage.
 *
 * A translucent tile with the glyph in its signal colour. It is deliberately NOT the
 * launcher's squircle-and-spectrum treatment: that glow is the ecosystem's one
 * sanctioned exception, and a second row of tiles wearing it would make it
 * decoration. `.app-tile-shell`, `.app-tile` and `.accent-glow` went with it —
 * those classes no longer exist and were rendering as nothing.
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
  icon: React.ReactNode;
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
      className="group flex flex-col items-center gap-3 cursor-pointer shrink-0"
    >
      <span
        className={`surface flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 transition-transform duration-200 ease-out group-hover:-translate-y-1 ${OFFER_TINT[accent]}`}
      >
        {icon}
      </span>

      <span className="text-body-sm sm:text-body font-semibold text-ink text-center whitespace-nowrap">
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
  const { user, openLoginModal, accessToken } = useAuth();
  /* Deliberately the whole `community` namespace, not `community.errors`:
     messages.test.ts asserts the layout ships `<ns>: messages.<ns>` for every
     namespace a client asks for, and a dotted one has no such entry to ship. */
  const tCommunity = useTranslations('community');

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
    /* The route 401s without a session, and the photo is saved to the device
       before the request goes out — submitting while signed out would leave it
       looking shared when nothing was. Ask for sign-in first. */
    if (!user) {
      openLoginModal();
      return;
    }
    const cleanUrl = inputUrl.trim();
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

    // Save credit & photo locally, under the same name the server will store,
    // so the credit does not change when the page is reloaded from Supabase.
    setLocalPhotos(slug, [...new Set([cleanUrl, ...localPhotos])]);
    setLocalCredit(slug, {
      url: cleanUrl,
      authorName: user.name,
      authorSocial: cleanSocial || undefined,
    });

    setInputUrl('');
    setAuthorSocial('');
    setPreviewUrl(null);
    setIsFormOpen(false);

    try {
      const token = accessToken();
      const res = await fetch('/api/community-photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          slug,
          imageUrl: cleanUrl,
          authorSocial: cleanSocial || undefined,
        }),
      });
      if (!res.ok) {
        /* The body carries a code, never a sentence. Rendering `data.error`
           directly is what put a Vietnamese string in front of English readers
           on every rate-limited share. Anything unrecognised falls back rather
           than reaching the screen raw. */
        const data = await res.json().catch(() => null);
        const code = isCommunityErrorCode(data?.error) ? data.error : 'unknown';
        setErrorMsg(tCommunity(`errors.${code}`));
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
                  className={`group relative block w-full overflow-hidden rounded-lg cursor-zoom-in shadow-[var(--elevation-1)] transition-transform duration-300 ${
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

                  <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-transparent to-void/40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 sm:p-4">
                    <span className="self-start text-label font-semibold uppercase tracking-[0.08em] px-2.5 py-1 rounded-sm bg-void/70 text-ink backdrop-blur-[30px]">
                      {isHeroTile
                        ? t('featuredShot')
                        : isUserPhoto
                          ? t('tagCommunity')
                          : t('frame', { index: i + 1 })}
                    </span>

                    <div className="flex items-end justify-between text-meta text-ink">
                      <div>
                        <span className="block truncate max-w-[80%] font-semibold">{title}</span>
                        {credit?.authorName && (
                          <span className="block mt-0.5 text-community">
                            {t('photoBy')} {credit.authorName}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold underline underline-offset-2 shrink-0">
                        {t('zoom')} ↗
                      </span>
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
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-11 h-11 rounded-md bg-danger/85 hover:bg-danger text-white flex items-center justify-center text-body transition-opacity backdrop-blur-[30px] shadow-[var(--elevation-1)] opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
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
        <div className="surface p-8 text-center flex flex-col items-center justify-center gap-3 mb-6">
          <p className="text-body text-ink-muted max-w-md">
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
      <div className="flex items-start justify-center gap-6 sm:gap-12 md:gap-16 mt-14 sm:mt-16 mb-0 flex-wrap">
        <ActionTile
          accent="community"
          icon={<CameraIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />}
          label={t('contributePhoto')}
          /* This tile toggles, so the tooltip says what the next press does. */
          description={isFormOpen ? t('cancel') : t('contributePhotoDesc')}
          expanded={isFormOpen}
          onClick={handleContributePhotoClick}
        />

        <ActionTile
          accent="proposal"
          icon={<VoteIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />}
          label={t('proposeVersion')}
          description={t('proposeVersionDesc')}
          onClick={handleProposeVersionClick}
        />

        <ActionTile
          accent="ai"
          icon={<AiSparkleIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />}
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
          className="surface p-5 sm:p-6 mt-6 mb-0 animate-fade-in flex flex-col gap-4"
        >
          <h4 className="text-body-lg font-semibold text-ink">{t('formTitle')}</h4>

          {/* 1. Image URL (Required) */}
          <div>
            <label
              htmlFor="photo-url-input"
              className="block mb-1.5 text-body-sm font-semibold text-ink-muted"
            >
              {t('urlLabel')} <span className="text-danger">*</span>
            </label>
            <input
              id="photo-url-input"
              type="url"
              value={inputUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={t('urlPlaceholder')}
              className="surface-sunken w-full px-4 py-2.5 min-h-[var(--layout-touch-target)] text-body text-ink placeholder:text-ink-faint"
              required
            />
          </div>

          {/* 2. Credit — the name is the signed-in account, not a free-text
              field, so a photo cannot be credited to someone who did not post
              it. Only the social link is the contributor's to fill in. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block mb-1.5 text-body-sm font-semibold text-ink-muted">
                {t('authorLabel')}
              </span>
              <p className="surface-sunken w-full px-4 py-2.5 min-h-[var(--layout-touch-target)] flex items-center text-body text-ink-muted">
                {user?.name ?? ''}
              </p>
            </div>

            <div>
              <label
                htmlFor="author-social-input"
                className="block mb-1.5 text-body-sm font-semibold text-ink-muted"
              >
                {t('socialLabel')}
              </label>
              <input
                id="author-social-input"
                type="url"
                value={authorSocial}
                onChange={(e) => setAuthorSocial(e.target.value)}
                placeholder="https://instagram.com/username"
                className="surface-sunken w-full px-4 py-2.5 min-h-[var(--layout-touch-target)] text-body text-ink placeholder:text-ink-faint"
              />
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-body-sm text-danger mt-1">
              {errorMsg}
            </p>
          )}

          {/* Live Preview Card */}
          {previewUrl && (
            <div className="flex flex-col gap-1.5">
              <span className="text-body-sm text-ink-muted">{t('previewLabel')}</span>
              <div className="relative w-full aspect-[16/9] max-h-48 overflow-hidden rounded-md bg-void/60 shadow-[var(--elevation-1)]">
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
              className="min-h-[var(--layout-touch-target)] px-3 text-body font-semibold text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button type="submit" className="btn-accent cursor-pointer">
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
          className="fixed inset-0 z-50 bg-void/85 backdrop-blur-[30px] animate-fade-in flex flex-col items-center justify-between p-4 sm:p-8 cursor-zoom-out select-none"
        >
          {/* Header Bar */}
          <div
            className="surface w-full max-w-5xl flex items-center justify-between z-20 px-4 py-2.5 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-body font-semibold text-ink truncate">{title}</span>
              <span className="text-label font-medium px-2.5 py-1 rounded-sm bg-white/8 text-ink shrink-0 shadow-[var(--elevation-spec)]">
                {t('frame', { index: lightboxIndex + 1 })} / {allPhotos.length}
              </span>
            </div>

            <button
              type="button"
              autoFocus
              onClick={() => setLightboxIndex(null)}
              aria-label={t('close')}
              className="btn-glass w-11 h-11 flex items-center justify-center shrink-0 cursor-pointer"
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
                className="hidden md:flex flex-col items-center justify-center shrink-0 w-32 lg:w-44 aspect-[4/3] rounded-lg overflow-hidden bg-void/60 opacity-40 hover:opacity-85 scale-80 hover:scale-90 transition-all duration-300 ease-out cursor-pointer shadow-[var(--elevation-2)] group backdrop-blur-[30px] relative"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary URL */}
                <img
                  src={allPhotos[(lightboxIndex - 1 + allPhotos.length) % allPhotos.length]}
                  alt="Previous Frame Preview"
                  className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-void/70 to-transparent flex items-center justify-start p-3">
                  <span className="text-ink text-title-2 font-semibold group-hover:-translate-x-0.5 transition-transform">
                    ‹
                  </span>
                </div>
                <span className="absolute bottom-2 left-2 text-meta px-2 py-0.5 rounded-sm bg-void/70 text-ink">
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
                className="btn-glass md:hidden absolute left-2 z-30 w-11 h-11 flex items-center justify-center text-title-3 active:scale-95 cursor-pointer"
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
                className="max-w-full max-h-[72dvh] object-contain rounded-lg shadow-[var(--elevation-3)]"
              />

              {/* Author Credit Badge Overlay in Lightbox */}
              {currentLightboxCredit?.authorName && (
                <div
                  className="surface mt-3 px-4 py-2 text-body-sm flex items-center gap-2 cursor-default"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-community">{t('photoBy')}</span>
                  {currentLightboxCredit.authorSocial ? (
                    <a
                      href={currentLightboxCredit.authorSocial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink hover:text-community underline underline-offset-2 font-semibold transition-colors flex items-center gap-1"
                    >
                      <span>{currentLightboxCredit.authorName}</span>
                      <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <span className="text-ink font-semibold">{currentLightboxCredit.authorName}</span>
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
                className="btn-glass md:hidden absolute right-2 z-30 w-11 h-11 flex items-center justify-center text-title-3 active:scale-95 cursor-pointer"
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
                className="hidden md:flex flex-col items-center justify-center shrink-0 w-32 lg:w-44 aspect-[4/3] rounded-lg overflow-hidden bg-void/60 opacity-40 hover:opacity-85 scale-80 hover:scale-90 transition-all duration-300 ease-out cursor-pointer shadow-[var(--elevation-2)] group backdrop-blur-[30px] relative"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary URL */}
                <img
                  src={allPhotos[(lightboxIndex + 1) % allPhotos.length]}
                  alt="Next Frame Preview"
                  className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-void/70 to-transparent flex items-center justify-end p-3">
                  <span className="text-ink text-title-2 font-semibold group-hover:translate-x-0.5 transition-transform">
                    ›
                  </span>
                </div>
                <span className="absolute bottom-2 right-2 text-meta px-2 py-0.5 rounded-sm bg-void/70 text-ink">
                  #{(lightboxIndex + 1) % allPhotos.length + 1}
                </span>
              </button>
            )}
          </div>

          {/* Filmstrip Thumbnail Track & Navigation Bar */}
          <div
            className="surface w-full max-w-5xl flex items-center justify-between flex-wrap gap-3 z-20 px-4 py-2 text-meta text-ink-muted cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Filmstrip Thumbnails Row.

                A rail that must never advertise its overflow — the indicator is
                hidden, the scrolling is not. */}
            <div className="scroll-silent flex items-center gap-2 overflow-x-auto py-0.5 max-w-full">
              {allPhotos.map((thumbSrc, idx) => (
                <button
                  key={thumbSrc}
                  type="button"
                  aria-label={t('goTo', { index: idx + 1 })}
                  aria-current={idx === lightboxIndex ? 'true' : undefined}
                  onClick={() => setLightboxIndex(idx)}
                  /* The current frame is a fill and a lift, never a ring. */
                  className={`relative shrink-0 w-12 h-9 rounded-sm overflow-hidden transition-all duration-300 cursor-pointer ${
                    idx === lightboxIndex
                      ? 'scale-110 shadow-[var(--elevation-2)]'
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
