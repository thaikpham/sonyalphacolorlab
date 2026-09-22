import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import loader, { isResizable } from './catalogue-loader';

/**
 * The loader stands where Vercel's optimizer used to, so a mistake here is not
 * a slower page — it is a 404 in place of a product photo, on a surface where
 * nobody cross-checks that the picture arrived.
 *
 * Two failures are worth pinning specifically, because both looked correct
 * against a small sample:
 *
 * - Rewriting a directory that does not publish both sizes. `multiple_images`
 *   is the trap: it answers at 500 and 404s at 1000, so a rule validated on one
 *   width breaks at the other.
 * - Restricting the rewrite by filename *shape*. B&H keys the size variants on
 *   the filename verbatim; bare ids, `<timestamp>_<id>` and long slugs all
 *   resolve. An earlier draft matched `\d+` only and silently passed 1936 of
 *   the catalogue's 2164 photos straight through at full size.
 */

const SMALL = 'https://static.bhphoto.com/images/images500x500';
const MID = 'https://static.bhphoto.com/images/images750x750';
const LARGE = 'https://static.bhphoto.com/images/images1000x1000';

describe('catalogueImageLoader', () => {
  it('climbs three rungs, taking the smallest that covers the width', () => {
    const src = `${LARGE}/1899230.jpg`;
    expect(loader({ src, width: 64 })).toBe(`${SMALL}/1899230.jpg`);
    expect(loader({ src, width: 500 })).toBe(`${SMALL}/1899230.jpg`);
    expect(loader({ src, width: 501 })).toBe(`${MID}/1899230.jpg`);
    expect(loader({ src, width: 750 })).toBe(`${MID}/1899230.jpg`);
    expect(loader({ src, width: 751 })).toBe(`${LARGE}/1899230.jpg`);
    expect(loader({ src, width: 1920 })).toBe(`${LARGE}/1899230.jpg`);
  });

  /**
   * The regression this rung exists for.
   *
   * Next builds its srcset from `deviceSizes`, whose first entry above a grid
   * card's declared `25vw` is 640. With a 500/1000 split that entry resolved to
   * the 1000px file and every card on a desktop viewport pulled ~138KB where
   * ~78KB would do.
   */
  it('answers the 640w srcset entry with the 750 rung, not the 1000 one', () => {
    const src = `https://static.bhphoto.com/images/fb/1899230.jpg`;
    expect(loader({ src, width: 640 })).toBe(`${MID}/1899230.jpg`);
  });

  /* A rung that is usually there is a 404 with extra steps: `images2500x2500`
     answered for 22 of 25 sampled filenames, so nothing is ever sent to it. */
  it('never sends a request to a rung it cannot count on', () => {
    const src = `${LARGE}/1899230.jpg`;
    for (const width of [16, 256, 640, 828, 1920, 3840]) {
      expect(loader({ src, width })).not.toContain('images2500x2500');
    }
  });

  it('keys on the directory, never on the filename shape', () => {
    for (const name of [
      '1899230.jpg',
      '1492618566000_784490.jpg',
      'sony_sel2470z_vario_tessar_t_fe_24_70mm_1008126.jpg',
      'Sony_MDR_7506_Headphone_49510.jpg',
    ]) {
      expect(loader({ src: `${LARGE}/${name}`, width: 64 })).toBe(`${SMALL}/${name}`);
    }
  });

  it('rewrites every directory that publishes the rungs', () => {
    for (const dir of ['fb', 'items', 'largeimages', 'images750x750', 'images2500x2500']) {
      const src = `https://static.bhphoto.com/images/${dir}/1899230.jpg`;
      expect(loader({ src, width: 64 })).toBe(`${SMALL}/1899230.jpg`);
    }
  });

  it('leaves directories that do not publish both sizes alone', () => {
    for (const dir of ['multiple_images', 'articles', 'manufacturers', 'categoryImages', 'PLCC']) {
      const src = `https://static.bhphoto.com/images/${dir}/whatever.jpg`;
      expect(loader({ src, width: 64 })).toBe(src);
      expect(loader({ src, width: 1920 })).toBe(src);
    }
  });

  /**
   * The vendored recipe photographs, picked between by rewriting the suffix.
   *
   * No optimizer is involved on this path — the three rungs are real files that
   * `npm run vendor:images` wrote — so a mistake here is a 404 where a
   * photograph should be, on the site's busiest surface.
   */
  describe('vendored recipe photographs', () => {
    const photo = '/recipes/SCL-PP-044/00-1024.webp';

    it('climbs the rungs that exist on disk, and only those', () => {
      const rung = (width: number) => loader({ src: photo, width });

      expect(rung(48)).toBe('/recipes/SCL-PP-044/00-320.webp');
      expect(rung(320)).toBe('/recipes/SCL-PP-044/00-320.webp');
      expect(rung(321)).toBe('/recipes/SCL-PP-044/00-640.webp');
      expect(rung(640)).toBe('/recipes/SCL-PP-044/00-640.webp');
      expect(rung(641)).toBe('/recipes/SCL-PP-044/00-1024.webp');
      expect(rung(1920)).toBe('/recipes/SCL-PP-044/00-1024.webp');
    });

    it('never reaches for the optimizer — these are static files', () => {
      for (const width of [48, 320, 640, 1024, 1920]) {
        expect(loader({ src: photo, width })).not.toContain('/_next/image');
      }
    });

    it('rewrites from whichever rung it is handed, not just the largest', () => {
      // The seed carries -1024, but a component may already hold a smaller one.
      expect(loader({ src: '/recipes/SCL-CL-001/02-320.webp', width: 900 })).toBe(
        '/recipes/SCL-CL-001/02-1024.webp',
      );
    });

    it('leaves other local files alone', () => {
      for (const src of ['/logo.png', '/recipes/notes.txt', '/fonts/noto-sans/a.woff2']) {
        expect(loader({ src, width: 640 })).toBe(src);
      }
    });
  });

  it('passes through anything that is neither a B&H photo nor Storage', () => {
    for (const src of [
      '/logo.png',
      '/products/sony-sel50f14gm.jpg',
      'https://www.sony.com.vn/image/df5de41437d48c04ff92d80faa8a610a?fmt=png-alpha',
      'https://sony.scene7.com/is/image/sonyglobalsolutions/a7iv',
      'data:image/gif;base64,R0lGOD',
      'not a url at all',
    ]) {
      expect(loader({ src, width: 64 })).toBe(src);
    }
  });

  /**
   * Article assets, and the rung that already exists.
   *
   * Nothing is transformed on demand any more. Recipe photographs are vendored
   * into `public/recipes` at three widths, and article media is written to
   * Storage at the same three widths at upload — so both branches of this
   * loader do the same thing: rewrite the path to name the rung that fits. The
   * optimizer is out of the picture entirely, which is the point. Routing these
   * through `/_next/image` traded a Supabase quota for a Vercel one, and
   * Vercel's had already run out once.
   */
  describe('article assets', () => {
    const CONTENT = 'https://touiyczjvnuaxfzulgeq.supabase.co';
    const ASSET = '3f2b9c41-6d5e-4a7b-9c10-2e8f4a6b1d33';
    const stem = `${CONTENT}/storage/v1/object/public/lab/body-ev-vs-flash-ev/${ASSET}`;
    const remote = `${stem}/1024.webp`;
    const local = `/lab/body-ev-vs-flash-ev/${ASSET}/1024.webp`;

    it('never reaches the optimizer', () => {
      for (const width of [16, 48, 256, 640, 1200, 1920]) {
        expect(loader({ src: remote, width })).not.toContain('/_next/image');
      }
    });

    it('climbs the three rungs in step with the width asked for', () => {
      const w = (width: number) => loader({ src: remote, width }).split('/').pop();
      expect(w(16)).toBe('320.webp');
      expect(w(320)).toBe('320.webp');
      expect(w(321)).toBe('640.webp');
      expect(w(640)).toBe('640.webp');
      expect(w(641)).toBe('1024.webp');
      expect(w(1920)).toBe('1024.webp');
    });

    it('asks for no width that was never written', () => {
      const widths = [16, 48, 64, 128, 256, 640, 750, 828, 1080, 1200, 1920];
      const asked = new Set(widths.map((width) => loader({ src: remote, width }).split('/').pop()));
      expect([...asked].sort()).toEqual(['1024.webp', '320.webp', '640.webp']);
    });

    it('changes only the width segment, so it cannot name a different asset', () => {
      const out = loader({ src: remote, width: 320 });
      expect(out).toBe(`${stem}/320.webp`);
      expect(out.startsWith(stem)).toBe(true);
    });

    it('works identically on the offline copy under public/', () => {
      /* Same three rungs on disk, written by the upload route's dev branch, so
         an article authored on a laptop renders through this same path. */
      expect(loader({ src: local, width: 320 })).toBe(
        `/lab/body-ev-vs-flash-ev/${ASSET}/320.webp`,
      );
    });

    it('leaves anything that is not an asset variant alone', () => {
      for (const src of [
        `${CONTENT}/storage/v1/object/public/lab/loose-file.webp`,
        `${CONTENT}/storage/v1/object/sign/lab-drafts/${ASSET}/1024.webp`,
        `${CONTENT}/rest/v1/recipes`,
        `${stem}/2048.webp`,
      ]) {
        expect(loader({ src, width: 320 })).toBe(src);
      }
    });
  });

  /**
   * `isResizable` is what the call sites pass to `unoptimized`, so if it ever
   * disagrees with the loader Next either warns on an image that does have
   * rungs, or builds a srcset of eight identical URLs for one that does not.
   */
  describe('isResizable', () => {
    it('is true exactly where the loader offers more than one file', () => {
      for (const src of [
        `${LARGE}/1899230.jpg`,
        'https://static.bhphoto.com/images/fb/1899230.jpg',
        'https://static.bhphoto.com/images/items/1899230.jpg',
        '/recipes/caspian-blue-640.webp',
      ]) {
        expect(isResizable(src), src).toBe(true);
      }
    });

    it('is false for every source returned verbatim', () => {
      for (const src of [
        'https://sony.scene7.com/is/image/sonyglobalsolutions/Primary_image-21?$primaryshotPreset$&fmt=png-alpha',
        'https://www.sony.com.vn/image/c40743f1385344c5a54745b9130fba5c?fmt=png-alpha',
        'https://static.bhphoto.com/images/multiple_images/whatever.jpg',
        'https://static.bhphoto.com/images/articles/whatever.jpg',
        '/logo.png',
      ]) {
        expect(isResizable(src), src).toBe(false);
      }
    });

    it('agrees with the loader rather than restating its branches', () => {
      const src = `${LARGE}/1899230.jpg`;
      const differs = loader({ src, width: 16 }) !== loader({ src, width: 4000 });
      expect(isResizable(src)).toBe(differs);
    });
  });

  it('never returns a bhphotovideo.com URL — that host 403s hotlinked requests', () => {
    const src = 'https://www.bhphotovideo.com/images/images1000x1000/1102009.jpg';
    expect(loader({ src, width: 64 })).toBe(src);
    expect(loader({ src, width: 64 })).not.toContain('static.bhphoto.com');
  });

  /**
   * The seed is the loader's only real input. If a future harvest introduces a
   * B&H directory nobody checked, this fails rather than shipping a photo that
   * 404s at one breakpoint and renders at another.
   */
  it('covers every B&H directory the catalogue actually references', () => {
    const seed = JSON.parse(
      readFileSync('data/sony-cameras.seed.json', 'utf8'),
    ) as { imageUrl?: string; galleryUrls?: string[] }[];

    const dirs = new Set<string>();
    for (const product of seed) {
      for (const url of [product.imageUrl, ...(product.galleryUrls ?? [])]) {
        const match = url?.match(/^https:\/\/static\.bhphoto\.com\/images\/([^/]+)\/[^/]+$/);
        if (match) dirs.add(match[1]);
      }
    }

    const known = new Set([
      'fb',
      'items',
      'largeimages',
      'images500x500',
      'images1000x1000',
      'images2500x2500',
      'multiple_images',
      'articles',
      'manufacturers',
      'categoryImages',
      'PLCC',
    ]);

    expect([...dirs].filter((d) => !known.has(d))).toEqual([]);
  });

  it('leaves no http:// or www.bhphotovideo.com image URL in the seed', () => {
    const raw = readFileSync('data/sony-cameras.seed.json', 'utf8');
    const seed = JSON.parse(raw) as { imageUrl?: string; galleryUrls?: string[] }[];

    const images = seed.flatMap((p) => [p.imageUrl, ...(p.galleryUrls ?? [])]).filter(Boolean);
    expect(images.filter((u) => u!.startsWith('http://'))).toEqual([]);
    expect(images.filter((u) => u!.includes('bhphotovideo.com'))).toEqual([]);
  });
});
