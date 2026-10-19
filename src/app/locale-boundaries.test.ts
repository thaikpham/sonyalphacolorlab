import { readFileSync } from 'node:fs';
import { createElement, type ComponentProps, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi as vitest } from 'vitest';

import en from '../../messages/en.json';
import vi from '../../messages/vi.json';
import ErrorBoundary from './[locale]/error';

/* `@/i18n/navigation` imports `next/navigation` without an extension, which
   Node's resolver refuses outside a Next build. The stand-in Link renders the
   href it was given; the pathname is whatever the test sets. */
const nav = { pathname: '/' };
vitest.mock('@/i18n/navigation', async () => {
  const { createElement: h } = await import('react');
  return {
    usePathname: () => nav.pathname,
    Link: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => h('a', { href, ...rest }, children),
  };
});

const { NOT_FOUND_APPS, NotFoundBody, notFoundApp } = await import('@/components/not-found-body');

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

describe('not-found boundary', () => {
  it('knows which app a missing path belongs to', () => {
    expect(notFoundApp('/cameras/unknown')).toBe('camera');
    expect(notFoundApp('/cameras/compare')).toBe('camera');
    expect(notFoundApp('/audio/wh-1000')).toBe('audio');
    expect(notFoundApp('/blog/unknown')).toBe('blog');
    expect(notFoundApp('/learn/unknown')).toBe('learn');
    expect(notFoundApp('/recipe/unknown')).toBe('recipe');
    /* A prefix is not a segment. */
    expect(notFoundApp('/blogroll')).toBe('recipe');
  });

  it('has copy for every app in both catalogues', () => {
    for (const app of NOT_FOUND_APPS) {
      for (const catalogue of [en, vi]) {
        const copy = (catalogue.notFound as Record<string, Record<string, string>>)[app];
        expect(copy, app).toBeDefined();
        expect(Object.keys(copy).sort(), app).toEqual(['action', 'body', 'title']);
      }
    }
  });

  it('sends a missing camera back to the camera catalogue with camera copy', () => {
    /* It said "That recipe isn't here" and linked to /colorlab for every
       notFound() under the locale — camera, audio, article and reference. */
    nav.pathname = '/cameras/unknown';
    const html = renderToStaticMarkup(createElement(NotFoundBody, { copy: en.notFound }));
    expect(html).toContain('href="/cameras"');
    expect(html).toContain(en.notFound.camera.title);
    expect(html).not.toContain(en.notFound.recipe.title);
  });

  it('is fed every app’s copy from the server catalogue', () => {
    const source = readFileSync('src/app/[locale]/not-found.tsx', 'utf8');
    expect(source).toContain('<NotFoundBody copy={copy} />');
    expect(source).toMatch(/NOT_FOUND_APPS\.map\(/);
  });
});
