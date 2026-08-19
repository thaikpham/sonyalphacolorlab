import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The typography guard. Three failures this catches, all of which shipped
 * silently once:
 *
 *  1. A missing vietnamese subset — diacritics fall back mid-word to a
 *     different face. No build error, no console warning, just uneven text.
 *  2. A second typeface creeping back in (mono, display, or another family).
 *  3. Type below the 13px floor, which is the original feedback.
 */
const FONT_DIR = join(process.cwd(), 'public', 'fonts', 'noto-sans');
const FACE_CSS = join(FONT_DIR, 'noto-sans.css');

describe('fonts', () => {
  it('vendors the face CSS into the repo', () => {
    expect(existsSync(FACE_CSS)).toBe(true);
  });

  const css = existsSync(FACE_CSS) ? readFileSync(FACE_CSS, 'utf8') : '';

  it('declares the literal family name every app shares', () => {
    expect(css).toContain("font-family: 'Noto Sans'");
  });

  it.each([400, 500, 600, 800])('ships weight %i', (weight) => {
    expect(css).toMatch(new RegExp('font-weight: ' + weight + ';'));
  });

  it('covers Vietnamese', () => {
    /* U+1EA0–U+1EF9 is the Vietnamese block. Without it, "Chọn ống kính"
       renders half in Noto Sans and half in the fallback. */
    expect(css.toUpperCase()).toContain('U+1EA0');
  });

  it('does not ship latin-ext', () => {
    expect(css).not.toContain('latin-ext');
  });

  it('references only local files', () => {
    expect(css).not.toMatch(/url\(['"]?https?:/);
  });

  it('is the only family — no mono, no display', () => {
    const tokens = readFileSync(
      join(process.cwd(), 'packages', 'colorlab-tokens', 'src', 'tokens.ts'),
      'utf8',
    );
    expect(tokens).not.toContain('mono:');
    expect(tokens).not.toContain('display:');
    expect(tokens).not.toContain('Noto Sans Mono');
  });
});
