import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { clSettingsSchema, ppSettingsSchema, whiteBalanceSchema } from '../camera/schema';
import { formatWhiteBalance } from '../camera/format';
import { constraintsFor } from './constraints';
import type { RecipeView } from '../recipes/source';

/**
 * "Tweak with AI" — adjusts an existing recipe from a natural-language request.
 *
 * Three layers keep the output shootable on a real camera:
 *   1. Structured outputs constrain the JSON shape to the same Zod schema the
 *      rest of the app uses, so enums (gamma, colour mode, Look) cannot be
 *      invented.
 *   2. The prompt states the numeric ranges, generated from `constants.ts` —
 *      necessary because the JSON Schema spec has no `minimum`/`maximum`, so
 *      structured outputs strips those bounds before sending.
 *   3. The result is re-validated with Zod on return and retried once with the
 *      specific failures fed back. Never trust the model's own claim that it
 *      stayed in range.
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
  | { ok: false; error: string; attempts: number };

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
  if (!apiKey) return { ok: false, error: 'AI tweaking is not configured.', attempts: 0 };

  const client = new Anthropic({ apiKey });
  const schema = tweakResult(recipe.format === 'pp' ? ppSettingsSchema : clSettingsSchema);

  let prompt = buildPrompt(recipe, request, locale);
  let lastError = '';

  // One retry, with the exact validation failures fed back. A second failure
  // means the request is asking for something the camera cannot do.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(schema) },
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal') {
      return { ok: false, error: 'The request was declined.', attempts: attempt };
    }

    const parsed = response.parsed_output;
    if (parsed) {
      return {
        ok: true,
        whiteBalance: parsed.whiteBalance,
        settings: parsed.settings,
        summary: parsed.summary,
        attempts: attempt,
      };
    }

    // `parsed_output` is null when the response did not satisfy the schema —
    // including the numeric bounds Zod checks client-side.
    lastError = 'the result contained values the camera cannot accept';
    prompt = `${buildPrompt(recipe, request, locale)}

Your previous answer was rejected because ${lastError}. Re-read the legal ranges
above and return values that fall inside them.`;
  }

  return {
    ok: false,
    error: `Could not produce a valid recipe — ${lastError}.`,
    attempts: 2,
  };
}
