import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Sharing a photograph from the recipe gallery.
 *
 * The handler saved the photo to the device and closed the form before the
 * request went out. Every refusal — an http:// URL the route will not store,
 * an expired session, the rate limit, a full gallery, an outage — then set an
 * error inside the form it had just closed, so nobody saw it, and the photo sat
 * in the collage looking shared when nothing was.
 *
 * Source assertions, because this suite has no DOM to submit a form in; what
 * has to hold is the order of three statements in one handler.
 */

const source = readFileSync('src/components/recipe-gallery.tsx', 'utf8');
const handler = source.slice(
  source.indexOf('const handleAddPhoto'),
  source.indexOf('const handleDeleteUserPhoto'),
);

describe('handleAddPhoto', () => {
  it('is found', () => {
    expect(handler.length).toBeGreaterThan(0);
  });

  it('accepts only the https:// the route stores', () => {
    expect(handler).not.toContain("cleanUrl.startsWith('http://')");
    expect(handler).toMatch(/!cleanUrl\.startsWith\('https:\/\/'\)/);
  });

  it('saves locally and closes the form only after the server said yes', () => {
    const refused = handler.indexOf('if (!res.ok)');
    expect(refused).toBeGreaterThan(-1);
    for (const effect of ['setLocalPhotos(', 'setLocalCredit(', 'setIsFormOpen(false)', "setInputUrl('')"]) {
      const at = handler.indexOf(effect);
      expect(at, `${effect} is missing`).toBeGreaterThan(-1);
      expect(at, `${effect} runs before the response is checked`).toBeGreaterThan(refused);
    }
  });

  it('renders a refusal from its code', () => {
    expect(handler).toContain('communityErrorOf(res)');
    expect(handler).toContain('errors.${');
  });

  it('sends one request at a time, now that the form stays open while it is in flight', () => {
    const guard = handler.indexOf('if (sharingRef.current) return;');
    expect(guard).toBeGreaterThan(-1);
    expect(handler.indexOf("fetch('/api/community-photos'")).toBeGreaterThan(guard);
    expect(handler).toMatch(/finally \{\s*setSharing\(false\)/);
    expect(source).toMatch(/<button\s+type="submit"[^>]*disabled=\{isSharing\}[^>]*aria-busy=\{isSharing \|\| undefined\}/);
  });

  it('no longer says the photo is saved before the request goes out', () => {
    expect(handler.replace(/\s+/g, ' ')).not.toContain('saved to the device before the request');
  });
});

describe('the gallery copy', () => {
  const messages = ['en', 'vi'].map(
    (l) => JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')) as { recipe: Record<string, string> },
  );

  it('no longer offers http:// as a valid photo address', () => {
    for (const m of messages) expect(m.recipe.errUrlScheme).not.toContain('http://');
  });

  it('no longer claims a failed share was saved on the device', () => {
    for (const m of messages) expect(m.recipe).not.toHaveProperty('errShareFailed');
  });
});
