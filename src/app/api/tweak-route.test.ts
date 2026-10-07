import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentUnavailableError, ControlUnavailableError } from '@/lib/supabase/errors';

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
  controlDown: false,
};

/* The bearer token *is* the address here, so a test can sign in as anyone.
   The real `requireUser` asks the control project; what is under test is what
   the route does with its answer. */
vi.mock('@/lib/auth/require-user', () => ({
  requireUser: async (req: Request) => {
    if (state.controlDown) throw new ControlUnavailableError('getUser: 503');
    const header = req.headers.get('authorization') ?? '';
    const email = header.startsWith('Bearer ') ? header.slice(7) : '';
    return email
      ? { id: email, email, name: email, avatarUrl: null, assuranceLevel: 'aal1' }
      : null;
  },
}));

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

const BODY = { slug: 'mojave-sun', request: 'warmer please', locale: 'en' };

const post = (as: string | null = 'reader@example.com', body: unknown = BODY) =>
  POST(
    new Request('http://localhost/api/tweak', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(as ? { authorization: `Bearer ${as}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  resetRateLimits();
  tweakRecipe.mockClear();
  state.recipe = { slug: 'mojave-sun' };
  state.recipeThrows = null;
  state.controlDown = false;
  vi.unstubAllEnvs();
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

/**
 * A paid endpoint answers signed-in readers only.
 *
 * It used to be anonymous, limited per `x-forwarded-for` — a header the caller
 * sets — and per warm instance. A script on rotating addresses could spend the
 * daily budget several times over. The limit is per verified address now.
 */
describe('identity', () => {
  it('refuses a request with no session, before it spends any budget', async () => {
    vi.stubEnv('AI_DAILY_CALL_CAP', '1');
    const res = await post(null);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
    expect(tweakRecipe).not.toHaveBeenCalled();

    /* The one call today's cap allows is still there for a signed-in reader. */
    expect((await post()).status).toBe(200);
  });

  it('answers controlUnavailable 503 when the session cannot be checked', async () => {
    state.controlDown = true;
    const res = await post();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'controlUnavailable' });
    expect(tweakRecipe).not.toHaveBeenCalled();
  });

  it('rate limits per verified address, not per client-supplied header', async () => {
    for (let i = 0; i < 5; i++) expect((await post('a@example.com')).status).toBe(200);
    const limited = await post('a@example.com');
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'rateLimited' });

    expect((await post('b@example.com')).status).toBe(200);
  });
});
