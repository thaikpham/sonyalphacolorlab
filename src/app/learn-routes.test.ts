import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bilingualAlternates } from '@/i18n/alternates';

/**
 * `/learn` and the article pages, pinned at the source.
 *
 * The rules here are invisible on screen: which list a route reads (a
 * knowledge page served under /blog would render perfectly well), which URL
 * a page calls canonical, and which room it is painted in. Each one has a
 * reason in ADR 0001 or 0004.
 */

const read = (p: string) => readFileSync(p, 'utf8');

const LEARN_INDEX = 'src/app/[locale]/learn/page.tsx';
const LEARN_PAGE = 'src/app/[locale]/learn/[id]/page.tsx';
const GLOSSARY = 'src/app/[locale]/learn/glossary/page.tsx';
const BLOG_PAGE = 'src/app/[locale]/blog/[id]/page.tsx';

describe('the reference shelf', () => {
  it.each([LEARN_INDEX, LEARN_PAGE, GLOSSARY])('%s is the paper room', (path) => {
    /* The same room as /blog (DESIGN.md rule 3 names /learn). */
    expect(read(path)).toMatch(/className="theme-paper contents"/);
    expect(read(path)).toMatch(/themeColor: '#F9F8F5'/);
  });

  it('serves knowledge pages only, from the published read', () => {
    const src = read(LEARN_PAGE);
    expect(src).toContain('getPublishedKnowledgePage(id)');
    expect(src).toMatch(/if \(!page\) notFound\(\)/);
    expect(src).not.toMatch(/\bARTICLES\b|getPublishedArticle/);
  });

  it('lists only knowledge pages on the index', () => {
    const src = read(LEARN_INDEX);
    expect(src).toContain('getPublishedKnowledge()');
    expect(src).not.toMatch(/getPublishedArticles|getPublishedEntries/);
  });

  it('builds the glossary from the explanation tables, not from authored rows', () => {
    expect(read(GLOSSARY)).toContain('buildGlossary(locale)');
  });
});

describe('canonical URLs for Vietnamese bodies (ADR 0004)', () => {
  it.each([
    [BLOG_PAGE, '/blog/'],
    [LEARN_PAGE, '/learn/'],
  ])('%s names the Vietnamese URL canonical and declares no alternates', (path, prefix) => {
    const src = read(path);
    expect(src).toMatch(/ARTICLE_LANG === routing\.defaultLocale/);
    expect(src).toContain(`\`/\${ARTICLE_LANG}${prefix}\${id}\``);
    expect(src).toMatch(/alternates: \{ canonical: canonicalPath\(id\) \}/);
    /* No hreflang: the English route is the same Vietnamese body under
       English chrome, not a translation. */
    expect(src).not.toMatch(/languages:/);
  });

  it.each([LEARN_INDEX, GLOSSARY])('%s is bilingual, so both locales are alternates', (path) => {
    expect(read(path)).toMatch(/alternates: bilingualAlternates\(locale, '\/learn(\/glossary)?'\)/);
  });

  it.each([
    ['src/app/[locale]/page.tsx', '/'],
    ['src/app/[locale]/colorlab/page.tsx', '/colorlab'],
    ['src/app/[locale]/cameras/page.tsx', '/cameras'],
    ['src/app/[locale]/audio/page.tsx', '/audio'],
    ['src/app/[locale]/blog/page.tsx', '/blog'],
    ['src/app/[locale]/blog/setup/page.tsx', '/blog/setup'],
  ])('%s canonicalises its filtered views to the bare path', (path, rest) => {
    expect(read(path)).toContain(`alternates: bilingualAlternates(locale, '${rest}')`);
  });

  it.each([BLOG_PAGE, LEARN_PAGE])('%s emits article structured data', (path) => {
    expect(read(path)).toMatch(/<ArticleStructuredData article=\{\w+\} path=\{canonicalPath\(id\)\} \/>/);
  });
});

describe('article structured data', () => {
  const src = read('src/components/structured-data.tsx');

  it('never claims a publication date the store does not keep', () => {
    expect(src).not.toMatch(/datePublished['"]?\s*:/);
    expect(src).toMatch(/dateModified: article\.updatedAt/);
    expect(src).toMatch(/inLanguage: ARTICLE_LANG/);
  });

  it('points SearchAction at the page that searches', () => {
    expect(src).toMatch(/urlTemplate: `\$\{home\}\/search\?q=\{search_term_string\}`/);
    expect(src).not.toMatch(/\$\{home\}\/\?q=/);
  });
});

describe('bilingualAlternates', () => {
  it('names each locale canonical for itself under the as-needed prefix', () => {
    expect(bilingualAlternates('en', '/colorlab')).toEqual({
      canonical: '/colorlab',
      languages: { en: '/colorlab', vi: '/vi/colorlab' },
    });
    expect(bilingualAlternates('vi', '/').canonical).toBe('/vi');
  });
});
