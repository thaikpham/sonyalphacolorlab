import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin, supabaseRead } from '@/lib/supabase/server';

export type CommentItem = {
  id: string;
  recipeSlug: string;
  authorName: string;
  authorEmail: string;
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
    authorEmail: 'minhtuan@gmail.com',
    authorAvatar: 'https://ui-avatars.com/api/?name=Minh+Tuan&background=0D8ABC&color=fff',
    content: 'Công thức này chụp phố chiều nắng vàng rất mượt! Mình tăng Shift A lên 1 nấc nữa thấy tông da sáng ấm hẳn.',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'seed-comment-2',
    recipeSlug: 'daylight-cinema',
    authorName: 'Hải Yến',
    authorEmail: 'haiyen.photo@gmail.com',
    authorAvatar: 'https://ui-avatars.com/api/?name=Hai+Yen&background=E91E63&color=fff',
    content: 'Skintone chụp chân dung lên mượt và tự nhiên lắm. Cảm ơn tác giả nhiều!',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    const filtered = memoryComments.filter((c) => c.recipeSlug === slug);
    return NextResponse.json({ comments: filtered, source: 'memory' });
  }

  try {
    const { data, error } = await supabaseRead()
      .from('recipe_comments')
      .select('*')
      .eq('recipe_slug', slug)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const comments: CommentItem[] = (data || []).map((row) => ({
      id: row.id,
      recipeSlug: row.recipe_slug,
      authorName: row.author_name,
      authorEmail: row.author_email,
      authorAvatar: row.author_avatar,
      content: row.content,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ comments, source: 'supabase' });
  } catch (err) {
    const filtered = memoryComments.filter((c) => c.recipeSlug === slug);
    return NextResponse.json({ comments: filtered, source: 'fallback', error: String(err) });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recipeSlug, authorName, authorEmail, authorAvatar, content } = body;

    if (!recipeSlug || !authorName || !authorEmail || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newComment: CommentItem = {
      id: `comment-${Date.now()}`,
      recipeSlug,
      authorName: authorName.slice(0, 100),
      authorEmail: authorEmail.slice(0, 255),
      authorAvatar: authorAvatar || null,
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
        author_name: authorName,
        author_email: authorEmail,
        author_avatar: authorAvatar,
        content: content,
      })
      .select('*')
      .single();

    if (error) throw error;

    const savedComment: CommentItem = {
      id: data.id,
      recipeSlug: data.recipe_slug,
      authorName: data.author_name,
      authorEmail: data.author_email,
      authorAvatar: data.author_avatar,
      content: data.content,
      createdAt: data.created_at,
    };

    return NextResponse.json({ comment: savedComment, source: 'supabase' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to post comment', details: String(err) }, { status: 500 });
  }
}
