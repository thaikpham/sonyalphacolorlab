import 'server-only';
import { SUBREDDIT } from './config';
import type { RedditPost, RedditStatus } from './topics';

/**
 * Reddit OAuth, server side only.
 *
 * Two things about the target sub drive every decision here.
 *
 * It is **private**, so there is no anonymous path: `client_credentials` gives
 * an app-only token that is not a member of the sub and reads 403 from it. The
 * grant has to be `refresh_token`, tied to an account that is a member — which
 * is why the app shows an honest "not connected" state rather than a feed when
 * `REDDIT_REFRESH_TOKEN` is absent, and never falls back to invented posts.
 *
 * And it is small. `/new?limit=100` is one request that returns every post the
 * sub has, so the topics for all 93 products come from a single cached listing.
 * Reddit's search endpoint would be the scalable shape, but its index lags a few
 * minutes behind a submission: a reader who posts, returns and does not see
 * their own topic reads that as a bug. Swap to search when one listing stops
 * covering the sub, and keep the freshly-submitted post in view some other way.
 */

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const API = 'https://oauth.reddit.com';

/** Reddit rejects generic and empty agents. Identify the app and a contact. */
const USER_AGENT =
  process.env.REDDIT_USER_AGENT?.trim() || 'web:alpha-colorlab:v2.0 (by /u/thaikpham)';

export function isRedditConfigured(): boolean {
  return Boolean(
    process.env.REDDIT_CLIENT_ID &&
      process.env.REDDIT_CLIENT_SECRET &&
      process.env.REDDIT_REFRESH_TOKEN,
  );
}

/* Access tokens last an hour; minting one per request would spend most of the
   rate limit on authentication. Refreshed a minute early so a token cannot
   expire between the check and the call that uses it. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const refreshToken = process.env.REDDIT_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error('[reddit] token exchange failed:', res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.value;
}

/** Drops the cached token so the next call re-authenticates. Used on a 401. */
function invalidateToken(): void {
  cachedToken = null;
}

interface Listing {
  data?: {
    children?: { data?: Record<string, unknown> }[];
  };
}

function toPost(raw: Record<string, unknown>): RedditPost | null {
  const id = typeof raw.id === 'string' ? raw.id : null;
  const title = typeof raw.title === 'string' ? raw.title : null;
  if (!id || !title) return null;

  const permalink = typeof raw.permalink === 'string' ? raw.permalink : `/comments/${id}/`;
  return {
    id,
    author: typeof raw.author === 'string' ? raw.author : '[deleted]',
    title,
    selftext: typeof raw.selftext === 'string' ? raw.selftext : '',
    createdUtc: typeof raw.created_utc === 'number' ? raw.created_utc : 0,
    score: typeof raw.score === 'number' ? raw.score : 0,
    numComments: typeof raw.num_comments === 'number' ? raw.num_comments : 0,
    url: `https://www.reddit.com${permalink}`,
    flair: typeof raw.link_flair_text === 'string' ? raw.link_flair_text : null,
    distinguished: typeof raw.distinguished === 'string' ? raw.distinguished : null,
    stickied: raw.stickied === true,
  };
}

/* One listing serves every product page, so it is cached process-wide rather
   than per request. Sixty seconds is short enough that a reader who posts and
   comes back sees their topic, and long enough that a burst of product pages
   costs Reddit one call. `next: { revalidate }` would not do this — the route
   is dynamic on `productId`, so its fetches opt out of the data cache. */
const LISTING_TTL_MS = 60_000;
let cachedListing: { posts: RedditPost[]; fetchedAt: number } | null = null;

export interface ListingResult {
  status: RedditStatus;
  posts: RedditPost[];
}

export async function fetchSubredditPosts(options?: { force?: boolean }): Promise<ListingResult> {
  if (!isRedditConfigured()) return { status: 'notConfigured', posts: [] };

  if (!options?.force && cachedListing && Date.now() - cachedListing.fetchedAt < LISTING_TTL_MS) {
    return { status: 'connected', posts: cachedListing.posts };
  }

  const token = await accessToken();
  if (!token) return { status: 'unauthorized', posts: [] };

  const res = await fetch(`${API}/r/${SUBREDDIT}/new?limit=100&raw_json=1`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 403) {
    /* 403 here is the private sub refusing an account that is not a member —
       the same answer a wrong or revoked token gets, and not something the
       reader can act on differently, so both report as `unauthorized`. */
    invalidateToken();
    console.error('[reddit] listing refused:', res.status, `r/${SUBREDDIT}`);
    return { status: 'unauthorized', posts: [] };
  }

  if (!res.ok) {
    console.error('[reddit] listing failed:', res.status);
    /* Serve the last good listing rather than an empty feed: a 429 or a Reddit
       outage is not the same statement as "this space has no topics". */
    if (cachedListing) return { status: 'connected', posts: cachedListing.posts };
    return { status: 'unavailable', posts: [] };
  }

  const body = (await res.json()) as Listing;
  const posts = (body.data?.children ?? [])
    .map((child) => (child.data ? toPost(child.data) : null))
    .filter((p): p is RedditPost => p !== null);

  cachedListing = { posts, fetchedAt: Date.now() };
  return { status: 'connected', posts };
}

/**
 * Submits a self post as the token's own account.
 *
 * Not reachable from a browser request on purpose — see `submitUrl()` in
 * `config.ts`. Its caller is `scripts/reddit-seed.ts`, where the account whose
 * name goes on the post is the project's own.
 */
export async function submitSelfPost(title: string, text: string): Promise<{ url: string }> {
  const token = await accessToken();
  if (!token) throw new Error('Reddit credentials are missing or were refused');

  const res = await fetch(`${API}/api/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: new URLSearchParams({
      sr: SUBREDDIT,
      kind: 'self',
      title,
      text,
      api_type: 'json',
      resubmit: 'true',
    }),
    cache: 'no-store',
  });

  const body = (await res.json()) as {
    json?: { data?: { url?: string }; errors?: [string, string][] };
  };

  /* Reddit answers 200 with the failure inside the envelope — RATELIMIT,
     SUBREDDIT_NOTALLOWED, NO_TEXT. Reading only `res.ok` reports every one of
     those as a successful post. */
  const errors = body.json?.errors ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map(([code, detail]) => `${code}: ${detail}`).join('; '));
  }
  if (!res.ok) throw new Error(`Reddit answered ${res.status}`);

  const url = body.json?.data?.url;
  if (!url) throw new Error('Reddit accepted the post but returned no URL');

  cachedListing = null;
  return { url };
}
