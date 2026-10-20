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

/** One handler of the component, from its `const` to the next one. */
function handler(name: string): string {
  const start = code.indexOf(`\n  const ${name} = `);
  expect(start, `handler ${name}`).toBeGreaterThan(-1);
  const end = code.indexOf('\n  const ', start + 1);
  return code.slice(start, end === -1 ? undefined : end);
}

/** The position of `needle` in `hay`, failing — not -1 — when it is absent. */
function at(hay: string, needle: string): number {
  const i = hay.indexOf(needle);
  expect(i, `missing: ${needle}`).toBeGreaterThan(-1);
  return i;
}

describe('the editor asks before it loses anything', () => {
  /* `localesEmptied`, `placementDrops` and `highlightsDropped` are executed in
     product-draft.test.ts. These pin that the component calls them, at the
     point where asking can still prevent the loss. */

  it('asks before a save that empties a feature list, and before the PATCH goes', () => {
    /* RC4: a save emptied sony-np-fz100's English bullets and nothing asked. */
    const save = handler('save');
    expect(at(save, 'localesEmptied(draft)')).toBeLessThan(at(save, "kind: 'save'"));
    expect(at(save, "kind: 'save'")).toBeLessThan(at(save, "method: 'PATCH'"));
  });

  it('asks before a move that drops filled specs or a camera’s highlights, and before it moves', () => {
    const place = handler('place');
    expect(at(place, 'placementDrops(')).toBeLessThan(at(place, 'withPlacement('));
    expect(at(place, 'highlightsDropped(')).toBeLessThan(at(place, 'withPlacement('));
    expect(at(place, "kind: 'placement'")).toBeLessThan(at(place, 'withPlacement('));
    expect(code).toMatch(/t\('highlightsDropTitle'\)/);
  });

  it('asks in the page, never with a browser dialog', () => {
    expect(code).toMatch(/role="alertdialog"/);
    const confirms = [...code.matchAll(/window\.confirm\(/g)].length;
    const discards = [...code.matchAll(/window\.confirm\(t\('discardConfirm'\)\)/g)].length;
    expect(confirms).toBe(discards);
  });
});

describe('one save at a time', () => {
  /* "Save anyway" ran save() while a translation was out; the translation's
     `finally` re-enabled Save mid-PATCH, and a second click sent the same
     version — answered 409 staleEdit for a save that had landed. */
  it('starts no save while another request is out', () => {
    const save = handler('save');
    expect(at(save, "if (busy !== '') return;")).toBeLessThan(at(save, 'fetch('));
  });

  it('cannot confirm while busy', () => {
    const answer = handler('answer');
    expect(at(answer, "busy !== ''")).toBeLessThan(at(answer, 'save(true)'));
    const i = at(code, 'answer(true)');
    const button = code.slice(code.lastIndexOf('<button', i), code.indexOf('</button>', i));
    expect(button).toContain("disabled={busy !== ''}");
  });
});

describe('the fields that used to be read-only are editable', () => {
  it('has SKU, a numeric price and the Sony Store URL', () => {
    expect(code).toMatch(/id="prod-sku"/);
    expect(code).toMatch(/id="prod-price"[\s\S]{0,80}inputMode="numeric"/);
    expect(code).toMatch(/id="prod-url"/);
  });

  it('refiles through place(), so every placement change is checked before it lands', () => {
    expect(code).toMatch(/onChange=\{\(e\) => place\(\{ category:/);
    expect(code).toMatch(/onChange=\{\(e\) => place\(\{ subCategory1:/);
    expect(code).toMatch(/onChange=\{\(e\) => place\(\{ subCategory2:/);
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
