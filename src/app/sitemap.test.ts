import { describe, expect, it } from 'vitest';
import sitemap from './sitemap';

/**
 * The sitemap in seed mode — the same code path production runs, against the
 * compiled catalogue. Pins the PR4 audit findings: the camera catalogue is
 * listed, the reference shelf is listed, Vietnamese-bodied pages are listed
 * once at their canonical URL, and nothing that is not a page is listed.
 */

const entries = await sitemap();
const urls = entries.map((e) => e.url.replace(/^https?:\/\/[^/]+/, ''));

describe('sitemap', () => {
  it('lists the camera catalogue and its product pages, in both locales', () => {
    expect(urls).toContain('/cameras');
    expect(urls).toContain('/vi/cameras');
    expect(urls).toContain('/cameras/sony-ilce-7m4-bq-ap2');
    expect(urls).toContain('/vi/cameras/sony-ilce-7m4-bq-ap2');
  });

  it('lists the reference shelf', () => {
    expect(urls).toContain('/learn');
    expect(urls).toContain('/vi/learn/glossary');
  });

  it('lists a blog article once, at its Vietnamese URL, with no alternates (ADR 0004)', () => {
    const article = entries.filter((e) => e.url.endsWith('/blog/iso-auto-min-ss'));
    expect(article).toHaveLength(1);
    expect(article[0].url).toMatch(/\/vi\/blog\/iso-auto-min-ss$/);
    expect(article[0].alternates).toBeUndefined();
  });

  it('declares both locales for a bilingual page', () => {
    const recipe = entries.find((e) => e.url.endsWith('/recipe/mojave-sun'));
    expect(Object.keys(recipe?.alternates?.languages ?? {})).toEqual(['en', 'vi']);
  });

  it.each(['/search', '/cameras/compare', '/admin', '/api', '?'])('never lists %s', (fragment) => {
    expect(urls.filter((u) => u.includes(fragment))).toEqual([]);
  });

  it('never lists a pilot draft', () => {
    expect(urls.filter((u) => u.includes('white-balance-shift') || u.includes('thu-nghiem'))).toEqual([]);
  });

  it('has no duplicate URL', () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});
