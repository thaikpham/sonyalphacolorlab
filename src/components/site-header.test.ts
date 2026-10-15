import { readFileSync } from 'node:fs';
import { createElement, type ComponentProps, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../messages/en.json';
import vi_ from '../../messages/vi.json';

/**
 * Render tests for the header, plus source assertions for the handlers.
 *
 * This suite has no DOM, so nothing here types or clicks. What can be asserted
 * is the markup each URL renders — the hidden inputs a no-JS search carries,
 * the copy each locale reads — and, for the parts that only exist as event
 * handlers, the shape of the handler, sliced out of the source the way
 * `recipe-gallery.test.ts` does it.
 *
 * `next/navigation` and `@/i18n/navigation` are stand-ins: next-intl's
 * `createNavigation` imports `next/navigation` without an extension, which
 * Node's resolver refuses outside a Next build. The `Link` stand-in prefixes
 * the locale the way `localePrefix: 'as-needed'` does, so an href asserted
 * here is the href a reader would get.
 */

const nav = { pathname: '/colorlab', search: '', locale: 'en' as 'en' | 'vi' };
const auth: { user: { name: string; email: string; avatarUrl: string } | null; isReady: boolean } = {
  user: null,
  isReady: true,
};

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useParams: () => ({ locale: nav.locale }),
}));

vi.mock('@/i18n/navigation', async () => {
  const { createElement: h } = await import('react');
  type Href = string | { pathname: string; query?: Record<string, string> };
  const hrefOf = (href: Href, locale?: string) => {
    const path =
      typeof href === 'string'
        ? href
        : href.pathname +
          (href.query && Object.keys(href.query).length > 0
            ? `?${new URLSearchParams(href.query)}`
            : '');
    const active = locale ?? nav.locale;
    return active === 'en' ? path : `/${active}${path === '/' ? '' : path}`;
  };
  return {
    usePathname: () => nav.pathname,
    useRouter: () => ({ push: () => {} }),
    Link: ({ href, locale, children, ...rest }: { href: Href; locale?: string; children?: ReactNode }) =>
      h('a', { href: hrefOf(href, locale), ...rest }, children),
  };
});

vi.mock('./auth-context', () => ({
  useAuth: () => ({ ...auth, openLoginModal: () => {}, logout: async () => {} }),
  GoogleMark: () => null,
}));

const { SiteHeader, wikiSearch } = await import('./site-header');

const source = readFileSync('src/components/site-header.tsx', 'utf8');
/** One handler's body, from its declaration to the next one's. */
const slice = (from: string, to: string) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  expect(start, `${from} is missing`).toBeGreaterThan(-1);
  expect(end, `${to} is missing after ${from}`).toBeGreaterThan(start);
  return source.slice(start, end);
};

function render(at: string, locale: 'en' | 'vi' = 'en') {
  const [pathname, search = ''] = at.split('?');
  nav.pathname = pathname;
  nav.search = search;
  nav.locale = locale;
  const intl: ComponentProps<typeof NextIntlClientProvider> = {
    locale,
    messages: locale === 'en' ? en : vi_,
    timeZone: 'Asia/Ho_Chi_Minh',
    children: null,
  };
  return renderToStaticMarkup(createElement(NextIntlClientProvider, intl, createElement(SiteHeader)));
}

/** `name=value` for every hidden input in the markup. */
const hiddenInputs = (html: string) =>
  [...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/g)].map(
    ([, name, value]) => `${name}=${value}`,
  );

beforeEach(() => {
  auth.user = null;
  auth.isReady = true;
});

