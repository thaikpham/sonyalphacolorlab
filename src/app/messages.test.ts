import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `NextIntlClientProvider` ships every message to the browser unless told
 * otherwise, so the layout narrows it to the namespaces client components use.
 *
 * The failure mode is silent and one-directional: adding a `useTranslations`
 * namespace to a client component without listing it here renders raw keys in
 * production while server-rendered pages look fine. This test catches that.
 */
const layout = readFileSync('src/app/[locale]/layout.tsx', 'utf8');

/** Namespaces requested by any 'use client' component. */
function clientNamespaces(): string[] {
  const files = ['hero-landing', 'language-toggle', 'site-header', 'tweak-panel'];
  const found = new Set<string>();
  for (const f of files) {
    const src = readFileSync(`src/components/${f}.tsx`, 'utf8');
    if (!src.includes("'use client'")) continue;
    for (const m of src.matchAll(/useTranslations\('([^']+)'\)/g)) found.add(m[1]);
  }
  return [...found].sort();
}

describe('client message scoping', () => {
  it('narrows the catalogue instead of shipping all of it', () => {
    expect(layout).toContain('messages={clientMessages}');
  });

  it('includes every namespace a client component asks for', () => {
    const needed = clientNamespaces();
    expect(needed.length).toBeGreaterThan(0);
    for (const ns of needed) {
      expect(layout, `client components use "${ns}" but the layout does not send it`).toContain(
        `${ns}: messages.${ns}`,
      );
    }
  });

  it('does not ship server-only namespaces to the browser', () => {
    // 'home' and 'filters' are rendered server-side; sending them is dead weight.
    expect(layout).not.toContain('home: messages.home');
    expect(layout).not.toContain('filters: messages.filters');
  });
});
