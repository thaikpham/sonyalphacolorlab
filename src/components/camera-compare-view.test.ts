import { readFileSync } from 'node:fs';
import { createElement, type ComponentProps, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import en from '../../messages/en.json';
import type { CameraSpecs, SonyCamera } from '@/lib/cameras/types';

/**
 * Render tests for the compare grid.
 *
 * No DOM, so nothing here clicks: the grid's rows are built by `compareBlocks`,
 * which the component calls and these tests call directly with the toggle in
 * either position, and the markup is checked for what each state renders.
 * Copy is real — the provider carries `messages/en.json`, so a missing key
 * renders as a key path and fails the assertion instead of passing it.
 *
 * Plain `.ts` with `createElement`: the vitest include pattern is
 * `src/**\/*.test.ts`, and a `.test.tsx` here would silently never run.
 */

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
    createElement('a', { href, ...rest }, children),
}));

const { addableProducts, CameraCompareView, compareBlocks } = await import('./camera-compare-view');

/* Widened to the abstract shape: the grid takes keys it builds at runtime
   (`specs.${key}`), which the literal catalogue type would reject. */
const t = createTranslator({ locale: 'en', messages: en as AbstractIntlMessages, namespace: 'cameras' });

const SAME_SPECS: CameraSpecs = {
  kind: 'camera',
  specsSource: '',
  specsMissing: [],
  sensor: 'Full-Frame Exmor R CMOS BSI',
  effectivePixels: '33,0 MP',
  isoRange: '100–51200',
  autofocus: '759 điểm',
  video: '4K 60p',
  stabilization: null,
  viewfinder: null,
  lcd: null,
  mediaSlots: null,
  battery: null,
  weight: '659 g',
  dimensions: null,
};

const camera = (id: string, priceVnd: number, priceFormatted: string): SonyCamera => ({
  id,
  sku: id.toUpperCase(),
  name: id,
  fullName: id,
  category: 'camera',
  subCategory1: 'Full Frame',
  subCategory2: 'Máy ảnh Alpha',
  priceVnd,
  priceFormatted,
  url: '',
  imageUrl: '',
  features: [],
  specs: { ...SAME_SPECS },
});

/** Two bodies whose specs agree and whose prices do not. */
const pair = [camera('a7iv', 63_990_000, '63.990.000 đ'), camera('fx3', 86_390_182, '86.390.182 đ')];

const INTL: ComponentProps<typeof NextIntlClientProvider> = {
  locale: 'en',
  messages: en,
  timeZone: 'Asia/Ho_Chi_Minh',
  children: null,
};

const render = (cams: SonyCamera[], selectedIds = cams.map((c) => c.id)) =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, INTL, createElement(CameraCompareView, { initialCameras: cams, selectedIds })),
  );

/** Copy as it appears in markup. */
const esc = (text: string) => text.replace(/&/g, '&amp;');

/** The `<tr>` whose row head reads `label`. */
const rowOf = (html: string, label: string) =>
  html.match(new RegExp(`<tr[^>]*>(?:(?!</tr>).)*?<span>${esc(label)}</span>(?:(?!</tr>).)*</tr>`))?.[0] ?? null;

describe('the difference filter', () => {
  it('keeps a price row that differs when only differences are shown', () => {
    const rows = compareBlocks({ cameras: pair, activeTab: 'all', onlyDiffs: true, t, locale: 'en' }).flatMap(
      (b) => b.rows,
    );
    const price = rows.find((r) => r.key === 'priceFormatted');
    expect(price?.differs).toBe(true);
    expect(rows.find((r) => r.key === 'sku')?.differs).toBe(true);
    // Every spec agrees, so none survives the filter.
    expect(rows.find((r) => r.key === 'sensor')).toBeUndefined();
  });

  it('badges the price row as different with the filter off', () => {
    const html = render(pair);
    const row = rowOf(html, en.cameras.specPrice);
    expect(row).not.toBeNull();
    expect(row).toContain(en.cameras.diffBadge);
    expect(rowOf(html, en.cameras.specs.sensor)).not.toContain(en.cameras.diffBadge);
  });
});

const headphone = (id: string, driver: string): SonyCamera => ({
  ...camera(id, 10_990_000, '10.990.000 đ'),
  category: 'audio',
  subCategory1: 'Tai nghe',
  subCategory2: 'Choàng đầu',
  specs: {
    kind: 'headphone',
    specsSource: '',
    specsMissing: [],
    designType: 'Tai nghe choàng đầu không dây',
    design: null,
    noiseCancelling: 'Chống ồn | Xuyên âm',
    driver,
    frequencyResponse: null,
    audioTech: null,
    processor: null,
    microphones: null,
    connectivity: null,
    battery: '30 giờ',
    fastCharge: null,
    smartFeatures: null,
    spatialSound: null,
    gameModes: null,
    includedAccessories: null,
    weight: '254 g',
  },
});

describe('an audio compare', () => {
  it('draws the headphone rows and offers the audio tab', () => {
    const html = render([headphone('xm6', '30mm carbon'), headphone('xm5', '30mm')]);
    expect(html).toContain(esc(en.cameras.sectionAudio));
    expect(html).toContain(`>${en.cameras.tabAudio}<`);
    expect(rowOf(html, en.cameras.specs.driver)).toContain(en.cameras.diffBadge);
    expect(rowOf(html, en.cameras.specs.noiseCancelling)).not.toBeNull();
  });

  it('offers no audio tab to a camera-only compare', () => {
    expect(render(pair)).not.toContain(`>${en.cameras.tabAudio}<`);
  });
});

