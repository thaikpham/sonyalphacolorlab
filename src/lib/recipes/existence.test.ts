import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publishedRecipeExists, publishedRecipeFormat } from './existence';
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
  slugs: [] as readonly string[],
  columns: '' as string,
  published: undefined as unknown,
  limit: undefined as number | undefined,
  result: {
    data: null as { id: string }[] | { format: string }[] | null,
    error: null as { message: string } | null,
  },
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
          expect(['id', 'format']).toContain(columns);
          query.columns = columns;
          return builder;
        },
        in: (column: string, values: readonly string[]) => {
          expect(column).toBe('slug');
          query.slugs = values;
          return builder;
        },
        eq: (column: string, value: unknown) => {
          if (column === 'published') query.published = value;
          return builder;
        },
        limit: async (n: number) => {
          query.limit = n;
          return query.result;
        },
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
  query.slugs = [];
  query.limit = undefined;
  query.columns = '';
  query.published = undefined;
  query.result = { data: null, error: null };
});

describe('publishedRecipeExists', () => {
  it('is true for a published recipe', async () => {
    query.result = { data: [{ id: 'r1' }], error: null };
    await expect(publishedRecipeExists('pp-027-vivid-daylight-cinema')).resolves.toBe(true);
    expect(query.columns).toBe('id');
    expect(query.limit).toBe(1);
  });

  /* The content plane's slugs change when the owner applies its migration,
     at a time the code cannot know: a page read under either spelling must
     still be writable (S9). */
  it('asks for every spelling the slug has had, in both directions', async () => {
    await publishedRecipeExists('daylight-cinema');
    expect(query.slugs).toEqual(['daylight-cinema', 'pp-027-vivid-daylight-cinema']);
    await publishedRecipeExists('pp-027-vivid-daylight-cinema');
    expect(query.slugs).toEqual(['pp-027-vivid-daylight-cinema', 'daylight-cinema']);
    await publishedRecipeExists('never-existed');
    expect(query.slugs).toEqual(['never-existed']);
  });

  it('is false when no row matches', async () => {
    await expect(publishedRecipeExists('never-existed')).resolves.toBe(false);
    query.result = { data: [], error: null };
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

describe('publishedRecipeFormat', () => {
  /* The proposals route validates settings against the recipe's own format —
     a Picture Profile proposal on a Creative Look recipe is Rule 2 broken in a
     jsonb column — so its existence probe has to say which format it found. */
  it('names the format of a published recipe, reading only that column', async () => {
    query.result = { data: [{ format: 'cl' }], error: null };
    await expect(publishedRecipeFormat('fl-raoul-rutnam')).resolves.toBe('cl');
    expect(query.columns).toBe('format');
    expect(query.published).toBe(true);
    expect(query.slugs).toEqual(['fl-raoul-rutnam', 'cl-001-film-hard-faded']);
  });

  it('is null when no published row matches', async () => {
    await expect(publishedRecipeFormat('never-existed')).resolves.toBeNull();
  });

  it('throws ContentUnavailableError rather than reporting the recipe missing', async () => {
    query.result = { data: null, error: { message: 'exceed_cached_egress_quota' } };
    await expect(publishedRecipeFormat('x')).rejects.toBeInstanceOf(ContentUnavailableError);
  });

  it('refuses a format it does not know instead of passing it on', async () => {
    query.result = { data: [{ format: 'raw' }], error: null };
    await expect(publishedRecipeFormat('x')).rejects.toBeInstanceOf(ContentUnavailableError);
  });
});
