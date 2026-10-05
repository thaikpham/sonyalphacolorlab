'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

type Shelf = 'articles' | 'learn';

const SHELVES: ReadonlyArray<{ key: Shelf; href: string; icon: ReactNode }> = [
  {
    key: 'articles',
    href: '/blog',
    icon: (
      <>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M8 13h8M8 17h5" />
      </>
    ),
  },
  {
    key: 'learn',
    href: '/learn',
    icon: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
        <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
      </>
    ),
  },
];

/**
 * Articles / Learn — the blog's two shelves, side by side on the header rail.
 *
 * `/learn` is the blog's reference shelf (ADR 0001): same app, same wordmark,
 * same paper room. It earned a place in navigation once it held a complete
 * group (the glossary) and no empty page — the brief's rule — and the owner
 * confirmed it on 2026-10-05.
 *
 * The same control as `WikiDivisionSwitch`, for the same reasons, and read
 * that component for them: links rather than buttons, so each shelf survives a
 * middle-click and a shared URL; 44px overall; mounted from `sm` up only,
 * because the phone rail is already full to the pixel. Below `sm` the feed's
 * own heading carries the Learn link, and every `/learn` page's breadcrumb and
 * wordmark lead back to the feed.
 *
 * Icons alone below `lg`. "Articles" and "Learn" are three times the width of
 * DI and PE, and between `sm` and `lg` that width came out of the wordmark,
 * which truncated to "ALPHA". The names stay in `aria-label` and `title`.
 */
export function BlogShelfSwitch({ pathname, className = '' }: { pathname: string; className?: string }) {
  const t = useTranslations('nav');
  const current: Shelf = pathname === '/learn' || pathname.startsWith('/learn/') ? 'learn' : 'articles';

  return (
    <div className={`surface-sunken shrink-0 items-center gap-1 p-0.5 ${className}`}>
      {SHELVES.map((shelf) => {
        const isCurrent = shelf.key === current;
        return (
          <Link
            key={shelf.key}
            href={shelf.href}
            title={t(shelf.key)}
            aria-label={t(shelf.key)}
            aria-current={isCurrent ? 'page' : undefined}
            className={`flex min-h-10 items-center gap-1.5 rounded-sm px-2.5 text-body-sm font-semibold transition-colors sm:px-3 ${
              isCurrent ? 'surface-selected text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {shelf.icon}
            </svg>
            <span className="hidden lg:inline">{t(shelf.key)}</span>
          </Link>
        );
      })}
    </div>
  );
}
