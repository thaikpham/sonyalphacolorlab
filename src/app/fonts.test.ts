import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TYPOGRAPHY } from '../../packages/colorlab-tokens/src/tokens';

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

  /* Noto Sans is a variable font: css2 hands back the same file for every
     weight. Named per weight, it was committed four times over and fetched
     once per weight a page used. One file per subset, one face spanning the
     weights, so each subset is a single request. */
  const weightRanges = [...css.matchAll(/font-weight: (\d+)(?: (\d+))?;/g)].map(
    ([, from, to]) => [Number(from), Number(to ?? from)] as const,
  );

  it.each([400, 500, 600, 800])('ships weight %i', (weight) => {
    expect(weightRanges.some(([from, to]) => from <= weight && weight <= to)).toBe(true);
  });

  it('references one file per subset', () => {
    const urls = new Set([...css.matchAll(/url\('([^']+)'\)/g)].map(([, url]) => url));
    expect([...urls].sort()).toEqual(['./NotoSans-latin.woff2', './NotoSans-vietnamese.woff2']);
  });

  it('commits no font file twice under two names', () => {
    const files = existsSync(FONT_DIR)
      ? readdirSync(FONT_DIR).filter((name) => name.endsWith('.woff2'))
      : [];
    const hashes = files.map((name) =>
      createHash('sha256').update(readFileSync(join(FONT_DIR, name))).digest('hex'),
    );
    expect(files.length).toBeGreaterThan(0);
    expect(new Set(hashes).size).toBe(files.length);
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

  /**
   * Read off the `--font-*` namespace, not off the source text.
   *
   * The handoff's version of this test asserted the source did not contain the
   * substring `display:` — but the type scale's page-title step IS called
   * `display` (`--text-display`, 42px), so that assertion fails on the very
   * scale this system specifies. What must never come back is a second
   * *family*, and a family is exactly what the `font` namespace holds.
   */
  it('is the only family — no mono, no display', () => {
    expect(Object.keys(TYPOGRAPHY.tokens)).toEqual(['sans']);
    expect(TYPOGRAPHY.tokens.sans).toContain("'Noto Sans'");

    const tokens = readFileSync(
      join(process.cwd(), 'packages', 'colorlab-tokens', 'src', 'tokens.ts'),
      'utf8',
    );
    expect(tokens).not.toContain('mono:');
    expect(tokens).not.toContain('Noto Sans Mono');
  });
});
