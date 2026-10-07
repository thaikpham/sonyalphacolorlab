import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HighlightsSide } from '@/lib/cameras/highlights';
import type { CameraSpecs } from '@/lib/cameras/types';

/**
 * Real render tests for the highlights surfaces, alongside the source-text
 * tests in `camera-page.test.ts`.
 *
 * `CameraHighlights`, `CoreSpecs` and `ProductSpecTable` are async Server
 * Components with no client interactivity, so they are called directly as
 * plain functions — `await CoreSpecs({ rows })`, never `<CoreSpecs rows={rows} />`
 * — which needs no JSX and keeps this file a plain `.ts`, matching the
 * `src/**\/*.test.ts` vitest include pattern (a `.test.tsx` here would
 * silently never run). `next-intl/server` is mocked to the identity function
 * so every translation key renders as itself; these tests check markup shape,
 * not copy — the copy itself is `messages.test.ts`'s job.
 */
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

const { CameraHighlights, CoreSpecs } = await import('./camera-highlights');
const { ProductSpecTable } = await import('./product-spec-table');

const points: HighlightsSide['points'] = [
  { title: 'Fast AF', body: 'Locks on quickly, even in low light.' },
  { title: 'In-body stabilization', body: 'Five axes of correction for handheld video.' },
];

describe('CameraHighlights', () => {
  it('renders one h3 per point', async () => {
    const html = renderToStaticMarkup(await CameraHighlights({ points }));
    expect(html.match(/<h3/g)).toHaveLength(points.length);
    for (const p of points) {
      expect(html).toContain(p.title);
      expect(html).toContain(p.body);
    }
  });
});

describe('CoreSpecs', () => {
  it('orders rows by CORE_SPEC_KEYS whatever the input order', async () => {
    // Input deliberately out of CORE_SPEC_KEYS order (sensor, …, battery, weight).
    const rows: HighlightsSide['keySpecs'] = [
      { key: 'weight', value: '659 g' },
      { key: 'battery', value: '580 shots' },
      { key: 'sensor', value: '33MP full-frame' },
    ];
    const html = renderToStaticMarkup(await CoreSpecs({ rows }));
    const sensorAt = html.indexOf('33MP full-frame');
    const batteryAt = html.indexOf('580 shots');
    const weightAt = html.indexOf('659 g');
    expect(sensorAt).toBeGreaterThanOrEqual(0);
    expect(sensorAt).toBeLessThan(batteryAt);
    expect(batteryAt).toBeLessThan(weightAt);
  });
});

const cameraSpecs: CameraSpecs = {
  kind: 'camera',
  specsSource: 'https://www.sony.com.vn/example',
  specsMissing: [],
  sensor: 'Full-Frame Exmor R CMOS BSI',
  effectivePixels: '33,0 MP',
  isoRange: '100–51200',
  autofocus: '759 điểm',
  video: '4K 60p',
  stabilization: '5-axis',
  viewfinder: '3,69 triệu điểm ảnh',
  lcd: '3,0"',
  mediaSlots: 'CFexpress A / SD',
  battery: '580 ảnh',
  weight: '659 g',
  dimensions: '131 x 96 x 80 mm',
};

describe('ProductSpecTable', () => {
  it('renders no surface wrapper and no h3 when embedded', async () => {
    const html = renderToStaticMarkup(
      await ProductSpecTable({ specs: cameraSpecs, locale: 'vi', embedded: true }),
    );
    expect(html).not.toContain('surface');
    expect(html).not.toContain('<h3');
    // The rows themselves still render.
    expect(html).toContain('Full-Frame Exmor R CMOS BSI');
  });

  it('renders the surface wrapper and the heading when not embedded', async () => {
    const html = renderToStaticMarkup(await ProductSpecTable({ specs: cameraSpecs, locale: 'vi' }));
    expect(html).toContain('surface');
    expect(html).toContain('<h3');
  });
});
