import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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

  it('passes through anything that is not a B&H catalogue photo', () => {
    for (const src of [
      '/logo.png',
      '/products/sony-sel50f14gm.jpg',
      'https://www.sony.com.vn/image/df5de41437d48c04ff92d80faa8a610a?fmt=png-alpha',
      'https://sony.scene7.com/is/image/sonyglobalsolutions/a7iv',
      'https://nqeedlgzaewccqztqvik.supabase.co/storage/v1/object/public/recipes/a.jpg',
      'data:image/gif;base64,R0lGOD',
      'not a url at all',
    ]) {
      expect(loader({ src, width: 64 })).toBe(src);
    }
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
