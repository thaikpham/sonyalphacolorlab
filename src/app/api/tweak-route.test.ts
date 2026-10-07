import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentUnavailableError } from '@/lib/supabase/errors';

/**
 * What `/api/tweak` answers when something it depends on fails — executed,
 * not pattern-matched. `tweak-error-codes.test.ts` pins the vocabulary against
 * the source; this pins which code a real failure turns into.
 *
 * The model and the recipe source are fakes. Nothing here reaches Anthropic or
 * Supabase.
 */

const state = {
  recipe: null as unknown,
  recipeThrows: null as Error | null,
};

const tweakRecipe = vi.fn(async () => ({
  ok: true as const,
  whiteBalance: { mode: 'auto' },
  settings: {},
  summary: 'ok',
}));

vi.mock('@/lib/recipes/source', () => ({
  getRecipe: async () => {
    if (state.recipeThrows) throw state.recipeThrows;
    return state.recipe;
  },
}));

vi.mock('@/lib/ai/tweak', () => ({ tweakRecipe }));

const { POST } = await import('./tweak/route');
const { resetRateLimits } = await import('@/lib/ai/rate-limit');

const post = (body: unknown = { slug: 'mojave-sun', request: 'warmer please', locale: 'en' }) =>
  POST(
    new Request('http://localhost/api/tweak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  resetRateLimits();
  tweakRecipe.mockClear();
  state.recipe = { slug: 'mojave-sun' };
  state.recipeThrows = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('a content outage', () => {
  it('answers contentUnavailable 503 with a body, never a bare 500', async () => {
    state.recipeThrows = new ContentUnavailableError('recipes.get');
    const res = await post();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'contentUnavailable' });
    expect(tweakRecipe).not.toHaveBeenCalled();
  });

  it('still answers recipeNotFound for a slug that is genuinely absent', async () => {
    state.recipe = null;
    const res = await post();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'recipeNotFound' });
  });
});
