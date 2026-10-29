import { readFileSync } from 'node:fs';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import vi from '../../messages/vi.json';
import type { InstallReason } from '@/lib/cameras/capabilities/installable';
import { CameraWarningLines, MyCameraWarning } from './my-camera-warning';

/**
 * The recipe page's accuracy line for the reader's camera (ADR 0006), rendered
 * through the real catalogues. Plain `.ts` with `createElement`: the vitest
 * include pattern is `src/**\/*.test.ts`.
 */

const render = (locale: 'en' | 'vi', el: ReturnType<typeof createElement>) => {
  const props: ComponentProps<typeof NextIntlClientProvider> = {
    locale,
    messages: locale === 'en' ? en : vi,
    timeZone: 'Asia/Ho_Chi_Minh',
    children: null,
  };
  return renderToStaticMarkup(createElement(NextIntlClientProvider, props, el));
};

const text = (html: string) => [...html.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1].replace(/&amp;/g, '&'));

const noLook: InstallReason = { setting: 'creativeLook', label: 'Creative Look', confirmed: true };
const noCinetone: InstallReason = { setting: 'gamma', label: 'S-Cinetone', confirmed: true };
const mayCinetone: InstallReason = { setting: 'gamma', label: 'S-Cinetone', confirmed: false };

describe('the warning line', () => {
  it('names the camera and Sony’s setting, untranslated, in both locales', () => {
    const a7iii = createElement(CameraWarningLines, { camera: 'a7 III', reasons: [noLook] });
    const a6400 = createElement(CameraWarningLines, { camera: 'a6400', reasons: [noCinetone] });
    expect(text(render('en', a7iii))).toEqual(['a7 III has no Creative Look']);
    expect(text(render('en', a6400))).toEqual(['a6400 has no S-Cinetone']);
    expect(text(render('vi', a7iii))).toEqual(['a7 III không có Creative Look']);
    expect(text(render('vi', a6400))).toEqual(['a6400 không có S-Cinetone']);
  });

  it('says "may" for the generic older camera’s unconfirmed S-Cinetone', () => {
    const older = createElement(CameraWarningLines, { camera: null, reasons: [mayCinetone] });
    expect(text(render('en', older))).toEqual(['An older camera may have no S-Cinetone']);
    expect(text(render('vi', older))).toEqual(['Máy đời cũ có thể không có S-Cinetone']);
  });

  it('marks a confirmed reason as one, and an unconfirmed one as a warning', () => {
    const html = render('en', createElement(CameraWarningLines, { camera: null, reasons: [noLook, mayCinetone] }));
    expect(html).toMatch(/<li class="[^"]*text-danger[^"]*">An older camera has no Creative Look<\/li>/);
    expect(html).toMatch(/<li class="[^"]*text-ink-muted[^"]*">An older camera may have no S-Cinetone<\/li>/);
  });

  it('renders nothing on the server: the cookie is the browser’s, read after hydration', () => {
    const html = render('en', createElement(MyCameraWarning, { warnings: { 'ILCE-7M3': { camera: 'a7 III', reasons: [noLook] } } }));
    expect(html).toBe('');
  });
});

describe('the recipe page', () => {
  const page = readFileSync('src/app/[locale]/recipe/[slug]/page.tsx', 'utf8');

  it('renders the line from warnings it computes for every choice', () => {
    expect(page).toContain('const options = cameraOptions(products);');
    expect(page).toContain('const warnings = cameraWarnings(recipe, options);');
    expect(page).toMatch(/<div className="mt-4 empty:hidden">\s*<MyCameraWarning warnings=\{warnings\} \/>\s*<\/div>/);
  });
});
