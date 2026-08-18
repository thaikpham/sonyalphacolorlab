'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, Suspense } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LanguageToggle } from './language-toggle';
import { GoogleMark, useAuth } from './auth-context';
import { LauncherGrid } from './launcher-grid';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { CREATIVE_LOOKS } from '@/lib/camera/constants';
import { DEFAULT_WIKI_SORT } from '@/lib/cameras/types';

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
 * The bar itself: film, blur, shadow — and its radius.
 *
 * `rounded-xl` (32px) is the scale's largest slab, which is what this is. The
 * bar is not full-bleed: it sits inside a wrapper carrying `.inset-safe` and
 * `.pt-safe`, so there is real ground on all three outer edges for the corners
 * to read against, and it floats over the page rather than capping it.
 *
 * No bottom border and no `overflow-hidden`. The border was never there — the
 * `0 14px 34px -18px` shadow is what separates the bar from the content under
 * it — and clipping would swallow the account menu, which is positioned to
 * overlap the bar's bottom edge on purpose.
 */
const HEADER_BAR =
  'rounded-xl ' +
  'bg-[linear-gradient(180deg,oklch(100%_0_0/0.075),oklch(100%_0_0/0.035))] ' +
  '[backdrop-filter:var(--elevation-blur-strong)] [-webkit-backdrop-filter:var(--elevation-blur-strong)] ' +
  'shadow-[0_14px_34px_-18px_oklch(0%_0_0/0.9),var(--elevation-spec)]';

/**
 * The two states of every filter chip in the console.
 *
 * Deliberately NOT `chip chip-action surface-selected`. `.chip` and
 * `.surface-selected` are both unlayered and `.chip` is written *after*
 * `.surface-selected` in globals.css, so on one element the chip's own white
 * film and specular shadow win and the selection renders as an ordinary chip —
 * and `.chip-action:hover` would repaint the accent fill white on top of that.
 * The selected state therefore carries `.surface-selected` plus the chip's
 * geometry as utilities. Both land on the same 44px touch target and the same
 * 12px radius, so the two states are the same object.
 */
const CHIP_IDLE = 'chip chip-action shrink-0 whitespace-nowrap';
const CHIP_SELECTED =
  'surface-selected shrink-0 inline-flex items-center justify-center gap-1.5 whitespace-nowrap ' +
  'px-3 min-h-[var(--layout-touch-target)] text-label font-semibold text-ink cursor-pointer';

/**
 * The wiki console's dropdowns. A select is an input, so it is pressed into the
 * surface rather than raised out of it, and it carries no focus ring of its own —
 * the global `:focus-visible` outline is the system's one sanctioned stroke.
 */
const WIKI_SELECT =
  'surface-sunken px-3 min-h-[var(--layout-touch-target)] text-body-sm font-semibold text-ink cursor-pointer';

/** A square 44px icon button on the control rail — launcher, mobile search. */
const ICON_BUTTON =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-sm cursor-pointer transition-colors';
const ICON_BUTTON_IDLE =
  'bg-white/[0.08] text-ink-muted hover:bg-white/[0.13] hover:text-ink shadow-[var(--elevation-spec)]';

