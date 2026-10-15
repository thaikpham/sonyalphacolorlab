import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import vi from '../../messages/vi.json';
import ErrorBoundary from './[locale]/error';

/**
 * The `[locale]` error boundary, rendered with a real catalogue.
 *
 * Plain `.ts` with `createElement`, for the reason `recipe-community-section`
 * gives: the vitest include pattern is `*.test.ts`.
 */
const INTL: ComponentProps<typeof NextIntlClientProvider> = {
  locale: 'vi',
  messages: vi,
  timeZone: 'Asia/Ho_Chi_Minh',
  children: null,
};

describe('error boundary', () => {
  it('labels the digest in the reader’s language', () => {
    /* `error.ref` was in both catalogues and shipped to the browser, and the
       page printed a literal "ref" beside the digest instead. */
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, INTL, createElement(ErrorBoundary, { error, reset: () => {} })),
    );
    expect(html).toContain(`${vi.error.ref} abc123`);
    expect(html).not.toContain('ref abc123');
  });
});
