import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The product editor's wiring, read from its source.
 *
 * What a save carries is executed in `src/lib/admin/product-draft.test.ts`;
 * this file pins that the component actually goes through those functions, and
 * the copy rules the parity test cannot see. Source assertions because the
 * suite has no DOM — the same call `session.test.ts` makes for the shell.
 */

const PATH = 'src/components/admin/admin-editor.tsx';
const source = readFileSync(PATH, 'utf8');

/** The source with comments removed, so prose never reads as code. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\{\s*\}/g, '');

const messages = {
  vi: JSON.parse(readFileSync('messages/vi.json', 'utf8')).admin as Record<string, unknown>,
  en: JSON.parse(readFileSync('messages/en.json', 'utf8')).admin as Record<string, unknown>,
};

describe('a late answer lands on the product it belongs to', () => {
  it('applies a translation only to the draft it was asked for', () => {
    /* Switching product while Claude was translating put product A's whole
       draft back under product B — and Save then wrote A's fields into B. */
    expect(code).not.toMatch(/setDraft\(\{\s*\.\.\.draft,\s*\[target\]/);
    expect(code).toMatch(/setDraft\(\(d\) => \(d && d\.id === id \?/);
  });

  it('refuses to save a draft of another product', () => {
    expect(code).toMatch(/draft\.id !== selected\.id/);
  });

  it('rebuilds the draft after a save without dropping what was typed meanwhile', () => {
    expect(code).toMatch(/afterSave\(/);
    expect(code).not.toMatch(/asDraft\(stored\)/);
  });

  it('lets a 409 staleEdit be recovered by reopening the same product', () => {
    /* The message says to reopen the product, but select() returned early for
       the product already open — the only way out was a page reload. */
    expect(code).toMatch(/data\.error === 'staleEdit'\) setStale\(true\)/);
    expect(code).toMatch(/if \(p\.id === selectedId && draft && !stale\) return;/);
    expect(code).toMatch(/setStale\(false\);\s*void open\(p\)/);
  });
});

describe('a save carries only what changed, and the version it changed', () => {
  it('builds the body from the draft diff', () => {
    expect(code).toMatch(/saveBody\(/);
    expect(code).not.toMatch(/features:\s*\{\s*en:\s*lines\(draft\.en\)/);
  });

  it('opens a product from the admin read, which carries the version', () => {
    expect(code).toMatch(/fetch\(`\/api\/admin\/products\/\$\{encodeURIComponent\([^)]*\)\}`,\s*\{\s*headers:\s*authed\(\)/);
  });
});

describe('unsaved edits', () => {
  it('asks before switching product or division, and before leaving the page', () => {
    expect(code).toMatch(/window\.confirm\(t\('discardConfirm'\)\)/);
    expect(code).toMatch(/'beforeunload'/);
    expect(code).toMatch(/t\('unsaved'\)/);
  });
});

describe('the create form', () => {
  it('offers only the categories the role may create', () => {
    /* A PE admin's first create defaulted to camera and always answered 403. */
    expect(code).toMatch(/categoriesFor\(adminRole\)/);
    expect(code).not.toMatch(/<option value="camera">/);
  });
});

describe('copy', () => {
  it('has no fallback lookup that hides a missing key from the parity test', () => {
    expect(code).not.toMatch(/tSafe/);
  });

  it('has no Vietnamese literal outside a comment', () => {
    /* Every user-visible string goes in messages/*.json. A diacritic outside
       a comment is a string that renders untranslated to the other locale. */
    const vietnamese = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
    const offending = code.split('\n').filter((l) => vietnamese.test(l));
    expect(offending).toEqual([]);
  });

  it('uppercases nothing outside .label', () => {
    /* CLAUDE.md: uppercase only in .label, never over three words.
       `category · subCategory1` rendered as e.g. "AUDIO · TAI NGHE INZONE". */
    expect(code).not.toMatch(/\buppercase\b/);
  });

  it('reads every admin key it ships, and ships every key it reads', () => {
    const read = new Set([...code.matchAll(/\bt\('([a-zA-Z0-9]+)'/g)].map((m) => m[1]));
    for (const key of read) {
      expect(messages.vi, `admin.${key} missing from vi`).toHaveProperty(key);
      expect(messages.en, `admin.${key} missing from en`).toHaveProperty(key);
    }
    /* `errors.*` is looked up by the code a route answers with. */
    const unread = Object.keys(messages.vi).filter((k) => k !== 'errors' && !code.includes(`'${k}'`));
    expect(unread).toEqual([]);
  });

  it('has a message for every code the product routes answer with', () => {
    const errors = messages.vi.errors as Record<string, string>;
    for (const route of ['src/app/api/admin/products/route.ts', 'src/app/api/admin/products/[id]/route.ts']) {
      const codes = [...readFileSync(route, 'utf8').matchAll(/error: '([a-zA-Z]+)'/g)].map((m) => m[1]);
      for (const c of codes) expect(errors, `admin.errors.${c}`).toHaveProperty(c);
    }
  });
});
