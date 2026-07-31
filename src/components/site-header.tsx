'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LanguageToggle } from './language-toggle';
import { Link, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { CREATIVE_LOOKS } from '@/lib/camera/constants';

export interface TagItem {
  tag: string;
  count: number;
}

interface SiteHeaderProps {
  tags?: TagItem[];
}

const FALLBACK_TAGS: TagItem[] = [
  { tag: 'atmospheric', count: 0 },
  { tag: 'high-contrast', count: 0 },
  { tag: 'stylized', count: 0 },
  { tag: 'versatile', count: 0 },
  { tag: 'clean', count: 0 },
  { tag: 'neutral', count: 0 },
  { tag: 'portrait', count: 0 },
  { tag: 'surreal', count: 0 },
  { tag: 'artistic', count: 0 },
  { tag: 'high-saturation', count: 0 },
  { tag: 'bold', count: 0 },
];

/**
 * Multi-functional sticky header navigation for Alpha ColorLab.
 *
 * Features:
 * - Wordmark with Sony Alpha 'α' glyph standing in for the "A".
 * - Expandable console integrating recipe keyword search, format filters (PP/CL),
 *   Creative Look sub-filters, and Tag filters with smooth glass animations.
 * - Auto-hides on scroll down, reappears on scroll up (locked open when search is focused).
 * - Keyboard shortcuts (⌘K / / to expand, ESC to close).
 */
function SiteHeaderInner({ tags: providedTags }: SiteHeaderProps) {
  const t = useTranslations('search');
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();

  const currentQ = searchParams?.get('q') ?? '';
  const currentFormat = searchParams?.get('format') ?? '';
  const currentLook = searchParams?.get('look') ?? '';
  const currentTag = searchParams?.get('tag') ?? '';

  const tagList = providedTags && providedTags.length > 0 ? providedTags : FALLBACK_TAGS;
  const hasActiveFilters = Boolean(currentQ || currentFormat || currentLook || currentTag);

  const [isHidden, setIsHidden] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(hasActiveFilters);
  const [isEcosystemOpen, setIsEcosystemOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState(currentQ);
  const inputRef = useRef<HTMLInputElement>(null);
  const ecosystemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Keep the input in step with the URL.
   *
   * Adjusted during render rather than in an effect: React re-runs this
   * component immediately without committing the first result, so there is no
   * flash of the stale query and no cascading re-render. Doing it in an effect
   * is what `react-hooks/set-state-in-effect` flags, and it would paint the old
   * value for one frame after every navigation.
   * https://react.dev/learn/you-might-not-need-an-effect
   */
  const [syncedQ, setSyncedQ] = useState(currentQ);
  if (syncedQ !== currentQ) {
    setSyncedQ(currentQ);
    setQuery(currentQ);
    if (hasActiveFilters) setIsSearchOpen(true);
  }

  // Handle scroll auto-hide behavior
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      if (currentScrollY < 0 || currentScrollY > maxScroll) return;

      if (currentScrollY <= 20) {
        setIsHidden(false);
        lastScrollY = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastScrollY;
      if (Math.abs(diff) > 6) {
        if (diff > 0 && currentScrollY > 60) {
          if (!isSearchOpen) {
            setIsHidden(true);
          }
        } else if (diff < 0) {
          setIsHidden(false);
        }
        lastScrollY = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isSearchOpen]);

  // Focus input when search expands
  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  // Global shortcut keys (⌘K / Ctrl+K / / to open search, Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTargetEditable =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === '/' && !isTargetEditable) {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          inputRef.current?.blur();
        }
        if (isEcosystemOpen) {
          setIsEcosystemOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, isEcosystemOpen]);

  const updateFilters = useCallback(
    (patch: { q?: string; format?: string; look?: string; tag?: string }) => {
      const next: Record<string, string> = {};

      const newQ = patch.q !== undefined ? patch.q : currentQ;
      const newFormat = patch.format !== undefined ? patch.format : currentFormat;
      const newLook = patch.look !== undefined ? patch.look : currentLook;
      const newTag = patch.tag !== undefined ? patch.tag : currentTag;

      if (newQ.trim()) next.q = newQ.trim();
      if (newFormat) next.format = newFormat;
      if (newLook && newFormat === 'cl') next.look = newLook;
      if (newTag) next.tag = newTag;

      // Filtering always lands on the grid, whatever page we came from.
      const qs = new URLSearchParams(next).toString();
      router.push(qs ? `/?${qs}` : '/', { scroll: false });
    },
    [currentQ, currentFormat, currentLook, currentTag, router],
  );

  /**
   * Live search, debounced.
   *
   * Navigating straight from `onChange` pushed a route per keystroke, and each
   * push refetches the RSC payload for the whole grid — "portrait" cost eight
   * round trips and raced its own results. One push once typing settles.
   */
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSearch = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateFilters({ q: value }), 250);
  };
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    updateFilters({ q: query });
  };

  const handleClearQuery = () => {
    setQuery('');
    updateFilters({ q: '' });
    inputRef.current?.focus();
  };

  const handleResetAll = () => {
    setQuery('');
    router.push('/', { scroll: false });
  };

  return (
    <>
      <header
      className={`sticky top-0 z-40 transition-transform duration-300 ease-in-out focus-within:translate-y-0 ${
        isHidden && !isSearchOpen ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="mx-auto max-w-[160rem] inset-safe pt-safe">
        <div
          className={`glass transition-all duration-300 ease-out px-3 py-2 sm:px-5 sm:py-2.5 flex flex-col gap-2.5 ${
            isSearchOpen ? 'shadow-[0_12px_40px_rgba(0,0,0,0.6)]' : ''
          }`}
        >
          {/* Main Top Header Line */}
          <div className="flex items-center justify-between gap-2.5 sm:gap-4">
            {/* Custom Brand Logo & 4-Square Ecosystem Launcher */}
            <div className="relative flex items-center gap-3 sm:gap-4 shrink-0" ref={ecosystemRef}>
              <Link
                href="/"
                className="group flex items-center transition-transform duration-300 hover:scale-105 active:scale-95"
              >
                <Image
                  src="/logo.png"
                  alt="Alpha ColorLab Logo"
                  width={1780}
                  height={499}
                  priority
                  className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto object-contain transition-all duration-300"
                />
              </Link>

              {/* 4-Square Grid Expand Button (Bigger Rounded Square) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsEcosystemOpen((prev) => !prev);
                }}
                aria-expanded={isEcosystemOpen}
                aria-label="Hệ sinh thái Sony Alpha"
                title="Hệ sinh thái Sony Alpha"
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl transition-all duration-300 cursor-pointer border flex items-center justify-center shrink-0 group ${
                  isEcosystemOpen
                    ? 'bg-white/20 text-white border-white/35 shadow-[0_0_20px_rgba(255,255,255,0.25)] scale-105'
                    : 'glass-flat text-white/80 hover:text-white hover:bg-white/20 border-white/15 hover:border-white/30'
                }`}
              >
                {/* 4-Square Grid SVG Icon (2x2 squares) */}
                <svg
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 ${
                    isEcosystemOpen ? 'rotate-90 text-white' : 'group-hover:scale-110'
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </button>
            </div>

            {/* Center: Search Trigger or Expanded Live Search Form */}
            <div className="flex-1 max-w-xl mx-auto transition-all duration-300">
              {!isSearchOpen ? (
                /* Compact Trigger Button */
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  aria-expanded="false"
                  aria-label={t('label')}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 rounded-full bg-black/50 text-white/90 hover:text-white text-xs sm:text-sm transition-all duration-300 group cursor-pointer shadow-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    <svg
                      aria-hidden="true"
                      className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span className="truncate">
                      {query ? (
                        <strong className="text-white">&quot;{query}&quot;</strong>
                      ) : (
                        t('placeholder')
                      )}
                    </span>

                    {/* Active Filter Badges in Compact Bar */}
                    {currentFormat && (
                      <span className="eyebrow text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">
                        {currentFormat === 'pp'
                          ? 'PP'
                          : currentLook
                          ? `CL:${currentLook}`
                          : 'CL'}
                      </span>
                    )}
                    {currentTag && (
                      <span className="eyebrow text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold truncate max-w-[5rem]">
                        #{currentTag}
                      </span>
                    )}
                  </span>

                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/15 text-white/80 group-hover:text-white transition-colors">
                    <kbd>⌘</kbd>
                    <kbd>K</kbd>
                  </span>
                </button>
              ) : (
                /* Expanded Search Input Form */
                /* A real GET form, not just an onSubmit handler: search has to
                   work before hydration and with JS off. `action` must carry the
                   locale prefix — a hardcoded "/" drops a Vietnamese reader who
                   arrived on a shared /vi link (so has no cookie yet) into the
                   English site. Active filters ride along as hidden inputs or
                   searching silently clears them. */
                <form
                  role="search"
                  action={locale === routing.defaultLocale ? '/' : `/${locale}`}
                  method="get"
                  onSubmit={handleSubmit}
                  className="relative flex items-center w-full animate-fade-in"
                >
                  {Object.entries({
                    format: currentFormat,
                    look: currentFormat === 'cl' ? currentLook : '',
                    tag: currentTag,
                  }).map(([key, value]) =>
                    value ? <input key={key} type="hidden" name={key} value={value} /> : null,
                  )}
                  <label htmlFor="header-search-input" className="sr-only">
                    {t('label')}
                  </label>

                  <div className="relative flex items-center w-full">
                    <svg
                      aria-hidden="true"
                      className="absolute left-3.5 w-4 h-4 text-white/70 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>

                    <input
                      id="header-search-input"
                      ref={inputRef}
                      type="search"
                      name="q"
                      value={query}
                      onChange={(e) => queueSearch(e.target.value)}
                      placeholder={t('placeholder')}
                      autoComplete="off"
                      className="w-full pl-9 pr-16 py-1.5 text-xs sm:text-sm rounded-full bg-black/70 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 transition-all shadow-md"
                    />

                    {query && (
                      <button
                        type="button"
                        onClick={handleClearQuery}
                        title={t('clear')}
                        aria-label={t('clear')}
                        className="absolute right-9 p-1 rounded-full text-white/70 hover:text-white transition-colors cursor-pointer"
                      >
                        <span aria-hidden className="text-xs">
                          ✕
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(false)}
                      title={t('close')}
                      aria-label={t('close')}
                      className="absolute right-2 p-1 text-xs text-white/70 hover:text-white transition-colors rounded-full cursor-pointer"
                    >
                      <span aria-hidden>✕</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-label={isSearchOpen ? t('close') : t('label')}
                className="sm:hidden p-1.5 rounded-full glass-flat text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <svg
                  aria-hidden="true"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>

              <LanguageToggle />
            </div>
          </div>

          {/* Expanded Glass Console for Filters & Tags (Smooth Height Transition) */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              isSearchOpen
                ? 'grid-rows-[1fr] opacity-100 pt-2 border-t border-white/10'
                : 'grid-rows-[0fr] opacity-0 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden flex flex-col gap-2 text-xs">
              {/* Row 1: Format Filters */}
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="eyebrow text-[11px] text-white/80 uppercase mr-1 w-14 shrink-0 font-bold">
                  Format
                </span>

                <button
                  type="button"
                  onClick={() => updateFilters({ format: '', look: '' })}
                  aria-current={!currentFormat ? 'true' : undefined}
                  className={`eyebrow rounded-full px-3 py-1 text-xs transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                    !currentFormat
                      ? '!text-black bg-white font-bold scale-105 shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
                      : 'glass-flat !text-white/80 hover:!text-white hover:bg-white/20 font-semibold'
                  }`}
                >
                  All
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateFilters({ format: currentFormat === 'pp' ? '' : 'pp', look: '' })
                  }
                  aria-current={currentFormat === 'pp' ? 'true' : undefined}
                  className={`eyebrow rounded-full px-3 py-1 text-xs transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                    currentFormat === 'pp'
                      ? '!text-black bg-white font-bold scale-105 shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
                      : 'glass-flat !text-white/80 hover:!text-white hover:bg-white/20 font-semibold'
                  }`}
                >
                  Picture Profile
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateFilters({ format: currentFormat === 'cl' ? '' : 'cl' })
                  }
                  aria-current={currentFormat === 'cl' ? 'true' : undefined}
                  className={`eyebrow rounded-full px-3 py-1 text-xs transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                    currentFormat === 'cl'
                      ? '!text-black bg-white font-bold scale-105 shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
                      : 'glass-flat !text-white/80 hover:!text-white hover:bg-white/20 font-semibold'
                  }`}
                >
                  Creative Look
                </button>
              </div>

              {/* Row 2: Creative Look Sub-Filters (only visible when format=cl) */}
              {currentFormat === 'cl' && (
                <div className="flex items-center flex-wrap gap-1.5 transition-all duration-300">
                  <span className="eyebrow text-[11px] text-white/80 uppercase mr-1 w-14 shrink-0 font-bold">
                    Look
                  </span>

                  <button
                    type="button"
                    onClick={() => updateFilters({ look: '' })}
                    aria-current={!currentLook ? 'true' : undefined}
                    className={`eyebrow rounded-full px-2.5 py-0.5 text-[11px] transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                      !currentLook
                        ? '!text-black bg-white font-bold scale-105 shadow-[0_4px_14px_rgba(0,0,0,0.3)]'
                        : 'glass-flat !text-white/80 hover:!text-white hover:bg-white/20 font-semibold'
                    }`}
                  >
                    All
                  </button>

                  {CREATIVE_LOOKS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() =>
                        updateFilters({ look: currentLook === l.code ? '' : l.code })
                      }
                      aria-current={currentLook === l.code ? 'true' : undefined}
                      className={`eyebrow rounded-full px-2.5 py-0.5 text-[11px] transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                        currentLook === l.code
                          ? '!text-black bg-white font-bold scale-105 shadow-[0_4px_14px_rgba(0,0,0,0.3)]'
                          : 'glass-flat !text-white/80 hover:!text-white hover:bg-white/20 font-semibold'
                      }`}
                    >
                      {l.code}
                    </button>
                  ))}
                </div>
              )}

              {/* Row 3: Tag Chips Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
                <span className="eyebrow text-[11px] text-white/80 uppercase mr-1 w-14 shrink-0 font-bold">
                  Tags
                </span>

                <button
                  type="button"
                  onClick={() => updateFilters({ tag: '' })}
                  aria-current={!currentTag ? 'true' : undefined}
                  className={`eyebrow shrink-0 rounded-full px-3 py-1 text-xs transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                    !currentTag
                      ? '!text-black bg-white font-bold scale-105 shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
                      : 'glass-flat !text-white/80 hover:!text-white hover:bg-white/20 font-semibold'
                  }`}
                >
                  All
                </button>

                {tagList.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() =>
                      updateFilters({ tag: currentTag === item.tag ? '' : item.tag })
                    }
                    aria-current={currentTag === item.tag ? 'true' : undefined}
                    className={`eyebrow shrink-0 rounded-full px-3 py-1 text-xs transition-all duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 active:scale-95 cursor-pointer ${
                      currentTag === item.tag
                        ? '!text-black bg-white font-bold scale-105 shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
                        : 'glass-flat !text-white/80 hover:!text-white hover:bg-white/20 font-semibold'
                    }`}
                  >
                    {item.tag}
                  </button>
                ))}
              </div>

              {/* Footer row: Clear all filters & Shortcut hint */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] text-ink-faint">
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="eyebrow text-[10px] text-red-400 hover:text-red-300 transition-colors cursor-pointer underline underline-offset-2"
                  >
                    Clear all filters
                  </button>
                  <span className="font-mono hidden sm:inline">Press ESC to close</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>

    {/* Full-Screen Backdrop Blur & Ultra-Minimal iPad Launchpad */}
    {isEcosystemOpen && mounted && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 z-[99990] flex flex-col items-center justify-center p-4 sm:p-8">
        {/* Full Screen Backdrop Blur Overlay */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-opacity duration-300 cursor-pointer"
          onClick={() => setIsEcosystemOpen(false)}
        />

        {/* iPad App Launchpad (Floating Apps without boxes) */}
        <div className="relative z-[99999] w-full max-w-5xl flex flex-col sm:grid sm:grid-cols-3 gap-8 sm:gap-12 md:gap-16 justify-items-center items-center max-h-[85vh] overflow-y-auto px-4 py-6 scrollbar-none">
          {/* App 1: ColorLab 2.0 (Current App) */}
          <div className="group flex flex-col items-center text-center max-w-[240px] animate-subtle-bounce-1">
            <div className="glow-rotate-halo logo-backlit-bg relative w-32 h-32 sm:w-40 sm:h-40 rounded-[26%] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] border border-white/10 p-1 sm:p-2 flex items-center justify-center mb-4 group-hover:scale-110 active:scale-95 transition-all duration-300 cursor-default">
              <Image
                src="/colorlab-icon.png"
                alt="ColorLab 2.0 Logo"
                width={150}
                height={150}
                className="w-full h-full object-contain relative z-10"
              />
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-white tracking-wide mb-1 drop-shadow-md">
              ColorLab 2.0
            </h4>
          </div>

          {/* App 2: CheeseBooth */}
          <a
            href="https://cheese-booth.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsEcosystemOpen(false)}
            className="group flex flex-col items-center text-center max-w-[240px] cursor-pointer animate-subtle-bounce-2"
          >
            <div className="glow-rotate-halo logo-backlit-bg relative w-32 h-32 sm:w-40 sm:h-40 rounded-[26%] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] border border-white/10 p-4 flex items-center justify-center mb-4 group-hover:scale-110 active:scale-95 transition-all duration-300">
              <Image
                src="/cheesebooth-icon.png"
                alt="CheeseBooth Logo"
                width={200}
                height={200}
                className="w-full h-full object-contain relative z-10"
              />
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-white group-hover:text-amber-300 transition-colors tracking-wide mb-1 drop-shadow-md">
              CheeseBooth
            </h4>
          </a>

          {/* App 3: Live Stream SOP */}
          <a
            href="https://sonylivesop.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsEcosystemOpen(false)}
            className="group flex flex-col items-center text-center max-w-[240px] cursor-pointer animate-subtle-bounce-3"
          >
            <div className="glow-rotate-halo logo-backlit-bg relative w-32 h-32 sm:w-40 sm:h-40 rounded-[26%] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] border border-white/10 flex items-center justify-center text-5xl sm:text-6xl mb-4 group-hover:scale-110 active:scale-95 transition-all duration-300">
              <span className="relative z-10">🎥</span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-white group-hover:text-blue-300 transition-colors tracking-wide mb-1 drop-shadow-md">
              Live Stream SOP
            </h4>
          </a>
        </div>
      </div>,
      document.body
    )}
  </>
  );
}

export function SiteHeader(props: SiteHeaderProps) {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[160rem] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <span className="font-sans text-sm font-bold tracking-widest text-white">
                ALPHA <span className="font-serif italic text-white/90">α</span> COLORLAB
              </span>
            </div>
          </div>
        </header>
      }
    >
      <SiteHeaderInner {...props} />
    </Suspense>
  );
}
