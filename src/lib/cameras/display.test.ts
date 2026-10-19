import { readFileSync } from 'node:fs';
import { createTranslator, type AbstractIntlMessages } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '../../../messages/en.json';
import vi from '../../../messages/vi.json';
import type { SonyCamera } from './types';
import { compareExitPath, officialUrl, priceLabel, productPath, subCategoryLabel } from './display';

const tEn = createTranslator({ locale: 'en', messages: en as AbstractIntlMessages, namespace: 'cameras' });
const tVi = createTranslator({ locale: 'vi', messages: vi as AbstractIntlMessages, namespace: 'cameras' });

describe('subCategoryLabel', () => {
  it('maps a stored Vietnamese value to the reader locale', () => {
    expect(subCategoryLabel('Tai nghe', tEn)).toBe('Headphones');
    expect(subCategoryLabel('Máy ảnh Alpha', tEn)).toBe('Alpha cameras');
    expect(subCategoryLabel('Tai nghe', tVi)).toBe('Tai nghe');
  });

  it('fixes the spelling of a technical name without translating it', () => {
    expect(subCategoryLabel('Full Frame', tEn)).toBe('Full-Frame');
    expect(subCategoryLabel('Full Frame', tVi)).toBe('Full-Frame');
  });

  it('renders an unknown or empty value as stored', () => {
    expect(subCategoryLabel('Cinema Line', tEn)).toBe('Cinema Line');
    expect(subCategoryLabel('', tEn)).toBe('');
  });
});

describe('priceLabel', () => {
  it('reads a zero price as on request, never as the stored Vietnamese text', () => {
    expect(priceLabel({ priceVnd: 0, priceFormatted: 'Liên hệ' }, tEn)).toBe(en.cameras.priceOnRequest);
    expect(priceLabel({ priceVnd: 63_990_000, priceFormatted: '63.990.000 đ' }, tEn)).toBe('63.990.000 đ');
  });
});

/**
 * Six camera rows store a newline-joined list of image assets in `url`, and
 * the product page drew it as "View on Sony Vietnam" — the button opened a
 * scene7 PNG with twenty more URLs glued on. The seed and the database are the
 * owner's to correct; what the page may do is refuse to link anything that is
 * not one product page.
 */
describe('officialUrl', () => {
  it('passes one http(s) product page through', () => {
    const page = 'https://www.sony.com.vn/interchangeable-lens-cameras/products/ilce-7m4';
    expect(officialUrl(page)).toBe(page);
    expect(officialUrl(`  ${page}\n`)).toBe(page);
    expect(officialUrl('https://www.bhphotovideo.com/c/product/1706637-REG/sony.html')).toMatch(/^https:/);
  });

  it('refuses a list of URLs', () => {
    expect(
      officialUrl(
        'https://www.sony.com.vn/a/products/zv-1\nhttps://cdn.shopify.com/s/files/1/zv-1.jpg',
      ),
    ).toBeNull();
  });

  it('refuses an image asset, which is never a product page', () => {
    expect(officialUrl('https://www.sony.com.vn/image/362957ebe1ae1ad73023d9d982fb9065?fmt=png-alpha&wid=660')).toBeNull();
    expect(officialUrl('https://sony.scene7.com/is/image/sonyglobalsolutions/slide5_Mobile_white?$productIntroPlatemobile$')).toBeNull();
    expect(officialUrl('https://static.bhphoto.com/images/images1000x1000/1706637.jpg')).toBeNull();
  });

  it('refuses anything that is not http(s), and nothing at all', () => {
    expect(officialUrl('javascript:alert(1)')).toBeNull();
    expect(officialUrl('/cameras/sony-ilce-7m4')).toBeNull();
    expect(officialUrl('')).toBeNull();
    expect(officialUrl(null)).toBeNull();
    expect(officialUrl(undefined)).toBeNull();
  });

  /* The catalogue as shipped. A seed row that fails here is not a test to
     relax: it is a content fix for the database, listed in the audit notes. */
  it.each(['cameras', 'audio'])('drops every image-list url in the %s seed', (seed) => {
    const products = JSON.parse(readFileSync(`data/sony-${seed}.seed.json`, 'utf8')) as SonyCamera[];
    for (const p of products) {
      const link = officialUrl(p.url);
      if (link === null) continue;
      expect(link, p.id).toMatch(/^https?:\/\/\S+$/);
      expect(link, p.id).not.toMatch(/\/image\/|\.(png|jpe?g|webp|gif)(\?|$)/i);
    }
  });
});

describe('productPath', () => {
  it('sends audio to its own route, which is the only one that resolves it', () => {
    expect(productPath({ id: 'sony-wh-1000xm6', category: 'audio' })).toBe('/audio/sony-wh-1000xm6');
    expect(productPath({ id: 'sony-ilce-7m4', category: 'camera' })).toBe('/cameras/sony-ilce-7m4');
    expect(productPath({ id: 'sony-sel2470gm2', category: 'lens' })).toBe('/cameras/sony-sel2470gm2');
  });
});

describe('compareExitPath', () => {
  it('leaves a headphones-only compare for the audio catalogue', () => {
    expect(compareExitPath([{ category: 'audio' }, { category: 'audio' }])).toBe('/audio');
  });

  it('leaves anything else for the camera catalogue', () => {
    expect(compareExitPath([{ category: 'audio' }, { category: 'camera' }])).toBe('/cameras');
    expect(compareExitPath([{ category: 'lens' }])).toBe('/cameras');
    expect(compareExitPath([])).toBe('/cameras');
  });
});
