import { NextResponse } from 'next/server';
import { hasControlConfig, controlAdmin, controlRead } from '@/lib/supabase/server';
import { requireUser, UNAUTHENTICATED } from '@/lib/auth/require-user';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { COMMUNITY_ERRORS, communityErrorBody, outageErrorCode } from '@/lib/community/errors';
import { readJsonBody } from '@/lib/community/request';
import { COMMENT_COLUMNS } from '@/lib/community/columns';
import { hasContentConfig } from '@/lib/supabase/server';
import { publishedRecipeExists } from '@/lib/recipes/existence';

/**
 * PostgREST rejects with a plain object, not an Error, so `String(err)` gave
 * "[object Object]" — which is how a missing table read as an empty comment
 * list for weeks instead of an obvious failure. Log the real shape server-side;
 * the client only learns that persistence is unavailable, never schema details.
 */
function logFallback(where: string, err: unknown) {
  const detail =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err
        ? JSON.stringify(err)
        : String(err);
  console.error(`[${where}] Supabase failed:`, detail);
}

/** A page of comments is a reading list, not an export. */
const COMMENT_LIST_LIMIT = 200;


export type CommentItem = {
  id: string;
  recipeSlug: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  createdAt: string;
};

/* Examples for a deployment with no control project at all — local work and
   offline builds. Never served as a fallback when a configured project fails:
   these are invented people on a real recipe, and during an outage they would
   read as the only comments it had. */
const memoryComments: CommentItem[] = [
  {
    id: 'seed-comment-1',
    recipeSlug: 'daylight-cinema',
    authorName: 'Minh Tuấn',
    authorAvatar: 'https://ui-avatars.com/api/?name=Minh+Tuan&background=0D8ABC&color=fff',
    content: 'Công thức này chụp phố chiều nắng vàng rất mượt! Mình tăng Shift A lên 1 nấc nữa thấy tông da sáng ấm hẳn.',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'seed-comment-2',
    recipeSlug: 'daylight-cinema',
    authorName: 'Hải Yến',
    authorAvatar: 'https://ui-avatars.com/api/?name=Hai+Yen&background=E91E63&color=fff',
    content: 'Skintone chụp chân dung lên mượt và tự nhiên lắm. Cảm ơn tác giả nhiều!',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json(communityErrorBody('missingFields'), { status: 400 });
  }

  if (!hasControlConfig()) {
    const filtered = memoryComments.filter((c) => c.recipeSlug === slug);
    return NextResponse.json({ comments: filtered, source: 'memory' });
  }

  try {
    const { data, error } = await controlRead()
      /* Explicit columns, never `*`. author_email is written on POST so a
         comment can be attributed, but it must never come back out — this
         endpoint is public and unauthenticated. */
      .from('recipe_comments')
      .select(COMMENT_COLUMNS)
      .eq('recipe_slug', slug)
      .order('created_at', { ascending: false })
      .limit(COMMENT_LIST_LIMIT);

    if (error) throw error;

    const comments: CommentItem[] = (data || []).map((row) => ({
      id: row.id,
      recipeSlug: row.recipe_slug,
      authorName: row.author_name,
      authorAvatar: row.author_avatar,
      content: row.content,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ comments, source: 'supabase' });
  } catch (err) {
    /* Configuration decides the source; failure is failure. This used to answer
       with the offline examples above, flagged `degraded` in a field the client
       never read — so an outage put two invented comments on daylight-cinema
       and "be the first" on every other recipe. An empty list with a code says
       what actually happened. */
    logFallback('comments', err);
    return NextResponse.json(
      { ...communityErrorBody('controlUnavailable'), comments: [] },
      { status: COMMUNITY_ERRORS.controlUnavailable },
    );
  }
}

export async function POST(request: Request) {
  try {
    /* Identity comes from the verified session, never the payload. The body
       used to carry authorName and authorEmail, which meant a bare curl could
       post as anyone. Those fields are now ignored if sent. */
    const user = await requireUser(request);
    if (!user) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

    const limit = checkRateLimit(`comment:${user.email}`, Date.now(), 10);
    if (!limit.allowed) {
      return NextResponse.json(
        communityErrorBody('rateLimited'),
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const read = await readJsonBody(request);
    if (!read.ok) {
      return NextResponse.json(communityErrorBody(read.error), { status: COMMUNITY_ERRORS[read.error] });
    }
    const body = read.body;
    const { recipeSlug, content } = body;

    if (
      typeof recipeSlug !== 'string' || !recipeSlug ||
      typeof content !== 'string' || !content.trim()
    ) {
      return NextResponse.json(communityErrorBody('missingFields'), { status: 400 });
    }

    /* The recipe lives in the other project, so Postgres cannot enforce this
       reference and the check has to happen here, before the write. A comment
       on a slug that does not exist is invisible on every page and survives
       until somebody goes looking for it. `publishedRecipeExists` throws rather
       than answering `false` when the content project is unreachable — see the
       catch below, which turns that into 503 and not 404. */
    if (hasContentConfig() && !(await publishedRecipeExists(recipeSlug))) {
      return NextResponse.json(communityErrorBody('recipeNotFound'), { status: 404 });
    }

    const db = controlAdmin();
    const { data, error } = await db
      .from('recipe_comments')
      .insert({
        recipe_slug: recipeSlug,
        author_name: user.name,
        author_email: user.email,
        author_avatar: user.avatarUrl,
        content: content.slice(0, 2000),
      })
      // Narrow here too: whatever this returns is what the response is built
      // from, so not fetching the email is what keeps it from being sent.
      .select(COMMENT_COLUMNS)
      .single();

    if (error) throw error;

    const savedComment: CommentItem = {
      id: data.id,
      recipeSlug: data.recipe_slug,
      authorName: data.author_name,
      authorAvatar: data.author_avatar,
      content: data.content,
      createdAt: data.created_at,
    };

    return NextResponse.json({ comment: savedComment, source: 'supabase' });
  } catch (err) {
    logFallback('comments', err);
    /* Which project failed is the whole content of the answer: a content
       outage means "we could not confirm the recipe", a control outage means
       "we could not store your comment", and neither is the 500 that a real
       bug in this handler would be. */
    const outage = outageErrorCode(err);
    if (outage) {
      return NextResponse.json(communityErrorBody(outage), { status: COMMUNITY_ERRORS[outage] });
    }
    return NextResponse.json(communityErrorBody('saveFailed'), { status: 500 });
  }
}
