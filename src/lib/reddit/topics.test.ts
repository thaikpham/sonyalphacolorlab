import { describe, expect, it } from 'vitest';
import {
  composeBody,
  composeTitle,
  productIdOf,
  productUrl,
  tagOf,
  titleOf,
  toTopic,
  topicsForProduct,
  type RedditPost,
} from './topics';

/**
 * The compose side and the parse side of the product binding are each other's
 * inverse, and nothing at runtime notices when they stop being.
 *
 * A topic composed in the drawer travels through Reddit and comes back as a
 * post in a listing. If the footer format drifts on one side, `productIdOf`
 * returns null, the post is silently dropped from every product's feed, and the
 * drawer shows an empty space that looks exactly like a space with no posts.
 * There is no error to see and no log line to find — which is why the round trip
 * is asserted here rather than trusted.
 */

const PRODUCT = { id: 'sony-ilce-7m4-bq-ap2', fullName: 'Sony 7 IV (ILCE-7M4/BQ AP2)' };

function post(overrides: Partial<RedditPost> = {}): RedditPost {
  return {
    id: 'abc123',
    author: 'linh',
    title: '[QA] CFexpress Type A or fast SD?',
    selftext: 'Body text.',
    createdUtc: 1_700_000_000,
    score: 12,
    numComments: 3,
    url: 'https://www.reddit.com/r/sonysandbox_dev/comments/abc123/',
    flair: null,
    distinguished: null,
    stickied: false,
    ...overrides,
  };
}

describe('product binding', () => {
  it('reads back the product a composed body was written for', () => {
    const body = composeBody('Some question about the buffer.', PRODUCT);
    expect(productIdOf({ selftext: body })).toBe(PRODUCT.id);
  });

  it('binds nothing when the body carries no product link', () => {
    expect(productIdOf({ selftext: 'A post someone wrote on Reddit directly.' })).toBeNull();
  });

  it('resolves a topic composed against another origin', () => {
    /* Composed on localhost, read back on the production deploy. The match is
       on the path, so the same post binds on every environment. */
    const composed = composeBody('Draft', PRODUCT).replace(
      productUrl(PRODUCT.id),
      `https://alpha-colorlab.vercel.app/vi/cameras/${PRODUCT.id}`,
    );
    expect(productIdOf({ selftext: composed })).toBe(PRODUCT.id);
  });

  it('does not bind one product id to a longer one that starts with it', () => {
    const other = productIdOf({ selftext: `see /cameras/${PRODUCT.id}-second` });
    expect(other).not.toBe(PRODUCT.id);
  });

  it('keeps only the posts bound to the requested product', () => {
    const mine = post({ id: 'a', selftext: composeBody('Mine', PRODUCT) });
    const theirs = post({
      id: 'b',
      selftext: composeBody('Theirs', { id: 'sony-ilme-fx30b-qap2', fullName: 'FX30' }),
    });
    const loose = post({ id: 'c', selftext: 'Posted straight to the sub.' });

    expect(topicsForProduct([mine, theirs, loose], PRODUCT.id).map((x) => x.id)).toEqual(['a']);
  });

  it('puts pinned posts first, then newest', () => {
    const body = composeBody('x', PRODUCT);
    const old = post({ id: 'old', createdUtc: 100, selftext: body });
    const fresh = post({ id: 'fresh', createdUtc: 900, selftext: body });
    const pinned = post({ id: 'pinned', createdUtc: 50, stickied: true, selftext: body });

    expect(topicsForProduct([old, fresh, pinned], PRODUCT.id).map((x) => x.id)).toEqual([
      'pinned',
      'fresh',
      'old',
    ]);
  });
});

describe('rendering a post as a topic', () => {
  it('hides the footer it added itself', () => {
    const topic = toTopic(post({ selftext: composeBody('Just the prose.', PRODUCT) }));
    expect(topic.body).toBe('Just the prose.');
    expect(topic.body).not.toContain('/cameras/');
  });

  it('leaves a body alone when it has no footer', () => {
    expect(toTopic(post({ selftext: 'Written on Reddit.' })).body).toBe('Written on Reddit.');
  });

  it('strips the bracketed tag marker from the title', () => {
    expect(titleOf('[RECIPE] Warm street')).toBe('Warm street');
    expect(titleOf('Warm street')).toBe('Warm street');
  });

  it('never empties a title that is only a marker', () => {
    /* A post titled `[QA]` and nothing else would otherwise render as a blank
       link with no target text — invisible to a pointer and to a screen reader. */
    expect(titleOf('[QA]')).toBe('[QA]');
  });

  it('reports mod and pin state from Reddit, not from the author name', () => {
    const topic = toTopic(post({ distinguished: 'moderator', stickied: true }));
    expect(topic.isMod).toBe(true);
    expect(topic.isPinned).toBe(true);
    expect(toTopic(post()).isMod).toBe(false);
  });
});

describe('tags', () => {
  it('round-trips every tag the composer can write', () => {
    for (const tag of ['guide', 'recipe', 'sample'] as const) {
      const title = composeTitle('Anything', tag);
      expect(tagOf({ title, flair: null })).toBe(tag);
    }
  });

  it('falls back to a question rather than guessing', () => {
    expect(tagOf({ title: 'Anything at all', flair: null })).toBe('qa');
  });

  it('lets a moderator flair override the title marker', () => {
    expect(tagOf({ title: '[QA] Which card?', flair: 'Guide' })).toBe('guide');
  });

  it('reads a Vietnamese title written on Reddit directly', () => {
    expect(tagOf({ title: 'Công thức màu cho chiều muộn', flair: null })).toBe('recipe');
  });
});
