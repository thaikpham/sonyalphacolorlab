import type { SonyCamera } from '@/lib/cameras/types';

/**
 * How a Reddit post is bound to one of the 93 products, and how it becomes a
 * topic the drawer can render.
 *
 * The binding is the **canonical product URL in the post body**. It is a link a
 * human reader wants anyway — it goes back to the specs the topic is about — and
 * it survives editing, crossposting and Reddit's own markdown rendering. A
 * machine tag in the title (`[sony-ilce-7m4-bq-ap2]`) would be exact, but every
 * reader on the sub would see it and eventually strip it; a per-product flair
 * would mean creating and moderating 93 flairs by hand.
 *
 * Nothing here reaches the network or reads a secret, so the compose side of it
 * runs in the browser and the parse side runs in the route, from one definition
 * of the footer format. The two must stay each other's inverse — that is what
 * `topics.test.ts` pins.
 */

export type TopicTag = 'guide' | 'recipe' | 'sample' | 'qa';

export const TOPIC_TAGS: TopicTag[] = ['guide', 'recipe', 'sample', 'qa'];

/**
 * A post as this app reads it, and how far the read got.
 *
 * Both shapes live here rather than beside the fetch in `client.ts`, which is
 * `server-only`: the drawer needs `RedditStatus` to render its own state, and a
 * type import from a `server-only` module is a build error waiting for whoever
 * turns on `verbatimModuleSyntax`.
 */
export interface RedditPost {
  id: string;
  author: string;
  title: string;
  selftext: string;
  /** Seconds since the epoch, UTC — Reddit's own `created_utc`. */
  createdUtc: number;
  score: number;
  numComments: number;
  /** Absolute, ready to link. */
  url: string;
  flair: string | null;
  /** `'moderator'` on a post a mod signed with the distinguish button. */
  distinguished: string | null;
  stickied: boolean;
}

export type RedditStatus = 'connected' | 'notConfigured' | 'unauthorized' | 'unavailable';

export interface CommunityTopic {
  /** Reddit's base-36 post id. */
  id: string;
  /** Reddit username, without the `u/`. */
  author: string;
  /** Signed with Reddit's distinguish button — a statement from the mod team. */
  isMod: boolean;
  isPinned: boolean;
  /** Seconds since the epoch, UTC. Rendered relative, client side. */
  createdUtc: number;
  tag: TopicTag;
  title: string;
  body: string;
  score: number;
  comments: number;
  /** The post on reddit.com. Every action that changes something goes here. */
  url: string;
}

/**
 * `[RECIPE] Warm street …` → `recipe`.
 *
 * The marker is a bracketed code, not translated copy: it is written into a
 * Reddit title that both locales share, and Rule 3 keeps technical tokens out of
 * the message catalogues for exactly this reason. Flair wins when a moderator
 * has set one, since that is the deliberate act.
 */
export function tagOf(post: Pick<RedditPost, 'title' | 'flair'>): TopicTag {
  const source = `${post.flair ?? ''} ${post.title}`.toLowerCase();
  if (/\bguide\b|hướng dẫn/.test(source)) return 'guide';
  if (/\brecipe\b|công thức/.test(source)) return 'recipe';
  if (/\bsample\b|\bphoto\b|ảnh mẫu/.test(source)) return 'sample';
  return 'qa';
}

/** Strips the leading `[TAG]` marker so it is not rendered twice. */
export function titleOf(title: string): string {
  return title.replace(/^\s*\[[A-Za-z]{2,10}\]\s*/, '').trim() || title.trim();
}

/**
 * The footer appended to every topic composed here, and the only thing that
 * binds a post to a product.
 *
 * Always the `en` path: the URL is an identifier as well as a link, and pinning
 * it to one locale keeps a topic composed on `/vi` and one composed on `/en`
 * parseable by the same rule. next-intl serves `/cameras/<id>` in English and
 * redirects a reader whose locale is Vietnamese, so nobody lands in the wrong
 * language.
 */
export function productFooter(product: Pick<SonyCamera, 'id' | 'fullName'>): string {
  return `\n\n---\n${product.fullName} · Alpha ColorLab\n${productUrl(product.id)}`;
}

export function productUrl(productId: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/cameras/${productId}`;
}

/**
 * Reads the product id back out of a post body.
 *
 * Matches on the path rather than the whole URL: the site is reachable as
 * localhost in development, as a preview deploy, and as the production domain,
 * and a topic composed against one of those must still resolve on the others.
 * Reddit escapes underscores in markdown, so the id charset stays as the
 * catalogue writes it — lowercase, digits and hyphens, all 93 of them.
 */
const PRODUCT_PATH = /\/cameras\/([a-z0-9][a-z0-9-]*)/;

export function productIdOf(post: Pick<RedditPost, 'selftext'>): string | null {
  return PRODUCT_PATH.exec(post.selftext)?.[1] ?? null;
}

export function toTopic(post: RedditPost): CommunityTopic {
  return {
    id: post.id,
    author: post.author,
    isMod: post.distinguished === 'moderator',
    isPinned: post.stickied,
    createdUtc: post.createdUtc,
    tag: tagOf(post),
    title: titleOf(post.title),
    /* The footer is this app's own bookkeeping. Rendering it back inside the
       card would show every reader a link to the page they are already on. */
    body: stripFooter(post.selftext),
    score: post.score,
    comments: post.numComments,
    url: post.url,
  };
}

function stripFooter(selftext: string): string {
  return selftext.replace(/\n*---\n[^\n]*Alpha ColorLab\n[^\n]*\/cameras\/[a-z0-9-]+\s*$/, '').trim();
}

/** Every topic bound to one product, pinned posts first, then newest. */
export function topicsForProduct(posts: RedditPost[], productId: string): CommunityTopic[] {
  return posts
    .filter((post) => productIdOf(post) === productId)
    .map(toTopic)
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdUtc - a.createdUtc);
}

/** The body a reader's draft becomes, footer included. */
export function composeBody(draft: string, product: Pick<SonyCamera, 'id' | 'fullName'>): string {
  return `${draft.trim()}${productFooter(product)}`;
}

/** The title a reader's draft becomes: `[RECIPE] …`. */
export function composeTitle(draft: string, tag: TopicTag): string {
  return `[${tag.toUpperCase()}] ${draft.trim()}`;
}
