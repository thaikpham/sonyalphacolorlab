import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import vi from '../../../../messages/vi.json';
import { CORE_SPEC_KEYS } from '@/lib/cameras/highlights';

const page = readFileSync('src/app/[locale]/cameras/[id]/page.tsx', 'utf8');
const editor = readFileSync('src/components/admin/admin-editor.tsx', 'utf8');

describe('the highlights editor', () => {
  it('edits highlights for cameras only and sends them with the save', () => {
    expect(editor).toContain("selected.category === 'camera'");
    expect(editor).toContain('draftToHighlights(draft.hl)');
    expect(editor).toContain('highlightsToDraft(parseHighlights(p.highlights))');
  });

  it('sends highlights only when the editor actually changed them', () => {
    /* Otherwise an unrelated save (a price edit, a feature line) re-sends
       `highlights` every time, and a stored value that fails the schema
       round-trips to an empty draft and then to `null` — silently erasing it
       on a save that never meant to touch it. */
    expect(editor).toContain('initialHl: HighlightsDraft');
    expect(editor).toContain('JSON.stringify(draft.hl) !== JSON.stringify(draft.initialHl)');
    expect(editor).toContain("selected.category === 'camera' && highlightsChanged");
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
