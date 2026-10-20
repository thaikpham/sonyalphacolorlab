import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CHECKS_KEY, checklistOrdinals } from '@/lib/lab/storage';
import type { Block } from '@/lib/lab/types';

/**
 * The article blocks, rendered without a DOM, and the wiring the article view
 * gives them. Called as plain elements with `createElement` so this file stays
 * a `.ts` the suite actually runs.
 */

const { Callout, ComparisonTable, TldrCard } = await import('./blocks');
const { Checklist } = await import('./checklist');

/** The class list on the first element that holds exactly `text`. */
function classOf(html: string, text: string): string {
  const m = new RegExp(`<[a-z0-9]+ class="([^"]*)"[^>]*>${text}<`).exec(html);
  expect(m, text).not.toBeNull();
  return m?.[1] ?? '';
}

describe('authored labels', () => {
  /* `.label` is uppercase, and uppercase is capped at three words because
     Vietnamese diacritics need the ascender room. A callout's label is its
     condition — a sentence an editor writes, up to 120 characters. */
  const long = 'Khi đọc Saturation trong một công thức';

  it('sets a callout label in sentence case', () => {
    const html = renderToStaticMarkup(createElement(Callout, { block: { t: 'callout', label: long, text: 't' } }));
    const cls = classOf(html, long);
    expect(cls.split(' ')).not.toContain('label');
    expect(cls).not.toMatch(/uppercase/);
  });

  it('sets a checklist label in sentence case', () => {
    const html = renderToStaticMarkup(
      createElement(Checklist, {
        block: { t: 'checklist', label: long, items: ['a', 'b', 'c'] },
        articleId: 'x',
        ordinal: 0,
      }),
    );
    const cls = classOf(html, long);
    expect(cls.split(' ')).not.toContain('label');
    expect(cls).not.toMatch(/uppercase/);
  });

  it('leaves the comparison chips in the case they were written', () => {
    const slider = readFileSync('src/components/lab/compare-slider.tsx', 'utf8');
    expect(slider).not.toMatch(/uppercase/);
  });
});

describe('repeated authored text', () => {
  /* The parser keeps duplicates — two rows headed "ISO" is a legitimate
     table — so a key built from the text collides, and React may drop or
     duplicate a child when it reconciles the list. A static server render
     does not warn about it, so the keys are pinned in the source too. */
  it('keys static lists by position, never by the text an editor wrote', () => {
    const blocks = readFileSync('src/components/lab/blocks.tsx', 'utf8');
    const checklist = readFileSync('src/components/lab/checklist.tsx', 'utf8');
    expect(blocks).not.toMatch(/key=\{(h|item|row\[0\])\}/);
    expect(checklist).not.toMatch(/key=\{item\}/);
  });

  it('renders every row of a table whose row headers repeat', () => {
    const html = renderToStaticMarkup(
      createElement(ComparisonTable, {
        block: {
          t: 'table',
          head: ['a', 'a', 'b'],
          rows: [
            ['ISO', '1', '2'],
            ['ISO', '3', '4'],
          ],
          caption: 'c',
        },
      }),
    );
    expect(html.match(/<th scope="row"/g)).toHaveLength(2);
  });

  it('renders repeated TL;DR lines and checklist items', () => {
    const tldr = renderToStaticMarkup(
      createElement(TldrCard, { block: { t: 'tldr', items: ['x', 'x', 'y'] }, label: 'l' }),
    );
    expect(tldr.match(/<li/g)).toHaveLength(3);
    const list = renderToStaticMarkup(
      createElement(Checklist, {
        block: { t: 'checklist', label: 'l', items: ['x', 'x', 'y'] },
        articleId: 'a',
        ordinal: 0,
      }),
    );
    expect(list.match(/<li/g)).toHaveLength(3);
  });
});

describe('checklist ticks', () => {
  /* Keyed by block index, a reader's ticks moved or vanished whenever an
     editor inserted a figure above the checklist. The ordinal counts
     checklists only, so editing anything else leaves it alone. */
  it('numbers checklists among themselves, not among all blocks', () => {
    const list: Block = { t: 'checklist', label: 'l', items: ['a'] };
    const p: Block = { t: 'p', text: 'p' };
    const fig: Block = { t: 'figure', caption: 'c' };
    expect(checklistOrdinals([p, list, p, list])).toEqual([-1, 0, -1, 1]);
    expect(checklistOrdinals([p, fig, list, p, fig, list])).toEqual([-1, -1, 0, -1, -1, 1]);
    // A new scheme under a new key: old position-keyed ticks are not misread.
    expect(CHECKS_KEY).toBe('alpha-lab-checks-v2');
  });

  it('is what the article view hands each checklist', () => {
    const view = readFileSync('src/components/lab/article-view.tsx', 'utf8');
    expect(view).toMatch(/checklistOrdinals\(article\.blocks\)/);
    expect(view).toMatch(/<Checklist key=\{i\} block=\{block\} articleId=\{articleId\} ordinal=\{/);
    expect(view).not.toMatch(/blockIndex/);
  });
});

describe('the article view', () => {
  const view = readFileSync('src/components/lab/article-view.tsx', 'utf8');

  it('fails to compile when a block type has no renderer', () => {
    /* No default and no declared return type: a new member of the union
       compiled, and every article holding one silently dropped it. */
    expect(view).toMatch(/default: \{[\s\S]{0,400}?const unreachable: never = block/);
  });
});
