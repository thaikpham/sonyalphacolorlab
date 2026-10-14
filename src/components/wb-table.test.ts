import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import { WB_EXPLANATIONS } from '@/lib/camera/explanations';
import type { WhiteBalance } from '@/lib/camera/schema';
import { WbTable } from './wb-table';

/**
 * The head row of the White Balance table, per mode (rule 1b).
 *
 * It always said "Temperature" and opened the Kelvin explanation, so a preset
 * recipe read "Temperature · Cloudy" and its `?` explained a dial the recipe
 * does not use. Plain `.ts` with `createElement`: the vitest include pattern is
 * `src/**\/*.test.ts`.
 */

const render = (wb: WhiteBalance) =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, { locale: 'en', messages: en }, createElement(WbTable, { wb })),
  );

/* The first ParamRow label in the table: a `<span>` whose class starts with
   the row's text size. */
const headLabel = (html: string) => html.match(/<span class="text-body-sm[^"]*">([^<]+)<\/span>/)?.[1];

describe('WbTable', () => {
  it('keeps Temperature and its explanation for a Kelvin recipe', () => {
    const html = render({ mode: 'kelvin', kelvin: 7000 });
    expect(headLabel(html)).toBe('Temperature');
    expect(html).toContain(WB_EXPLANATIONS.temperature.en);
  });

  it.each([
    ['a preset', { mode: 'preset', preset: 'Cloudy', shift: { ab: { axis: 'A', amount: 1.5 } } }],
    ['an auto mode', { mode: 'auto', auto: 'AWB' }],
  ] as [string, WhiteBalance][])('names the White Balance, not a Temperature, for %s', (_, wb) => {
    const html = render(wb);
    expect(headLabel(html)).toBe('White Balance');
    expect(html).not.toContain(WB_EXPLANATIONS.temperature.en);
  });
});
