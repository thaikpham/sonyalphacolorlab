'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LanguageToggle } from './language-toggle';
import { useAuth } from './auth-context';
import { EcosystemApp } from './ecosystem-app';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { CREATIVE_LOOKS } from '@/lib/camera/constants';
import { DEFAULT_WIKI_SORT } from '@/lib/cameras/types';
import { ECOSYSTEM_APPS } from '@/lib/ecosystem';

interface TagItem {
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
  const tCameras = useTranslations('cameras');
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  /* Two catalogues share this chrome: the camera wiki and the headphone &
     speaker wiki. `isWiki` decides whether the filter bar renders at all;
     `wikiBase` decides which route its controls navigate to. They were one
     flag and a hardcoded `/cameras`, so every control on `/audio` — search,
     sort, view switcher, reset — silently threw the reader into the camera
     catalogue. */
  const isAudioWiki = pathname === '/audio' || pathname.startsWith('/audio/');
  const isWiki =
    pathname === '/cameras' || pathname.startsWith('/cameras/') || isAudioWiki;
  const wikiBase = isAudioWiki ? '/audio' : '/cameras';
  const searchParams = useSearchParams();
  const { user, loginWithGoogle, logout } = useAuth();

  const currentQ = searchParams?.get('q') ?? '';
  const currentFormat = searchParams?.get('format') ?? '';
  const currentLook = searchParams?.get('look') ?? '';
  const currentTag = searchParams?.get('tag') ?? '';

  const wikiCat = searchParams?.get('cat') ?? 'all';
  const wikiSub1 = searchParams?.get('sub1') ?? 'all';
  const wikiSub2 = searchParams?.get('sub2') ?? 'all';
  const wikiSort = searchParams?.get('sort') ?? DEFAULT_WIKI_SORT;
  const wikiView = searchParams?.get('view') ?? 'grid';

  const tagList = providedTags && providedTags.length > 0 ? providedTags : FALLBACK_TAGS;
  const hasActiveFilters = isWiki
    ? Boolean(currentQ || wikiCat !== 'all' || wikiSub1 !== 'all' || wikiSub2 !== 'all' || wikiSort !== DEFAULT_WIKI_SORT)
    : Boolean(currentQ || currentFormat || currentLook || currentTag);

