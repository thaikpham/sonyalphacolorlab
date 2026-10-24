import { describe, expect, it } from 'vitest';
import {
  NO_FILTERS,
  browseFilters,
  browseHref,
  colorlabPath,
  colorlabSearch,
  facetCounts,
  hasBrowseFilters,
  matchesBrowse,
  parseFormat,
  situationCounts,
  visibleSituations,
  type Browsable,
} from './browse';

const r = (
  situations: Browsable['situations'],
  style: Browsable['style'],
  tone: Browsable['tone'],
  format: Browsable['format'] = 'pp',
): Browsable => ({
  format,
  situations,
  style,
  tone,
});

const CATALOGUE: Browsable[] = [
  r(['portrait', 'daily'], 'natural', 'warm'),
  r(['portrait'], 'film', 'mono'),
  r(['portrait', 'street'], 'film', 'cool', 'cl'),
  r(['street', 'daily'], 'vivid', 'neutral', 'cl'),
  r(['travel'], 'vivid', 'warm'),
  r(['night'], 'film', 'cool'),
];

describe('filters from the URL', () => {
  it('reads style, tone and q, and drops a value it does not know', () => {
    expect(browseFilters('portrait', { style: 'film', tone: 'warm', q: ' cafe ' })).toEqual({
      situation: 'portrait',
      style: 'film',
      tone: 'warm',
      format: null,
      q: 'cafe',
    });
    expect(browseFilters(null, { style: 'FILM', tone: 'sepia', q: ['a', 'b'] })).toEqual({
      situation: null,
      style: null,
      tone: null,
      format: null,
      q: 'a',
    });
    expect(browseFilters(null, {})).toEqual(NO_FILTERS);
  });

  it('reads the colour system, the same ?format= the previous catalogue used', () => {
    expect(browseFilters(null, { format: 'cl' }).format).toBe('cl');
    expect(browseFilters(null, { format: ['pp', 'cl'] }).format).toBe('pp');
    expect(browseFilters(null, { format: 'xx' }).format).toBeNull();
    expect(browseFilters(null, { format: 'CL' }).format).toBeNull();
    expect(parseFormat('pp')).toBe('pp');
    expect(parseFormat(undefined)).toBeNull();
    expect(parseFormat(1)).toBeNull();
  });

  it('never reads ?situation= — the situation is the path', () => {
    expect(browseFilters(null, { situation: 'portrait' }).situation).toBeNull();
  });

  it('knows when nothing is chosen', () => {
    expect(hasBrowseFilters(NO_FILTERS)).toBe(false);
    expect(hasBrowseFilters({ ...NO_FILTERS, tone: 'cool' })).toBe(true);
    expect(hasBrowseFilters({ ...NO_FILTERS, q: 'x' })).toBe(true);
    expect(hasBrowseFilters({ ...NO_FILTERS, format: 'cl' })).toBe(true);
  });
});

describe('the catalogue search keeps the reader’s filters', () => {
  it('merges a new query into the style and tone already in the URL', () => {
    expect(colorlabSearch(new URLSearchParams('style=film&tone=warm'), { q: 'cafe' })).toBe(
      'q=cafe&style=film&tone=warm',
    );
    expect(colorlabSearch(new URLSearchParams('q=old&style=film'), { q: '85' })).toBe('q=85&style=film');
  });

  it('drops a cleared query, an empty value and an unknown one', () => {
    expect(colorlabSearch(new URLSearchParams('q=a7&tone=cool'), { q: '' })).toBe('tone=cool');
    expect(colorlabSearch(new URLSearchParams('style=film'), { style: '' })).toBe('');
    expect(colorlabSearch(new URLSearchParams('style=sepia&tone=hot'), {})).toBe('');
    expect(colorlabSearch(null, { q: '  ' })).toBe('');
  });

  it('keeps the colour system and carries no legacy parameter', () => {
    expect(colorlabSearch(new URLSearchParams('format=cl&look=FL&tag=x&q=a'), {})).toBe('q=a&format=cl');
    expect(colorlabSearch(new URLSearchParams('format=cl&tone=cool&style=film'), { q: 'x' })).toBe(
      'q=x&style=film&tone=cool&format=cl',
    );
    expect(colorlabSearch(new URLSearchParams('format=xx&q=a'), {})).toBe('q=a');
    expect(colorlabSearch(new URLSearchParams('format=cl'), { format: '' })).toBe('');
  });
});

