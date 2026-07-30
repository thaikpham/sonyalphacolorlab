import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkDailyBudget, checkRateLimit } from '@/lib/ai/rate-limit';
import { tweakRecipe } from '@/lib/ai/tweak';
import { getRecipe } from '@/lib/recipes/source';

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
  // Best-effort client identity. Behind Vercel this is the real client IP;
  // locally it falls back to a single shared bucket.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'local';

  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  // Backstop against a link going around a group: a fleet-wide daily ceiling,
  // checked before any parsing so a flood costs as little as possible.
  const budget = checkDailyBudget();
  if (!budget.allowed) {
    return NextResponse.json(
      { error: 'The daily AI budget is used up. Try again tomorrow.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  let input: z.infer<typeof body>;
  try {
    input = body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const recipe = await getRecipe(input.slug, input.locale);
  if (!recipe) return NextResponse.json({ error: 'Recipe not found.' }, { status: 404 });

  try {
    const result = await tweakRecipe(recipe, input.request, input.locale);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

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
    return NextResponse.json({ error: 'The AI service is unavailable.' }, { status: 502 });
  }
}
