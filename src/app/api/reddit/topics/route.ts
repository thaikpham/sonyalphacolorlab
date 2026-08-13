import { NextResponse } from 'next/server';
import { fetchSubredditPosts } from '@/lib/reddit/client';
import { SUBREDDIT, SUBREDDIT_HANDLE } from '@/lib/reddit/config';
import { topicsForProduct } from '@/lib/reddit/topics';

/**
 * Real topics for one product, read from r/<SUBREDDIT>.
 *
 * The `status` is a **code**, never a sentence — same rule as the community
 * routes: the client looks it up in `cameras.redditStatus.*` and renders it in
 * the reader's own locale. `notConfigured` and `unauthorized` are separate
 * because they are separate jobs: one needs credentials added, the other needs
 * the token's account invited to a private sub.
 *
 * `ok: true` with an empty list and a non-`connected` status is the honest
 * answer, and it is why the drawer no longer has placeholder posts to fall back
 * on: a space that cannot be read must not look like a space with no topics.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId')?.trim();

  if (!productId) {
    return NextResponse.json({ ok: false, error: 'missingFields' }, { status: 400 });
  }

  try {
    const { status, posts } = await fetchSubredditPosts();
    return NextResponse.json({
      ok: true,
      subreddit: SUBREDDIT,
      handle: SUBREDDIT_HANDLE,
      status,
      topics: status === 'connected' ? topicsForProduct(posts, productId) : [],
    });
  } catch (err) {
    console.error('[API /api/reddit/topics] failed:', err);
    return NextResponse.json({
      ok: true,
      subreddit: SUBREDDIT,
      handle: SUBREDDIT_HANDLE,
      status: 'unavailable',
      topics: [],
    });
  }
}
