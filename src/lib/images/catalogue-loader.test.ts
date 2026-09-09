import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import loader from './catalogue-loader';

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
const LARGE = 'https://static.bhphoto.com/images/images1000x1000';

describe('catalogueImageLoader', () => {
  it('serves the 500px variant at card widths and the 1000px one above', () => {
    const src = `${LARGE}/1899230.jpg`;
    expect(loader({ src, width: 64 })).toBe(`${SMALL}/1899230.jpg`);
    expect(loader({ src, width: 500 })).toBe(`${SMALL}/1899230.jpg`);
    expect(loader({ src, width: 501 })).toBe(`${LARGE}/1899230.jpg`);
    expect(loader({ src, width: 1920 })).toBe(`${LARGE}/1899230.jpg`);
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

  it('rewrites every directory that publishes both sizes', () => {
    for (const dir of ['fb', 'items', 'largeimages', 'images2500x2500']) {
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
   * Storage photographs must NOT pass through.
   *
   * They used to, and that is what spent the project's cached-egress quota: no
   * resizing ever happened, so a 210px grid card downloaded the full original —
   * 155KB on average, 1.87MB at worst, 1.27GB of CDN egress a day against a 5GB
   * month. A passthrough here is not a missing optimization, it is the bug.
   */
  describe('Supabase Storage', () => {
    const STORAGE = 'https://nqeedlgzaewccqztqvik.supabase.co';
    const photo = `${STORAGE}/storage/v1/object/public/recipes/SCL-PP-044/00.png`;

    /* Next inlines this at build time for the browser; vitest does not load
       `.env.local`, so the host has to be stated for the branch to exist. */
    const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
    beforeAll(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = STORAGE;
    });
    afterAll(() => {
      if (original === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = original;
    });

    it('leaves photographs alone when Supabase is not configured at all', () => {
      // The app runs off the seed files then; there is no Storage to optimize.
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      expect(loader({ src: photo, width: 256 })).toBe(photo);
      process.env.NEXT_PUBLIC_SUPABASE_URL = STORAGE;
    });

    it('routes recipe photographs through the optimizer, never verbatim', () => {
      const out = loader({ src: photo, width: 256 });

      expect(out).not.toBe(photo);
      expect(out.startsWith('/_next/image?')).toBe(true);
      expect(new URLSearchParams(out.split('?')[1]).get('url')).toBe(photo);
    });

    it('snaps to three rungs, so the whole catalogue is ~555 transformations', () => {
      // The optimizer bills distinct transformations, not requests. Next asks
      // across its full ladder; only these three widths may reach it.
      const widths = [16, 48, 64, 128, 256, 640, 750, 828, 1080, 1200, 1920];
      const asked = new Set(
        widths.map((width) => new URLSearchParams(loader({ src: photo, width }).split('?')[1]).get('w')),
      );

      expect([...asked].sort()).toEqual(['1200', '256', '640']);
    });

    it('climbs the rungs in step with the width asked for', () => {
      const w = (width: number) =>
        new URLSearchParams(loader({ src: photo, width }).split('?')[1]).get('w');

      // 48px filmstrip thumbnails and the 128-176px lightbox previews. Serving
      // these from 640 was a 10x overdraw on the one surface that renders
      // sixteen images at once.
      expect(w(48)).toBe('256');
      expect(w(256)).toBe('256');
      expect(w(257)).toBe('640');
      expect(w(640)).toBe('640');
      expect(w(641)).toBe('1200');
      expect(w(1920)).toBe('1200');
    });

    it('carries the requested quality, defaulting to Next’s own 75', () => {
      const q = (quality?: number) =>
        new URLSearchParams(loader({ src: photo, width: 256, quality }).split('?')[1]).get('q');

      expect(q()).toBe('75');
      expect(q(90)).toBe('90');
    });

    it('refuses any path on the host that is not a public Storage object', () => {
      // A loader that hands /_next/image an arbitrary path on this host turns
      // the optimizer into a proxy for whatever else the host serves.
      for (const src of [
        `${STORAGE}/rest/v1/recipes`,
        `${STORAGE}/auth/v1/authorize`,
        `${STORAGE}/storage/v1/object/sign/recipes/a.jpg`,
      ]) {
        expect(loader({ src, width: 256 })).toBe(src);
      }
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
