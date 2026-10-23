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
    /* Disabled while a request is in flight — and while the preview is still
       loading, which the case below pins. */
    expect(source).toMatch(
      /<button\s+type="submit"[^>]*disabled=\{isSharing \|\| previewPending\}[^>]*aria-busy=\{isSharing \|\| previewPending \|\| undefined\}/,
    );
  });

  /* A duplicate is a photo someone else already shared. Writing a local credit
     for it named this reader over the real contributor on this device. */
  it('writes no local credit for a photo the server already had', () => {
    expect(handler).toMatch(/\bbody = await res\.json\(\)\.catch\(\(\) => null\);/);
    const guard = handler.indexOf('if (!body?.duplicate)');
    expect(guard).toBeGreaterThan(-1);
    expect(handler.indexOf('setLocalCredit(')).toBeGreaterThan(guard);
  });

  /* A link to a web page, a dead file or a thumbnail was stored, then dropped
     from the grid by its onError or drawn as a smudge in the large tile. */
  it('refuses before the request unless the preview decoded at 320px or wider', () => {
    const gate = handler.indexOf('if (!decoded?.ok)');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(handler.indexOf('setSharing(true)'));
    expect(handler).toMatch(/const decoded = preview\?\.src === cleanUrl \? preview : null;/);
    expect(handler).toContain("t('errPreviewSmall')");
    expect(handler).toContain("t('errPreviewLoad')");
    expect(source).toContain('const MIN_PREVIEW_WIDTH = 320;');
    expect(source).toMatch(/const ok = width >= MIN_PREVIEW_WIDTH;/);
    expect(source).toMatch(/onError=\{\(\) => \{\s*setPreview\(\{ src: previewUrl, ok: false, width: 0 \}\);/);
  });

  /* A slow but valid photo is not "could not load": Submit waits, disabled,
     while the browser is still fetching the preview, and the handler returns
     quietly rather than raising errPreviewLoad. */
  it('waits for a preview still loading instead of calling it a failure', () => {
    expect(source).toMatch(/const previewPending = previewUrl !== null && preview\?\.src !== previewUrl;/);
    const wait = handler.indexOf('if (previewPending && previewUrl === cleanUrl) return;');
    expect(wait).toBeGreaterThan(-1);
    expect(wait).toBeLessThan(handler.indexOf('if (!decoded?.ok)'));
    expect(source).toMatch(/disabled=\{isSharing \|\| previewPending\}/);
  });

  /* Facebook and Instagram CDN links are signed and expire: refused here with
     the route's own list and its own code, before the round trip. */
  it('refuses an expiring social-CDN host before the request', () => {
    const check = handler.indexOf('if (isExpiringImageHost(cleanUrl))');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(handler.indexOf('setSharing(true)'));
    expect(handler).toContain("tCommunity('errors.expiringImageHost')");
    expect(source).toContain("from '@/lib/community/image-hosts'");
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

  it('reads the list only from a response that succeeded', () => {
    /* The route answers an outage 503 now, with a body that is an error. */
    const read = source.slice(source.indexOf('fetch(`/api/community-photos?slug='));
    expect(read).toMatch(
      /^fetch\(`[^`]*`, \{ signal: controller\.signal \}\)\s*\.then\(\(res\) => \(res\.ok \? res\.json\(\) : null\)\)/,
    );
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
  const tiles = source.slice(source.indexOf('{allPhotos.map((src, i)'), source.indexOf('{/* Still asking'));

  /* Every photograph is a reader's now; the catalogue carries none. Tile 0 is
     the large one by position, which never made it a featured shot. */
  it('tags every photo as community, the hero included', () => {
    expect(tiles).toContain("{t('tagCommunity')}");
    expect(source).not.toContain("t('featuredShot')");
    expect(source).not.toMatch(/\bisUserPhoto\b/);
  });

  /* `priority` is deprecated in Next 16, and an early fetch is a preload on a
     third party's behalf when every tile is an arbitrary reader URL. */
  it('preloads nothing, without the deprecated prop', () => {
    expect(source).not.toMatch(/\bpriority=\{/);
    expect(tiles).not.toMatch(/fetchPriority=/);
    expect(tiles).not.toMatch(/loading=\{/);
    expect(tiles).toMatch(/\bunoptimized\b/);
  });
});

describe('the collage, with no catalogue photographs', () => {
  it('takes no images prop and shows only what readers contributed', () => {
    expect(source).toMatch(/interface RecipeGalleryProps \{\s*slug: string;\s*title: string;\s*\}/);
    expect(source).toMatch(/export function RecipeGallery\(\{ slug, title \}: RecipeGalleryProps\)/);
    expect(source).toMatch(/const allPhotos = useMemo\(\s*\(\) => userPhotos\.filter\(/);
  });

  /* A photographed recipe used to flash "No photos yet" until the GET came
     back. Placeholders until it settles — ok, refused or offline — and the
     empty state only after. */
  it('shows placeholder tiles until the first answer, and the empty state only after it', () => {
    /* `loaded` is "the answer for THIS recipe has come back": it starts
       unset, and a recipe the GET has not answered yet is not loaded. */
    expect(source).toMatch(/const \[loadedSlug, setLoadedSlug\] = useState<string \| null>\(null\);/);
    expect(source).toMatch(/const loaded = loadedSlug === slug;/);
    expect(source).toMatch(/\{!loaded && allPhotos\.length === 0 && \(/);
    expect(source).toMatch(/\{loaded && allPhotos\.length === 0 && !isFormOpen && \(/);
    const placeholders = source.slice(source.indexOf('{/* Still asking'), source.indexOf('{/* Empty State */}'));
    expect(placeholders).toMatch(/<ul aria-hidden className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/);
    /* The radius of the tiles they stand in for, so nothing changes shape
       when the photographs arrive. */
    expect(placeholders).toContain('bg-glass rounded-lg');
    expect(source).toContain('overflow-hidden rounded-lg cursor-zoom-in');
    expect(placeholders).not.toMatch(/\bt\(/);
  });

  it('settles on every answer the GET can give, but not on an abort', () => {
    const read = source.slice(source.indexOf('fetch(`/api/community-photos?slug='), source.indexOf('return () => controller.abort();'));
    expect(read).toMatch(/\.then\(\(data\) => \{\s*setLoadedSlug\(slug\);/);
    expect(read).toMatch(/if \(err\?\.name !== 'AbortError'\) \{\s*setLoadedSlug\(slug\);/);
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

  it('says why a small preview was refused, in both locales', () => {
    for (const m of messages) expect(m.recipe.errPreviewSmall).toMatch(/320/);
  });

  it('no longer carries the featured-shot badge', () => {
    for (const m of messages) expect(m.recipe).not.toHaveProperty('featuredShot');
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