describe('addresses', () => {
  it('puts the situation in the path and the rest in the query', () => {
    expect(colorlabPath(null)).toBe('/colorlab');
    expect(colorlabPath('portrait')).toBe('/colorlab/portrait');
    expect(browseHref({ ...NO_FILTERS, situation: 'portrait', style: 'film' })).toBe(
      '/colorlab/portrait?style=film',
    );
    expect(browseHref({ ...NO_FILTERS, tone: 'mono', q: 'hẻm' })).toBe('/colorlab?q=h%E1%BA%BBm&tone=mono');
    expect(browseHref({ ...NO_FILTERS, format: 'pp' })).toBe('/colorlab?format=pp');
    expect(browseHref({ ...NO_FILTERS, situation: 'night', format: 'cl', tone: 'cool' })).toBe(
      '/colorlab/night?tone=cool&format=cl',
    );
    expect(browseHref(NO_FILTERS)).toBe('/colorlab');
  });
});

describe('matching and counting', () => {
  it('ANDs the four groups and ignores an empty one', () => {
    expect(matchesBrowse(CATALOGUE[0], NO_FILTERS)).toBe(true);
    expect(matchesBrowse(CATALOGUE[0], { ...NO_FILTERS, situation: 'portrait', style: 'natural', tone: 'warm' })).toBe(true);
    expect(matchesBrowse(CATALOGUE[0], { ...NO_FILTERS, situation: 'portrait', style: 'film' })).toBe(false);
    expect(matchesBrowse(CATALOGUE[0], { ...NO_FILTERS, situation: 'night' })).toBe(false);
  });

  it('excludes the other colour system', () => {
    expect(matchesBrowse(CATALOGUE[0], { ...NO_FILTERS, format: 'pp' })).toBe(true);
    expect(matchesBrowse(CATALOGUE[0], { ...NO_FILTERS, format: 'cl' })).toBe(false);
    expect(CATALOGUE.filter((x) => matchesBrowse(x, { ...NO_FILTERS, format: 'cl' }))).toEqual([
      CATALOGUE[2],
      CATALOGUE[3],
    ]);
  });

  it('counts each group against the other three, so a chip says what pressing it yields', () => {
    const f = facetCounts(CATALOGUE, { ...NO_FILTERS, situation: 'portrait' });
    /* Situations are counted with no situation applied: the row stays whole. */
    expect(f.situations.portrait).toBe(3);
    expect(f.situations.street).toBe(2);
    expect(f.situations.night).toBe(1);
    expect(f.situations.heritage).toBe(0);
    /* Styles and tones are counted inside the chosen situation. */
    expect(f.styles).toEqual({ natural: 1, range: 0, vivid: 0, film: 2 });
    expect(f.tones).toEqual({ warm: 1, neutral: 0, cool: 1, mono: 1 });

    expect(f.formats).toEqual({ pp: 2, cl: 1 });

    const g = facetCounts(CATALOGUE, { ...NO_FILTERS, situation: 'portrait', style: 'film' });
    expect(g.tones).toEqual({ warm: 0, neutral: 0, cool: 1, mono: 1 });
    /* The style row is counted with the style released, so the natural chip
       still shows what it would yield. */
    expect(g.styles.natural).toBe(1);
    /* And the situation row is counted inside style=film: one street recipe. */
    expect(g.situations.street).toBe(1);
  });

  it('counts the colour system with itself released, and the other rows inside it', () => {
    const f = facetCounts(CATALOGUE, { ...NO_FILTERS, format: 'pp' });
    /* Both systems keep a count, so Creative Look still says what it yields. */
    expect(f.formats).toEqual({ pp: 4, cl: 2 });
    /* Every other row is counted inside Picture Profile. */
    expect(f.styles).toEqual({ natural: 1, range: 0, vivid: 1, film: 2 });
    expect(f.tones).toEqual({ warm: 2, neutral: 0, cool: 1, mono: 1 });
    expect(f.situations).toMatchObject({ portrait: 2, street: 0, daily: 1, travel: 1, night: 1 });

    /* And the system row is counted inside the other groups. */
    const g = facetCounts(CATALOGUE, { ...NO_FILTERS, format: 'pp', situation: 'street' });
    expect(g.formats).toEqual({ pp: 0, cl: 2 });
  });

  it('advertises a situation only from three recipes', () => {
    expect(situationCounts(CATALOGUE)).toMatchObject({ portrait: 3, street: 2, daily: 2, travel: 1, night: 1, heritage: 0 });
    expect(visibleSituations(CATALOGUE)).toEqual(['portrait']);
    expect(visibleSituations([...CATALOGUE, r(['street'], 'film', 'warm')])).toEqual(['portrait', 'street']);
  });
});
