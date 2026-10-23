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
  situationCounts,
  visibleSituations,
  type Browsable,
} from './browse';

const r = (situations: Browsable['situations'], style: Browsable['style'], tone: Browsable['tone']): Browsable => ({
  situations,
  style,
  tone,
});

const CATALOGUE: Browsable[] = [
  r(['portrait', 'daily'], 'natural', 'warm'),
  r(['portrait'], 'film', 'mono'),
  r(['portrait', 'street'], 'film', 'cool'),
  r(['street', 'daily'], 'vivid', 'neutral'),
  r(['travel'], 'vivid', 'warm'),
  r(['night'], 'film', 'cool'),
];

describe('filters from the URL', () => {
  it('reads style, tone and q, and drops a value it does not know', () => {
    expect(browseFilters('portrait', { style: 'film', tone: 'warm', q: ' cafe ' })).toEqual({
      situation: 'portrait',
      style: 'film',
      tone: 'warm',
      q: 'cafe',
    });
    expect(browseFilters(null, { style: 'FILM', tone: 'sepia', q: ['a', 'b'] })).toEqual({
      situation: null,
      style: null,
      tone: null,
      q: 'a',
    });
    expect(browseFilters(null, {})).toEqual(NO_FILTERS);
  });

  it('never reads ?situation= — the situation is the path', () => {
    expect(browseFilters(null, { situation: 'portrait' }).situation).toBeNull();
  });

  it('knows when nothing is chosen', () => {
    expect(hasBrowseFilters(NO_FILTERS)).toBe(false);
    expect(hasBrowseFilters({ ...NO_FILTERS, tone: 'cool' })).toBe(true);
    expect(hasBrowseFilters({ ...NO_FILTERS, q: 'x' })).toBe(true);
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

  it('carries no legacy parameter', () => {
    expect(colorlabSearch(new URLSearchParams('format=cl&look=FL&tag=x&q=a'), {})).toBe('q=a');
  });
});

describe('addresses', () => {
  it('puts the situation in the path and the rest in the query', () => {
    expect(colorlabPath(null)).toBe('/colorlab');
    expect(colorlabPath('portrait')).toBe('/colorlab/portrait');
    expect(browseHref({ situation: 'portrait', style: 'film', tone: null, q: '' })).toBe(
      '/colorlab/portrait?style=film',
    );
    expect(browseHref({ situation: null, style: null, tone: 'mono', q: 'hẻm' })).toBe(
      '/colorlab?q=h%E1%BA%BBm&tone=mono',
    );
    expect(browseHref(NO_FILTERS)).toBe('/colorlab');
  });
});

describe('matching and counting', () => {
  it('ANDs the three groups and ignores an empty one', () => {
    expect(matchesBrowse(CATALOGUE[0], NO_FILTERS)).toBe(true);
    expect(matchesBrowse(CATALOGUE[0], { situation: 'portrait', style: 'natural', tone: 'warm' })).toBe(true);
    expect(matchesBrowse(CATALOGUE[0], { situation: 'portrait', style: 'film', tone: null })).toBe(false);
    expect(matchesBrowse(CATALOGUE[0], { situation: 'night', style: null, tone: null })).toBe(false);
  });

  it('counts each group against the other two, so a chip says what pressing it yields', () => {
    const f = facetCounts(CATALOGUE, { situation: 'portrait', style: null, tone: null, q: '' });
    /* Situations are counted with no situation applied: the row stays whole. */
    expect(f.situations.portrait).toBe(3);
    expect(f.situations.street).toBe(2);
    expect(f.situations.night).toBe(1);
    expect(f.situations.heritage).toBe(0);
    /* Styles and tones are counted inside the chosen situation. */
    expect(f.styles).toEqual({ natural: 1, range: 0, vivid: 0, film: 2 });
    expect(f.tones).toEqual({ warm: 1, neutral: 0, cool: 1, mono: 1 });

    const g = facetCounts(CATALOGUE, { situation: 'portrait', style: 'film', tone: null, q: '' });
    expect(g.tones).toEqual({ warm: 0, neutral: 0, cool: 1, mono: 1 });
    /* The style row is counted with the style released, so the natural chip
       still shows what it would yield. */
    expect(g.styles.natural).toBe(1);
    /* And the situation row is counted inside style=film: one street recipe. */
    expect(g.situations.street).toBe(1);
  });

  it('advertises a situation only from three recipes', () => {
    expect(situationCounts(CATALOGUE)).toMatchObject({ portrait: 3, street: 2, daily: 2, travel: 1, night: 1, heritage: 0 });
    expect(visibleSituations(CATALOGUE)).toEqual(['portrait']);
    expect(visibleSituations([...CATALOGUE, r(['street'], 'film', 'warm')])).toEqual(['portrait', 'street']);
  });
});
