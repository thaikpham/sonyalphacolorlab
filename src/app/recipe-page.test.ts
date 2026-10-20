import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The recipe page's layout, outline and labels — source assertions, because
 * this suite has no DOM and no browser to measure a column in. Each case is a
 * defect found by reading the CSS against the screen widths it lands on.
 */

const page = readFileSync('src/app/[locale]/recipe/[slug]/page.tsx', 'utf8');
const table = readFileSync('src/components/settings-table.tsx', 'utf8');
const gallery = readFileSync('src/components/recipe-gallery.tsx', 'utf8');
const wbTable = readFileSync('src/components/wb-table.tsx', 'utf8');
const messages = ['en', 'vi'].map(
  (l) => JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')) as { recipe: Record<string, string> },
);

describe('the settings column', () => {
  /* At 1024px a 5/12 column with gap-12 is about 342px inside its padding.
     ParamRow's 9rem + 8.5rem tracks and two gaps left the effect track about
     6px wide — the collapse AGENTS.md rule 4 warns about. */
  it('is half the page at lg and five twelfths only from xl', () => {
    expect(page).toContain('lg:col-span-6 xl:col-span-7');
    expect(page).toContain('lg:col-span-6 xl:col-span-5');
    expect(page).not.toMatch(/lg:col-span-[57]\b(?! xl)/);
    expect(page).toContain('lg:gap-8 xl:gap-12');
  });

  /* Beside a 16rem plane, `1fr` was about 62px at 1024px and the readout is a
     non-wrapping `text-title-2` — "7000K, B3-M1.5" is about 190px — so the grid
     ran out of the card and the page scrolled sideways. */
  it('stacks the shift plane over the readout while the column is narrow', () => {
    expect(page).toContain('sm:grid-cols-[16rem_1fr] lg:grid-cols-1 2xl:grid-cols-[16rem_1fr]');
    expect(page).toMatch(/<div className="min-w-0">\s*<FormattedWb/);
    expect(wbTable).toMatch(/inline-flex flex-wrap items-center/);
  });
});

describe('the outline', () => {
  /* h1 → h4 with the contribute form open, and an h3 introducing the h2s it
     sat above. axe's heading-order fails the first. */
  it('steps h1 → h2 → h3 and never skips', () => {
    expect(gallery).not.toMatch(/<h[3-6]\b/);
    expect(gallery).toMatch(/<h2 className="text-body-lg font-semibold text-ink">\{t\('formTitle'\)\}<\/h2>/);
    expect(page).toMatch(/<h2 className="[^"]*">\{t\('paramsLabel'\)\}<\/h2>/);
    expect(table).toMatch(/<h3 className="label mb-2">\{title\}<\/h3>/);
    expect(table).not.toMatch(/<h2\b/);
  });
});

describe('labels', () => {
  /* A label restating the heading under it is the eyebrow CLAUDE.md removed. */
  it('puts no eyebrow over the White Balance heading', () => {
    expect(page).not.toContain('wbEngineLabel');
    for (const m of messages) expect(m.recipe).not.toHaveProperty('wbEngineLabel');
  });

  /* Uppercase is `.label` only, and never over three words: Vietnamese
     diacritics need the ascender room. vi rendered "TẤT CẢ CÔNG THỨC",
     "CÀI ĐẶT MÁY ẢNH" and "CL: BW (BLACK & WHITE)". */
  it('sets no uppercase over more than three words', () => {
    expect(page).not.toMatch(/className="[^"]*\buppercase\b/);
    expect(page).not.toMatch(/className="label[^"]*">\{t\('(back|paramsLabel)'\)\}/);
    expect(page).toMatch(/CL: \{look\.code\}\s*<span className="normal-case">\(\{look\.label\}\)<\/span>/);
  });
});
