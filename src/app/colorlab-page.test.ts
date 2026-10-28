import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The catalogue pages, the browse they share and the loading skeleton —
 * source assertions, as the neighbouring route tests do.
 */

const index = readFileSync('src/app/[locale]/colorlab/(index)/page.tsx', 'utf8');
const situation = readFileSync('src/app/[locale]/colorlab/[situation]/page.tsx', 'utf8');
const browse = readFileSync('src/components/browse/recipe-browse.tsx', 'utf8');
const filters = readFileSync('src/components/browse/browse-filters.tsx', 'utf8');
const tiles = readFileSync('src/components/browse/situation-tiles.tsx', 'utf8');
const loading = readFileSync('src/app/[locale]/colorlab/(index)/loading.tsx', 'utf8');
const card = readFileSync('src/components/recipe-card.tsx', 'utf8');

const classOf = (source: string, tag: string) =>
  source.match(new RegExp(`<${tag}\\b[^>]*className="([^"]+)"`))?.[1].split(/\s+/) ?? [];

describe('/colorlab and /colorlab/[situation]', () => {
  /* `listRecipes` is `unstable_cache` keyed by its arguments, and the header
     pushes `?q=` after every typing pause — so "mojave" was up to six cache
     misses, each a recipes select plus a translations read, and any random
     `?q=` from anyone added an entry. Nothing new goes into that key: the
     text match, the four groups and the legacy parameters all run in memory
     after one unfiltered read. */
  it('reads the catalogue once, unfiltered, and filters in the page', () => {
    const code = browse.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code.match(/listRecipes\([^)]*\)/g)).toEqual(['listRecipes(locale)']);
    expect(browse).toMatch(/matchesQuery\(r, filters\.q\)/);
    expect(browse).toMatch(/matchesLegacyFilters\(r, legacy\)/);
    expect(browse).toMatch(/facetCounts\(narrowed, filters\)/);
    for (const page of [index, situation]) expect(page).not.toMatch(/listRecipes\(/);
  });

  /* `?format=` was a legacy parameter for one release; it is the colour-system
     group now, read once by `browseFilters`. Left in the legacy object too it
     would filter twice and the system row's counts would lose the other
     system — every count for it would read zero and its chip would vanish. */
  it('reads ?format= as the colour-system group, not as a legacy parameter', () => {
    const legacy = browse.slice(browse.indexOf('const legacy = {'), browse.indexOf('};', browse.indexOf('const legacy = {')));
    expect(legacy).toContain('look: one(sp.look)');
    expect(legacy).toContain('tag: one(sp.tag)');
    expect(legacy).not.toMatch(/format/);
  });

  it('are one browse: the same component, the heading the only difference', () => {
    expect(index).toMatch(/<RecipeBrowse model=\{model\} title=\{tBrowse\('title'\)\} \/>/);
    expect(situation).toMatch(/<RecipeBrowse model=\{model\} title=\{t\(`situations\.\$\{situation\}`\)\} \/>/);
    expect(index).toContain('loadBrowse(locale, null, await searchParams, (await cookies()).get(MY_CAMERA_COOKIE)?.value)');
    expect(situation).toContain(
      'loadBrowse(locale, situation, await searchParams, (await cookies()).get(MY_CAMERA_COOKIE)?.value)',
    );
  });

  it('refuses an unknown situation with a real 404, and enumerates the known ones', () => {
    expect(situation).toMatch(/const situation = parseSituation\(raw\);\s*if \(!situation\) notFound\(\);/);
    expect(situation).toMatch(/export function generateStaticParams\(\)/);
    expect(situation).toContain("bilingualAlternates(locale, `/colorlab/${situation}`)");
  });

  it('never reads ?situation= — the situation is the path', () => {
    for (const src of [browse, index, situation, filters]) expect(src).not.toMatch(/sp\.situation|searchParams\.situation|'situation='/);
  });

  /* An eyebrow over the h1, and uppercase over four words. */
  it('has nothing over its h1', () => {
    const hero = browse.slice(browse.indexOf('<div className="hero-block'), browse.indexOf('</div>', browse.indexOf('<div className="hero-block')));
    expect(hero).not.toMatch(/<p\b/);
    expect(hero).toContain('<h1');
  });

  /* The empty state echoes the query. A pasted URL is one unbreakable token,
     and at 375px it pushed the page sideways. */
  it('wraps an echoed query instead of widening the page', () => {
    /* On the empty state's wrapper since 2026-10-28, which holds the title,
       the button and the echoed query alike. */
    expect(browse).toMatch(/<div className="[^"]*\bbreak-words\b[^"]*">\s*<p className="[^"]*">\{t\('emptyTitle'\)\}/);
  });

  it('keeps one h1 and steps to h2 before any h3', () => {
    expect(browse.match(/<h1\b/g)).toHaveLength(1);
    expect(browse).not.toMatch(/<h3\b/);
    expect(tiles).toMatch(/<h2 id="browse-by-situation"/);
    expect(tiles).toMatch(/<h3 className="text-body/);
    expect(card).toMatch(/<h3 className="text-title-3/);
  });
});

describe('the browse row', () => {
  it('is links, not buttons — it works before hydration and Back walks it', () => {
    expect(filters).not.toMatch(/'use client'|<button|useRouter|onClick/);
    expect(filters).toMatch(/<Link\s+href=\{c\.href\}/);
  });

  it('draws its chips in the header’s two states, and never an All chip', () => {
    expect(filters).toContain("import { CHIP_IDLE, CHIP_SELECTED } from '@/components/chip-styles'");
    expect(filters).toMatch(/className=\{c\.selected \? CHIP_SELECTED : CHIP_IDLE\}/);
    expect(filters).not.toMatch(/filterAll|'all'/);
  });

  it('puts the colour system first, named by Sony’s own menu words', () => {
    const keys = [...filters.matchAll(/key: '(\w+)' as const/g)].map((m) => m[1]);
    expect(keys).toEqual(['format', 'situation', 'style', 'tone']);
    expect(filters).toContain("label: t('system')");
    expect(filters).toContain('ids: RECIPE_FORMATS');
    expect(filters).toContain('counts: facets.formats');
    expect(filters).toMatch(/name: \(id: string\) => FORMAT_LABELS\[/);
    /* Never a message key: Picture Profile and Creative Look are not translated. */
    expect(filters).not.toMatch(/t\(`formats?\./);
  });

  it('leaves out a chip that would yield nothing, unless it is the selected one', () => {
    expect(filters).toMatch(/\.filter\(\(id\) => g\.counts\[id\] > 0 \|\| g\.selected === id\)/);
  });

  it('keeps its labels to three uppercase words and scrolls each group on a phone', () => {
    expect(filters).toMatch(/<span className="label[^"]*">\{g\.label\}<\/span>/);
    expect(filters).toMatch(/<ul className="filter-scroll/);
  });
});

describe('the situation tiles', () => {
  it('show a name, a count and the recipes’ own colours — never a photograph', () => {
    expect(tiles).not.toMatch(/RecipePhoto|<Image|images\[0\]|<img/);
    expect(tiles).toContain('accentCss(r.accent)');
    expect(tiles).toContain("tHome('resultCount', { count: own.length })");
    expect(tiles).toContain('visibleSituations(recipes)');
  });

  it('only appear on the landing, before anything is chosen', () => {
    expect(browse).toMatch(/\{landing \? <SituationTiles recipes=\{all\} \/> : null\}/);
    expect(browse).toContain('const landing = !hasBrowseFilters(filters);');
  });
});

describe('the recipe card', () => {
  /* D10 and Q4: a format in `ink-faint`, a name without its code, the
     situations it browses under. No parameter chips, no tag line, no signal
     colour borrowed to mean a format. */
  it('is a label, a name and one meta line', () => {
    expect(card).not.toMatch(/text-community|text-proposal|recipeChips|recipe\.tags|wbLabel/);
    expect(card).toMatch(/<span className="label">\{kind\}<\/span>/);
    expect(card).toContain('recipeTitle(recipe.name)');
    expect(card).toMatch(/<p className="meta line-clamp-1">\{situations\}<\/p>/);
  });

  /* No recipe carries a photograph: the 210px slot is the palette its own
     settings grade, never a photo component or the old accent wash. */
  it('shows the recipe’s palette as its thumbnail', () => {
    expect(card).toMatch(
      /<div className="h-\[210px\] w-full overflow-hidden">\s*<RecipePalette palette=\{recipe\.palette\} tone=\{recipe\.tone\} style=\{recipe\.style\} variant="card" \/>/,
    );
    expect(card).not.toMatch(/RecipePhoto|RecipeColorField|recipe\.images|<Image|<img/);
    expect(card).toContain('FORMAT_LABELS[recipe.format]');
  });
});

describe('the recipe palette', () => {
  const palette = readFileSync('src/components/recipe-palette.tsx', 'utf8');
  const recipePage = readFileSync('src/app/[locale]/recipe/[slug]/page.tsx', 'utf8');
  const og = readFileSync('src/app/[locale]/recipe/[slug]/opengraph-image.tsx', 'utf8');

  it('is one labelled image, the ramp then six hues, with nothing written on it and no strokes', () => {
    expect(palette).toMatch(/role="img"\s*aria-label=\{label\}/);
    expect(palette).toContain("const RAMP: readonly SwatchId[] = ['highlight', 'mid', 'shadow'];");
    expect(palette).toContain(
      "const BARS: readonly SwatchId[] = ['red', 'skin', 'yellow', 'foliage', 'sky', 'blossom'];",
    );
    expect(palette).toMatch(/grid-cols-\[1fr_3fr\]/);
    expect(palette).toMatch(/<span key=\{id\} style=\{\{ background: swatch\[id\]\.css \}\} \/>/g);
    expect(palette).not.toMatch(/\bborder\b|\bring-|outline-|#[0-9a-fA-F]{3}/);
  });

  it('names its swatches and states its limit on the recipe page only', () => {
    expect(palette).toMatch(/if \(variant === 'card'\) return grid;/);
    expect(palette).toMatch(/<p className="meta">\{t\('note'\)\}<\/p>/);
    expect(recipePage).toMatch(
      /<RecipePalette palette=\{recipe\.palette\} tone=\{recipe\.tone\} style=\{recipe\.style\} variant="page" light=\{recipe\.light\} \/>/,
    );
  });

  it('says which light it was read under when that is not daylight', () => {
    expect(palette).toMatch(/\{light \? <p className="meta">\{t\('light', \{ kelvin: light \}\)\}<\/p> : null\}/);
  });

  it('runs along the share card in hex, from the same swatches', () => {
    expect(og).toMatch(/recipe\.palette\.map\(\(swatch\) =>/);
    expect(og).toContain('background: swatch.hex');
    /* Satori ignores oklch() and renders no colour, silently. */
    const code = og.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/swatch\.css|oklch\(/);
  });
});

describe('/colorlab loading skeleton', () => {
  /* It was a centred 86rem three-column block with 4/5 tiles, standing in for
     a full-bleed one-to-six-column grid — the jump it exists to prevent. */
  it('has the page grid’s container and columns', () => {
    const pageMain = classOf(browse, 'main');
    const skeletonMain = classOf(loading, 'main');
    for (const c of ['max-w-[160rem]', 'pt-8', 'inset-safe']) {
      expect(pageMain, c).toContain(c);
      expect(skeletonMain, c).toContain(c);
    }
    const grid = (s: string) => classOf(s, 'ul').filter((c) => /grid-cols|^gap-/.test(c));
    expect(grid(loading)).toEqual(grid(browse));
  });

  it('sizes the tiles like a recipe card', () => {
    expect(loading).toContain('h-[210px]');
    expect(loading).not.toContain('aspect-[4/5]');
    /* The card body's three bars: label, title, meta — at the card's gaps. */
    expect(loading).toContain('flex flex-col gap-2 px-5 pt-[19px] pb-[22px]');
    expect(card).toContain('flex flex-col gap-2 px-5 pt-[19px] pb-[22px]');
  });

  it('sits in the index route group, beside the situation route rather than above it', () => {
    expect(loading).toBeTruthy();
    expect(index).toContain('(index)');
  });
});