  const [isHidden, setIsHidden] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(hasActiveFilters);
  const [isEcosystemOpen, setIsEcosystemOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [query, setQuery] = useState(currentQ);
  const inputRef = useRef<HTMLInputElement>(null);
  const ecosystemRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  interface PredictiveItem {
    id: string;
    title: string;
    subtitle: string;
    badge?: string;
    price?: string;
    url: string;
    imageUrl?: string;
    accentHex?: string;
  }

  const [predictiveResults, setPredictiveResults] = useState<PredictiveItem[]>([]);
  const [isPredictiveLoading, setIsPredictiveLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isPredictiveOpen, setIsPredictiveOpen] = useState(false);
  const predictiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Monotonic id of the newest predictive request.
   *
   * The dropdown is fed by whichever response lands last, which is not
   * necessarily the newest query — "a7" issued before "a7 iv" can resolve after
   * it and repaint the older matches over the newer ones. Comparing against
   * this on arrival drops any response that is no longer the current one, and
   * bumping it is also how a cleared box cancels a request already in flight.
   */
  const predictiveSeq = useRef(0);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isPredictiveOpen || predictiveResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < predictiveResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : predictiveResults.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && predictiveResults[selectedIndex]) {
      e.preventDefault();
      const target = predictiveResults[selectedIndex];
      setIsSearchOpen(false);
      setIsPredictiveOpen(false);
      router.push(target.url);
    } else if (e.key === 'Escape') {
      setIsPredictiveOpen(false);
    }
  };

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
    /* A navigation answers the query — the reader is now looking at results,
       so the suggestions for that same text are stale chrome over them. This
       does not fetch: arriving on a URL is not someone typing. */
    setIsPredictiveOpen(false);
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
      const newQ = patch.q !== undefined ? patch.q : currentQ;

      if (isWiki) {
        const qs = new URLSearchParams(newQ.trim() ? { q: newQ.trim() } : {}).toString();
        router.push(qs ? `${wikiBase}?${qs}` : wikiBase, { scroll: false });
      } else {
        const next: Record<string, string> = {};
        const newFormat = patch.format !== undefined ? patch.format : currentFormat;
        const newLook = patch.look !== undefined ? patch.look : currentLook;
        const newTag = patch.tag !== undefined ? patch.tag : currentTag;

        if (newQ.trim()) next.q = newQ.trim();
        if (newFormat) next.format = newFormat;
        if (newLook && newFormat === 'cl') next.look = newLook;
        if (newTag) next.tag = newTag;

        const qs = new URLSearchParams(next).toString();
        /* `/colorlab`, not `/` — the root is the ecosystem launcher now, and it
           renders no grid, so every recipe search and filter here would have
           navigated out of the app and shown four tiles instead of results. */
        router.push(qs ? `/colorlab?${qs}` : '/colorlab', { scroll: false });
      }
    },
    [currentQ, currentFormat, currentLook, currentTag, isWiki, wikiBase, router],
  );

  const updateWikiFilters = useCallback(
    (patch: {
      q?: string;
      cat?: string;
      sub1?: string;
      sub2?: string;
      sort?: string;
      view?: string;
    }) => {
      const next = new URLSearchParams();

      const newQ = patch.q !== undefined ? patch.q : currentQ;
      const newCat = patch.cat !== undefined ? patch.cat : wikiCat;
      const newSub1 = patch.sub1 !== undefined ? patch.sub1 : wikiSub1;
      const newSub2 = patch.sub2 !== undefined ? patch.sub2 : wikiSub2;
      const newSort = patch.sort !== undefined ? patch.sort : wikiSort;
      const newView = patch.view !== undefined ? patch.view : wikiView;

      if (newQ.trim()) next.set('q', newQ.trim());
      if (newCat && newCat !== 'all') next.set('cat', newCat);
      if (newSub1 && newSub1 !== 'all') next.set('sub1', newSub1);
      if (newSub2 && newSub2 !== 'all') next.set('sub2', newSub2);
      if (newSort && newSort !== DEFAULT_WIKI_SORT) next.set('sort', newSort);
      if (newView && newView !== 'grid') next.set('view', newView);

      const qs = next.toString();
      router.push(qs ? `${wikiBase}?${qs}` : wikiBase, { scroll: false });
    },
    [currentQ, wikiCat, wikiSub1, wikiSub2, wikiSort, wikiView, wikiBase, router],
  );

  /**
   * Live search, debounced.
   *
   * Navigating straight from `onChange` pushed a route per keystroke, and each
   * push refetches the RSC payload for the whole grid — "portrait" cost eight
   * round trips and raced its own results. One push once typing settles.
   */
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Suggestions for what is in the box, also debounced.
   *
   * This is an event response, not a synchronisation — it belongs here rather
   * than in an effect keyed on `query`. As an effect it fired one request per
   * keystroke (the 250ms above debounced only the route push, not this), so
   * "a7 iv" cost five calls to `/api/search/predictive` and painted whichever
   * came back last. It also could not avoid setting state synchronously in the
   * effect body, which is the cascading-render pattern
   * `react-hooks/set-state-in-effect` rejects.
   *
   * 120ms is shorter than the route debounce on purpose: the dropdown is the
   * fast feedback a typist is waiting on, the grid behind it is not.
   * https://react.dev/learn/you-might-not-need-an-effect
   */
  const queuePredictive = (value: string) => {
    if (predictiveTimer.current) clearTimeout(predictiveTimer.current);
    const q = value.trim();

    if (!q) {
      // Bumping the sequence orphans any in-flight response, so a request sent
      // before the box was cleared cannot repopulate an empty dropdown.
      predictiveSeq.current += 1;
      setPredictiveResults([]);
      setIsPredictiveOpen(false);
      setIsPredictiveLoading(false);
      setSelectedIndex(-1);
      return;
    }

    setIsPredictiveOpen(true);
    setIsPredictiveLoading(true);
    setSelectedIndex(-1);

    const seq = (predictiveSeq.current += 1);
    const mode = isWiki ? 'wiki' : 'colorlab';
    predictiveTimer.current = setTimeout(() => {
      fetch(`/api/search/predictive?q=${encodeURIComponent(q)}&mode=${mode}&locale=${locale}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: PredictiveItem[] }) => {
          if (seq !== predictiveSeq.current) return;
          setPredictiveResults(Array.isArray(data.results) ? data.results : []);
        })
        /* An offline or 500 response leaves the previous query's matches on
           screen otherwise, which reads as a result for what was just typed. */
        .catch(() => {
          if (seq === predictiveSeq.current) setPredictiveResults([]);
        })
        .finally(() => {
          if (seq === predictiveSeq.current) setIsPredictiveLoading(false);
        });
    }, 120);
  };

  const queueSearch = (value: string) => {
    setQuery(value);
    queuePredictive(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateFilters({ q: value }), 250);
  };

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (predictiveTimer.current) clearTimeout(predictiveTimer.current);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    updateFilters({ q: query });
  };

  const handleClearQuery = () => {
    setQuery('');
    queuePredictive('');
    updateFilters({ q: '' });
    inputRef.current?.focus();
  };

  const handleResetAll = () => {
    setQuery('');
    queuePredictive('');
    // Clearing filters returns to the current app's own index, never the launcher.
    router.push(isWiki ? wikiBase : '/colorlab', { scroll: false });
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
              {isWiki ? (
                <Link
                  href={wikiBase}
                  className="group flex h-9 sm:h-10 min-w-0 items-center gap-2 sm:gap-2.5 transition-transform duration-300 hover:scale-105 active:scale-95"
                >
                  <Image
                    src="/sony-wiki-icon.png"
                    alt="Sony Wiki Logo"
                    width={512}
                    height={512}
                    priority
                    className="h-8 sm:h-9 w-8 sm:w-9 rounded-xl object-contain transition-all duration-300 shadow-md border border-white/20 shrink-0"
                  />
                  <span className="font-black text-base sm:text-lg tracking-wider text-white uppercase font-sans whitespace-nowrap flex items-center gap-1.5">
                    SONY <span className="text-amber-400 font-mono font-bold tracking-normal">WIKI</span>
                  </span>
                </Link>
              ) : (
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
              )}

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
                  className={`w-full h-9 sm:h-10 flex items-center justify-between gap-3 px-4 rounded-full transition-all duration-300 group cursor-pointer shadow-sm ${
                    isWiki
                      ? 'bg-black/70 border border-amber-400/30 text-amber-200 hover:border-amber-400/50'
                      : 'bg-black/50 border border-white/10 text-white/90 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {isWiki ? (
                      <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1 shrink-0">
                        <span>📷</span>
                        <span className="hidden xs:inline">WIKI</span>
                      </span>
                    ) : (
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
                    )}
                    <span className="truncate">
                      {query ? (
                        <strong className="text-white">&quot;{query}&quot;</strong>
                      ) : (
                        isWiki ? t('wikiPlaceholder') : t('placeholder')
                      )}
                    </span>

                    {/* Active Filter Badges in Compact Bar (ColorLab mode) */}
                    {!isWiki && currentFormat && (
                      <span className="eyebrow text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold">
                        {currentFormat === 'pp'
                          ? 'PP'
                          : currentLook
                          ? `CL:${currentLook}`
                          : 'CL'}
                      </span>
                    )}
                    {!isWiki && currentTag && (
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
                  action={
                    isWiki
                      ? (locale === routing.defaultLocale ? wikiBase : `/${locale}${wikiBase}`)
                      : (locale === routing.defaultLocale ? '/' : `/${locale}`)
                  }
                  method="get"
                  onSubmit={handleSubmit}
                  className="relative flex h-9 sm:h-10 items-center w-full animate-fade-in"
                >
                  {!isWiki &&
                    Object.entries({
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
                    {isWiki ? (
                      <span className="absolute left-3 flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/35 shrink-0 pointer-events-none select-none">
                        <span>📷</span>
                        <span>WIKI</span>
                      </span>
                    ) : (
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
                    )}

                    <input
                      id="header-search-input"
                      ref={inputRef}
                      type="search"
                      name="q"
                      value={query}
                      onChange={(e) => queueSearch(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder={isWiki ? t('wikiPlaceholder') : t('placeholder')}
                      autoComplete="off"
                      className={`w-full h-full text-xs sm:text-sm rounded-full bg-black/80 text-white placeholder:text-white/40 focus:outline-none transition-all shadow-md [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none ${
                        isWiki
                          ? 'pl-20 sm:pl-24 pr-10 border border-amber-400/40 focus:ring-1 focus:ring-amber-400/70 focus:border-amber-400/70'
                          : 'pl-9 pr-10 border border-white/20 focus:ring-1 focus:ring-white/40'
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        if (query) {
                          handleClearQuery();
                        } else {
                          setIsSearchOpen(false);
                        }
                      }}
                      title={query ? t('clear') : t('close')}
                      aria-label={query ? t('clear') : t('close')}
                      className="absolute right-3 p-1 rounded-full text-white/60 hover:text-white transition-colors cursor-pointer"
                    >
                      <span aria-hidden className="text-xs">
                        ✕
                      </span>
                    </button>

                    {/* Live Predictive Search Auto-complete Popup */}
                    {isPredictiveOpen && query.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-[9999] overflow-hidden rounded-2xl border border-white/25 bg-void/95 shadow-2xl backdrop-blur-2xl animate-fade-in font-sans">
                        {isPredictiveLoading && predictiveResults.length === 0 ? (
                          <div className="p-3 text-xs text-white/60 flex items-center gap-2 font-mono">
                            <span className="animate-spin">⏳</span>
                            <span>{locale === 'vi' ? 'Đang tìm gợi ý phù hợp…' : 'Finding instant matches…'}</span>
                          </div>
                        ) : predictiveResults.length > 0 ? (
                          <div className="p-2 flex flex-col gap-1">
                            <div className="px-3 py-1 text-[10px] font-mono font-bold text-white/50 uppercase tracking-widest flex items-center justify-between border-b border-white/10 pb-1.5 mb-0.5">
                              <span>{isWiki ? (locale === 'vi' ? 'Sản Phẩm Khớp Nhanh' : 'Matching Products') : (locale === 'vi' ? 'Công Thức Khớp Nhanh' : 'Matching Recipes')}</span>
                              <span className="text-amber-300 font-mono">{predictiveResults.length} {locale === 'vi' ? 'gợi ý' : 'matches'}</span>
                            </div>

                            {predictiveResults.map((item, idx) => (
                              <Link
                                key={item.id}
                                href={item.url}
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setIsPredictiveOpen(false);
                                }}
                                className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
                                  selectedIndex === idx
                                    ? 'bg-amber-400/20 text-white shadow-md border border-amber-400/40 scale-[1.01]'
                                    : 'hover:bg-white/10 text-white/90 hover:text-white'
                                }`}
                              >
                                {item.imageUrl ? (
                                  /* 36px on screen. As a bare <img> this pulled
                                     the full 1000x1000 original — ~139KB per
                                     suggestion, on every keystroke that changed
                                     the list. */
                                  <Image
                                    src={item.imageUrl}
                                    alt=""
                                    width={36}
                                    height={36}
                                    className="w-9 h-9 rounded-lg object-cover bg-black/60 border border-white/15 shrink-0"
                                  />
                                ) : (
                                  <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border border-white/20"
                                    style={{ backgroundColor: item.accentHex || 'rgba(255,255,255,0.1)' }}
                                  >
                                    {isWiki ? '📷' : '🎨'}
                                  </div>
                                )}

                                <div className="flex-1 min-w-0 flex flex-col justify-center leading-snug">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-xs sm:text-sm text-white truncate font-sans">
                                      {item.title}
                                    </span>
                                    {item.badge && (
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                                        isWiki
                                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/35'
                                          : 'bg-white/20 text-white border border-white/25'
                                      }`}>
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-white/60 truncate font-mono mt-0.5">
                                    {item.subtitle}
                                  </span>
                                </div>

                                {item.price && (
                                  <span className="text-xs font-mono font-bold text-amber-300 shrink-0 ml-auto">
                                    {item.price}
                                  </span>
                                )}
                              </Link>
                            ))}

                            <button
                              type="button"
                              onClick={handleSubmit}
                              className="w-full text-center py-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 border-t border-white/10 mt-1 cursor-pointer font-sans"
                            >
                              {locale === 'vi'
                                ? `Nhấn Enter để xem tất cả kết quả cho "${query}" →`
                                : `Press Enter to view all results for "${query}" →`}
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 text-center text-xs text-white/60 font-sans">
                            {locale === 'vi'
                              ? `Không có gợi ý khớp ngay lập tức. Nhấn Enter để tìm kiếm sâu.`
                              : `No instant matches. Press Enter for deep search.`}
                          </div>
                        )}
                      </div>
                    )}
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

          {/* Expanded Glass Console for Filters & Controls */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              isSearchOpen
                ? 'grid-rows-[1fr] opacity-100 mt-2.5 pt-2 border-t border-white/10'
                : 'grid-rows-[0fr] opacity-0 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden flex flex-col gap-2 text-xs">
              {isWiki ? (
                /* Sony Wiki Controls */
                <div className="flex flex-col gap-2.5 py-1 font-sans">
                  {/* Row 1: Category Tabs & View Switcher */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full scrollbar-none">
                      {/* Every product on `/audio` is one category, so tabs
                          keyed on `cat` would be one live tab and three empty
                          ones. There they select `sub1` — Tai nghe or Loa —
                          which is the split a reader of that page is after. */}
                      {(isAudioWiki
                        ? [
                            { key: 'all', label: tCameras('catAll'), icon: '📦' },
                            { key: 'Tai nghe', label: 'Tai nghe', icon: '🎧' },
                            { key: 'Loa', label: 'Loa', icon: '🔊' },
                          ]
                        : [
                            { key: 'all', label: tCameras('catAll'), icon: '📦' },
                            { key: 'camera', label: tCameras('catCamera'), icon: '📷' },
                            { key: 'lens', label: tCameras('catLens'), icon: '🔍' },
                            { key: 'accessory', label: tCameras('catAccessory'), icon: '🎙️' },
                          ]
                      ).map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() =>
                            isAudioWiki
                              ? updateWikiFilters({ sub1: cat.key, sub2: 'all' })
                              : updateWikiFilters({ cat: cat.key, sub1: 'all', sub2: 'all' })
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 font-sans ${
                            (isAudioWiki ? wikiSub1 : wikiCat) === cat.key
                              ? 'bg-amber-400 text-black shadow-md font-extrabold scale-105'
                              : 'glass-flat text-white/80 hover:bg-white/20 hover:text-white border border-white/15'
                          }`}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Catalogue switcher.
                        Without it the audio wiki is reachable only by typing
                        the URL: the brand link, the tabs and the reset control
                        all stay inside whichever catalogue you are already in,
                        so a reader on `/cameras` had no path to the other 25
                        products. */}
                    <div className="flex items-center p-1 rounded-xl bg-black/70 border border-white/20 shrink-0 font-sans">
                      <Link
                        href="/cameras"
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all font-sans ${
                          isAudioWiki ? 'text-white/60 hover:text-white' : 'bg-amber-400 text-black font-extrabold shadow-md'
                        }`}
                      >
                        📷 {tCameras('title')}
                      </Link>
                      <Link
                        href="/audio"
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all font-sans ${
                          isAudioWiki ? 'bg-amber-400 text-black font-extrabold shadow-md' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        🎧 {tCameras('catAudio')}
                      </Link>
                    </div>

                    {/* View Mode Switcher */}
                    <div className="flex items-center p-1 rounded-xl bg-black/70 border border-white/20 ml-auto shrink-0 font-sans">
                      <button
                        type="button"
                        onClick={() => updateWikiFilters({ view: 'table' })}
                        title={tCameras('viewTable')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans ${
                          wikiView === 'table' ? 'bg-amber-400 text-black font-extrabold shadow-md' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        📋 {tCameras('viewTable')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateWikiFilters({ view: 'grid' })}
                        title={tCameras('viewGrid')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans ${
                          wikiView === 'grid' ? 'bg-amber-400 text-black font-extrabold shadow-md' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        🔲 {tCameras('viewGrid')}
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Sub-category Dropdowns & Sort */}
                  <div className="flex items-center justify-between gap-3 flex-wrap text-xs font-sans border-t border-white/10 pt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Digital Clock Style Product Counter Badge */}
                      <span className="px-3 py-1 rounded-xl bg-black/90 border border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.25)] font-mono font-extrabold text-xs tracking-wider flex items-center gap-2 select-none shrink-0">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24]" />
                        <span>{isAudioWiki ? '25 PRODUCTS' : '94 PRODUCTS'}</span>
                      </span>

                      {/* `sub1` already has tabs on the audio route, so only
                          the `sub2` dropdown shows there. */}
                      {!isAudioWiki && (
                      <select
                        value={wikiSub1}
                        onChange={(e) => updateWikiFilters({ sub1: e.target.value, sub2: 'all' })}
                        className="px-3 py-1.5 rounded-xl bg-black/80 border border-white/25 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-400/60 cursor-pointer font-sans"
                      >
                        <option value="all">{tCameras('sub1All')}</option>
                        {['1-Inch', 'APS-C', 'Adapter', 'Audio', 'Full Frame', 'Grip / Tripod', 'Power'].map((sub1) => (
                          <option key={sub1} value={sub1}>
                            {sub1}
                          </option>
                        ))}
                      </select>
                      )}

                      <select
                        value={wikiSub2}
                        onChange={(e) => updateWikiFilters({ sub2: e.target.value })}
                        className="px-3 py-1.5 rounded-xl bg-black/80 border border-white/25 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-400/60 cursor-pointer font-sans"
                      >
                        <option value="all">{tCameras('sub2All')}</option>
                        {(isAudioWiki
                          ? ['Choàng đầu', 'Nhét tai', 'Gaming', 'Di động', 'Karaoke']
                          : [
                              'Battery',
                              'Cinema Line',
                              'DSC',
                              'G',
                              'GM',
                              'Lens Mount',
                              'Microphone',
                              'Máy ảnh Alpha',
                              'SEL',
                              'Vlog',
                              'Vlog Accessory',
                            ]
                        ).map((sub2) => (
                          <option key={sub2} value={sub2}>
                            {sub2}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-white/80 font-bold hidden sm:inline font-sans">{tCameras('sortBy')}:</span>
                      <select
                        value={wikiSort}
                        onChange={(e) => updateWikiFilters({ sort: e.target.value })}
                        className="px-3 py-1.5 rounded-xl bg-black/80 border border-white/25 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-400/60 cursor-pointer font-sans"
                      >
                        {/* Cheapest first leads, because it is the default the
                            page opens on — a select whose first option is not
                            the one in effect reads as though it were reset. */}
                        <option value="price-asc">{tCameras('sortPriceAsc')}</option>
                        <option value="price-desc">{tCameras('sortPriceDesc')}</option>
                        <option value="name">{tCameras('sortName')}</option>
                        <option value="sku">{tCameras('sortSku')}</option>
                      </select>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] text-ink-faint">
                      <button
                        type="button"
                        onClick={handleResetAll}
                        className="eyebrow text-[10px] text-amber-300 hover:text-amber-200 transition-colors cursor-pointer underline underline-offset-2"
                      >
                        {t('clearAll')}
                      </button>
                      <span className="font-mono hidden sm:inline">{t('escHint')}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* ColorLab Recipe Controls */
                <>
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
                </>
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
            {/* One list, two surfaces — see `ECOSYSTEM_APPS`. The landing page
                at `/` renders the same four tiles from the same definitions, so
                a new app appears in both without touching either. The two
                external entries carry absolute URLs and deliberately not
                routes: they are separate projects on their own repos and their
                own Vercel deployments, so this app has no copy of their source
                and no way to render them. They used to be reachable at
                `/cheesebooth` and `/livesop`, which embedded each deployment in
                an iframe; that only ever worked because the destination was
                already external, and it cost the reader the app's own chrome,
                its URL bar and its deep links. Send them to the real origin. */}
            <div className="w-full max-w-2xl grid grid-cols-2 gap-x-8 gap-y-14 sm:gap-x-16 sm:gap-y-20 justify-items-center items-center">
              {ECOSYSTEM_APPS.map((app) => (
                <EcosystemApp
                  key={app.key}
                  app={app}
                  onNavigate={() => setIsEcosystemOpen(false)}
                />
              ))}
            </div>
          </div>
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
