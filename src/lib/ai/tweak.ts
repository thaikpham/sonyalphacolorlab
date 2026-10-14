import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { clSettingsSchema, ppSettingsSchema, whiteBalanceSchema } from '../camera/schema';
import { formatWhiteBalance } from '../camera/format';
import { constraintsFor } from './constraints';
import type { TweakErrorCode } from './errors';
import type { RecipeView } from '../recipes/source';

/**
 * "Tweak with AI" — adjusts an existing recipe from a natural-language request.
 *
 * Three layers keep the output shootable on a real camera:
 *   1. Structured outputs constrain the JSON *shape* to the same Zod schema the
 *      rest of the app uses. Only the shape: the SDK's schema transform moves
 *      `enum` and `const` into description text, so an invented gamma, colour
 *      mode or Look can still arrive.
 *   2. The prompt states the legal values, generated from `constants.ts` —
 *      necessary because the JSON Schema subset has no `minimum`/`maximum`, so
 *      structured outputs strips those bounds before sending.
 *   3. The result is re-validated with Zod here and retried once with the
 *      specific failures fed back. Never trust the model's own claim that it
 *      stayed in range.
 *
 * `messages.create`, not `messages.parse`. In SDK 0.115 `parse` runs Zod itself
 * and throws on a failure, so `parsed_output` was never null: an out-of-range
 * value left the loop as an exception, the route answered 502 `unavailable`,
 * and the retry below never ran. A refusal threw the same way, because its text
 * is not JSON, before `stop_reason` was read. Parsing here reads `stop_reason`
 * first and keeps the Zod issues to feed back.
 */

const MODEL = 'claude-sonnet-5';

const tweakResult = <T extends z.ZodTypeAny>(settings: T) =>
  z.object({
    whiteBalance: whiteBalanceSchema,
    settings,
    /** One sentence, in the reader's language, on what changed and why. */
    summary: z.string(),
  });

export type TweakOutcome =
  | { ok: true; whiteBalance: unknown; settings: unknown; summary: string; attempts: number }
  | { ok: false; error: TweakErrorCode; attempts: number };

const SYSTEM = `You adjust colour recipes for Sony Alpha cameras.

You are given one existing recipe and a request. Return the adjusted recipe.

Rules:
- Change only what the request calls for. Leave every other value exactly as it was.
- A recipe is either Picture Profile or Creative Look, never both — the camera
  disables Creative Look whenever Picture Profile is on. Keep the same format.
- Every value must be legal on the camera. The legal ranges are given below;
  a value outside them cannot be entered and the recipe becomes useless.
- Values move in the listed steps. Do not invent intermediate values.
- Prefer small, deliberate adjustments over sweeping ones. A request to make
  something "warmer" is a nudge, not a redesign.`;

function buildPrompt(recipe: RecipeView, request: string, locale: string): string {
  return [
    `Recipe: ${recipe.name}`,
    `Format: ${recipe.format === 'pp' ? 'Picture Profile' : 'Creative Look'}`,
    `White Balance: ${formatWhiteBalance(recipe.whiteBalance)}`,
    `Current settings: ${JSON.stringify(recipe.settings)}`,
    '',
    constraintsFor(recipe.format),
    '',
    `Request: ${request}`,
    '',
    `Write the summary in ${locale === 'vi' ? 'Vietnamese' : 'English'}. Keep camera`,
    'parameter names, Creative Look codes and White Balance values in English.',
  ].join('\n');
}

export async function tweakRecipe(
  recipe: RecipeView,
  request: string,
  locale = 'en',
): Promise<TweakOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: 'notConfigured', attempts: 0 };

  const client = new Anthropic({ apiKey });
  const schema = tweakResult(recipe.format === 'pp' ? ppSettingsSchema : clSettingsSchema);

  let prompt = buildPrompt(recipe, request, locale);
  let lastError = '';

  // One retry, with the exact validation failures fed back. A second failure
  // means the request is asking for something the camera cannot do.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(schema) },
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal') {
      return { ok: false, error: 'declined', attempts: attempt };
    }
    /* Cut off mid-object. Retrying the same prompt into the same ceiling buys
       nothing, and the half-written JSON is not a validation failure to feed
       back. */
    if (response.stop_reason === 'max_tokens') {
      console.error('[tweak] answer truncated at max_tokens');
      return { ok: false, error: 'invalidResult', attempts: attempt };
    }

    const result = validate(schema, response.content);
    if (result.ok) {
      return {
        ok: true,
        whiteBalance: result.data.whiteBalance,
        settings: result.data.settings,
        summary: result.data.summary,
        attempts: attempt,
      };
    }

    lastError = result.issues;
    prompt = `${buildPrompt(recipe, request, locale)}

Your previous answer was rejected:
${lastError}
Re-read the legal values above and return values that fall inside them.`;
  }

  /* Server-side only. This used to be interpolated into the response body, so
     a Zod message naming internal fields and legal ranges went to the browser. */
  console.error('[tweak] no valid recipe after 2 attempts:\n' + lastError);
  return {
    ok: false,
    error: 'invalidResult',
    attempts: 2,
  };
}

/**
 * The first text block, parsed and checked against the recipe schema.
 *
 * The issues are `path: message` lines for the retry prompt and the log. They
 * name internal fields and legal ranges, so they never go to the browser.
 */
function validate<T extends z.ZodTypeAny>(
  schema: T,
  content: Anthropic.ContentBlock[],
): { ok: true; data: z.infer<T> } | { ok: false; issues: string } {
  const text = content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, issues: '- the answer was not valid JSON' };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issues = parsed.error.issues
    .slice(0, 5)
    .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  return { ok: false, issues };
}
