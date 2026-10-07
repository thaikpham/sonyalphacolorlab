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
});

describe('the camera page', () => {
  it('shows highlights and core specs when a camera has them', () => {
    expect(page).toContain('<CameraHighlights points={highlights.points} />');
    expect(page).toContain('<CoreSpecs rows={highlights.keySpecs} />');
  });

  it('collapses the full table under its own heading', () => {
    expect(page).toMatch(/<details[\s\S]*fullSpecsHeading[\s\S]*<ProductSpecTable[^>]*embedded[\s\S]*<\/details>/);
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