/**
 * Multi-functional sticky header navigation for Alpha ColorLab.
 *
 * Features:
 * - Wordmark with Sony Alpha 'α' glyph standing in for the "A".
 * - Expandable console integrating recipe keyword search, format filters (PP/CL),
 *   Creative Look sub-filters, and Tag filters.
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
  const { user, openLoginModal, logout } = useAuth();

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
  /**
   * The launcher tiles inside the portal. A REF, not a class name.
   *
   * This test used to be `e.target.closest('.app-enter')`, and `.app-enter` was
   * a staggered-entrance class from the deleted vfx.css. Once the launcher was
   * rebuilt the class was gone, `closest` returned null for every click, and so
   * every click inside the overlay — including one on the Sony Wiki tile —
   * counted as "outside the tiles" and closed the launcher. The tile could not
   * be opened at all.
   *
   * Nothing caught it: the class is referenced from a string in JS rather than
   * a `className`, so it is invisible to the audit greps, and `app-enter` was
   * not in the deleted-vocabulary pattern to begin with (`app-glow` was). A ref
   * cannot rot this way — it points at the node, not at a name.
   */
  const launcherRef = useRef<HTMLDivElement>(null);

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
          className={`${HEADER_BAR} transition-all duration-300 ease-out px-3 py-2 sm:px-6 sm:py-3 flex flex-col`}
        >
          {/* Main Top Header Line.

              Every control in this row sits on one height rail, and the rail is
              now the 44px touch target (`--layout-touch-target`) rather than a
              per-control height. They were already vertically centred, but at
              five different heights (40 / 32 / 33.6 / 32 / 37.2px inside a 40px
              bar) the row read as ragged rather than as one piece of chrome —
              and none of them cleared 44px. Anything added here must join the
              rail, and the gap scale below it: `gap-1.5/2` inside a control
              cluster, `gap-2/2.5` within a group, `gap-3/4` between groups.
              Alignment is a system, not a per-element decision. */}
          <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-4">
            {/* Custom Brand Logo & 4-Square Ecosystem Launcher.

                The wordmark is the one element allowed to shrink — everything
                else on the rail is `shrink-0`. The row is `flex-nowrap`, so
                with a fixed-width mark the controls simply ran off the right of
                a 375px screen: 350px of content in 311px, and worse once signed
                in. It keeps its full size wherever there is room and truncates
                inside the same 44px rail where there is not. */}
            <div className="relative flex min-w-0 items-center gap-2 sm:gap-2.5" ref={ecosystemRef}>
              {isWiki ? (
                <Link
                  href={wikiBase}
                  className="flex min-h-[var(--layout-touch-target)] min-w-0 items-center gap-2 sm:gap-2.5"
                >
                  <Image
                    src="/sony-wiki-icon.png"
                    alt="Sony Wiki Logo"
                    width={512}
                    height={512}
                    priority
                    className="h-9 w-9 rounded-sm object-contain shrink-0"
                  />
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-body-lg font-extrabold tracking-[-0.02em] text-ink">
                    SONY <span className="text-accent-400">WIKI</span>
                  </span>
                </Link>
              ) : (
                /* ColorLab's own brand mark, not type.

                   The four overlapping circles are the product's logo and carry
                   its own palette — amber, teal, crimson. That is not a
                   competitor-hue violation and `/design-sync` must not "fix" it:
                   the no-red/yellow/green rule governs colours the INTERFACE
                   chooses, and a brand mark is artwork, the same exemption the
                   Google mark on the sign-in button gets.

                   `unoptimized` for the reason the launcher icons carry it: the
                   account's image-optimization quota is spent, so only transforms
                   already in Vercel's cache resolve and a newly-sized variant
                   returns 402. The source is served straight from /public.

                   It is the link's only content, so `alt` is the accessible name
                   rather than empty — and it is the one element on the rail
                   allowed to shrink, capped on a phone so the row cannot overflow
                   sideways. */
                <Link
                  href="/"
                  className="flex min-h-[var(--layout-touch-target)] min-w-0 items-center"
                >
                  <Image
                    src="/logo.png"
                    alt="Alpha AI Color Lab"
                    width={1780}
                    height={499}
                    priority
                    unoptimized
                    className="h-9 w-auto max-w-[42vw] object-contain object-left sm:max-w-none"
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
                className={`${ICON_BUTTON} ${
                  isEcosystemOpen ? 'surface-selected text-ink' : ICON_BUTTON_IDLE
                }`}
              >
                {/* 4-Square Grid SVG Icon (2x2 squares) */}
                <svg
                  className="w-5 h-5"
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
            {/* 300px at rest, 520px while searching — the field growing is what
                tells the reader the bar has changed mode, and the wordmark and
                the console give up the width for it. */}
            <div
              className={`${
                isSearchOpen ? 'flex sm:max-w-[520px]' : 'hidden sm:flex sm:max-w-[300px]'
              } flex-1 min-w-0 mx-auto items-center transition-all duration-300`}
            >
              {!isSearchOpen ? (
                /* Compact Trigger Button */
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  aria-expanded="false"
                  aria-label={t('label')}
                  className="surface-sunken w-full min-h-[var(--layout-touch-target)] flex items-center justify-between gap-3 px-4 text-body text-ink-faint hover:text-ink-muted transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 truncate">
                    {isWiki ? (
                      <span className="text-label font-semibold text-accent-400 shrink-0">WIKI</span>
                    ) : (
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4 shrink-0"
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
                        <strong className="font-semibold text-ink">&quot;{query}&quot;</strong>
                      ) : (
                        isWiki ? t('wikiPlaceholder') : t('placeholder')
                      )}
                    </span>

                    {/* Active Filter Badges in Compact Bar (ColorLab mode) */}
                    {!isWiki && currentFormat && (
                      <span className="chip shrink-0">
                        {currentFormat === 'pp'
                          ? 'PP'
                          : currentLook
                          ? `CL:${currentLook}`
                          : 'CL'}
                      </span>
                    )}
                    {!isWiki && currentTag && (
                      <span className="chip shrink-0 truncate max-w-[6rem]">#{currentTag}</span>
                    )}
                  </span>

                  <span className="hidden sm:inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-sm bg-white/[0.08] text-label font-semibold text-ink-faint shadow-[var(--elevation-spec)]">
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
                  className="relative flex min-h-[var(--layout-touch-target)] items-center w-full animate-fade-in"
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
                      <span className="absolute left-4 text-label font-semibold text-accent-400 shrink-0 pointer-events-none select-none">
                        WIKI
                      </span>
                    ) : (
                      <svg
                        aria-hidden="true"
                        className="absolute left-4 w-4 h-4 text-ink-faint pointer-events-none"
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
                      /* No `focus:outline-none` and no focus ring of its own:
                         the sunken field is already the affordance, and the one
                         sanctioned stroke in the system is the global
                         `:focus-visible` outline, which that utility would have
                         removed for keyboard users. */
                      className={`surface-sunken w-full min-h-[var(--layout-touch-target)] text-body text-ink placeholder:text-ink-faint [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none ${
                        isWiki ? 'pl-16 pr-12' : 'pl-11 pr-12'
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
                      className="absolute right-2 p-2 rounded-sm text-ink-faint hover:text-ink transition-colors cursor-pointer"
                    >
                      <span aria-hidden className="text-body">
                        ✕
                      </span>
                    </button>

                    {/* Live Predictive Search Auto-complete Popup */}
                    {isPredictiveOpen && query.trim().length > 0 && (
                      /* Positioning, clipping and the opaque backing on this
                         plain wrapper; the elevation on the panel inside it.
                         `.surface-raised` is unlayered CSS, so a `absolute`
                         alongside it is the bug that stretched this bar once
                         already — and a surface is translucent by construction,
                         so `bg-void/95` on it would do nothing and the
                         suggestions would sit over the photograph behind. */
                      <div className="absolute left-0 right-0 top-full mt-2 z-[9999] overflow-hidden rounded-lg bg-void/95 animate-fade-in">
                        <div className="surface-raised">
                        {isPredictiveLoading && predictiveResults.length === 0 ? (
                          <div className="p-4 text-body-sm text-ink-muted">
                            <span>{locale === 'vi' ? 'Đang tìm gợi ý phù hợp…' : 'Finding instant matches…'}</span>
                          </div>
                        ) : predictiveResults.length > 0 ? (
                          <div className="p-2 flex flex-col gap-1">
                            <div className="label flex items-center justify-between gap-2 px-3 py-1.5">
                              <span>{isWiki ? (locale === 'vi' ? 'Sản Phẩm Khớp Nhanh' : 'Matching Products') : (locale === 'vi' ? 'Công Thức Khớp Nhanh' : 'Matching Recipes')}</span>
                              <span className="text-accent-400 tabular-nums">{predictiveResults.length} {locale === 'vi' ? 'gợi ý' : 'matches'}</span>
                            </div>

                            {predictiveResults.map((item, idx) => (
                              <Link
                                key={item.id}
                                href={item.url}
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  setIsPredictiveOpen(false);
                                }}
                                className={`flex items-center gap-3 p-2 rounded-sm transition-colors ${
                                  selectedIndex === idx
                                    ? 'surface-selected text-ink'
                                    : 'text-ink-muted hover:bg-white/[0.06] hover:text-ink'
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
                                    className="w-9 h-9 rounded-sm object-cover bg-sunken shrink-0"
                                  />
                                ) : (
                                  /* The recipe's own accent stands in for the
                                     photograph it has none of. `◫` is the
                                     ecosystem's no-photo mark, the same one the
                                     wiki grid draws. */
                                  <div
                                    className="w-9 h-9 rounded-sm flex items-center justify-center shrink-0 text-body-lg text-void/50"
                                    /* Dark ink on this chip is correct, but only
                                       because the ground is always light:
                                       `--accent` is documented to resolve at or
                                       above the ramp's 400 lightness. The
                                       fallback used to be white 8% — which over
                                       the void is nearly black, so a recipe with
                                       no computed accent drew a near-black mark
                                       on a near-black chip. It falls back to the
                                       ramp step the contract names instead. */
                                    style={{
                                      backgroundColor:
                                        item.accentHex || 'var(--color-accent-400)',
                                    }}
                                    aria-hidden
                                  >
                                    ◫
                                  </div>
                                )}

                                <div className="flex-1 min-w-0 flex flex-col justify-center leading-snug">
                                  <div className="flex items-center gap-2">
                                    <span className="text-body-sm font-semibold text-ink truncate">
                                      {item.title}
                                    </span>
                                    {item.badge && <span className="chip shrink-0">{item.badge}</span>}
                                  </div>
                                  <span className="meta truncate mt-0.5">{item.subtitle}</span>
                                </div>

                                {item.price && (
                                  <span className="text-body-sm font-semibold text-accent-400 tabular-nums shrink-0 ml-auto">
                                    {item.price}
                                  </span>
                                )}
                              </Link>
                            ))}

                            <button
                              type="button"
                              onClick={handleSubmit}
                              className="w-full text-center min-h-[var(--layout-touch-target)] px-3 rounded-sm text-body-sm font-semibold text-accent-400 cursor-pointer"
                            >
                              {locale === 'vi'
                                ? `Nhấn Enter để xem tất cả kết quả cho "${query}" →`
                                : `Press Enter to view all results for "${query}" →`}
                            </button>
                          </div>
                        ) : (
                          <div className="p-4 text-center text-body-sm text-ink-muted">
                            {locale === 'vi'
                              ? `Không có gợi ý khớp ngay lập tức. Nhấn Enter để tìm kiếm sâu.`
                              : `No instant matches. Press Enter for deep search.`}
                          </div>
                        )}
                        </div>
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
                className={`sm:hidden ${ICON_BUTTON} ${ICON_BUTTON_IDLE}`}
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
                    aria-label={user.name}
                    /* A 40px disc, and the accent gradient under the photograph
                       is what it falls back to — the name that used to ride
                       beside it reserved up to 64px in a row with none to spare,
                       and it is the first line of the menu this opens. */
                    className="h-10 w-10 shrink-0 overflow-hidden rounded-full cursor-pointer bg-[linear-gradient(160deg,var(--color-accent-400),var(--color-accent-600))] shadow-[0_6px_16px_-6px_color-mix(in_oklch,var(--color-accent-500)_60%,transparent),var(--elevation-spec)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- user avatar */}
                    <img
                      src={user.avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      /* A dead avatar URL uncovers the accent disc underneath.
                         It used to swap in a generated one from an external
                         avatar service, which put a third-party request and a
                         colour from outside the ramp on the critical path for
                         a 40px circle. */
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="h-full w-full object-cover"
                    />
                  </button>

                  {isProfileOpen && (
                    /* The positioning lives on this wrapper and the elevation on
                       the panel inside it, because the two cannot share an
                       element. A surface class is unlayered CSS and therefore
                       beats Tailwind's layered utilities, so the panel this
                       replaces — which carried both the deleted surface
                       primitive and `absolute` — computed to
                       `position: relative`, stayed in normal flow and stretched
                       the header from 82px to 188px, the bar visibly growing
                       instead of a menu opening over the page.

                       The opaque backing is here for the same reason: a surface
                       is translucent by construction, so `bg-void/95` on the
                       panel itself was dead and the recipe photograph behind
                       showed straight through the email address. Painted
                       underneath, the translucent film still sits on top of it
                       and still reads as a floating layer.

                       `mt-1`, not `mt-2`: the menu is anchored under the avatar
                       and its top edge lands *inside* the bar's bottom padding,
                       so it visibly overlaps the bar. That overlap is what ties
                       it to the control that opened it, now that there is no
                       rule along that edge for it to cross. */
                    <div className="absolute right-0 top-full mt-1 w-[17rem] max-w-[calc(100vw-2rem)] z-50 overflow-hidden rounded-lg bg-void/95">
                      <div role="menu" className="surface-raised p-2 flex flex-col gap-1 animate-fade-in">
                        <div className="px-3 py-2 flex flex-col gap-0.5 min-w-0">
                          <p className="text-body-sm font-semibold text-ink truncate">{user.name}</p>
                          <p className="meta truncate">{user.email}</p>
                        </div>
                        <hr className="seam shrink-0" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsProfileOpen(false);
                            void logout();
                          }}
                          className="w-full min-h-[var(--layout-touch-target)] px-3 rounded-sm text-left text-body font-semibold text-danger hover:bg-danger/10 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <span>{tAuth('signOut')}</span>
                          <span aria-hidden className="text-ink-faint">↪</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  /* Opens the login sheet; it is the sheet's button that calls
                     `loginWithGoogle()`.

                     This used to call `loginWithGoogle()` straight from here,
                     which redirected to Google with no interstitial — and, worse,
                     had nowhere to report a failure. `loginWithGoogle` records
                     `errNotConfigured` / `errOpenFailed` in the auth context, and
                     that error is rendered ONLY inside the modal. Called from the
                     header, a failed sign-in set an error string nobody could
                     see and the page simply sat there. The rest of the app
                     already routes through `openLoginModal()` — the community
                     section and the recipe gallery both do — so this is also the
                     consistent path. */
                  onClick={() => openLoginModal()}
                  aria-label={tAuth('signInGoogle')}
                  title={tAuth('signInGoogle')}
                  /* A glass action, not a white pill: `bg-white text-black`
                     was dark type on a light field in a dark-only system.

                     The mark stays. It is Google's trademark and their sign-in
                     branding guidelines require it on a button that starts the
                     Google flow. What was wrong here was the DUPLICATE: a second
                     copy of the same four brand hexes inlined in this file. It is
                     imported from auth-context now, so the mark has one
                     definition and the hex grep has one exemption. */
                  className="btn-glass shrink-0 cursor-pointer gap-2"
                >
                  <GoogleMark className="w-4 h-4 shrink-0" />
                  {/* The full label plus the flag toggle plus the wordmark came
                      to 400px of content in a 311px row at 375px wide, and the
                      row is `flex-nowrap`, so it overflowed the page sideways
                      instead of wrapping. `aria-label` above names it either
                      way. */}
                  <span aria-hidden className="hidden md:inline whitespace-nowrap">
                    {tAuth('signInGoogle')}
                  </span>
                  <span aria-hidden className="md:hidden whitespace-nowrap">
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
                ? 'grid-rows-[1fr] opacity-100 mt-3'
                : 'grid-rows-[0fr] opacity-0 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden flex flex-col gap-3 text-body-sm">
              {/* The console genuinely is a second block under the control rail,
                  so it gets the one divider the system allows: light that fades
                  out at both ends, never a rule. It lives inside the collapsing
                  row so it disappears with the console. */}
              <hr className="seam shrink-0" />
              {isWiki ? (
                /* Sony Wiki Controls */
                <div className="flex flex-col gap-3">
                  {/* Row 1: Category Tabs & View Switcher */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {/* `.filter-scroll` is the fallback this rail was written
                        for: a wrapping chip list above 48rem, one silently
                        scrolling row below it, rather than three rows of chips
                        pushing the catalogue off a phone screen. */}
                    <div className="filter-scroll flex flex-wrap items-center gap-2 min-w-0">
                      {/* Every product on `/audio` is one category, so tabs
                          keyed on `cat` would be one live tab and three empty
                          ones. There they select `sub1` — Tai nghe or Loa —
                          which is the split a reader of that page is after. */}
                      {(isAudioWiki
                        ? [
                            { key: 'all', label: tCameras('catAll') },
                            { key: 'Tai nghe', label: 'Tai nghe' },
                            { key: 'Loa', label: 'Loa' },
                          ]
                        : [
                            { key: 'all', label: tCameras('catAll') },
                            { key: 'camera', label: tCameras('catCamera') },
                            { key: 'lens', label: tCameras('catLens') },
                            { key: 'accessory', label: tCameras('catAccessory') },
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
                          className={
                            (isAudioWiki ? wikiSub1 : wikiCat) === cat.key ? CHIP_SELECTED : CHIP_IDLE
                          }
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* View Mode Switcher — a segmented control, so the rut is
                        pressed in and the live option is a fill. */}
                    <div className="surface-sunken flex items-center gap-1 p-1 ml-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => updateWikiFilters({ view: 'table' })}
                        title={tCameras('viewTable')}
                        className={`px-3 min-h-10 rounded-sm text-body-sm font-semibold transition-colors cursor-pointer ${
                          wikiView === 'table' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        {tCameras('viewTable')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateWikiFilters({ view: 'grid' })}
                        title={tCameras('viewGrid')}
                        className={`px-3 min-h-10 rounded-sm text-body-sm font-semibold transition-colors cursor-pointer ${
                          wikiView === 'grid' ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        {tCameras('viewGrid')}
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Sub-category Dropdowns & Sort */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* `sub1` already has tabs on the audio route, so only
                          the `sub2` dropdown shows there. */}
                      {!isAudioWiki && (
                      <select
                        value={wikiSub1}
                        onChange={(e) => updateWikiFilters({ sub1: e.target.value, sub2: 'all' })}
                        className={WIKI_SELECT}
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
                        className={WIKI_SELECT}
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
                      <span className="label hidden sm:inline">{tCameras('sortBy')}</span>
                      <select
                        value={wikiSort}
                        onChange={(e) => updateWikiFilters({ sort: e.target.value })}
                        className={WIKI_SELECT}
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
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleResetAll}
                        className="text-body-sm font-semibold text-accent-400 transition-colors cursor-pointer underline underline-offset-2"
                      >
                        {t('clearAll')}
                      </button>
                      <span className="meta hidden sm:inline">{t('escHint')}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* ColorLab Recipe Controls */
                <>
                  {/* Every chip in these three rows used to be black type on a
                      white pill when live, and a dimmed white on the deleted
                      flat-surface primitive when not — dark on light in a
                      dark-only interface, forced past the cascade with
                      `!important` because that primitive was unlayered and
                      outranked the colour utility. Both halves are gone: the
                      live state is an accent-tinted FILL and the idle one is the
                      system's own chip. */}

                  {/* Row 1: Format Filters */}
                  <div className="flex items-start gap-3">
                    <span className="label w-14 shrink-0 leading-11">Format</span>

                    <div className="filter-scroll flex flex-wrap items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => updateFilters({ format: '', look: '' })}
                        aria-current={!currentFormat ? 'true' : undefined}
                        className={!currentFormat ? CHIP_SELECTED : CHIP_IDLE}
                      >
                        All
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateFilters({ format: currentFormat === 'pp' ? '' : 'pp', look: '' })
                        }
                        aria-current={currentFormat === 'pp' ? 'true' : undefined}
                        className={currentFormat === 'pp' ? CHIP_SELECTED : CHIP_IDLE}
                      >
                        Picture Profile
                      </button>

                      <button
                        type="button"
                        onClick={() => updateFilters({ format: currentFormat === 'cl' ? '' : 'cl' })}
                        aria-current={currentFormat === 'cl' ? 'true' : undefined}
                        className={currentFormat === 'cl' ? CHIP_SELECTED : CHIP_IDLE}
                      >
                        Creative Look
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Creative Look Sub-Filters (only visible when format=cl) */}
                  {currentFormat === 'cl' && (
                    <div className="flex items-start gap-3">
                      <span className="label w-14 shrink-0 leading-11">Look</span>

                      <div className="filter-scroll flex flex-wrap items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => updateFilters({ look: '' })}
                          aria-current={!currentLook ? 'true' : undefined}
                          className={!currentLook ? CHIP_SELECTED : CHIP_IDLE}
                        >
                          All
                        </button>

                        {CREATIVE_LOOKS.map((l) => (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => updateFilters({ look: currentLook === l.code ? '' : l.code })}
                            aria-current={currentLook === l.code ? 'true' : undefined}
                            className={currentLook === l.code ? CHIP_SELECTED : CHIP_IDLE}
                          >
                            {l.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row 3: Tag Chips Bar */}
                  <div className="flex items-start gap-3">
                    <span className="label w-14 shrink-0 leading-11">Tags</span>

                    <div className="filter-scroll flex flex-wrap items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => updateFilters({ tag: '' })}
                        aria-current={!currentTag ? 'true' : undefined}
                        className={!currentTag ? CHIP_SELECTED : CHIP_IDLE}
                      >
                        All
                      </button>

                      {tagList.map((item) => (
                        <button
                          key={item.tag}
                          type="button"
                          onClick={() => updateFilters({ tag: currentTag === item.tag ? '' : item.tag })}
                          aria-current={currentTag === item.tag ? 'true' : undefined}
                          className={currentTag === item.tag ? CHIP_SELECTED : CHIP_IDLE}
                        >
                          {item.tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Footer row: Clear all filters & Shortcut hint */}
                  {hasActiveFilters && (
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleResetAll}
                        className="text-body-sm font-semibold text-accent-400 transition-colors cursor-pointer underline underline-offset-2"
                      >
                        {t('clearAll')}
                      </button>
                      <span className="meta hidden sm:inline">{t('escHint')}</span>
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
        {/* Backdrop. The ground at 80%, not 60%: at 60% the recipe photographs
            behind still came through the blur as legible shapes and competed
            with the icons for attention. A launcher has to feel like a layer
            over the page, not a filter on it. */}
        <div className="absolute inset-0 bg-void/80 [backdrop-filter:var(--elevation-blur-strong)] [-webkit-backdrop-filter:var(--elevation-blur-strong)] transition-opacity duration-300" />

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
          className="relative z-[99999] h-full w-full scroll-area scroll-silent"
          onClick={(e) => {
            // Closing on a click outside the tiles, which is what the backdrop
            // did before this layer covered it. The layer has to stay
            // hit-testable — `pointer-events-none` would hand the wheel to the
            // page underneath and the launcher would not scroll at all.
            //
            // Tested against the launcher's own node, never a class name: the
            // previous `closest('.app-enter')` went on compiling and passing
            // every test after the class it named was deleted, and silently
            // swallowed every click on a tile. See `launcherRef`.
            if (!launcherRef.current?.contains(e.target as Node)) {
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
            <div ref={launcherRef}>
              <LauncherGrid size="md" onNavigate={() => setIsEcosystemOpen(false)} />
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
      /* The placeholder is the same bar as the real one — same film, same 40px
         blur, same shadow and no bottom rule — so hydration does not swap one
         header treatment for another. The wordmark was set in an italic serif
         here, the only second family left in the app. */
      fallback={
        <header className={`sticky top-0 z-40 w-full ${HEADER_BAR}`}>
          <div className="mx-auto flex max-w-[160rem] items-center justify-between px-3 py-2 sm:px-6 sm:py-3">
            <div className="flex min-h-[var(--layout-touch-target)] items-center gap-1.5">
              <span aria-hidden className="text-title-3 leading-none text-accent-400">
                α
              </span>
              <span className="whitespace-nowrap text-body-lg font-extrabold tracking-[-0.02em] text-ink">
                ColorLab
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
