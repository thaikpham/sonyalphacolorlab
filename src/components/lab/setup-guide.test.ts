import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/i18n/navigation', () => ({ Link: () => null }));

const { nextRadioIndex } = await import('./setup-guide');

/** Comments removed, so prose never reads as code. */
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const source = strip(readFileSync('src/components/lab/setup-guide.tsx', 'utf8'));

describe('the menu-version radio group', () => {
  /* `role="radiogroup"` promises the ARIA radio pattern: one tab stop, and
     the arrow keys move the selection. Both options were tab stops and the
     arrows did nothing. */
  it.each([
    ['ArrowRight', 0, 1],
    ['ArrowDown', 0, 1],
    ['ArrowRight', 1, 0],
    ['ArrowLeft', 0, 1],
    ['ArrowUp', 1, 0],
  ] as const)('%s from option %i moves to option %i', (key, from, to) => {
    expect(nextRadioIndex(key, from, 2)).toBe(to);
  });

  it.each(['Tab', 'Enter', ' ', 'a'])('leaves %j to the browser', (key) => {
    expect(nextRadioIndex(key, 0, 2)).toBeNull();
  });

  it('makes only the checked option a tab stop, and handles the arrows on it', () => {
    const radio = source.slice(source.indexOf('role="radio"'), source.indexOf('</button>', source.indexOf('role="radio"')));
    expect(radio).toMatch(/tabIndex=\{on \? 0 : -1\}/);
    expect(radio).toMatch(/onKeyDown=\{/);
    expect(source).toMatch(/nextRadioIndex\(e\.key, i, versions\.length\)/);
    expect(source).toMatch(/\.focus\(\)/);
  });
});

describe('the setup tool’s styling', () => {
  /* The type scale, the radius scale and the elevation wholes, as CLAUDE.md
     states them: an off-scale size or radius is a bug, and a hand-rolled
     backdrop blur is an elevation patched rather than chosen. */
  it('uses the type scale, the radius scale and no hand-rolled blur', () => {
    expect(source).not.toMatch(/text-\[(clamp|\d)/);
    expect(source).not.toMatch(/rounded-full|rounded-\[/);
    expect(source).not.toMatch(/backdrop-blur/);
  });

  it('keeps the sticky header opaque, with the surface on a panel inside it', () => {
    /* Positioning on a plain wrapper, the surface class on the panel inside:
       a surface class on the sticky element decides its own position. */
    expect(source).toMatch(/<header className="sticky top-0 z-10 bg-void[^"]*">\s*<div className="surface-raised/);
  });
});
