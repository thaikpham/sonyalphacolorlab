import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import type { ContentRef } from '@/lib/lab/types';

vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/i18n/navigation', () => ({ Link: () => null }));

const { refsUnavailable } = await import('./related-links');

/**
 * "Some related links could not be loaded" is a claim about this page's
 * links, so it is made only when a source one of them resolves from failed.
 * It used to show whenever any source failed: the audio catalogue going
 * down put the notice under an article whose links were all recipes.
 */

const recipe: ContentRef = { kind: 'recipe', id: 'PP-001' };
const product: ContentRef = { kind: 'product', id: 'sony-ilce-7m4' };
const page: ContentRef = { kind: 'knowledge', id: 'white-balance-shift' };

describe('refsUnavailable', () => {
  it('is false when the failed source is not one these links read', () => {
    expect(refsUnavailable([recipe], ['products'])).toBe(false);
    expect(refsUnavailable([recipe, page], ['products'])).toBe(false);
  });

  it('is true when a link reads from the failed source', () => {
    expect(refsUnavailable([recipe, product], ['products'])).toBe(true);
    expect(refsUnavailable([page], ['pages'])).toBe(true);
    expect(refsUnavailable([{ kind: 'article', id: 'a' }], ['pages'])).toBe(true);
    expect(refsUnavailable([recipe], ['recipes'])).toBe(true);
  });

  it('is false with no links, whatever failed', () => {
    expect(refsUnavailable([], ['pages', 'recipes', 'products'])).toBe(false);
  });

  it('is what the article view asks', () => {
    const view = readFileSync('src/components/lab/article-view.tsx', 'utf8');
    expect(view).toMatch(/unavailable=\{refsUnavailable\(article\.meta\.related, unavailable\)\}/);
  });
});

describe('the glossary chips under a recipe', () => {
  it('name the group from CONCEPT_GROUP_LABELS, the heading they link to', () => {
    /* Rule 3: technical labels live in one constants source. Retyped here,
       a rename would leave the chips out of step with the glossary group. */
    const source = readFileSync('src/components/content/reverse-links.tsx', 'utf8');
    expect(source).not.toMatch(/'Picture Profile'|'Creative Look'|White Balance/);
    expect(source).toMatch(/CONCEPT_GROUP_LABELS\[format\]/);
    expect(source).toMatch(/CONCEPT_GROUP_LABELS\.wb/);
  });
});
