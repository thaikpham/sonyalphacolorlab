import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, normalize } from 'node:path';
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

/*
 * The per-route walk. What follows resolves, for one provider, every
 * `useTranslations` call its subtree can reach — through as many files as it
 * takes. The previous version looked one import level deep and asked only
 * whether the imported FILE was a client component, so `EditGate` was the
 * whole of what it saw on an edit route: `AdminGate`, `ArticleEditor`, the
 * rail, the block editor and the preview behind it were never examined.
 *
 * It walks DECLARATIONS, not files. A file is the wrong unit in both
 * directions. Too coarse: `gate.tsx` imports `useAuth` from `auth-context.tsx`,
 * whose `AuthProvider` reads `auth` — but `AuthProvider` is mounted by the
 * layout, outside the route's provider, so a file-level walk would demand
 * `auth` from every edit route for a string none of them renders. Too fine
 * would be an AST; a top-level declaration and the text up to the next one is
 * enough, because an identifier in that text that names another declaration
 * (rendered as JSX, called as a hook, read as a constant) is a reference, and
 * references are what a React tree is made of.
 */

/** The source with comments removed, so prose never reads as a reference. */
const strip = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const isClient = (file: string) => readFileSync(file, 'utf8').includes("'use client'");

/** A specifier as a file in this repo, or null for a package. */
function resolveImport(spec: string, from: string): string | null {
  if (!spec.startsWith('@/') && !spec.startsWith('.')) return null;
  const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : `${dirname(from)}/${spec}`;
  const norm = normalize(base);
  return [`${norm}.tsx`, `${norm}.ts`, `${norm}/index.tsx`, `${norm}/index.ts`].find((p) => existsSync(p)) ?? null;
}

/**
 * What a file imports, by the local name each binding gets. Type-only imports
 * bind nothing at runtime and are left out; a package resolves to `null`.
 */
function imports(file: string): Map<string, { file: string | null; name: string }> {
  const out = new Map<string, { file: string | null; name: string }>();
  const src = strip(readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/import\s+(type\s+)?([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*'([^']+)'/g)) {
    if (m[1]) continue;
    const resolved = resolveImport(m[4], file);
    if (m[2]) out.set(m[2], { file: resolved, name: 'default' });
    for (const spec of (m[3] ?? '').split(',')) {
      const s = spec.trim();
      if (!s || s.startsWith('type ')) continue;
      const [name, alias] = s.split(/\s+as\s+/);
      out.set(alias ?? name, { file: resolved, name });
    }
  }
  return out;
}

type Region = { file: string; names: string[]; body: string };

/**
 * A file's top-level declarations, each with its text up to the next one. A
 * declaration binds one name, or several for a destructuring —
 * `export const { Link, redirect, … } = createNavigation(routing)` — and
 * `default` as well when it is the default export.
 */
const regionCache = new Map<string, Region[]>();
function regions(file: string): Region[] {
  const cached = regionCache.get(file);
  if (cached) return cached;
  const lines = strip(readFileSync(file, 'utf8')).split('\n');
  const HEAD = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|enum)\s+(?:([\w$]+)|\{([^}]*)\})/;
  const starts = lines.flatMap((l, i) => (HEAD.test(l) ? [i] : []));
  const out = starts.map((start, i): Region => {
    const body = lines.slice(start, starts[i + 1] ?? lines.length).join('\n');
    const m = lines[start].match(HEAD)!;
    const names = m[1]
      ? [m[1]]
      : m[2].split(',').map((s) => s.trim().split(/\s*:\s*/).pop()!.split(/\s*=\s*/)[0]).filter(Boolean);
    if (/^export\s+default\b/.test(lines[start])) names.push('default');
    return { file, names, body };
  });
  regionCache.set(file, out);
  return out;
}

/**
 * The declaration a file exports under `name`, following `export … from`
 * re-exports. A type exports nothing to walk. A name this cannot place is
 * answered with the whole file, so an unmodelled export shape errs towards
 * reading too much rather than too little.
 */
function declaration(file: string, name: string): Region | null {
  const own = regions(file).find((r) => r.names.includes(name));
  if (own) return own;
  const src = strip(readFileSync(file, 'utf8'));
  if (new RegExp(`^(?:export\\s+)?(?:type|interface)\\s+${name}\\b`, 'm').test(src)) return null;
  for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    for (const spec of m[1].split(',')) {
      const [orig, alias] = spec.trim().split(/\s+as\s+/);
      if ((alias ?? orig) !== name) continue;
      const target = resolveImport(m[2], file);
      return target ? declaration(target, orig) : null;
    }
  }
  for (const m of src.matchAll(/export\s*\*\s*from\s*'([^']+)'/g)) {
    const target = resolveImport(m[1], file);
    const found = target && declaration(target, name);
    if (found) return found;
  }
  return { file, names: [name], body: src };
}

/**
 * Every `useTranslations` call reachable from the JSX inside one provider, as
 * `[file, namespace]`.
 *
 * Breadth-first over references: each identifier in a region that names a
 * declaration in the same file, or an import from another file in this repo,
 * is walked in turn; a package is not entered. A namespace counts once the
 * walk has passed a `'use client'` file — a server component inside the
 * provider reads the request's messages, not the provider's, but everything
 * below the first client boundary reads the provider's and nothing else.
 */
