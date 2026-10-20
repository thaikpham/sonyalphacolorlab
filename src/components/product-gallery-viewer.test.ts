import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import { galleryImages, ProductGalleryViewer } from './product-gallery-viewer';

/**
 * No DOM, so nothing here fires an image error: what a failed load does to the
 * list is `galleryImages`, which the component calls with the URLs that failed,
 * and the markup is checked for what an empty list renders.
 */

const BH = 'https://static.bhphoto.com/images';
const SONY = 'https://www.sony.com.vn/image/7dfe1883c81b07329241249057a11fbc?fmt=png-alpha';

const INTL: ComponentProps<typeof NextIntlClientProvider> = {
  locale: 'en',
  messages: en,
  timeZone: 'Asia/Ho_Chi_Minh',
  children: null,
};

const render = (props: ComponentProps<typeof ProductGalleryViewer>) =>
  renderToStaticMarkup(createElement(NextIntlClientProvider, INTL, createElement(ProductGalleryViewer, props)));

describe('galleryImages', () => {
  it('reads two size directories of one B&H photo as one photo', () => {
    /* FX2's row: the primary, then the primary again, then the same file one
       size directory over. The loader serves both from one rung. */
    expect(galleryImages(`${BH}/fb/1899230.jpg`, [`${BH}/fb/1899230.jpg`, `${BH}/images1000x1000/1899230.jpg`])).toEqual([
      `${BH}/fb/1899230.jpg`,
    ]);
  });

  it('keeps different photos, in order, and drops blanks', () => {
    expect(galleryImages(`${BH}/fb/1729317.jpg`, ['', '  ', `${BH}/images1000x1000/1729318.jpg`])).toEqual([
      `${BH}/fb/1729317.jpg`,
      `${BH}/images1000x1000/1729318.jpg`,
    ]);
  });

  it('never merges a directory the loader does not resize', () => {
    /* `multiple_images` is not one file at two sizes, so it is not a duplicate. */
    const a = `${BH}/multiple_images/images500x500/1634137757000_IMG_1621830.jpg`;
    expect(galleryImages(`${BH}/fb/1621830.jpg`, [a])).toHaveLength(2);
  });

  it('drops a photo that failed to load', () => {
    expect(galleryImages(SONY, [`${BH}/fb/1.jpg`], new Set([SONY]))).toEqual([`${BH}/fb/1.jpg`]);
    expect(galleryImages(SONY, [], new Set([SONY]))).toEqual([]);
  });
});

describe('ProductGalleryViewer', () => {
  it('shows one photo once, with no counter and no thumbnail rail', () => {
    const html = render({
      primaryImageUrl: `${BH}/fb/1899230.jpg`,
      galleryUrls: [`${BH}/fb/1899230.jpg`, `${BH}/images1000x1000/1899230.jpg`],
      productName: 'FX2',
    });
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).not.toContain('1 / 2');
    expect(html).not.toContain('aria-label="FX2');
  });

  it('draws the no-photo mark, not a broken image, when there is nothing to show', () => {
    const html = render({ primaryImageUrl: '', galleryUrls: [], productName: 'RX1R III' });
    expect(html).not.toContain('<img');
    expect(html).toContain(en.cameras.noPhoto);
    expect(html).not.toContain('/logo.png');
  });
});
