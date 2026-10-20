import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CL_PARAM_LABELS,
  PP_DETAIL_LABELS,
  PP_PARAM_LABELS,
  PP_RANGES,
  WB_PARAM_LABELS,
} from '@/lib/camera/constants';
import type { PpSettings } from '@/lib/camera/schema';

/**
 * The recipe form's controls, rendered without a DOM.
 *
 * `next-intl` is mocked to the identity function, so a label rendered from
 * the catalogue shows as its key — which is what lets these tests tell a
 * catalogue label from one taken from `constants.ts`.
 */

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const { Ranged, parseRangedInput, omitKey } = await import('./fields');
const { PpFields } = await import('./settings-fields');

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const PP: PpSettings = {
  blackLevel: 0,
  gamma: 'Cine1',
  blackGamma: { range: 'Middle', level: 0 },
  knee: { mode: 'Auto' },
  colorMode: 'Pro',
  saturation: 0,
  colorPhase: 0,
  colorDepth: { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 },
  detail: {
    level: 0,
    mode: 'Auto',
    vhBalance: 0,
    bwBalance: 'Type3',
    limit: PP_RANGES.detailLimit.min,
    crispening: PP_RANGES.detailCrispening.min,
    hiLightDetail: PP_RANGES.detailHiLightDetail.min,
  },
};

describe('a number field', () => {
  it('commits only a whole number, so a lone minus or an empty box is not one', () => {
    /* Typing "-" first read as an invalid number, the change was skipped, and
       React wrote the old 0 back: "-7" became "7". */
    expect(parseRangedInput('-')).toBeNull();
    expect(parseRangedInput('')).toBeNull();
    expect(parseRangedInput('  ')).toBeNull();
    expect(parseRangedInput('-7')).toBe(-7);
    expect(parseRangedInput('92.5')).toBe(92.5);
  });

  it('shows the box as typed while it is being edited, and the value otherwise', () => {
    const source = readFileSync('src/components/colorlab/admin/fields.tsx', 'utf8');
    expect(source).toMatch(/value=\{text \?\? shown\}/);
    expect(source).toMatch(/onBlur=\{\(\) => setText\(null\)\}/);
    const out = html(
      createElement(Ranged, { label: 'L', range: PP_RANGES.blackLevel, value: -7, onChange: () => {} }),
    );
    expect(out).toContain('value="-7"');
  });

  it('can be empty when the field is optional', () => {
    const out = html(
      createElement(Ranged, {
        label: 'L',
        range: PP_RANGES.kneeAutoMaxPoint,
        value: undefined,
        onChange: () => {},
        onClear: () => {},
      }),
    );
    expect(out).toContain('value=""');
  });
});

describe('an Auto knee', () => {
  it('shows Max Point and Sensitivity as unset when the recipe does not state them', () => {
    /* None of the Auto-knee recipes in the seed states either, and the public
       page prints plain "Auto"; the editor showed 90 and Mid, and choosing
       the Mid it showed fired no change. */
    const out = html(createElement(PpFields, { value: PP, onChange: () => {} }));
    expect(out).toMatch(/<option value="" selected="">/);
    expect(out).not.toMatch(new RegExp(`value="${PP_RANGES.kneeAutoMaxPoint.min}"`));
  });

  it('drops a cleared key rather than storing an empty one', () => {
    expect(omitKey({ mode: 'Auto', sensitivity: 'Mid', maxPoint: 95 }, 'sensitivity')).toEqual({
      mode: 'Auto',
      maxPoint: 95,
    });
  });

  it('types no camera value into the component', () => {
    const source = readFileSync('src/components/colorlab/admin/settings-fields.tsx', 'utf8');
    expect(source).not.toMatch(/'Mid'/);
  });
});

describe('parameter labels', () => {
  const technical = new Set<string>([
    ...Object.values(PP_PARAM_LABELS),
    ...Object.values(PP_DETAIL_LABELS),
    ...Object.values(CL_PARAM_LABELS),
    ...Object.values(WB_PARAM_LABELS),
  ]);

  it('are not copied into the catalogue (Rule 3)', () => {
    for (const side of ['en', 'vi']) {
      const ns = JSON.parse(readFileSync(`messages/${side}.json`, 'utf8')).recipeAdmin as Record<
        string,
        unknown
      >;
      for (const [key, value] of Object.entries(ns)) {
        if (typeof value === 'string') expect(technical.has(value), `${side}.${key}`).toBe(false);
      }
    }
  });

  it('come from constants.ts on the Picture Profile form', () => {
    const out = html(createElement(PpFields, { value: PP, onChange: () => {} }));
    for (const label of [
      PP_PARAM_LABELS.blackLevel,
      PP_PARAM_LABELS.gamma,
      PP_PARAM_LABELS.knee,
      PP_PARAM_LABELS.colorMode,
      PP_PARAM_LABELS.colorPhase,
      `${PP_PARAM_LABELS.colorDepth} R`,
      PP_DETAIL_LABELS.mode,
      PP_DETAIL_LABELS.hiLightDetail,
    ]) {
      expect(out, label).toContain(label);
    }
  });
});
