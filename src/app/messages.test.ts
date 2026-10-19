import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/**
 * A `clientMessages` object literal, however the file that holds it is written.
 *
 * The semicolon is optional, and that is the point of naming this once rather
 * than inlining it three times. The admin routes are written with semicolons
 * and the Alpha Tech Blogs routes without, and a pattern that demanded one
 * simply did not match the second style — so a provider written that way was
 * invisible here. Invisible in both directions: the route-level check reported
 * a namespace as unsent when it was sent, and the "no namespace ships unread"
 * check quietly stopped counting the namespaces that provider sends.
 */
const PROVIDER_BLOCK = /const clientMessages = \{([\s\S]*?)\n {2}\};?/g;

const en = JSON.parse(readFileSync('messages/en.json', 'utf8')) as Record<string, unknown>;
const vi = JSON.parse(readFileSync('messages/vi.json', 'utf8')) as Record<string, unknown>;

/**
 * Concatenates every .ts/.tsx under a directory, recursively — tests excluded.
 * This file names namespaces in its own assertions, and counting those would
 * let a namespace keep itself alive.
 */
function readSources(dir: string): string {
  return sourceFiles(dir)
    .map(([, src]) => src)
    .join('\n');
}

/**
 * Every source file under a directory, recursively, as `[path, contents]`.
 *
 * Per FILE, not one concatenated blob. `clientComponents` filters on
 * `'use client'`, and a blob containing one client component matches for its
 * whole directory — which counted every server component's namespace as
 * client-needed and made the "no namespace ships unread" half of this test
 * assert nothing.
 */
function sourceFiles(dir: string): Array<[string, string]> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
      ? ([[p, readFileSync(p, 'utf8')]] as Array<[string, string]>)
      : [];
  });
}

/**
 * Every 'use client' component, discovered rather than listed. A hardcoded list
 * is the same silent failure one level up: a new client component with a new
 * namespace would simply be invisible to this test.
 */
function clientComponents(): string[] {
  /* Recursive, and per file. `readdirSync('src/components')` read only the top
     level, where `admin` is a DIRECTORY entry that `.endsWith('.tsx')` drops —
     so `src/components/admin/admin-editor.tsx`, the one client component in a
     subfolder and the largest consumer of a namespace in the repo, was
     invisible to the guard whose whole job is to notice it. */
  return [...sourceFiles('src/components'), ...sourceFiles('src/app')]
    .filter(([, src]) => src.includes("'use client'"))
    .map(([, src]) => src);
}

