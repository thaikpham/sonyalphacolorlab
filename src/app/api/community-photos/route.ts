import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { isSupabaseConfigured, supabaseAdmin, supabaseRead } from '@/lib/supabase/server';
import { listSlugs } from '@/lib/recipes/source';
import { communityErrorBody } from '@/lib/community/errors';
import { requireUser, UNAUTHENTICATED } from '@/lib/auth/require-user';

/**
 * Community photo URLs & Author credits.
 *
 * POST runs on the service role, applying rate limits, per-recipe caps,
 * slug validation, and author credit persistence.
 */

const MAX_PHOTOS_PER_RECIPE = 40;

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Invalid slug');

/* No authorName: the credit is the verified session's name. It used to be
   taken from the payload, so an unauthenticated caller could credit a photo to
   anyone at all — the same hole the comment and vote routes already closed. */
const postBody = z.object({
  slug: slugSchema,
  imageUrl: z
    .string()
    .url()
    .max(2048)
    .refine((u) => u.startsWith('https://'), { message: 'Image URL must use https://' }),
  authorSocial: z.string().url().max(2048).optional(),
});

const clientKey = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  req.headers.get('x-real-ip') ??
  'local';

/** GET /api/community-photos?slug=<slug> */
export async function GET(req: Request) {
  const parsed = slugSchema.safeParse(new URL(req.url).searchParams.get('slug'));
  if (!parsed.success) {
    return NextResponse.json(communityErrorBody('missingFields'), { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, photos: [], credits: [], source: 'offline' });
  }

  try {
    const { data, error } = await supabaseRead()
      .from('community_photos')
      .select('image_url, author_name, author_social')
      .eq('recipe_slug', parsed.data)
      .order('created_at', { ascending: false })
      .limit(MAX_PHOTOS_PER_RECIPE);

    if (error) {
      console.error('[community-photos GET]', error.message);
      return NextResponse.json({ ok: true, photos: [], credits: [], source: 'fallback' });
    }

    const rows = (data ?? []) as {
      image_url: string;
      author_name?: string | null;
      author_social?: string | null;
    }[];

    return NextResponse.json({
      ok: true,
      photos: rows.map((r) => r.image_url),
      credits: rows.map((r) => ({
        url: r.image_url,
        authorName: r.author_name ?? undefined,
        authorSocial: r.author_social ?? undefined,
      })),
      source: 'supabase',
    });
  } catch (e) {
    console.error('[community-photos GET]', e);
    return NextResponse.json({ ok: true, photos: [], credits: [], source: 'fallback' });
  }
}

/** POST /api/community-photos */
export async function POST(req: Request) {
  /* This route writes on a reader's behalf, so it needs a verified session.
     It had none: anyone could POST a photo URL onto any recipe, and the rate
     limit keyed on a spoofable `x-forwarded-for` rather than on a person. */
  const user = await requireUser(req);
  if (!user) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

  const limit = checkRateLimit(`photos:${user.email}`);
  if (!limit.allowed) {
    return NextResponse.json(
      communityErrorBody('rateLimited'),
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let body: z.infer<typeof postBody>;
  try {
    body = postBody.parse(await req.json());
  } catch {
    return NextResponse.json(
      communityErrorBody('invalidImageUrl'),
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, saved: false, source: 'offline' });
  }

  const slugs = await listSlugs();
  if (!slugs.includes(body.slug)) {
    return NextResponse.json(communityErrorBody('recipeNotFound'), { status: 404 });
  }

  try {
    const db = supabaseAdmin();

    const { count, error: countError } = await db
      .from('community_photos')
      .select('id', { count: 'exact', head: true })
      .eq('recipe_slug', body.slug);
    if (countError) throw new Error(countError.message);

    if ((count ?? 0) >= MAX_PHOTOS_PER_RECIPE) {
      return NextResponse.json(
        communityErrorBody('photoLimitReached'),
        { status: 409 },
      );
    }

    const { error } = await db
      .from('community_photos')
      .insert({
        recipe_slug: body.slug,
        image_url: body.imageUrl,
        author_name: user.name,
        author_social: body.authorSocial || null,
        // Coarse origin marker, deliberately still the IP: this table has no
        // column-level grant, so an email here would be readable by anon.
        submitted_by: clientKey(req),
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: true, saved: true, duplicate: true });
      }
      console.error('[community-photos POST]', error.message);
      return NextResponse.json(communityErrorBody('saveFailed'), { status: 500 });
    }

    return NextResponse.json({ ok: true, saved: true, source: 'supabase' });
  } catch (e) {
    console.error('[community-photos POST]', e);
    return NextResponse.json(communityErrorBody('saveFailed'), { status: 500 });
  }
}
