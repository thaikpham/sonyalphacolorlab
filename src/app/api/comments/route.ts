import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin, supabaseRead } from '@/lib/supabase/server';
import { requireUser, UNAUTHENTICATED } from '@/lib/auth/require-user';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { communityErrorBody } from '@/lib/community/errors';

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
  console.error(`[${where}] Supabase unavailable, serving in-process memory:`, detail);
}


export type CommentItem = {
  id: string;
  recipeSlug: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  createdAt: string;
};

// In-memory fallback cache when running offline / without Supabase credentials
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

  if (!isSupabaseConfigured()) {
    const filtered = memoryComments.filter((c) => c.recipeSlug === slug);
    return NextResponse.json({ comments: filtered, source: 'memory' });
  }

  try {
    const { data, error } = await supabaseRead()
      /* Explicit columns, never `*`. author_email is written on POST so a
         comment can be attributed, but it must never come back out — this
         endpoint is public and unauthenticated. */
      .from('recipe_comments')
      .select('id, recipe_slug, author_name, author_avatar, content, created_at')
      .eq('recipe_slug', slug)
      .order('created_at', { ascending: false });

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
    const filtered = memoryComments.filter((c) => c.recipeSlug === slug);
    logFallback('comments', err);
    return NextResponse.json({ comments: filtered, source: 'fallback', degraded: true });
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

    const body = await request.json();
    const { recipeSlug, content } = body;

    if (!recipeSlug || !content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(communityErrorBody('missingFields'), { status: 400 });
    }

    const newComment: CommentItem = {
      id: `comment-${Date.now()}`,
      recipeSlug,
      authorName: user.name,
      authorAvatar: user.avatarUrl,
      content: content.slice(0, 2000),
      createdAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) {
      memoryComments.unshift(newComment);
      return NextResponse.json({ comment: newComment, source: 'memory' });
    }

    const db = supabaseAdmin();
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
      .select('id, recipe_slug, author_name, author_avatar, content, created_at')
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
    return NextResponse.json(communityErrorBody('saveFailed'), { status: 500 });
  }
}