function reachableNamespaces(file: string, subtree: string): Array<[string, string]> {
  const found = new Map<string, [string, string]>();
  const seen = new Set<string>();
  const queue: Array<{ file: string; body: string; client: boolean }> = [
    { file, body: strip(subtree), client: isClient(file) },
  ];
  const visit = (r: Region, client: boolean) => {
    const key = `${r.file}#${r.names[0]}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({ file: r.file, body: r.body, client: client || isClient(r.file) });
  };
  while (queue.length) {
    const { file, body, client } = queue.shift()!;
    if (client) {
      for (const m of body.matchAll(/useTranslations\('([^']+)'\)/g)) found.set(`${file}#${m[1]}`, [file, m[1]]);
    }
    const local = regions(file);
    const imported = imports(file);
    for (const id of identifiers(body)) {
      const own = local.find((r) => r.names.includes(id));
      if (own) {
        visit(own, client);
        continue;
      }
      const from = imported.get(id);
      if (!from?.file) continue;
      const target = declaration(from.file, from.name);
      if (target) visit(target, client);
    }
  }
  return [...found.values()].sort();
}

/**
 * The identifiers in a body, read past its string literals. A word inside
 * quotes is a message, not a reference — `useAuth` says "must be used within
 * AuthProvider" in its error, and that is not a render of `AuthProvider`. A
 * template literal is text too, except for the expressions inside `${…}`.
 */
function identifiers(body: string): Set<string> {
  const out = new Set<string>();
  for (const [tok] of body.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|[A-Za-z_$][\w$]*/g)) {
    if (tok[0] === '`') {
      for (const e of tok.matchAll(/\$\{([^}]*)\}/g)) for (const id of identifiers(e[1])) out.add(id);
    } else if (tok[0] !== "'" && tok[0] !== '"') {
      out.add(tok);
    }
  }
  return out;
}

/** The JSX between a file's `<NextIntlClientProvider …>` and `</NextIntlClientProvider>`. */
function providerSubtree(src: string): string {
  return [...src.matchAll(/<NextIntlClientProvider\b[^>]*>([\s\S]*?)<\/NextIntlClientProvider>/g)]
    .map((m) => m[1])
    .join('\n');
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
   * The per-route check, and what makes the guard per-route rather than a
   * union. A union answers "does SOMEBODY send `admin`" — so dropping it from
   * one of the five admin routes left the suite green while that route
   * rendered raw keys. This asks "does THIS provider send what the tree inside
   * it reads", transitively, so a namespace read five components down an edit
   * route is the route's to send.
   *
   * The provider's OWN list, and nothing from the layout above it. A nested
   * `NextIntlClientProvider` does not add to its parent's messages, it
   * replaces them (use-intl `IntlProvider`: `messages === undefined ?
   * prevContext?.messages : messages`), so a route that sends `labAdmin` and
   * relies on the layout for `auth` renders `auth` as raw keys. The previous
   * version of this test added the layout's namespaces to every route's and
   * so could not see that.
   *
   * `{children}` is a prop, not a reference, so a layout's pages are not
   * walked here; what they read is covered by the union check above.
   */
  it('every route with its own provider sends what the subtree inside it reads', () => {
    const routes = sourceFiles('src/app').filter(([, src]) => src.includes('const clientMessages'));
    expect(routes.length).toBeGreaterThan(0);

    for (const [file, src] of routes) {
      const sends = new Set(
        [...src.matchAll(PROVIDER_BLOCK)].flatMap((b) =>
          [...b[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]),
        ),
      );
      const subtree = providerSubtree(src);
      expect(subtree, `${file} declares clientMessages but renders no <NextIntlClientProvider>`).not.toBe('');
      const reads = reachableNamespaces(file, subtree);
      expect(reads.length, `${file}: nothing inside its provider reads a namespace`).toBeGreaterThan(0);
      for (const [dep, ns] of reads) {
        expect(
          sends.has(root(ns)),
          `${file} renders ${dep} inside its provider, which reads "${ns}", but its clientMessages does not send "${root(ns)}" — a nested provider replaces the layout's messages, so that renders as raw keys`,
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

  /**
   * `lab` at key granularity. It is ~10KB a locale and two client components
   * read it: the article compare slider, one key, on any page; and the setup
   * guide, most of the rest, on `/blog/setup` alone. Shipped whole from the
   * layout, every recipe and camera page carried the setup tool's copy. The
   * namespace checks above cannot see this — `lab` is read on the client, so
   * sending it passes them either way.
   */
  it('ships the setup tool’s copy only on the setup page', () => {
    expect(layout).not.toContain('lab: messages.lab');
    const shipped = layout.match(/^\s*lab: \{([^}\n]*)\},$/m);
    expect(shipped, 'the layout names the lab keys it sends').not.toBeNull();
    const keys = [...shipped![1].matchAll(/(\w+):/g)].map((m) => m[1]);

    const slider = readFileSync('src/components/lab/compare-slider.tsx', 'utf8');
    const read = [...slider.matchAll(/\bt\('(\w+)'/g)].map((m) => m[1]);
    expect(keys.sort()).toEqual([...new Set(read)].sort());

    const setup = readFileSync('src/app/[locale]/blog/setup/page.tsx', 'utf8');
    expect(setup).toMatch(/const clientMessages = \{\s*lab: messages\.lab,?\s*\}/);
    expect(setup).toMatch(/<NextIntlClientProvider messages=\{clientMessages\}>\s*<SetupGuide \/>/);
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
