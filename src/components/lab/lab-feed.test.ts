import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_META } from '@/lib/lab/meta';
import type { Article } from '@/lib/lab/types';

/**
 * The feed, rendered with fixtures — the reason it takes its catalogue as a
 * prop. `next-intl` renders each key as itself, so the branches below are
 * told apart by which keys reach the markup.
 */

vi.mock('next-intl/server', () => ({
  getTranslations: async () =>
    Object.assign((key: string) => key, { has: () => false }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: unknown; children?: ReactNode }) =>
    createElement('a', { href: typeof href === 'string' ? href : JSON.stringify(href), ...rest }, children),
}));

const { LabFeed, parseFilter } = await import('./lab-feed');

const article = (id: string, patch: Partial<Article> = {}): Article => ({
  id,
  kind: 'article',
  topic: 'color',
  level: 'mid',
  archetype: 'explainer',
  read: '6 phút đọc',
  title: `Title ${id}`,
  dek: `Dek ${id}.`,
  blocks: [],
  meta: EMPTY_META,
  ...patch,
});

const feed = async (filter: Parameters<typeof parseFilter>[0], articles: Article[]) =>
  renderToStaticMarkup(await LabFeed({ filter: parseFilter(filter), articles }));

describe('parseFilter', () => {
  it('reads a known topic and level', () => {
    expect(parseFilter({ topic: 'af', level: 'pro' })).toEqual({ topic: 'af', level: 'pro' });
  });

  it.each([
    [{}],
    [{ topic: ['af', 'color'], level: 'xx' }],
    [{ topic: undefined, level: ['newbie'] }],
    [{ topic: 'glossary', level: '' }],
  ])('treats an array, an unknown id or nothing as no filter: %j', (params) => {
    expect(parseFilter(params)).toEqual({ topic: 'all', level: 'all' });
  });
});

describe('LabFeed', () => {
  it('says a stage is empty when it has no articles at all', async () => {
    const html = await feed({ level: 'pro' }, [article('a')]);
    expect(html).toContain('stageEmptyTitle');
    expect(html).not.toContain('pinnedTitle');
  });

  it('says the filter matched nothing when the stage has articles elsewhere', async () => {
    const html = await feed({ level: 'mid', topic: 'setup' }, [article('a')]);
    expect(html).toContain('emptyTitle');
    expect(html).not.toContain('stageEmptyTitle');
    expect(html).not.toContain('pinnedTitle');
  });

  it('shows the pinned tool, and no empty state, where only the tool matches', async () => {
    const html = await feed({ level: 'newbie', topic: 'setup' }, [article('a')]);
    expect(html).toContain('pinnedTitle');
    expect(html).not.toMatch(/emptyTitle|stageEmptyTitle/);
  });

  it('lists the matching articles', async () => {
    const html = await feed({}, [article('a'), article('b', { level: 'pro', topic: 'af' })]);
    expect(html).toContain('Title a');
    expect(html).toContain('Title b');
    expect(html).toContain('pinnedTitle');
  });

  it('prints no dangling separator or empty paragraph for a blank read time or dek', async () => {
    /* Both are '' when a row was saved without them. The row printed
       "topic · " and an empty line under the title. */
    const html = await feed({ level: 'mid' }, [article('a', { read: '', dek: '' })]);
    const row = html.slice(html.indexOf('href="/blog/a"'));
    const link = row.slice(0, row.indexOf('</a>'));
    expect(link).not.toMatch(/·\s*(<span[^>]*>)?\s*<\/span>/);
    expect(link).not.toMatch(/<p[^>]*><\/p>/);
  });
});

describe('the feed’s context lines', () => {
  /* "STAGE 01 · BEGINNER › CAMERA SETUP" is seven words of uppercase, and
     uppercase is capped at three — Vietnamese diacritics need the ascender
     room. The lines that compose several labels recede by weight and ink
     step instead. */
  const context = (html: string) => {
    const at = html.indexOf('id="articles"');
    expect(at).toBeGreaterThan(-1);
    return html.slice(at, html.indexOf('</div>', at));
  };
  const rowLine = (html: string, id: string) => {
    const at = html.indexOf(`href="/blog/${id}"`);
    expect(at).toBeGreaterThan(-1);
    return html.slice(at, html.indexOf('</p>', at));
  };

  it.each([
    ['a stage and a topic', { level: 'mid', topic: 'color' }, 'stageLabel'],
    ['every article', {}, 'allTopics'],
  ])('sets the context line for %s without .label', async (_label, filter, key) => {
    const line = context(await feed(filter, [article('a')]));
    expect(line).toContain(key);
    expect(line).not.toMatch(/class="label[ "]/);
  });

  it('sets an article row’s topic and read time without .label', async () => {
    const line = rowLine(await feed({}, [article('a')]), 'a');
    expect(line).toContain('topics.color');
    expect(line).not.toMatch(/class="label[ "]/);
  });

  it('does the same on the article page', () => {
    const view = readFileSync('src/components/lab/article-view.tsx', 'utf8');
    expect(view).not.toMatch(/<p className="label mb-3">/);
  });
});
