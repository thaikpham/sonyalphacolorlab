import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The admin pages' own copy — their `<title>` — comes from the catalogue, in
 * the one admin locale.
 *
 * Three pages hard-coded a Vietnamese title and two passed `'vi'` to
 * `getTranslations` themselves, so the layout's "switchable by one constant"
 * was true of the layout only. Discovered rather than listed, so a new page
 * cannot opt out by not being named here.
 */

function pages(dir = 'src/app/admin'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return pages(p);
    return /^(page|layout)\.tsx$/.test(e.name) ? [p] : [];
  });
}

describe.each(pages())('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('names no locale of its own', () => {
    expect(source).not.toMatch(/locale:\s*'vi'/);
    expect(source).not.toMatch(/const ADMIN_LOCALE\s*=/);
  });

  it('writes no title literal outside the wordmark template', () => {
    const titles = [...source.matchAll(/title:\s*'([^']*)'/g)].map((m) => m[1]);
    expect(titles.filter((t) => !t.includes('Alpha Admin'))).toEqual([]);
  });
});