describe('leaving the compare page', () => {
  it('opens an audio product on its own route, where it resolves', () => {
    /* `/cameras/<audio-id>` is a 404: the camera reader excludes audio. */
    const html = render([headphone('xm6', '30mm'), pair[0]]);
    expect(html).toContain('href="/audio/xm6"');
    expect(html).toContain('href="/cameras/a7iv"');
    expect(html).not.toContain('href="/cameras/xm6"');
  });

  it('goes back to the catalogue through the locale-aware link, with no prefix to redirect', () => {
    expect(render(pair)).toMatch(/<a href="\/cameras"[^>]*>[^<]*Back to catalogue/);
    expect(render(pair)).not.toContain('href="/en/cameras"');
  });

  it('goes back to the audio catalogue when only headphones are compared', () => {
    expect(render([headphone('xm6', '30mm'), headphone('xm5', '30mm')])).toMatch(
      /<a href="\/audio"[^>]*>[^<]*Back to catalogue/,
    );
  });
});

describe('the page head', () => {
  it('makes no claim about accent tinting the grid never does', () => {
    expect(en.cameras).not.toHaveProperty('compareLegend');
    expect(render(pair)).not.toMatch(/better value/i);
  });

  it('says there is nothing to compare instead of drawing an empty grid', () => {
    const html = render([], []);
    expect(html).toContain(en.cameras.compareEmptyTitle);
    expect(html).not.toContain('<table');
    expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
  });
});

describe('the add picker', () => {
  const seed = JSON.parse(readFileSync('data/sony-cameras.seed.json', 'utf8')) as SonyCamera[];

  it('finds a body by the alias the header and the grid resolve', () => {
    /* The catalogue names the a7 IV "7 IV"; a substring match never found it. */
    const found = addableProducts(seed, [], 'a7 iv');
    expect(found.map((c) => c.id)).toContain('sony-ilce-7m4-bq-ap2');
  });

  it('never offers a product already in the compare', () => {
    const a7iv = seed.find((c) => c.id === 'sony-ilce-7m4-bq-ap2')!;
    expect(addableProducts(seed, [a7iv.id], 'a7 iv').map((c) => c.id)).not.toContain(a7iv.id);
    expect(addableProducts(seed, [a7iv.id], '')).toHaveLength(seed.length - 1);
  });

  it('finds nothing for nonsense', () => {
    expect(addableProducts(seed, [], 'zzzqqq')).toEqual([]);
  });
});

/* The picker opens on click, which this suite cannot do, so its wiring is
   pinned in the source. */
describe('the add picker wiring', () => {
  const source = readFileSync('src/components/camera-compare-view.tsx', 'utf8');
  const modal = source.slice(source.indexOf('{isAddModalOpen && ('));

  it('is handed ids the page has already normalised', () => {
    const page = readFileSync('src/app/[locale]/cameras/compare/page.tsx', 'utf8');
    expect(page).toMatch(/const selectedIds = compareSelection\(\s*ids,/);
    expect(page).not.toContain('ids.split');
  });

  it('refuses a pick by the columns drawn, not by the ids in the URL', () => {
    const add = source.slice(source.indexOf('const addCamera'), source.indexOf('const hasAudio'));
    expect(add).toContain('comparedCameras.length >= MAX_COMPARE');
    expect(add).not.toContain('activeIds.length >= 6');
  });

  it('draws thumbnails that degrade to the no-photo mark', () => {
    expect(modal).toContain('<ProductPhoto');
    expect(modal).toContain('size={40}');
    expect(modal).not.toContain('<Image');
  });

  it('is a named dialog that Escape closes, with a named search field', () => {
    expect(modal).toMatch(/aria-labelledby="compare-add-title"/);
    expect(modal).toMatch(/id="compare-add-title"/);
    expect(modal).toMatch(/onKeyDown=\{\(e\) => \{\s*if \(e\.key === 'Escape'\) setIsAddModalOpen\(false\);/);
    const input = modal.slice(modal.indexOf('<input'), modal.indexOf('/>', modal.indexOf('<input')));
    expect(input).toContain("aria-label={t('selectProductTitle')}");
    expect(input).toContain('autoFocus');
  });

  it('says when the search finds nothing', () => {
    expect(modal).toMatch(/availableToAdd\.length === 0[\s\S]*t\('emptyTitle'\)/);
  });
});

describe('the column head', () => {
  it('links a product page and drops an image list stored as the url', () => {
    const page = 'https://www.sony.com.vn/interchangeable-lens-cameras/products/ilce-7m4';
    const html = render([
      { ...pair[0], url: page },
      { ...pair[1], url: 'https://www.sony.com.vn/image/abc?fmt=png-alpha\nhttps://cdn.shopify.com/x.jpg' },
    ]);
    expect(html).toContain(`href="${page}"`);
    expect(html).not.toContain('cdn.shopify.com');
    expect(html.match(/Sony ↗/g)).toHaveLength(1);
  });
});
