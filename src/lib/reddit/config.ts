/**
 * The one subreddit this app reads and writes.
 *
 * `sonysandbox_dev` is the Devvit playtest sub for the `sonysandbox` app. It is
 * **private**: `reddit.com/r/sonysandbox_dev/*.json` answers 403 to anyone who
 * is not a member, so reading it needs a user token from an account that is one
 * (`src/lib/reddit/client.ts`). The handle itself is not a secret — it is shown
 * in the UI and it is half of the submit link — so it is a `NEXT_PUBLIC_` var
 * and this module is safe to import from a client component.
 *
 * Point `NEXT_PUBLIC_REDDIT_SUBREDDIT` at a public community to go live; nothing
 * else in the integration is named after the dev sub.
 */
export const SUBREDDIT = process.env.NEXT_PUBLIC_REDDIT_SUBREDDIT?.trim() || 'sonysandbox_dev';

/** Display handle, e.g. `r/sonysandbox_dev`. */
export const SUBREDDIT_HANDLE = `r/${SUBREDDIT}`;

export const SUBREDDIT_URL = `https://www.reddit.com/r/${SUBREDDIT}/`;

/**
 * Reddit's own compose page, pre-filled. This is the write path for a reader:
 * they land on Reddit already signed in as themselves and press Post.
 *
 * Deliberately not a server-side submit. A route that posts from a bot token
 * puts one account's name on prose someone else typed, to an audience they
 * never chose — the same trap `identity-not-from-body.test.ts` pins for the
 * community tables. The bot token exists (`scripts/reddit-seed.ts`) and is for
 * posts the project itself authors.
 */
export function submitUrl(title: string, text: string): string {
  const params = new URLSearchParams({ title, text });
  return `https://www.reddit.com/r/${SUBREDDIT}/submit?${params.toString()}`;
}
