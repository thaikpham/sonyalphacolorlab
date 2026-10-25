import { beforeEach, describe, expect, it, vi } from 'vitest';
import seed from '../../../data/recipes.seed.json';
import type { RecipeView } from '../recipes/source';

/**
 * What `tweakRecipe` does with what the model sends back — executed, with the
 * SDK replaced.
 *
 * The retry with feedback was dead code for as long as it existed. It called
 * `messages.parse`, and in SDK 0.115 that parse runs Zod itself and *throws* on
 * a failure, so `parsed_output` was never null: an out-of-range value left the
 * loop as an exception and the route answered 502 `unavailable`. A refusal,
 * whose text is not JSON, threw the same way before `stop_reason` was read.
 * Nothing caught it because nothing ran the function.
 */

type Reply = { stop_reason: string; content: { type: 'text'; text: string }[] };

const model = {
  replies: [] as Reply[],
  prompts: [] as string[],
};

type Params = {
  messages: { content: string }[];
  output_config?: { format?: { parse?: (text: string) => unknown } };
};

/* `parse` behaves as SDK 0.115's does: it runs the format's own parser over
   the text and rethrows whatever that throws. Faking it as "returns null on a
   bad value" is the assumption that hid the bug. */
vi.mock('@anthropic-ai/sdk', () => {
  const create = async (params: Params) => {
    model.prompts.push(params.messages[0].content);
    const reply = model.replies.shift();
    if (!reply) throw new Error('no reply queued');
    return reply;
  };
  return {
    default: class {
      messages = {
        create,
        parse: async (params: Params) => {
          const reply = await create(params);
          const parsed_output = params.output_config?.format?.parse?.(reply.content[0].text);
          return { ...reply, parsed_output };
        },
      };
    },
  };
});

const { tweakRecipe } = await import('./tweak');

const recipe = (seed as unknown as RecipeView[]).find((r) => r.slug === 'pp-001-vivid-nostalgia-film')!;

const answer = (value: unknown, stop_reason = 'end_turn'): Reply => ({
  stop_reason,
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
});

const valid = {
  whiteBalance: recipe.whiteBalance,
  settings: recipe.settings,
  summary: 'Warmer.',
};

/* Black Level is -15…+15 on the camera; 40 cannot be entered. */
const outOfRange = {
  ...valid,
  settings: { ...(recipe.settings as Record<string, unknown>), blackLevel: 40 },
};

beforeEach(() => {
  model.replies = [];
  model.prompts = [];
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('tweakRecipe', () => {
  it('returns a valid first answer', async () => {
    model.replies = [answer(valid)];
    const out = await tweakRecipe(recipe, 'warmer');
    expect(out).toMatchObject({ ok: true, attempts: 1, summary: 'Warmer.' });
  });

  it('retries once with the failing path fed back, then succeeds', async () => {
    model.replies = [answer(outOfRange), answer(valid)];
    const out = await tweakRecipe(recipe, 'warmer');
    expect(out).toMatchObject({ ok: true, attempts: 2 });
    expect(model.prompts).toHaveLength(2);
    expect(model.prompts[0]).not.toContain('rejected');
    expect(model.prompts[1]).toContain('settings.blackLevel');
  });

  it('answers invalidResult after two invalid answers', async () => {
    model.replies = [answer(outOfRange), answer(outOfRange)];
    expect(await tweakRecipe(recipe, 'warmer')).toEqual({
      ok: false,
      error: 'invalidResult',
      attempts: 2,
    });
  });

  it('treats text that is not JSON as an invalid answer, not an outage', async () => {
    model.replies = [answer('Sure! Here is a warmer recipe.'), answer(valid)];
    expect(await tweakRecipe(recipe, 'warmer')).toMatchObject({ ok: true, attempts: 2 });
  });

  it('maps a refusal to declined without retrying', async () => {
    model.replies = [answer('I cannot help with that.', 'refusal')];
    expect(await tweakRecipe(recipe, 'warmer')).toEqual({
      ok: false,
      error: 'declined',
      attempts: 1,
    });
    expect(model.prompts).toHaveLength(1);
  });

  it('maps a truncated answer to invalidResult', async () => {
    model.replies = [answer('{"whiteBalance":', 'max_tokens')];
    expect(await tweakRecipe(recipe, 'warmer')).toMatchObject({
      ok: false,
      error: 'invalidResult',
    });
  });

  it('lets an upstream failure throw, so the route answers unavailable', async () => {
    model.replies = [];
    await expect(tweakRecipe(recipe, 'warmer')).rejects.toThrow('no reply queued');
  });
});
