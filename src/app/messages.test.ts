import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `NextIntlClientProvider` ships every message to the browser unless told
 * otherwise, so the layout narrows it to the namespaces client components use.
 *
 * The failure mode is silent and one-directional: adding a `useTranslations`
 * namespace to a client component without listing it here renders raw keys in
 * production while server-rendered pages look fine. This test catches that.
 *
 * It also catches the opposite drift. `heroLanding` outlived the component that
 * used it — `hero-landing.tsx` was deleted, the namespace was not, and ten
 * strings kept shipping to every visitor for nothing.
 */
const layout = readFileSync('src/app/[locale]/layout.tsx', 'utf8');

const en = JSON.parse(readFileSync('messages/en.json', 'utf8')) as Record<string, unknown>;
const vi = JSON.parse(readFileSync('messages/vi.json', 'utf8')) as Record<string, unknown>;

/**
 * Concatenates every .ts/.tsx under a directory, recursively — tests excluded.
 * This file names namespaces in its own assertions, and counting those would
 * let a namespace keep itself alive.
 */
function readSources(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map((e) => {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) return readSources(p);
      return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
        ? readFileSync(p, 'utf8')
        : '';
    })
    .join('\n');
}

/**
 * Every 'use client' component, discovered rather than listed. A hardcoded list
 * is the same silent failure one level up: a new client component with a new
 * namespace would simply be invisible to this test.
 */
function clientComponents(): string[] {
  return readdirSync('src/components')
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => readFileSync(`src/components/${f}`, 'utf8'))
    .filter((src) => src.includes("'use client'"));
}

/** Namespaces requested by any 'use client' component. */
function clientNamespaces(): string[] {
  const found = new Set<string>();
  for (const src of clientComponents()) {
    for (const m of src.matchAll(/useTranslations\('([^']+)'\)/g)) found.add(m[1]);
  }
  return [...found].sort();
}

/** Namespaces the layout actually sends, read back out of `clientMessages`. */
function sentNamespaces(): string[] {
  const block = layout.match(/const clientMessages = \{([\s\S]*?)\n {2}\};/)?.[1] ?? '';
  return [...block.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort();
}

/** Flattens to dotted paths so a nested key missing on one side is visible. */
function paths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    paths(v, prefix ? `${prefix}.${k}` : k),
  );
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

  it('does not ship a namespace no client component reads', () => {
    const needed = new Set(clientNamespaces());
    const sent = sentNamespaces();
    expect(sent.length).toBeGreaterThan(0);
    for (const ns of sent) {
      expect(needed.has(ns), `the layout ships "${ns}" but no client component reads it`).toBe(true);
    }
  });

  it('does not ship server-only namespaces to the browser', () => {
    // 'home' is rendered server-side; sending it is dead weight.
    expect(layout).not.toContain('home: messages.home');
  });
});

describe('catalogue', () => {
  it('defines the same keys in both locales', () => {
    const enPaths = paths(en).sort();
    const viPaths = paths(vi).sort();
    expect(
      viPaths.filter((p) => !enPaths.includes(p)),
      'present in vi.json but missing from en.json',
    ).toEqual([]);
    expect(
      enPaths.filter((p) => !viPaths.includes(p)),
      'present in en.json but missing from vi.json',
    ).toEqual([]);
  });

  it('has no namespace nothing reads', () => {
    /* A namespace outliving its component is invisible at runtime — next-intl
       never complains about a message nobody asked for. */
    const src = readSources('src/app') + readSources('src/components') + readSources('src/lib');
    for (const ns of Object.keys(en)) {
      expect(src.includes(`'${ns}'`), `messages define "${ns}" but nothing reads it`).toBe(true);
    }
  });
});
