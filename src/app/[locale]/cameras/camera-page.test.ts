import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import vi from '../../../../messages/vi.json';
import { CORE_SPEC_KEYS } from '@/lib/cameras/highlights';

const page = readFileSync('src/app/[locale]/cameras/[id]/page.tsx', 'utf8');
const editor = readFileSync('src/components/admin/admin-editor.tsx', 'utf8');
/* What a save sends lives beside the editor, in a module the suite can run;
   `src/lib/admin/product-draft.test.ts` executes it. */
const draft = readFileSync('src/lib/admin/product-draft.ts', 'utf8');

describe('the highlights editor', () => {
  it('edits highlights for cameras only and sends them with the save', () => {
    expect(editor).toContain("selected.category === 'camera'");
    expect(draft).toContain('draftToHighlights(d.hl)');
    /* Parsed once, on the server (`productFromRow`); the editor is a client
       component and must not carry the schema (src/design/client-graph.test.ts). */
    expect(draft).toContain('highlightsToDraft(p.highlights ?? null)');
    expect(readFileSync('src/app/api/admin/products/[id]/route.ts', 'utf8')).toContain('productFromRow');
    expect(readFileSync('src/lib/cameras/row.ts', 'utf8')).toContain('highlights: parseHighlights(row.highlights, row.id)');
  });

  it('sends highlights only when the editor actually changed them', () => {
    /* Otherwise an unrelated save (a price edit, a feature line) re-sends
       `highlights` every time, and a stored value that fails the schema
       round-trips to an empty draft and then to `null` — silently erasing it
       on a save that never meant to touch it. */
    expect(draft).toContain('base: DraftFields');
    expect(draft).toContain("product.category === 'camera' && !same(d.hl, b.hl)");
  });
});

describe('the camera page', () => {
  it('shows highlights and core specs when a camera has them', () => {
    expect(page).toContain('<CameraHighlights points={highlights.points} />');
    expect(page).toContain('<CoreSpecs rows={highlights.keySpecs} />');
  });

  it('collapses the full table under its own heading', () => {
    expect(page).toMatch(/<details[\s\S]*fullSpecsHeading[\s\S]*<ProductSpecTable[^>]*embedded[\s\S]*<\/details>/);
  });

  it('gives the collapsed table a disclosure marker that switches on group-open, with no stroke and no motion', () => {
    const details = page.match(/<details className="group surface p-5">[\s\S]*?<\/details>/)?.[0] ?? '';
    expect(details).toBeTruthy();
    // `marker:content-none` replaces the native triangle, which `display: flex`
    // on `<summary>` hides inconsistently across browsers to begin with.
    expect(details).toContain('list-none');
    expect(details).toContain('marker:content-none');
    // One glyph for "closed", hidden once open; one for "open", hidden until then.
    expect(details).toMatch(/group-open:hidden/);
    expect(details).toMatch(/group-open:inline/);
    expect(details).not.toMatch(/\btransition\b|\banimate-/);
    expect(details).toContain('min-h-11');
  });

  it('keeps today\'s feature list as the fallback', () => {
    expect(page).toMatch(/highlights \?[\s\S]*:\s*\([\s\S]*featureList\(product\.features, locale\)/);
  });

  it('labels every core spec in both languages', () => {
    for (const key of CORE_SPEC_KEYS) {
      expect(en.cameras.coreSpecs[key], key).toBeTruthy();
      expect(vi.cameras.coreSpecs[key], key).toBeTruthy();
    }
    expect(vi.cameras.specs.fullSpecsHeading).toBe('Thông số kỹ thuật đầy đủ');
  });
});

const audioPage = readFileSync('src/app/[locale]/audio/[id]/page.tsx', 'utf8');

describe('the official link', () => {
  it('is drawn only for a url that officialUrl accepts', () => {
    /* `href={product.url}` drew six image lists as "View on Sony Vietnam". */
    expect(page).not.toContain('href={product.url}');
    expect(page).toMatch(/const official = officialUrl\(product\.url\)/);
    expect(page).toMatch(/\{official && \(\s*<a\s+href=\{official\}/);
  });
});

describe('the product pages', () => {
  it.each([
    ['camera', page],
    ['audio', audioPage],
  ])('the %s page sizes to the dynamic viewport, never 100vh', (_kind, source) => {
    expect(source).not.toMatch(/\bmin-h-screen\b(?!-dynamic)/);
    expect(source).toContain('min-h-screen-dynamic');
  });
});
