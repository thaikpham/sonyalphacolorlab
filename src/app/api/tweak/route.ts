import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkDailyBudget, checkRateLimit } from '@/lib/ai/rate-limit';
import { tweakRecipe } from '@/lib/ai/tweak';
import { getRecipe } from '@/lib/recipes/source';
import { tweakErrorBody } from '@/lib/ai/errors';
import { ContentUnavailableError, ControlUnavailableError } from '@/lib/supabase/errors';
import { requireUser } from '@/lib/auth/require-user';

/**
 * POST /api/tweak — adjust a recipe from a natural-language request.
 *
 * The API key lives here and never reaches the browser. The recipe is loaded
 * server-side from its slug rather than accepted from the client, so a caller
 * cannot smuggle in arbitrary settings for the model to "adjust".
 */

const body = z.object({
  slug: z.string().min(1).max(120),
  request: z.string().min(3).max(500),
  locale: z.enum(['en', 'vi']).default('en'),
});

export async function POST(req: Request) {
  /* A paid call, so a verified reader and nobody else — and before the budget,
     so an anonymous flood spends none of it. The limit used to key on
     `x-forwarded-for`, which the caller sets: a script on rotating addresses
     got a fresh bucket per request. A verified address is one bucket however
     many addresses it arrives from. */
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser(req);
  } catch (e) {
    if (!(e instanceof ControlUnavailableError)) throw e;
    console.error('[tweak]', e.message);
    return NextResponse.json(tweakErrorBody('controlUnavailable'), { status: 503 });
  }
  if (!user) return NextResponse.json(tweakErrorBody('unauthenticated'), { status: 401 });

  const limit = checkRateLimit(`tweak:${user.email}`);
  if (!limit.allowed) {
    return NextResponse.json(
      tweakErrorBody('rateLimited'),
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  // Backstop against a link going around a group: a fleet-wide daily ceiling,
  // checked before any parsing so a flood costs as little as possible.
  const budget = checkDailyBudget();
  if (!budget.allowed) {
    return NextResponse.json(
      tweakErrorBody('budgetExhausted'),
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  let input: z.infer<typeof body>;
  try {
    input = body.parse(await req.json());
  } catch {
    return NextResponse.json(tweakErrorBody('invalidRequest'), { status: 400 });
  }

  /* An unreachable content project throws rather than answering "no such
     recipe" — see `contentOrOfflineSeed`. Left uncaught it was a bare 500, and
     the panel's `res.json()` failed on the empty body. */
  let recipe: Awaited<ReturnType<typeof getRecipe>>;
  try {
    recipe = await getRecipe(input.slug, input.locale);
  } catch (e) {
    if (!(e instanceof ContentUnavailableError)) throw e;
    console.error('[tweak]', e.message);
    return NextResponse.json(tweakErrorBody('contentUnavailable'), { status: 503 });
  }
  if (!recipe) return NextResponse.json(tweakErrorBody('recipeNotFound'), { status: 404 });

  try {
    const result = await tweakRecipe(recipe, input.request, input.locale);
    if (!result.ok) return NextResponse.json(tweakErrorBody(result.error), { status: 422 });

    return NextResponse.json(
      {
        whiteBalance: result.whiteBalance,
        settings: result.settings,
        summary: result.summary,
      },
      { headers: { 'X-RateLimit-Remaining': String(limit.remaining) } },
    );
  } catch (e) {
    // Never leak the upstream error text — it can carry request details.
    console.error('[tweak]', e);
    return NextResponse.json(tweakErrorBody('unavailable'), { status: 502 });
  }
}