describe('the wiki search keeps the reader’s filters', () => {
  it('merges a new query into the category, sort and view already in the URL', () => {
    expect(wikiSearch(new URLSearchParams('cat=lens&view=table'), { q: 'gm' })).toBe(
      'q=gm&cat=lens&view=table',
    );
    expect(
      wikiSearch(new URLSearchParams('cat=lens&sub2=GM&sort=price-desc&view=table&q=old'), { q: '85' }),
    ).toBe('q=85&cat=lens&sub2=GM&sort=price-desc&view=table');
  });

  it('drops a cleared query and every default, never the other filters', () => {
    expect(wikiSearch(new URLSearchParams('q=a7&cat=camera'), { q: '' })).toBe('cat=camera');
    expect(
      wikiSearch(new URLSearchParams('cat=all&sub1=all&sub2=all&sort=price-asc&view=grid'), {}),
    ).toBe('');
  });

  it('routes the search box through the same merge as the filter controls', () => {
    /* Typing, Enter and the clear button all go through `updateFilters`. Its
       wiki branch used to rebuild the URL from `q` alone. */
    const updateFilters = slice('const updateFilters = useCallback(', 'const searchTimer');
    const wikiBranch = updateFilters.slice(updateFilters.indexOf('if (isWiki)'));
    expect(wikiBranch).toMatch(/^if \(isWiki\) \{\s*updateWikiFilters\(\{ q: newQ \}\);\s*return;/);
  });

  it('carries non-default wiki filters through a no-JS search as hidden inputs', () => {
    const html = render('/cameras?q=a&cat=lens&sub2=GM&sort=price-desc&view=table');
    expect(hiddenInputs(html)).toEqual(['cat=lens', 'sub2=GM', 'sort=price-desc', 'view=table']);
  });

  it('carries no hidden input for a filter at its default', () => {
    const html = render('/cameras?q=a&cat=all&sort=price-asc&view=grid');
    expect(hiddenInputs(html)).toEqual([]);
  });

  it('still carries the ColorLab filters', () => {
    const html = render('/colorlab?q=a&format=cl&look=FL&tag=portrait');
    expect(hiddenInputs(html)).toEqual(['format=cl', 'look=FL', 'tag=portrait']);
  });
});

/** The text of every `<button>` in the markup, tags stripped. */
const buttonTexts = (html: string) =>
  [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(([, inner]) =>
    inner.replace(/<[^>]+>/g, '').trim(),
  );

describe('the filter console reads in the reader’s language', () => {
  it('names the audio tabs through the catalogue, not the stored value', () => {
    /* The key stays `Tai nghe` / `Loa` — it is the filter value the route and
       the catalogue share. Only the label was raw, so /en read Vietnamese. */
    const tabs = buttonTexts(render('/audio'));
    expect(tabs).toContain(en.cameras.sub.headphones);
    expect(tabs).toContain(en.cameras.sub.speakers);
    expect(tabs).not.toContain('Tai nghe');
    expect(tabs).not.toContain('Loa');
  });

  it('labels the ColorLab rows and reset chips from the catalogue', () => {
    const html = render('/colorlab?format=cl', 'vi');
    const text = html.replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim());
    for (const literal of ['Format', 'Tags', 'All']) {
      expect(text, `"${literal}" renders untranslated on /vi`).not.toContain(literal);
    }
    expect(text).toContain(vi_.search.filterFormat);
    expect(text).toContain(vi_.search.filterTags);
    expect(text.filter((s) => s === vi_.search.filterAll)).toHaveLength(3);
  });
});

describe('live search stays where the reader is', () => {
  it('filters in place only on a catalogue index', () => {
    /* On /recipe/<slug> the 250ms push went to /colorlab?q=…, and on
       /cameras/compare to /cameras?q=…: a pause after "moj" unmounted the page
       the reader was on, and threw away a comparison. */
    expect(source).toMatch(
      /const isCatalogueIndex = pathname === '\/colorlab' \|\| pathname === wikiBase;/,
    );
    const queueSearch = slice('const queueSearch', 'useEffect(() => () =>');
    expect(queueSearch).toMatch(
      /if \(isAll \|\| !isCatalogueIndex\) return;\s*\n\s*searchTimer\.current = setTimeout/,
    );
  });

  it('does not navigate when the box is cleared away from an index', () => {
    const handleClearQuery = slice('const handleClearQuery', 'const handleResetAll');
    expect(handleClearQuery).toMatch(/if \(!isAll && isCatalogueIndex\) updateFilters\(\{ q: '' \}\);/);
  });

  it('keeps the suggestions open when the URL catches up with its own push', () => {
    /* The debounced push changes `q`, and the URL sync used to close the
       dropdown on every change — so after each pause the suggestions vanished
       and ArrowDown had nothing to move through. */
    const queueSearch = slice('const queueSearch', 'useEffect(() => () =>');
    expect(queueSearch).toMatch(/setLivePushedQ\(value\.trim\(\)\);\s*updateFilters\(\{ q: value \}\);/);

    const sync = slice('if (syncedQ !== currentQ) {', '// Handle scroll auto-hide behavior');
    const own = sync.indexOf('if (currentQ === livePushedQ)');
    expect(own).toBeGreaterThan(-1);
    const otherwise = sync.indexOf('} else {', own);
    expect(otherwise).toBeGreaterThan(own);
    expect(sync.indexOf('setIsPredictiveOpen(false)'), 'closes on its own push').toBeGreaterThan(otherwise);
    expect(sync.indexOf('setQuery(currentQ)'), 'resets the box to its own push').toBeGreaterThan(otherwise);
  });

  it('closes the suggestions on an explicit submit', () => {
    const handleSubmit = slice('const handleSubmit', 'const handleClearQuery');
    expect(handleSubmit).toContain('setIsPredictiveOpen(false)');
    expect(handleSubmit).toContain('setLivePushedQ(null)');
  });
});
