import { readFileSync } from 'node:fs';
import { createElement, type ComponentProps, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import en from '../../messages/en.json';
import vi_ from '../../messages/vi.json';
import type { CameraCard } from '@/lib/cameras/types';

/**
 * Render tests for the catalogue grid.
 *
 * No DOM, so nothing here clicks: the URL is the grid's state, so each test
 * sets `useSearchParams` and checks what that URL renders. What only an
 * interaction reaches — the confirm sheet, a sixth pick — is pinned in the
 * source, sliced per handler, at the bottom.
 *
 * Plain `.ts` with `createElement`: the vitest include pattern is
 * `src/**\/*.test.ts`, and a `.test.tsx` here would silently never run.
 */

const url = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock('next/navigation', () => ({ useSearchParams: () => url.params }));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement('a', { href, ...rest }, children),
}));

const { CameraWikiView } = await import('./camera-wiki-view');

const card = (id: string, over: Partial<CameraCard> = {}): CameraCard => ({
  id,
  sku: id.toUpperCase(),
  name: id,
  fullName: id,
  category: 'camera',
  subCategory1: 'Full Frame',
  subCategory2: 'Máy ảnh Alpha',
  priceVnd: 1_000_000,
  priceFormatted: '1.000.000 đ',
  url: '',
  imageUrl: '',
  features: [],
  specChips: [],
  ...over,
});

const CATALOGUE = [
  card('a7iv'),
  card('a6700', { subCategory1: 'APS-C' }),
  card('ecm', { category: 'accessory', subCategory1: 'Audio', subCategory2: 'Microphone' }),
];

const render = (query: string, locale: 'en' | 'vi' = 'en', cams = CATALOGUE, basePath?: string) => {
  url.params = new URLSearchParams(query);
  const intl: ComponentProps<typeof NextIntlClientProvider> = {
    locale,
    messages: locale === 'en' ? en : vi_,
    timeZone: 'Asia/Ho_Chi_Minh',
    children: null,
  };
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, intl, createElement(CameraWikiView, { initialCameras: cams, basePath })),
  );
};

/** The label row above the h1. */
const trailOf = (html: string) => html.match(/<span class="label flex flex-wrap[^"]*">(.*?)<\/span><h1/)?.[1] ?? '';
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the trail above the title', () => {
  it('reads sub-categories in the reader locale, as the chips do', () => {
    const trail = text(trailOf(render('cat=camera&sub2=Máy ảnh Alpha')));
    expect(trail).toContain('Alpha cameras');
    expect(trail).not.toContain('Máy ảnh Alpha');
  });

  it('normalises the spelling of a technical name', () => {
    const trail = text(trailOf(render('cat=camera&sub1=Full Frame')));
    expect(trail).toContain('Full-Frame');
    expect(trail).not.toContain('Full Frame');
  });
});

describe('the facet rail', () => {
  it('orders chips by the page locale, not the runtime default', () => {
    /* `Audio` reads "Âm thanh" on /vi. Root collation sorts it before APS-C;
       Vietnamese treats Â as its own letter after A, and sorts it after. */
    const html = render('', 'vi');
    const at = (label: string) => html.indexOf(`>${label}</button>`);
    expect(at('APS-C')).toBeGreaterThan(-1);
    expect(at('Âm thanh')).toBeGreaterThan(-1);
    const viFirst = new Intl.Collator('vi').compare('APS-C', 'Âm thanh') < 0;
    expect(at('APS-C') < at('Âm thanh')).toBe(viFirst);
  });
});

describe('the card compare toggle', () => {
  it('names the product it adds, and shows keyboard focus on its visible label', () => {
    const html = render('');
    expect(html).toContain(`aria-label="${en.cameras.compareProduct.replace('{name}', 'a7iv')}"`);
    const label = html.match(/<label class="([^"]*)"><input type="checkbox"/)?.[1] ?? '';
    expect(label).toContain('has-[:focus-visible]:outline-2');
    expect(label).toContain('has-[:focus-visible]:outline-accent-400');
  });
});

describe('the table view', () => {
  it('opens each product through a link a keyboard can reach', () => {
    const html = render('view=table');
    for (const c of CATALOGUE) expect(html).toContain(`href="/cameras/${c.id}"`);
  });

  it('opens audio under its own route', () => {
    const html = render('view=table', 'en', [card('xm6', { category: 'audio', subCategory1: 'Tai nghe' })], '/audio');
    expect(html).toContain('href="/audio/xm6"');
  });

  it('gives the compare checkbox a 44px target', () => {
    const html = render('view=table');
    const cell = html.match(/<label class="([^"]*)"><input type="checkbox"[^>]*aria-label="a7iv"/)?.[1] ?? '';
    expect(cell).toContain('min-h-[var(--layout-touch-target)]');
    expect(cell).toContain('min-w-[var(--layout-touch-target)]');
  });
});

/* What only a click reaches, pinned per handler. */
describe('wiring the interactions reach', () => {
  const source = readFileSync('src/components/camera-wiki-view.tsx', 'utf8');
  const sheet = source.slice(source.indexOf('{isConfirmModalOpen && ('), source.indexOf('export function CameraWikiView('));

  it('keeps sort and view when clearing search and filters', () => {
    expect(source).not.toContain('router.push(basePath, { scroll: false })');
    expect(source.match(/onClick=\{clearFilters\}/g)).toHaveLength(2);
    const clear = source.slice(source.indexOf('const clearFilters'), source.indexOf('const clearFilters') + 200);
    expect(clear).toContain("updateWikiParam({ cat: 'all', sub1: 'all', sub2: 'all', q: '' })");
  });

  it('refuses a seventh pick visibly and says the limit', () => {
    expect(source).toContain('const atCompareLimit = selectedForCompare.length >= MAX_COMPARE');
    expect(source.match(/disabled=\{!isChecked && atCompareLimit\}/g)).toHaveLength(2);
    expect(source).toMatch(/\{atCompareLimit && \(\s*<span[^>]*>\{t\('maxCompareHint'\)\}<\/span>/);
  });

  it('names the confirm sheet and its controls, and closes it on Escape', () => {
    expect(sheet).toContain('aria-labelledby="compare-confirm-title"');
    expect(sheet).toContain('id="compare-confirm-title"');
    expect(sheet).toMatch(/onKeyDown=\{\(e\) => \{\s*if \(e\.key === 'Escape'\) setIsConfirmModalOpen\(false\);/);
    expect(sheet).toContain("aria-label={t('closeDialog')}");
    expect(sheet).toContain("aria-label={t('removeProduct')}");
    expect(sheet).toContain('autoFocus');
  });

  it('opens a product from the sheet through links, not click-only elements', () => {
    expect(sheet).not.toMatch(/<(div|h3)\s+onClick=\{\(\) => openProduct/);
    expect(sheet.match(/<Link\s+href=\{productHref\(cam\)\}/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it('gives the sheet remove button a 44px target', () => {
    expect(sheet).not.toContain('w-6 h-6');
    const remove = sheet.slice(sheet.indexOf('onClick={() => removeFromSheet(cam.id)}'));
    expect(remove.slice(0, 400)).toContain('min-h-[var(--layout-touch-target)]');
  });

  it('closes the sheet when its last product is removed', () => {
    const remove = source.slice(source.indexOf('const removeFromSheet'), source.indexOf('const removeFromSheet') + 300);
    expect(remove).toMatch(/if \(selectedForCompare\.length <= 1\) setIsConfirmModalOpen\(false\)/);
  });
});
