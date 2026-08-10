'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LanguageToggle } from './language-toggle';
import { useAuth } from './auth-context';
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
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { user, loginWithGoogle, logout } = useAuth();

  const currentQ = searchParams?.get('q') ?? '';
  const currentFormat = searchParams?.get('format') ?? '';
  const currentLook = searchParams?.get('look') ?? '';
  const currentTag = searchParams?.get('tag') ?? '';

  const tagList = providedTags && providedTags.length > 0 ? providedTags : FALLBACK_TAGS;
  const hasActiveFilters = Boolean(currentQ || currentFormat || currentLook || currentTag);

  const [isHidden, setIsHidden] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(hasActiveFilters);
  const [isEcosystemOpen, setIsEcosystemOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [query, setQuery] = useState(currentQ);
  const inputRef = useRef<HTMLInputElement>(null);
  const ecosystemRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  /**
   * False on the server and during hydration, true afterwards — the guard the
   * ecosystem portal needs, since `document` does not exist on the server.
   *
   * `useState` + an effect is the usual spelling and is what
   * `react-hooks/set-state-in-effect` flags: it commits a render purely to
   * schedule a second one. `useSyncExternalStore` expresses the same thing as
   * two snapshots, and never subscribes because the value cannot change again.
   */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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
            // A dropdown is a child of the bar, so it rides off-screen with it.
            // Closing it keeps the state honest with what the reader can see.
            setIsProfileOpen(false);
            setIsEcosystemOpen(false);
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
        if (isProfileOpen) {
          setIsProfileOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, isEcosystemOpen, isProfileOpen]);

  /**
   * Close either dropdown on a click outside it.
   *
   * `ecosystemRef` was already attached to the wrapper but nothing read it, so
   * the launcher could only be dismissed with Escape — on a phone, where there
   * is no Escape key, it stayed open until something else was tapped.
   * `pointerdown` covers mouse, touch and pen in one listener.
   */
  useEffect(() => {
    if (!isEcosystemOpen && !isProfileOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        isEcosystemOpen &&
        !ecosystemRef.current?.contains(target) &&
        !portalRef.current?.contains(target)
      ) {
        setIsEcosystemOpen(false);
      }
      if (isProfileOpen && !profileRef.current?.contains(target)) setIsProfileOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isEcosystemOpen, isProfileOpen]);

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
      {/* `has-[:focus-visible]`, not `focus-within`.
          Both keep the bar on screen while something inside it has focus, which
          is what a keyboard user needs — a focused control must not be scrolled
          out from under them. But `focus-within` also fires for a *mouse* click,
          and a button keeps focus after being clicked, so opening the profile
          menu or the ecosystem launcher pinned the header open permanently: the
          scroll handler kept setting `-translate-y-full` and this class kept
          cancelling it. `:focus-visible` is only set for keyboard focus, so the
          reveal survives and the pin does not. */}
      <header
      className={`sticky top-0 z-40 transition-transform duration-300 ease-in-out has-[:focus-visible]:translate-y-0 ${
        isHidden && !isSearchOpen ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="mx-auto max-w-[160rem] inset-safe pt-safe">
        {/* No `gap` on this column, deliberately.

            The filter console below is a second child that collapses to zero
            height when closed — but a flex `gap` is applied between children
            whatever their size, so a `gap-2.5` here left 10px of dead space
            under the control row that no longer had anything in it. The bar
            measured 10px of padding above the row and 20px below: the controls
            were centred in their own rail and sitting off-centre in the bar
            around it. The console owns its own separation instead, as a margin
            that only exists while it is open. */}
        <div
          className={`glass transition-all duration-300 ease-out px-3 py-1.5 sm:px-5 sm:py-2 flex flex-col ${
            isSearchOpen ? 'shadow-[0_12px_40px_rgba(0,0,0,0.6)]' : ''
          }`}
        >
          {/* Main Top Header Line.

              Every control in this row sits on one height rail — `h-9` below
              `sm`, `h-10` at `sm` and up — and the logo is capped to it. They
              were already vertically centred, but at five different heights
              (40 / 32 / 33.6 / 32 / 37.2px inside a 40px bar) the row read as
              ragged rather than as one piece of chrome. Anything added here
              must join the rail, and the gap scale below it: `gap-1.5/2` inside
              a control cluster, `gap-2/2.5` within a group, `gap-3/4` between
              groups. Alignment is a system, not a per-element decision. */}
          <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-4">
            {/* Custom Brand Logo & 4-Square Ecosystem Launcher.

                The wordmark is the one element allowed to shrink — everything
                else on the rail is `shrink-0`. The row is `flex-nowrap`, so
                with a fixed-width logo the controls simply ran off the right of
                a 375px screen: 350px of content in 311px, and worse once signed
                in, where the profile pill is wider than the sign-in button. It
                keeps its full size wherever there is room and letterboxes down
                inside the same 36/40px rail where there is not. */}
            <div className="relative flex min-w-0 items-center gap-2 sm:gap-2.5" ref={ecosystemRef}>
              <Link
                href="/"
                className="group flex h-9 sm:h-10 min-w-0 items-center transition-transform duration-300 hover:scale-105 active:scale-95"
              >
                <Image
                  src="/logo.png"
                  alt="Alpha ColorLab Logo"
                  width={1780}
                  height={499}
                  priority
                  className="h-9 sm:h-10 w-auto max-w-full object-contain object-left transition-all duration-300"
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
                aria-label={tNav('ecosystem')}
                title={tNav('ecosystem')}
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

            {/* Center: Search Trigger or Expanded Live Search Form.

                Hidden below `sm` while closed. The narrow layout already
                carries a dedicated search button on the right, so showing both
                was two affordances for one action — and with the logo, the
                launcher, the profile pill and two flags all `shrink-0` in a
                `flex-nowrap` row, the pill was squeezed to a few dozen pixels
                of unreadable placeholder. It still opens full-width here. */}
            <div
              className={`${
                isSearchOpen ? 'flex' : 'hidden sm:flex'
              } flex-1 min-w-0 max-w-xl mx-auto items-center transition-all duration-300`}
            >
              {!isSearchOpen ? (
                /* Compact Trigger Button */
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  aria-expanded="false"
                  aria-label={t('label')}
                  className="w-full h-9 sm:h-10 flex items-center justify-between gap-3 px-4 rounded-full bg-black/50 text-white/90 hover:text-white text-xs sm:text-sm transition-all duration-300 group cursor-pointer shadow-sm"
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
                  className="relative flex h-9 sm:h-10 items-center w-full animate-fade-in"
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

                  <div className="relative flex h-full items-center w-full">
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
                      className="w-full h-full pl-9 pr-16 text-xs sm:text-sm rounded-full bg-black/70 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 transition-all shadow-md"
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
            <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-label={isSearchOpen ? t('close') : t('label')}
                className="sm:hidden w-9 h-9 shrink-0 flex items-center justify-center rounded-full glass-flat text-white/80 hover:text-white transition-colors cursor-pointer"
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

              {/* Google Auth / Profile Button */}
              {user ? (
                /* A click-toggled disclosure, not a hover menu. `group-hover`
                   alone left Sign out unreachable for anyone without a hovering
                   pointer — every touch device, and the keyboard. */
                <div className="relative shrink-0" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen((prev) => !prev)}
                    aria-expanded={isProfileOpen}
                    aria-haspopup="menu"
                    className={`flex h-9 sm:h-10 items-center gap-2 pl-1 pr-1 sm:pl-1.5 sm:pr-3.5 rounded-full glass-flat transition-all cursor-pointer border shadow-sm ${
                      isProfileOpen
                        ? 'bg-white/20 border-white/40'
                        : 'border-white/20 hover:bg-white/20 hover:border-white/40'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- user avatar */}
                    <img
                      src={user.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&bold=true`;
                      }}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/40 shrink-0"
                    />
                    {/* Avatar-only below `sm`, for the same reason the sign-in
                        button is icon-only there: the name reserved up to 64px
                        in a row that has none to spare, and truncating it to
                        "Tha…" bought nothing a reader could use. */}
                    <span className="hidden sm:inline text-xs font-bold text-white sm:max-w-[7rem] md:max-w-[9rem] truncate font-sans whitespace-nowrap">
                      {user.name}
                    </span>
                  </button>

                  {isProfileOpen && (
                    /* The positioning lives on this wrapper and the glass look on
                       the panel inside it, because the two cannot share an
                       element. `.glass` is unlayered CSS and therefore beats
                       Tailwind's layered `absolute`, so a `glass absolute` panel
                       computes to `position: relative`, stays in normal flow,
                       and stretches the header — 82px to 188px here, which is
                       the bar visibly growing instead of the menu opening over
                       the page. */
                    <div className="absolute right-0 top-full mt-2 w-48 z-50 overflow-hidden rounded-[var(--radius-glass)] border border-white/20 bg-void/95 shadow-2xl">
                      {/* Opacity, border and shadow belong to the wrapper for the
                          same reason as the positioning: `.glass` hard-sets
                          background, box-shadow and `border: 0 !important`, so
                          `bg-void/95` on the glass panel itself was dead and the
                          menu stayed translucent — the recipe photo behind it
                          showed straight through the email address. Painting the
                          opaque colour underneath lets the glass gradient sit on
                          top of it and still read as glass. */}
                      <div role="menu" className="glass p-2 animate-fade-in">
                        <div className="px-3 py-2 border-b border-white/10">
                          <p className="text-xs font-bold text-white truncate font-sans">{user.name}</p>
                          <p className="text-[10px] text-white/50 truncate font-mono mt-0.5">
                            {user.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsProfileOpen(false);
                            void logout();
                          }}
                          className="w-full mt-1 px-3 py-2 rounded-xl text-left text-xs font-semibold text-danger hover:bg-danger/10 transition-colors flex items-center justify-between cursor-pointer font-sans"
                        >
                          <span>{tAuth('signOut')}</span>
                          <span aria-hidden>↪</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => loginWithGoogle()}
                  aria-label={tAuth('signInGoogle')}
                  title={tAuth('signInGoogle')}
                  className="flex h-9 sm:h-10 items-center justify-center gap-2 w-9 sm:w-auto sm:px-4 rounded-full bg-white text-black font-extrabold text-xs sm:text-sm hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer shrink-0 border border-white font-sans"
                >
                  <GoogleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  {/* Icon-only on the narrowest screens. The label plus the flag
                      toggle plus the wordmark came to 400px of content in a
                      311px row at 375px wide, and the row is `flex-nowrap`, so
                      it overflowed the page sideways instead of wrapping.
                      `aria-label` above still names the button. */}
                  <span aria-hidden className="hidden md:inline whitespace-nowrap">
                    {tAuth('signInGoogle')}
                  </span>
                  <span aria-hidden className="hidden sm:inline md:hidden whitespace-nowrap">
                    {tAuth('signIn')}
                  </span>
                </button>
              )}

              <LanguageToggle />
            </div>
          </div>

          {/* Expanded Glass Console for Filters & Tags (Smooth Height Transition) */}
          <div
            /* `mt-2.5` replaces the column gap that used to sit here whether or
               not this was open; the rule is the same 10px above the divider,
               it just costs nothing when closed. */
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              isSearchOpen
                ? 'grid-rows-[1fr] opacity-100 mt-2.5 pt-2 border-t border-white/10'
                : 'grid-rows-[0fr] opacity-0 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden flex flex-col gap-1.5 text-xs">
              {/* Each row is a two-column rail: a fixed-width label, then the
                  chips in their own flex box. The label used to be a sibling of
                  the chips in one wrapping flex row, so the moment the chips
                  wrapped, line two started at x=0 and ran under the label — the
                  left edge only lined up when everything happened to fit on one
                  line. The chip boxes carry `py-1` because their hover state
                  lifts them 2px and `overflow-x-auto` computes `overflow-y` to
                  `auto`, which clipped the lift and flickered a scrollbar. */}

              {/* Row 1: Format Filters */}
              <div className="flex items-start gap-2">
                <span className="eyebrow text-[11px] text-white/80 uppercase w-14 shrink-0 font-bold leading-6">
                  Format
                </span>

                <div className="flex flex-wrap items-center gap-1.5 min-w-0 py-1">
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
                    onClick={() => updateFilters({ format: currentFormat === 'cl' ? '' : 'cl' })}
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
              </div>

              {/* Row 2: Creative Look Sub-Filters (only visible when format=cl) */}
              {currentFormat === 'cl' && (
                <div className="flex items-start gap-2 transition-all duration-300">
                  <span className="eyebrow text-[11px] text-white/80 uppercase w-14 shrink-0 font-bold leading-6">
                    Look
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5 min-w-0 py-1">
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
                        onClick={() => updateFilters({ look: currentLook === l.code ? '' : l.code })}
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
                </div>
              )}

              {/* Row 3: Tag Chips Bar */}
              <div className="flex items-start gap-2">
                <span className="eyebrow text-[11px] text-white/80 uppercase w-14 shrink-0 font-bold leading-6">
                  Tags
                </span>

                <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto py-1 scrollbar-none">
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
                      onClick={() => updateFilters({ tag: currentTag === item.tag ? '' : item.tag })}
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
              </div>

              {/* Footer row: Clear all filters & Shortcut hint */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-2 mt-0.5 border-t border-white/10 text-[10px] text-ink-faint">
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="eyebrow text-[10px] text-danger/85 hover:text-danger transition-colors cursor-pointer underline underline-offset-2"
                  >
                    {t('clearAll')}
                  </button>
                  <span className="font-mono hidden sm:inline">{t('escHint')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>

    {/* Full-Screen Backdrop Blur & iPad-style Launchpad */}
    {isEcosystemOpen && mounted && typeof document !== 'undefined' && createPortal(
      <div ref={portalRef} className="fixed inset-0 z-[99990]">
        {/* Backdrop. `black/80`, not `/60`: at 60% the recipe photographs
            behind still came through the blur as legible shapes and competed
            with the icons for attention. A launcher has to feel like a layer
            over the page, not a filter on it. */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl transition-opacity duration-300" />

        {/* The scrolling box, and therefore the clipping box, is deliberately
            the whole viewport.

            `overflow-y-auto` used to live on the grid below, where it also
            computed `overflow-x` to `auto` — so the launcher was clipped to its
            own content box, 1023×316 at 1440×900. A tile's ambient bloom is
            `blur(26px)`, which stays faintly visible about 78px out, so the
            clip sliced every glow off along a hard rectangle and the whole
            launcher sat inside a visible seam. Padding cannot fix that: the box
            grows with the padding and the cut moves with it. Clipping at the
            viewport edge instead puts the cut where there is nothing left to
            see, and the grid goes back to `overflow: visible`.

            `min-h-full` + centring on the child, rather than `justify-center`
            here, is what lets tall content scroll without losing its top — the
            usual failure of a centred flex item inside a scroll container. */}
        <div
          className="relative z-[99999] h-full w-full overflow-y-auto overscroll-contain scrollbar-none"
          onClick={(e) => {
            // Closing on a click outside the tiles, which is what the backdrop
            // did before this layer covered it. The layer has to stay
            // hit-testable — `pointer-events-none` would hand the wheel to the
            // page underneath and the launcher would not scroll at all.
            if (!(e.target as HTMLElement).closest('.app-enter')) {
              setIsEcosystemOpen(false);
            }
          }}
        >
          <div className="min-h-full flex items-center justify-center p-6 sm:p-10">
            {/* `items-center sm:items-start`: this box is a flex column below
                `sm` and a grid above it, and `align-items` means different
                things in each. In the grid it keeps the three tiles on one line
                even if a longer app name wraps to two; in the column it is what
                centres them, and `items-start` alone left-aligned the whole
                stack on a phone (`justify-items-center` is grid-only and does
                nothing there).

                `iconInset` is per-app on purpose. The three PNGs are bare
                artwork on transparency with quite different bleed (96%, 90%,
                82% of their own canvas), so one shared padding renders them at
                three different optical sizes — which is exactly what it used to
                do. These values land all three on roughly 70% of the tile.
                Percentages, not `p-4`, so they hold at both tile sizes without
                a breakpoint. */}
            <div className="w-full max-w-2xl grid grid-cols-2 gap-8 sm:gap-12 justify-items-center items-center">
              <EcosystemApp
                name="ColorLab 2.0"
                icon="/colorlab-icon.png"
                href="/"
                external={false}
                iconInset="p-[13.5%]"
                enter="app-enter-1"
                onNavigate={() => setIsEcosystemOpen(false)}
              />

              <EcosystemApp
                name="Sony Wiki"
                icon="/sony-wiki-icon.png"
                href="/cameras"
                external={false}
                iconInset="p-[10%]"
                enter="app-enter-2"
                accent="group-hover:text-amber-300"
                onNavigate={() => setIsEcosystemOpen(false)}
              />

              {/* Absolute URLs, and deliberately not routes here. These two are
                  separate projects on their own repos and their own Vercel
                  deployments — this app has no copy of their source and no way
                  to render them. They used to be reachable at `/cheesebooth`
                  and `/livesop`, which embedded each deployment in an iframe;
                  that only ever worked because the destination was already
                  external, and it cost the reader the app's own chrome, its
                  URL bar and its deep links. Send them to the real origin. */}
              <EcosystemApp
                name="CheeseBooth"
                icon="/cheesebooth-icon.png"
                href="https://cheese-booth.vercel.app/"
                iconInset="p-[11%]"
                enter="app-enter-3"
                accent="group-hover:text-amber-300"
                onNavigate={() => setIsEcosystemOpen(false)}
              />

              <EcosystemApp
                name="Live Stream SOP"
                icon="/livesop-icon.png"
                href="https://sonylivesop.vercel.app/"
                iconInset="p-[7.5%]"
                enter="app-enter-4"
                accent="group-hover:text-blue-300"
                onNavigate={() => setIsEcosystemOpen(false)}
              />
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
  </>
  );
}

/**
 * One app in the Sony Alpha ecosystem launcher.
 *
 * The current app renders as a plain tile; the others as external links.
 *
 * Three elements, and the split matters. The **shell** owns every transform —
 * the staggered entrance and the hover scale. The **glow** is its own absolutely
 * positioned layer *behind* the tile rather than a `z-index: -1` pseudo on the
 * tile, because a negative-z child only paints behind its parent while that
 * parent is not a stacking context: the moment the tile itself scaled on hover
 * it became one, and the blurred rainbow painted across the icon's face instead
 * of around it. The **tile** is the opaque squircle and does the clipping.
 *
 * Nothing here clips the shell's overflow — the glow lives outside the tile's
 * box by design, and `overflow-hidden` anywhere above it cuts away the only
 * part of it that is ever visible.
 */
function EcosystemApp({
  name,
  icon,
  href,
  iconInset,
  enter,
  accent = '',
  onNavigate,
  external = true,
}: {
  name: string;
  icon: string;
  href?: string;
  iconInset: string;
  enter: string;
  accent?: string;
  onNavigate?: () => void;
  /** The sibling apps live on other origins and open in a new tab. This one is
      the app you are already in, so it navigates in place. */
  external?: boolean;
}) {
  const body = (
    <>
      <div className="app-tile-shell w-32 h-32 sm:w-40 sm:h-40 mb-4">
        <span aria-hidden className="app-glow" />
        <div
          className={`app-tile w-full h-full ${iconInset} flex items-center justify-center`}
        >
          <Image
            src={icon}
            /* Decorative: the visible name below is already the link's label,
               and a duplicate here would have a screen reader read it twice. */
            alt=""
            width={200}
            height={200}
            /* Served straight from /public, never through /_next/image.
               These three broke in production with
               `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` — the account's
               image-optimization quota is spent, so only transforms already in
               Vercel's cache still resolve. Every other image on the site kept
               working purely because it had been optimized before the quota
               ran out; these were added after it, so no cached variant existed
               and all three rendered as broken icons.
               The sources are now 256x256 and 6-11KB each, which is smaller
               than the optimizer's own output would have been, so there is
               nothing left to optimize away. This also makes the launcher
               immune to the quota, which is the point: it is the one component
               whose whole job is to look like the apps work. */
            unoptimized
            className="w-full h-full object-contain"
          />
        </div>
      </div>
      <h4
        className={`text-base sm:text-lg font-bold text-white transition-colors tracking-wide drop-shadow-md ${accent}`}
      >
        {name}
      </h4>
    </>
  );

  const shell = `group app-enter ${enter} flex flex-col items-center text-center max-w-[240px]`;

  // A tile with no href renders as a dead square: it looks identical to the
  // two beside it, and clicking it does nothing at all — not even close the
  // launcher. That is what "the links don't work" meant.
  if (!href) {
    return <div className={`${shell} cursor-default`}>{body}</div>;
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          // Delay unmounting so the browser can process the default link action
          if (onNavigate) setTimeout(onNavigate, 200);
        }}
        className={`${shell} cursor-pointer`}
      >
        {body}
      </a>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`${shell} cursor-pointer`}
    >
      {body}
    </Link>
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}