/** Namespaces requested by any 'use client' component. */
function clientNamespaces(): string[] {
  const found = new Set<string>();
  for (const src of clientComponents()) {
    for (const m of src.matchAll(/useTranslations\('([^']+)'\)/g)) found.add(m[1]);
  }
  return [...found].sort();
}

/**
 * Namespaces actually sent to the browser, read back out of every
 * `clientMessages` object in the tree.
 *
 * The layout is not the only provider. `admin` is 3.2KB — 17% of the whole
 * catalogue — and only the admin editor reads it, so the five admin routes each
 * mount their own `NextIntlClientProvider` rather than making every visitor
 * carry it. A guard that reads only the layout would call that a violation and
 * push the payload back onto everyone, which is the opposite of what the rule
 * it enforces is for.
 */
function providerFiles(): Array<{ file: string; sends: Set<string> }> {
  return sourceFiles('src/app')
    .map(([file, src]) => {
      const sends = new Set<string>();
      for (const block of src.matchAll(PROVIDER_BLOCK)) {
        for (const m of block[1].matchAll(/^\s*(\w+):/gm)) sends.add(m[1]);
      }
      return { file, sends };
    })
    .filter((p) => p.sends.size > 0);
}

function sentNamespaces(): string[] {
  return [...new Set(providerFiles().flatMap((p) => [...p.sends]))].sort();
}

/**
 * Every client component a file mounts directly, resolved through its own
 * imports, with the namespaces each of them reads.
 *
 * This is what makes the check per-route rather than a union. A union answers
 * "does SOMEBODY send `admin`" — so dropping it from one of the five admin
 * routes left the suite green while that route rendered raw keys. Asking
 * instead "does THIS provider send what the components on THIS page read"
 * fails the moment one route falls behind its siblings.
 */
function mountedClientNamespaces(file: string, src: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const imp of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(@\/[^']+|\.[^']+)'/g)) {
    const names = imp[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim());
    const spec = imp[2];
    const base = spec.startsWith('@/')
      ? `src/${spec.slice(2)}`
      : `${file.split('/').slice(0, -1).join('/')}/${spec}`;
    const candidate = [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`].find((p) => existsSync(p));
    if (!candidate) continue;
    const dep = readFileSync(candidate, 'utf8');
    if (!dep.includes("'use client'")) continue;
    // Only count it if the file actually renders the component.
    if (!names.some((n) => new RegExp(`<${n}[\\s/>]`).test(src))) continue;
    for (const m of dep.matchAll(/useTranslations\('([^']+)'\)/g)) out.push([candidate, m[1]]);
  }
  return out;
}

/** Flattens to dotted paths so a nested key missing on one side is visible. */
function paths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    paths(v, prefix ? `${prefix}.${k}` : k),
  );
}

/* `useTranslations('cameras.specs')` is a path into a namespace, not a
   namespace: a provider sends the whole `cameras` object and next-intl walks
   down to `specs`. Every comparison therefore uses the ROOT segment. */
const root = (ns: string) => ns.split('.')[0];

describe('client message scoping', () => {
  it('narrows the catalogue instead of shipping all of it', () => {
    expect(layout).toContain('messages={clientMessages}');
  });

  it('includes every namespace a client component asks for', () => {
    const needed = clientNamespaces();
    const sent = new Set(sentNamespaces());
    expect(needed.length).toBeGreaterThan(0);
    for (const ns of needed) {
      expect(
        sent.has(root(ns)),
        `a client component calls useTranslations('${ns}') but no NextIntlClientProvider sends "${root(ns)}" — its labels render as raw keys`,
      ).toBe(true);
    }
  });

  /**
   * The per-route check. A route that mounts its own provider is opting out of
   * the layout's set, so it has to carry everything its own subtree reads —
   * `src/app/[locale]/layout.tsx` is above these and its namespaces are added
   * to whatever the route sends.
   */
  it('every route with its own provider sends what its components read', () => {
    const fromLayout = new Set(
      [...layout.matchAll(PROVIDER_BLOCK)].flatMap((b) =>
        [...b[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]),
      ),
    );

    const routes = sourceFiles('src/app').filter(([, src]) => src.includes('const clientMessages'));
    expect(routes.length).toBeGreaterThan(0);

    for (const [file, src] of routes) {
      const sends = new Set([
        ...fromLayout,
        ...[...src.matchAll(PROVIDER_BLOCK)].flatMap((b) =>
          [...b[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]),
        ),
      ]);
      for (const [dep, ns] of mountedClientNamespaces(file, src)) {
        expect(
          sends.has(root(ns)),
          `${file} mounts ${dep}, which reads "${ns}", but that route's provider does not send "${root(ns)}"`,
        ).toBe(true);
      }
    }
  });

  it('does not ship a namespace no client component reads', () => {
    const needed = new Set(clientNamespaces().map(root));
    const sent = sentNamespaces();
    expect(sent.length).toBeGreaterThan(0);
    for (const ns of sent) {
      expect(needed.has(ns), `"${ns}" is sent to the browser but no client component reads it`).toBe(
        true,
      );
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

  /**
   * Keys whose reader is being written on a parallel branch — the compare
   * limit hint (audit3/wiki) and the error digest label (audit3/header) — so
   * deleting them here would land those components on a raw key. Remove each
   * entry once its reader is merged.
   */
  const AWAITING_READER = new Set(['cameras.maxCompareHint', 'error.ref']);

  /**
   * The same check one level down, for the namespaces the layout ships whole.
   *
   * A namespace that is read keeps every key in it alive as far as the check
   * above can tell, and the layout sends `cameras`, `lab`, `nav`, `search` …
   * entire — so thirty keys left over from deleted UI (a compare bar, a detail
   * modal, two filter dropdowns, fourteen `ideal*` use-case badges) shipped to
   * every visitor in both languages. The heroLanding cost, key by key.
   *
   * A key is read when its name, or its path below the namespace, appears
   * quoted in a source file, or when an ancestor is the prefix of a template
   * lookup (`t(\`specs.${key}\`)`), which reaches its children by data. Loose
   * on purpose: it can only miss a dead key whose name is quoted for some other
   * reason, never fail a live one.
   */
  it('ships no leaf key nothing reads', () => {
    const src = [
      readSources('src/app'),
      readSources('src/components'),
      readSources('src/lib'),
      readSources('scripts'),
    ].join('\n');
    const quoted = (s: string) => src.includes(`'${s}'`) || src.includes(`"${s}"`) || src.includes(`\`${s}\``);
    const templated = (prefix: string) =>
      src.includes(`\`${prefix}.\${`) || src.includes(`'${prefix}.' +`) || quoted(prefix);

    const shipped = [...layout.matchAll(PROVIDER_BLOCK)].flatMap((b) =>
      [...b[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]),
    );
    expect(shipped.length).toBeGreaterThan(0);

    const dead: string[] = [];
    for (const ns of shipped) {
      for (const path of paths(en[ns], ns)) {
        if (AWAITING_READER.has(path)) continue;
        const segs = path.split('.').slice(1);
        const leaf = segs[segs.length - 1];
        const viaAncestor = segs.slice(0, -1).some((_, i) => templated(segs.slice(0, i + 1).join('.')));
        if (!quoted(leaf) && !quoted(segs.join('.')) && !viaAncestor) dead.push(path);
      }
    }
    expect(dead, 'shipped to every browser, read by nothing').toEqual([]);
  });
});

describe('copy that states a fact', () => {
  const both = (pick: (m: Record<string, Record<string, string>>) => string) =>
    [en, vi].map((m) => pick(m as Record<string, Record<string, string>>));

  it('gives the launcher description no count to go stale', () => {
    /* It said "Four tools" for three apps, in every search result for `/`. */
    for (const text of both((m) => m.launcher.subtitle)) {
      expect(text).not.toMatch(/\d|\b(one|two|three|four|five|six) tools\b|\b(hai|ba|bốn|năm|sáu) công cụ\b/i);
    }
  });

  it('says sign-in receives the email, rather than "only" a name and picture', () => {
    /* A disclaimer shown before an OAuth grant must not understate what is
       collected: the email is received, stored, and shown back to the reader. */
    for (const text of both((m) => m.auth.privacy)) {
      expect(text).toMatch(/email/i);
      expect(text).not.toMatch(/\bonly\b|chỉ nhận/i);
    }
  });

  it('does not call the read-only photo credit optional', () => {
    /* It labels the signed-in account's name, which cannot be edited or left out. */
    for (const text of both((m) => m.recipe.authorLabel)) {
      expect(text).not.toMatch(/optional|không bắt buộc/i);
    }
  });
});
