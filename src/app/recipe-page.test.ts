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

describe('the row of other recipes for the same situation', () => {
  const card = readFileSync('src/components/recipe-card.tsx', 'utf8');
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const browse = ['en', 'vi'].map(
    (l) => (JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')) as { browse: Record<string, unknown> }).browse,
  );

  /* The browse's own unfiltered read — no new cache key, no new query — and
     nothing request-bound beside it, so the page stays prerendered. */
  it('reads the catalogue the browse reads, once, and stays static', () => {
    expect(code(page).match(/listRecipes\([^)]*\)/g)).toEqual(['listRecipes(locale)']);
    expect(page).toContain('const more = moreForSituation(recipe, catalogue);');
    expect(page).toMatch(/export async function generateStaticParams\(\)/);
    expect(code(page)).not.toMatch(/\bcookies\(|\bheaders\(|searchParams|force-dynamic|connection\(/);
  });

  it('draws the browse’s card, under an h2 that links to the situation', () => {
    expect(page).toMatch(/\{more \? \(\s*<section aria-labelledby="more-for-situation"/);
    expect(page).toMatch(/<h2 id="more-for-situation" className="text-title-3 font-semibold text-ink">\s*<Link\s+href=\{colorlabPath\(more\.situation\)\}/);
    expect(page).toContain("{tBrowse('moreFor', { situation: situationLabels[more.situation] })}");
    expect(page).toContain('{more.recipes.map((r) => (');
    expect(page).toMatch(/<li key=\{r\.id\} className="grid">\s*<RecipeCard recipe=\{r\} situationLabels=\{situationLabels\} \/>/);
    expect(page).toContain('grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6');
    /* No `see all` line and no helper copy: the heading is the link. */
    const row = page.slice(page.indexOf('<section aria-labelledby="more-for-situation"'), page.indexOf('</section>', page.indexOf('more-for-situation')));
    expect(row).not.toMatch(/<p\b/);
    expect(row.match(/<Link\b/g)).toHaveLength(1);
  });

  /* An eager prefetch of every card is what once put thousands of requests a
     day on the recipes table. The card keeps Link's default. */
  it('keeps the card’s prefetch at Link’s default', () => {
    expect(code(card)).not.toMatch(/prefetch/);
    expect(code(page)).not.toMatch(/prefetch/);
  });

  it('has its heading in both languages, the situation interpolated', () => {
    for (const m of browse) {
      expect(typeof m.moreFor).toBe('string');
      expect(m.moreFor).toContain('{situation}');
    }
    expect(browse[0].moreFor).not.toEqual(browse[1].moreFor);
  });
});
