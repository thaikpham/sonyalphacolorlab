import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_COLUMNS, galleryFromRow, productFromRow, type ProductRow } from './row';
import type { SonyCamera } from './types';

/**
 * A gallery saved in /admin/wiki has to be the gallery the site shows.
 *
 * Both catalogue readers used to select every column except `gallery_urls` and
 * take the gallery from the seed instead. The admin route wrote the column; no
 * reader ever read it. So a gallery edit committed, answered "saved", and the
 * editor reopened on the old photographs — as did every product page — which
 * reads exactly like a save that never reached the database.
 */

const row = (over: Partial<ProductRow> = {}): ProductRow => ({
  id: 'sony-zv-1m2-wq-e32',
  sku: 'ZV-1M2/WQ E32',
  name: 'ZV-1 II',
  full_name: 'Máy ảnh Sony ZV-1 II',
  category: 'camera',
  sub_category_1: 'Compact',
  sub_category_2: '',
  price_vnd: '19990000',
  price_formatted: '19.990.000 ₫',
  url: 'https://www.sony.com.vn/zv1m2',
  image_url: 'https://static.bhphoto.com/images/fb/1.jpg',
  gallery_urls: ['https://db.example/1.jpg', 'https://db.example/2.jpg'],
  features: { en: ['a'], vi: ['b'] },
  specs: null,
  ...over,
});

const seed = {
  galleryUrls: ['https://seed.example/old.jpg'],
  specs: { kind: 'camera', specsSource: 'https://seed', specsMissing: [] },
} as unknown as SonyCamera;

describe('productFromRow', () => {
  it('takes the gallery from the database when the row holds one', () => {
    expect(productFromRow(row(), seed).galleryUrls).toEqual([
      'https://db.example/1.jpg',
      'https://db.example/2.jpg',
    ]);
  });

  it('keeps an emptied gallery empty — the editor cleared it on purpose', () => {
    expect(productFromRow(row({ gallery_urls: [] }), seed).galleryUrls).toEqual([]);
  });

  it('falls back to the seed only for a gallery never written', () => {
    expect(productFromRow(row({ gallery_urls: null }), seed).galleryUrls).toEqual(seed.galleryUrls);
    expect(productFromRow(row({ gallery_urls: undefined }), seed).galleryUrls).toEqual(seed.galleryUrls);
  });

  it('falls back to the seed spec block only when the row has none', () => {
    expect(productFromRow(row({ specs: null }), seed).specs).toBe(seed.specs);
    const own = { kind: 'camera', specsSource: 'https://db', specsMissing: [] };
    expect(productFromRow(row({ specs: own }), seed).specs).toBe(own);
  });

  it('converts the bigint price PostgREST may send as a string', () => {
    expect(productFromRow(row()).priceVnd).toBe(19_990_000);
  });

  it('drops blank and non-string gallery entries', () => {
    expect(galleryFromRow(['https://a', '', '  ', 7, null])).toEqual(['https://a']);
    expect(galleryFromRow('https://a')).toBeUndefined();
  });
});

describe('PRODUCT_COLUMNS', () => {
  const columns = PRODUCT_COLUMNS.split(',').map((c) => c.trim());

  it('asks for the gallery', () => {
    expect(columns).toContain('gallery_urls');
  });

  it('never asks for an editor address, and never for *', () => {
    /* These reads run under the anon key. `updated_by` is an email. */
    expect(columns).not.toContain('updated_by');
    expect(columns).not.toContain('*');
  });
});

/* The readers themselves, online, against a fake content project. */

const answers: Record<string, ProductRow[]> = { camera: [], audio: [] };
const selected: string[] = [];

vi.mock('@/lib/supabase/server', () => ({
  contentRead: () => ({
    from: (table: string) => {
      expect(table).toBe('sony_cameras');
      let audio = false;
      const builder = {
        select(columns: string) {
          selected.push(columns);
          return builder;
        },
        eq(column: string, value: string) {
          if (column === 'category' && value === 'audio') audio = true;
          return builder;
        },
        neq() {
          return builder;
        },
        order: async () => ({ data: audio ? answers.audio : answers.camera, error: null }),
      };
      return builder;
    },
  }),
}));

const ONLINE = {
  NEXT_PUBLIC_AUTH_SUPABASE_URL: 'https://nqeedlgzaewccqztqvik.supabase.co',
  NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY: 'a',
  AUTH_SUPABASE_SECRET_KEY: 'b',
  NEXT_PUBLIC_CONTENT_SUPABASE_URL: 'https://alpehrfvkryearajlfnx.supabase.co',
  CONTENT_SUPABASE_ANON_KEY: 'c',
  CONTENT_SUPABASE_SECRET_KEY: 'd',
};

describe('the catalogue readers, online', () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(ONLINE)) vi.stubEnv(key, value);
    selected.length = 0;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('serve the camera gallery the database holds', async () => {
    /* A product that also exists in the seed, with a different gallery there:
       the database's answer is the one the site must show. */
    answers.camera = [row({ id: 'sony-ilce-7m4-bq-ap2', gallery_urls: ['https://db.example/saved.jpg'] })];
    const { getSonyCameras } = await import('./data');
    const [product] = await getSonyCameras();
    expect(product.galleryUrls).toEqual(['https://db.example/saved.jpg']);
    expect(selected).toEqual([PRODUCT_COLUMNS]);
  });

  it('serve the audio gallery the database holds', async () => {
    answers.audio = [
      row({ id: 'sony-wh-1000xm6', category: 'audio', gallery_urls: ['https://db.example/xm6.jpg'] }),
    ];
    const { getSonyAudio } = await import('@/lib/audio/data');
    const [product] = await getSonyAudio();
    expect(product.galleryUrls).toEqual(['https://db.example/xm6.jpg']);
    expect(selected).toEqual([PRODUCT_COLUMNS]);
  });
});
