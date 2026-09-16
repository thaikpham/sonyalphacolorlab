import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from './content-freeze';

/**
 * The freeze has to be boring and it has to be narrow.
 *
 * Boring: only the exact string `true`. A switch that accepts `1`, `yes` or
 * `TRUE` is a switch somebody turns on by accident and then cannot find,
 * because the value they are looking at looks off.
 *
 * Narrow: it stops the three mutations whose rows are mid-migration and
 * nothing else. If it took Auth or the community routes down with it, a cutover
 * delta measured over ten minutes would read to every visitor as an outage, and
 * the pressure to skip the freeze — and lose a write — would win.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('contentAdminWritesFrozen', () => {
  it('is off by default', () => {
    expect(contentAdminWritesFrozen()).toBe(false);
  });

  it('is on for exactly true', () => {
    vi.stubEnv('CONTENT_ADMIN_FROZEN', 'true');
    expect(contentAdminWritesFrozen()).toBe(true);
  });

  it.each(['TRUE', '1', 'yes', 'true ', ''])('stays off for %o', (value) => {
    vi.stubEnv('CONTENT_ADMIN_FROZEN', value);
    expect(contentAdminWritesFrozen()).toBe(false);
  });

  it('answers with a code, never a sentence', () => {
    expect(CONTENT_ADMIN_FROZEN).toEqual({ error: 'contentAdminFrozen' });
  });
});

describe('what the freeze must not reach', () => {
  const UNAFFECTED = [
    'src/app/api/comments/route.ts',
    'src/app/api/community-photos/route.ts',
    'src/app/api/proposals/route.ts',
    'src/app/api/proposals/vote/route.ts',
    'src/app/api/admin/session/route.ts',
    'src/lib/lab/data.ts',
    'src/lib/recipes/source.ts',
    'src/lib/cameras/data.ts',
  ];

  it.each(UNAFFECTED)('%s ignores it', (path) => {
    expect(readFileSync(path, 'utf8')).not.toContain('contentAdminWritesFrozen');
  });
});
