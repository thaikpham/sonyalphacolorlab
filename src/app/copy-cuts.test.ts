import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Copy cut to one sentence and one action (sub-project 5, 2026-10-28): an
 * empty state is a title and the button that leaves it, an error page one
 * sentence and Try again, and a tab shows no count of nothing.
 */
type Tree = { [k: string]: string | Tree };
const msgs = Object.fromEntries(
  ['en', 'vi'].map((l) => [l, JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')) as Tree]),
) as Record<'en' | 'vi', Tree>;
const at = (l: 'en' | 'vi', path: string) =>
  path.split('.').reduce<string | Tree | undefined>((n, k) => (typeof n === 'object' ? n[k] : undefined), msgs[l]);
const src = (p: string) => readFileSync(p, 'utf8');

describe('the cut copy', () => {
  it('reads as one sentence each', () => {
    expect(at('vi', 'home.emptyTitle')).toBe('Không có công thức nào khớp bộ lọc.');
    expect(at('en', 'home.emptyTitle')).toBe('No recipes match these filters.');
    expect(at('vi', 'home.emptyAction')).toBe('Xoá bộ lọc');
    expect(at('en', 'home.emptyAction')).toBe('Clear filters');
    expect(at('vi', 'error.body')).toBe('Lỗi từ phía chúng tôi, không phải bạn.');
    expect(at('en', 'error.body')).toBe('That’s on us, not you.');
  });

  it('has no explanatory tails left', () => {
    for (const l of ['en', 'vi'] as const) {
      expect(at(l, 'home.emptyTail')).toBeUndefined();
      expect(at(l, 'lab.emptyBody')).toBeUndefined();
      expect(at(l, 'lab.stageEmptyBody')).toBeUndefined();
    }
  });

  it('makes the empty catalogue a button out, not a sentence around a link', () => {
    const browse = src('src/components/browse/recipe-browse.tsx');
    expect(browse).not.toContain("t('emptyTail'");
    expect(browse).toMatch(/<Link href="\/colorlab" className="btn-glass">\s*\{t\('emptyAction'\)\}/);
  });

  it('shows a tab count only when there is something to count', () => {
    const community = src('src/components/recipe-community-section.tsx');
    expect(community).toContain("commentsLoaded && comments.length > 0 ? t('tabComments', { count: comments.length }) : t('tabCommentsPlain')");
    expect(community).toMatch(/proposalsLoaded && proposals\.length > 0\s*\?\s*t\('tabProposals', \{ count: proposals\.length \}\)\s*:\s*t\('tabProposalsPlain'\)/);
  });

  it('gives an empty feed its title and the way out, nothing between', () => {
    const feed = src('src/components/lab/lab-feed.tsx');
    expect(feed).not.toContain("t('emptyBody')");
    expect(feed).not.toContain("t('stageEmptyBody')");
  });
});
