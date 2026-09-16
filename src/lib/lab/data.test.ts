import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { articleFromPublicRow } from './data';

/**
 * The blog had two sources of truth and neither knew about the other.
 *
 * The admin editor wrote `lab_articles`; every reading surface — the feed, the
 * article route, `generateStaticParams`, the sitemap, the metadata — returned
 * the compiled `ARTICLES` array. A save therefore succeeded, said so, and
 * changed nothing a reader could see. That is the defect this reader closes,
 * and these tests are what stop it reopening: the array may be reached only
 * through the explicit offline branch, never as a fallback from a failed query.
 *
 * The mapper is tested directly rather than through the query, because what
 * matters about it is that it treats a row as untrusted input. An administrator
 * is trusted to publish; the JSON their browser sent is still JSON.
 */

const ROW = {
  id: 'body-ev-vs-flash-ev',
  topic: 'exposure',
  level: 'mid',
  archetype: 'explainer',
  read: '8 phút',
  title: 'Body EV và Flash EV',
  dek: 'Hai thanh bù trừ, hai vùng ảnh khác nhau.',
  blocks: [{ t: 'p', text: 'Một đoạn văn.' }],
  updated_at: '2026-09-09T00:00:00.000Z',
};

describe('articleFromPublicRow', () => {
  it('maps a well-formed row', () => {
    expect(articleFromPublicRow(ROW)).toMatchObject({
      id: 'body-ev-vs-flash-ev',
      topic: 'exposure',
      level: 'mid',
      title: 'Body EV và Flash EV',
      blocks: [{ t: 'p', text: 'Một đoạn văn.' }],
    });
  });

  it.each([
    ['no id', { ...ROW, id: '' }],
    ['no title', { ...ROW, title: '   ' }],
    ['an id that is not a string', { ...ROW, id: 42 }],
  ])('refuses a row with %s', (_label, row) => {
    expect(articleFromPublicRow(row as Record<string, unknown>)).toBeNull();
  });

  it('falls back to a valid topic and level rather than rendering an unknown one', () => {
    const mapped = articleFromPublicRow({ ...ROW, topic: 'astrophotography', level: 'wizard' });
    expect(mapped).toMatchObject({ topic: 'setup', level: 'newbie' });
  });

  it('drops a malformed block instead of handing it to a renderer', () => {
    const mapped = articleFromPublicRow({
      ...ROW,
      blocks: [{ t: 'p', text: 'kept' }, { t: 'not-a-block' }, { t: 'p' }],
    });
    expect(mapped?.blocks).toEqual([{ t: 'p', text: 'kept' }]);
  });

  it('survives blocks that are not an array at all', () => {
    expect(articleFromPublicRow({ ...ROW, blocks: 'nonsense' })?.blocks).toEqual([]);
  });
});

describe('the published query', () => {
  const source = readFileSync('src/lib/lab/data.ts', 'utf8');

  it('reads the content plane with the anon client', () => {
    expect(source).toMatch(/contentRead\(\)[\s\S]{0,80}lab_articles/);
    expect(source).not.toContain('contentAdmin');
    expect(source).not.toContain('controlRead');
  });

  it('never selects updated_by, which is an editor address', () => {
    /* The anon key ships in the browser bundle, so a column in this select
       list is a column the whole internet can read. */
    expect(source).toMatch(/const PUBLIC_COLUMNS = '[^']*'/);
    const columns = source.match(/const PUBLIC_COLUMNS = '([^']*)'/)?.[1] ?? '';
    expect(columns).not.toContain('updated_by');
    expect(columns).not.toContain('*');
  });

  it('filters to published rows in the query, not only in RLS', () => {
    expect(source).toMatch(/\.eq\('status', 'published'\)/);
  });

  it('reaches the compiled catalogue only through the offline branch', () => {
    /* The regression to prevent: `catch { return ARTICLES }`. The array is a
       Git-time snapshot, so serving it on a failed read republishes every
       article an administrator has deleted or unpublished since the last
       commit — silently, and for as long as the outage lasts. */
    expect(source).toContain('contentOrOfflineSeed');
    expect(source).toMatch(/isDevStore\(\) \? devPublished\(\) : ARTICLES/);
    expect(source).not.toMatch(/catch[\s\S]{0,120}ARTICLES/);
    /* One reference in code — the offline branch — plus the import. Anything
       more is a second path to the snapshot. */
    const inCode = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('/*'));
    expect(inCode.join('\n').match(/\bARTICLES\b/g)).toHaveLength(2);
  });
});

describe('the reading surfaces', () => {
  const SURFACES = [
    'src/app/[locale]/blog/page.tsx',
    'src/app/[locale]/blog/[id]/page.tsx',
    'src/app/sitemap.ts',
  ];

  it.each(SURFACES)('%s goes through the shared reader', (path) => {
    const source = readFileSync(path, 'utf8');
    expect(source).toMatch(/getPublishedArticles?\(/);
    /* Importing the array here is what made a save invisible. */
    expect(source).not.toMatch(/from '@\/lib\/lab\/articles'[\s\S]*ARTICLES/);
    expect(source).not.toMatch(/\bARTICLES\b/);
  });
});
