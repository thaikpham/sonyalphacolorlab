import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publishedRecipeExists } from './existence';
import { ContentUnavailableError } from '@/lib/supabase/errors';

/**
 * The only thing standing between a cross-project reference and an orphan row.
 *
 * `recipe_comments.recipe_slug` has no foreign key and, after the split, cannot
 * have one: the recipe lives in a different Postgres. So the check is an
 * application-level one, and the interesting case is not "missing" — it is
 * "could not ask". Returning `false` on an outage would answer 404 to every
 * comment on every recipe while the content project was restricted, which reads
 * to a user as "this recipe was deleted".
 */

const query = {
  slug: '' as string,
  published: undefined as unknown,
  result: { data: null as { id: string } | null, error: null as { message: string } | null },
};

vi.mock('@/lib/supabase/server', () => ({
  contentRead: () => ({
    from: (table: string) => {
      expect(table).toBe('recipes');
      const builder = {
        select: (columns: string) => {
          /* Never `*`. A published-existence probe has no business reading the
             rest of the row, and a `select('*')` here is how a column added
             later starts travelling on a hot path. */
          expect(columns).toBe('id');
          return builder;
        },
        eq: (column: string, value: unknown) => {
          if (column === 'slug') query.slug = value as string;
          if (column === 'published') query.published = value;
          return builder;
        },
        maybeSingle: async () => query.result,
      };
      return builder;
    },
  }),
  controlRead: () => {
    throw new Error('a recipe does not live on the control plane');
  },
  controlAdmin: () => {
    throw new Error('a recipe does not live on the control plane');
  },
  contentAdmin: () => {
    throw new Error('an existence probe must not use a service credential');
  },
  hasContentConfig: () => true,
  hasControlConfig: () => true,
}));

beforeEach(() => {
  query.slug = '';
  query.published = undefined;
  query.result = { data: null, error: null };
});

describe('publishedRecipeExists', () => {
  it('is true for a published recipe', async () => {
    query.result = { data: { id: 'r1' }, error: null };
    await expect(publishedRecipeExists('daylight-cinema')).resolves.toBe(true);
    expect(query.slug).toBe('daylight-cinema');
  });

  it('is false when no row matches', async () => {
    await expect(publishedRecipeExists('never-existed')).resolves.toBe(false);
  });

  it('asks only about published rows, so a draft cannot be commented on', async () => {
    await publishedRecipeExists('draft-recipe');
    expect(query.published).toBe(true);
  });

  it('throws ContentUnavailableError rather than reporting the recipe missing', async () => {
    query.result = { data: null, error: { message: 'exceed_cached_egress_quota' } };
    await expect(publishedRecipeExists('daylight-cinema')).rejects.toBeInstanceOf(
      ContentUnavailableError,
    );
  });

  it('keeps the upstream message out of the thrown error', async () => {
    query.result = { data: null, error: { message: 'relation "recipes" does not exist' } };
    await expect(publishedRecipeExists('x')).rejects.toThrow(/^recipes\.exists$/);
  });
});
