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
  source.indexOf('const handleContributePhotoClick'),
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

  /* A duplicate is a photo someone else already shared. Writing a local credit
     for it named this reader over the real contributor on this device. */
  it('writes no local credit for a photo the server already had', () => {
    expect(handler).toMatch(/\bbody = await res\.json\(\)\.catch\(\(\) => null\);/);
    const guard = handler.indexOf('if (!body?.duplicate)');
    expect(guard).toBeGreaterThan(-1);
    expect(handler.indexOf('setLocalCredit(')).toBeGreaterThan(guard);
  });

  it('no longer says the photo is saved before the request goes out', () => {
    expect(handler.replace(/\s+/g, ' ')).not.toContain('saved to the device before the request');
  });
});

/**
 * A remove control that only edited localStorage.
 *
 * A photo is saved locally only after its POST succeeds, so every tile that
 * showed ✕ was already a public `community_photos` row, and the route has no
 * DELETE. "Remove contributed photo" hid it on this device and nowhere else.
 * An owner-scoped delete needs an author identity column that the table does
 * not have, so until it exists there is no control offering one.
 */
describe('shared photos', () => {
  it('offer no remove control that cannot remove them', () => {
    expect(source).not.toContain('handleDeleteUserPhoto');
    expect(source).not.toContain('deletePhoto');
  });
});

/**
 * The lightbox follows a photograph, not a position.
 *
 * `allPhotos` shrinks when a tile fails to load and reorders when the
 * community fetch lands. Tracked by index, the open photo could vanish — the
 * dialog unmounted while the index stayed set, so the keydown handler went on
 * swallowing arrow keys page-wide and the next arrow reopened a different
 * photo. A src that leaves the list closes the lightbox by derivation.
 */
describe('the lightbox', () => {
  it('is keyed by src and derives its index', () => {
    expect(source).toContain('useState<string | null>(null);');
    expect(source).not.toMatch(/useState<number \| null>/);
    expect(source).toMatch(/const at = lightboxSrc === null \? -1 : allPhotos\.indexOf\(lightboxSrc\);/);
    expect(source).toMatch(/const lightboxIndex = at === -1 \? null : at;/);
  });

  it('listens for keys only while a photo is actually open', () => {
    const effect = source.slice(source.indexOf('// Keyboard navigation'), source.indexOf('const handleUrlChange'));
    expect(effect).toContain('if (lightboxIndex === null) return;');
  });
});

describe('collage tiles', () => {
  const tiles = source.slice(source.indexOf('{allPhotos.map((src, i)'), source.indexOf('{/* Empty State */}'));

  /* Tile 0 is the hero whatever it is. On a recipe with no catalogue photo
     that is the first community upload — any https URL a reader posted — and it
     was badged "Featured shot" with no Community tag. */
  it('tags a community photo as community, even in the hero slot', () => {
    const tag = tiles.slice(tiles.indexOf('{isUserPhoto'), tiles.indexOf('</span>', tiles.indexOf('{isUserPhoto')));
    expect(tag.indexOf("t('tagCommunity')")).toBeGreaterThan(-1);
    expect(tag.indexOf("t('tagCommunity')")).toBeLessThan(tag.indexOf("t('featuredShot')"));
  });

  /* `priority` is deprecated in Next 16, and it preloaded whatever was first —
     an arbitrary third-party URL when the catalogue had nothing. */
  it('raises fetch priority for a catalogue hero only, without the deprecated prop', () => {
    expect(source).not.toMatch(/\bpriority=\{/);
    expect(tiles).toContain('const isCatalogueHero = isHeroTile && !isUserPhoto;');
    expect(tiles).toMatch(/loading=\{isCatalogueHero \? 'eager' : undefined\}/);
    expect(tiles).toMatch(/fetchPriority=\{isCatalogueHero \? 'high' : undefined\}/);
  });
});

describe('the contribute form', () => {
  /* `type="url"` and `required` let the browser block the submit with its own
     bubble, in the browser's language, before the localised checks ran. */
  it('leaves validation to the localised checks', () => {
    expect(source).toMatch(/<form\s+id="contribute-photo-form"\s+noValidate/);
    expect(handler).toContain("t('errUrlRequired')");
    expect(handler).toContain("t('errSocialScheme')");
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

  /* Keyboard hints and "use … below to" lines were removed site-wide on
     2026-09-28 (CLAUDE.md, "no explanatory lines"). */
  it('carries no keyboard hint and no "use … below" helper line', () => {
    for (const m of messages) {
      for (const [key, value] of Object.entries(m.recipe)) {
        expect(value, key).not.toMatch(/[←→]|\bkey\)|phím/);
      }
      expect(m.recipe.galleryEmpty).not.toMatch(/below|bên dưới/);
      expect(m.recipe).not.toHaveProperty('prevTitle');
      expect(m.recipe).not.toHaveProperty('nextTitle');
    }
  });
});
