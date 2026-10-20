import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPEC_ROWS, type AccessorySpecs, type CameraSpecs, type LensSpecs, type ProductSpecs, type SonyCamera } from './types';
import { PRICE_VND_MAX, type Category } from './taxonomy';
import {
  PRODUCT_WRITE_ERRORS,
  SKU_MAX,
  URL_MAX,
  productCreate,
  productPatch,
  writeErrorFor,
  type CreateResult,
  type PatchResult,
} from './product-write';

/**
 * What an administrator's save may change, decided without Next or Supabase.
 *
 * The owner's report was "I edit a product, press Save, and nothing updates".
 * The writes landed; what failed was around them. Category, sub-categories,
 * SKU, price and URL could not be changed at all, five accessories could never
 * take a spec value, and the create route wrote a price in a spelling no other
 * row uses. These are the rules both product routes share.
 *
 * `productPatch` answers with the COLUMNS a save changes, never a whole row —
 * the update route writes only those, under its version filter.
 *
 * Rule of thumb: **a value equal to what is stored is accepted as stored; only a
 * change is validated.** A row carrying a legacy value must still be saveable
 * for its other fields.
 */

const seed = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as SonyCamera[];
const catalogue = [...seed('data/sony-cameras.seed.json'), ...seed('data/sony-audio.seed.json')];
const byId = (id: string) => {
  const p = catalogue.find((c) => c.id === id);
  if (!p) throw new Error(`no seeded product ${id}`);
  return structuredClone(p);
};

const anyone = () => true;
const diOnly = (c: Category) => c !== 'audio';
const peOnly = (c: Category) => c === 'audio';

function expectPatch(r: PatchResult): Record<string, unknown> {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.update;
}

function expectCreated(r: CreateResult): SonyCamera {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.product;
}

function expectMissingMatchesNulls(specs: ProductSpecs) {
  const row = specs as unknown as Record<string, unknown>;
  const nulls = SPEC_ROWS[specs.kind].filter((f) => row[f] === null || row[f] === undefined).sort();
  expect([...specs.specsMissing].sort()).toEqual(nulls);
  for (const k of Object.keys(row)) {
    if (['kind', 'specsSource', 'specsMissing', 'keySpecs'].includes(k)) continue;
    expect(SPEC_ROWS[specs.kind], `stray key "${k}" on a ${specs.kind} block`).toContain(k);
  }
}

const fx3 = () => byId('sony-ilme-fx3a-q-ap2');
const headphone = () => structuredClone(catalogue.find((p) => p.category === 'audio' && p.subCategory1 === 'Tai nghe')!);

describe('productPatch — the fields that were read-only', () => {
  it('changes SKU, price, URL and placement in one save, as columns', () => {
    const update = expectPatch(
      productPatch(
        {
          sku: '  ILME-FX3A  ',
          priceVnd: 99_990_000,
          url: ' https://www.sony.com.vn/electronics/fx3a ',
          category: 'camera',
          subCategory1: 'Full Frame',
          subCategory2: 'Máy ảnh Alpha',
        },
        fx3(),
        anyone,
      ),
    );
    expect(update).toEqual({
      sku: 'ILME-FX3A',
      price_vnd: 99_990_000,
      price_formatted: '99.990.000 đ',
      url: 'https://www.sony.com.vn/electronics/fx3a',
      sub_category_2: 'Máy ảnh Alpha',
    });
  });

  it('writes nothing for a value equal to the stored one', () => {
    const p = fx3();
    expect(
      expectPatch(
        productPatch(
          {
            sku: p.sku,
            priceVnd: p.priceVnd,
            url: p.url,
            category: p.category,
            subCategory1: p.subCategory1,
            subCategory2: p.subCategory2,
          },
          p,
          anyone,
        ),
      ),
    ).toEqual({});
  });

  it('derives the formatted price on the server and never takes it from the body', () => {
    expect(expectPatch(productPatch({ priceVnd: 0, priceFormatted: '1 ₫' }, fx3(), anyone))).toEqual({
      price_vnd: 0,
      price_formatted: 'Liên hệ',
    });
    expect(expectPatch(productPatch({ priceFormatted: 'free!' }, fx3(), anyone))).toEqual({});
  });

  it('never writes the id, whatever the body says', () => {
    expect(expectPatch(productPatch({ id: 'sony-other' }, fx3(), anyone))).toEqual({});
  });

  it('refuses a price that is not a whole number of đồng in range', () => {
    for (const priceVnd of [-1, 1.5, PRICE_VND_MAX + 1, '1000', Number.NaN, null]) {
      expect(productPatch({ priceVnd }, fx3(), anyone), String(priceVnd)).toMatchObject({
        ok: false,
        error: 'invalidPrice',
        status: 400,
      });
    }
    expect(expectPatch(productPatch({ priceVnd: PRICE_VND_MAX }, fx3(), anyone)).price_vnd).toBe(PRICE_VND_MAX);
  });

  it('accepts only one http or https link, and not an endless one', () => {
    for (const url of [
      'javascript:alert(1)',
      'ftp://sony.com/x',
      'www.sony.com.vn',
      'https://a.test/1.png\nhttps://a.test/2.png',
      `https://a.test/${'x'.repeat(URL_MAX)}`,
    ]) {
      expect(productPatch({ url }, fx3(), anyone), url.slice(0, 40)).toMatchObject({
        ok: false,
        error: 'invalidUrl',
        status: 400,
      });
    }
    expect(expectPatch(productPatch({ url: 'http://sony.com.vn/a' }, fx3(), anyone)).url).toBe('http://sony.com.vn/a');
  });

  it('lets the link be cleared — an empty url is the catalogue’s “no page”', () => {
    /* 20 audio rows and 6 cameras ship with `url: ''`; both surfaces test it
       before linking. A made-up sony.com.vn link would read as sourced. */
    expect(expectPatch(productPatch({ url: '  ' }, fx3(), anyone))).toEqual({ url: '' });
  });

  it('requires a SKU except on audio, and caps its length', () => {
    expect(productPatch({ sku: '   ' }, fx3(), anyone)).toMatchObject({ ok: false, error: 'skuRequired', status: 400 });
    expect(productPatch({ sku: 'X'.repeat(SKU_MAX + 1) }, fx3(), anyone)).toMatchObject({ ok: false, error: 'invalidSku' });
    expect(productPatch({ sku: 'A\u0007B' }, fx3(), anyone)).toMatchObject({ ok: false, error: 'invalidSku' });
    const audio = { ...headphone(), sku: 'WH-TEST' };
    expect(expectPatch(productPatch({ sku: '' }, audio, anyone))).toEqual({ sku: '' });
  });

  it('keeps the inner spacing of a SKU as Sony prints it', () => {
    /* `DSC-RX1RM3  AP2` ships with two spaces; collapsing them would make it a
       different SKU from the one on the box. */
    expect(expectPatch(productPatch({ sku: 'DSC-RX1RM3  AP2' }, fx3(), anyone)).sku).toBe('DSC-RX1RM3  AP2');
  });

  it('asks for a SKU when an audio product without one moves out of audio', () => {
    const audio = headphone();
    expect(audio.sku).toBe('');
    expect(
      productPatch({ category: 'accessory', subCategory1: 'Audio', subCategory2: 'Microphone' }, audio, anyone),
    ).toMatchObject({ ok: false, error: 'skuRequired' });
    expect(
      expectPatch(
        productPatch({ category: 'accessory', subCategory1: 'Audio', subCategory2: 'Microphone', sku: 'ECM-X' }, audio, anyone),
      ),
    ).toMatchObject({ category: 'accessory', sub_category_1: 'Audio', sub_category_2: 'Microphone', sku: 'ECM-X' });
  });

  it('answers a malformed field as a malformed request', () => {
    for (const body of [{ sku: 7 }, { url: 42 }, { subCategory1: ['Full Frame'] }, { subCategory2: null }]) {
      expect(productPatch(body, fx3(), anyone), JSON.stringify(body)).toMatchObject({
        ok: false,
        error: 'badRequest',
        status: 400,
      });
    }
  });

  it('refuses a placement the taxonomy does not have', () => {
    for (const body of [
      { category: 'drone' },
      { subCategory1: 'Mirrorless Full-Frame' },
      { subCategory2: 'GM' },
      /* "Cinema Line" is not a lens line. */
      { category: 'lens' },
      { category: 'audio', subCategory1: 'Loa', subCategory2: 'Nhét tai' },
    ]) {
      expect(productPatch(body, fx3(), anyone), JSON.stringify(body)).toMatchObject({
        ok: false,
        error: 'invalidPlacement',
        status: 400,
      });
    }
  });

  it('allows an empty second level', () => {
    expect(expectPatch(productPatch({ subCategory2: '' }, fx3(), anyone))).toEqual({ sub_category_2: '' });
  });

  it('lets a row keep legacy values it already stores while other fields change', () => {
    const legacy = {
      ...fx3(),
      subCategory1: 'Mirrorless Full-Frame',
      subCategory2: 'Alpha 7 Series',
      url: 'https://a.test/1.png\nhttps://a.test/2.png',
      priceFormatted: '86.390.182 ₫',
      sku: '',
    };
    const update = expectPatch(
      productPatch(
        {
          name: 'FX3 (2026)',
          subCategory1: legacy.subCategory1,
          subCategory2: legacy.subCategory2,
          url: legacy.url,
          sku: '',
          specs: { weight: '640 g' },
        },
        legacy,
        anyone,
      ),
    );
    expect(Object.keys(update).sort()).toEqual(['name', 'specs']);
    expect((update.specs as CameraSpecs).weight).toBe('640 g');
  });

  it('keeps main’s lenient text fields: a blank name or image is not sent, not an error', () => {
    expect(expectPatch(productPatch({ name: '  ', fullName: '', imageUrl: ' ' }, fx3(), anyone))).toEqual({});
  });

  it('refuses a body that is not an object', () => {
    for (const body of [null, 'x', [], 3]) {
      expect(productPatch(body, fx3(), anyone)).toMatchObject({ ok: false, error: 'badRequest', status: 400 });
    }
  });

  it('cleans the gallery and the feature lines', () => {
    const update = expectPatch(
      productPatch(
        { galleryUrls: [' https://a.test/1.png ', '', 3, 'https://a.test/2.png'], features: { en: [' One ', ''], vi: 'x' } },
        fx3(),
        anyone,
      ),
    );
    expect(update.gallery_urls).toEqual(['https://a.test/1.png', 'https://a.test/2.png']);
    expect(update.features).toEqual({ en: ['One'], vi: [] });
  });

  it('respects an emptied gallery', () => {
    expect(expectPatch(productPatch({ galleryUrls: [] }, fx3(), anyone)).gallery_urls).toEqual([]);
  });
});

describe('productPatch — authorisation', () => {
  it('needs the role to cover the category the product is in now', () => {
    expect(productPatch({ name: 'x' }, headphone(), diOnly)).toMatchObject({
      ok: false,
      error: 'notAllowedForCategory',
      status: 403,
    });
    expect(productPatch({ name: 'x' }, fx3(), peOnly)).toMatchObject({ ok: false, error: 'notAllowedForCategory' });
  });

  it('and the category it is moving to', () => {
    /* A DI editor cannot file a camera under audio, nor a PE editor pull a
       headphone into the camera list. */
    expect(
      productPatch({ category: 'audio', subCategory1: 'Tai nghe', subCategory2: 'Nhét tai', sku: '' }, fx3(), diOnly),
    ).toMatchObject({ ok: false, error: 'notAllowedForCategory', status: 403 });
    expect(
      productPatch({ category: 'accessory', subCategory1: 'Audio', subCategory2: 'Microphone', sku: 'X' }, headphone(), peOnly),
    ).toMatchObject({ ok: false, error: 'notAllowedForCategory', status: 403 });
  });
});

describe('productPatch — highlights', () => {
  const side = {
    points: [1, 2, 3, 4].map((i) => ({ title: `T${i}`, body: `B${i}.` })),
    keySpecs: [{ key: 'sensor', value: '33MP' }],
  };

  it('stores valid highlights, and clears them with null', () => {
    expect(expectPatch(productPatch({ highlights: { en: side, vi: side } }, fx3(), anyone)).highlights).toEqual({
      en: side,
      vi: side,
    });
    expect(expectPatch(productPatch({ highlights: null }, fx3(), anyone))).toEqual({ highlights: null });
  });

  it('refuses highlights that fail the schema, or on a product that will not be a camera', () => {
    expect(productPatch({ highlights: { en: side } }, fx3(), anyone)).toMatchObject({ ok: false, error: 'invalidHighlights' });
    expect(productPatch({ highlights: { en: side, vi: side } }, byId('sony-np-fz100'), anyone)).toMatchObject({
      ok: false,
      error: 'invalidHighlights',
    });
    expect(
      productPatch(
        { category: 'lens', subCategory1: 'Full Frame', subCategory2: 'G', highlights: { en: side, vi: side } },
        fx3(),
        anyone,
      ),
    ).toMatchObject({ ok: false, error: 'invalidHighlights' });
  });
});

describe('productPatch — the spec block follows the placement', () => {
  it('gives an accessory with no block one on its first save', () => {
    const battery = byId('sony-np-fz100');
    expect(battery.specs).toBeFalsy();
    const specs = expectPatch(
      productPatch({ specs: { kind: 'speaker', weight: 'Xấp xỉ 83 g', compatibility: 'ILCE-7M4', power: '100W' } }, battery, anyone),
    ).specs as AccessorySpecs;
    expect(specs.kind).toBe('accessory');
    expect(specs.weight).toBe('83 g');
    expect(specs.compatibility).toBe('ILCE-7M4');
    expect(specs.dimensions).toBeNull();
    expect(specs.keySpecs).toEqual([]);
    expect(specs.specsSource).toBe(battery.url);
    expectMissingMatchesNulls(specs);
  });

  it('every one of the five blockless accessories can take a value', () => {
    const blockless = catalogue.filter((p) => !p.specs);
    expect(blockless.map((p) => p.id).sort()).toEqual(
      ['sony-ecm-b10', 'sony-ecm-m1', 'sony-gp-vpt2bt', 'sony-la-ea5', 'sony-np-fz100'].sort(),
    );
    for (const p of blockless) {
      const specs = expectPatch(productPatch({ specs: { weight: '1 g' } }, structuredClone(p), anyone)).specs as AccessorySpecs;
      expect(specs.weight, p.id).toBe('1 g');
      expect(specs.specsSource, p.id).toMatch(/^https:\/\//);
    }
  });

  it('cites the catalogue home when the product has no https page of its own', () => {
    const blockless = { ...byId('sony-np-fz100'), url: '' };
    const specs = expectPatch(productPatch({ specs: { weight: '1 g' } }, blockless, anyone)).specs as AccessorySpecs;
    expect(specs.specsSource).toBe('https://www.sony.com.vn');
  });

  it('leaves a blockless product blockless when the save does not touch specs', () => {
    expect(expectPatch(productPatch({ name: 'NP-FZ100' }, byId('sony-np-fz100'), anyone))).not.toHaveProperty('specs');
  });

  it('re-shapes the block when the category changes, keeping the shared rows', () => {
    const camera = fx3();
    const before = camera.specs as CameraSpecs;
    expect(before.weight).toBeTruthy();
    const update = expectPatch(
      productPatch(
        { category: 'lens', subCategory1: 'Full Frame', subCategory2: 'G', specs: { focalLength: '24 mm' } },
        camera,
        anyone,
      ),
    );
    expect(update).toMatchObject({ category: 'lens', sub_category_2: 'G' });
    expect(update).not.toHaveProperty('sub_category_1');
    const specs = update.specs as LensSpecs;
    expect(specs.kind).toBe('lens');
    expect(specs.weight).toBe(before.weight);
    expect(specs.focalLength).toBe('24 mm');
    expect(specs).not.toHaveProperty('sensor');
    expect(specs.specsSource).toBe(before.specsSource);
    expectMissingMatchesNulls(specs);
  });

  it('re-shapes the block on a kind-changing move even when the body sends no specs', () => {
    const update = expectPatch(productPatch({ subCategory1: 'Loa', subCategory2: 'Di động' }, headphone(), anyone));
    expect((update.specs as ProductSpecs).kind).toBe('speaker');
    expectMissingMatchesNulls(update.specs as ProductSpecs);
  });

  it('keeps the block whole on a move that does not change the kind', () => {
    const update = expectPatch(productPatch({ subCategory1: 'APS-C', subCategory2: 'Vlog' }, fx3(), anyone));
    expect(update).toEqual({ sub_category_1: 'APS-C', sub_category_2: 'Vlog' });
  });

  it('applies the body’s values to the new kind only where the new kind has the row', () => {
    const specs = expectPatch(
      productPatch(
        { category: 'accessory', subCategory1: 'Power', subCategory2: 'Battery', specs: { sensor: 'APS-C', weight: '9 g' } },
        fx3(),
        anyone,
      ),
    ).specs as AccessorySpecs;
    expect(specs).not.toHaveProperty('sensor');
    expect(specs.weight).toBe('9 g');
    expectMissingMatchesNulls(specs);
  });

  it('keeps the stored kind on a same-kind save, whatever kind the body claims', () => {
    const specs = expectPatch(productPatch({ specs: { kind: 'lens', lcd: '', specsMissing: [] } }, fx3(), anyone))
      .specs as CameraSpecs;
    expect(specs.kind).toBe('camera');
    expect(specs.lcd).toBeNull();
    expect(specs.specsMissing).toContain('lcd');
    expectMissingMatchesNulls(specs);
  });

  it('never writes a spec block whose kind disagrees with the placement', () => {
    for (const p of catalogue) {
      const specs = expectPatch(productPatch({ specs: {} }, structuredClone(p), anyone)).specs as ProductSpecs;
      expect(specs.kind, p.id).toBe(p.specs?.kind ?? 'accessory');
    }
  });

  it('keeps a legacy audio row’s stored block, and refuses to invent one of unknown shape', () => {
    const legacy = { ...headphone(), subCategory1: 'Tai nghe Inzone', subCategory2: '' };
    const specs = expectPatch(productPatch({ specs: { battery: '40 giờ' } }, legacy, anyone)).specs as ProductSpecs;
    expect(specs.kind).toBe('headphone');
    expect(productPatch({ specs: { battery: '1' } }, { ...legacy, specs: undefined }, anyone)).toMatchObject({
      ok: false,
      error: 'invalidPlacement',
    });
  });
});

describe('productCreate', () => {
  const body = {
    sku: 'ILCE-7M5',
    name: 'Alpha 7 V',
    category: 'camera',
    subCategory1: 'Full Frame',
    subCategory2: 'Máy ảnh Alpha',
    priceVnd: 64_990_000,
    url: 'https://www.sony.com.vn/a7v',
  };

  it('writes the price the way every seeded row does (never ₫)', () => {
    expect(expectCreated(productCreate(body, anyone)).priceFormatted).toBe('64.990.000 đ');
    expect(
      expectCreated(productCreate({ ...body, priceVnd: 0, priceFormatted: '0 ₫' }, anyone)).priceFormatted,
    ).toBe('Liên hệ');
    expect(expectCreated(productCreate({ ...body, priceVnd: undefined }, anyone)).priceVnd).toBe(0);
  });

  it('derives the spec kind from the taxonomy, not by searching the label for "loa"', () => {
    const speaker = expectCreated(
      productCreate({ ...body, sku: '', category: 'audio', subCategory1: 'Loa', subCategory2: 'Karaoke' }, anyone),
    );
    expect(speaker.specs?.kind).toBe('speaker');
    expect(
      productCreate({ ...body, sku: '', category: 'audio', subCategory1: 'Loa kéo', subCategory2: '' }, anyone),
    ).toMatchObject({ ok: false, error: 'invalidPlacement' });
  });

  it('builds an all-gaps block with the body’s values applied', () => {
    const p = expectCreated(productCreate({ ...body, specs: { weight: 'Khoảng 600 g' } }, anyone));
    expect((p.specs as CameraSpecs).weight).toBe('600 g');
    expect(p.specs?.specsSource).toBe(body.url);
    expectMissingMatchesNulls(p.specs!);
  });

  it('gives an accessory the keySpecs list its type requires', () => {
    const p = expectCreated(
      productCreate({ ...body, sku: 'ECM-X', category: 'accessory', subCategory1: 'Audio', subCategory2: 'Microphone' }, anyone),
    );
    expect(p.specs).toMatchObject({ kind: 'accessory', keySpecs: [] });
  });

  it('applies the same SKU, price, URL and placement rules as an update', () => {
    expect(productCreate({ ...body, sku: '' }, anyone)).toMatchObject({ ok: false, error: 'skuRequired' });
    expect(productCreate({ ...body, priceVnd: -5 }, anyone)).toMatchObject({ ok: false, error: 'invalidPrice' });
    expect(productCreate({ ...body, url: 'javascript:x' }, anyone)).toMatchObject({ ok: false, error: 'invalidUrl' });
    expect(productCreate({ ...body, subCategory2: 'GM' }, anyone)).toMatchObject({ ok: false, error: 'invalidPlacement' });
    expect(productCreate({ ...body, subCategory1: 'Mirrorless Full-Frame' }, anyone)).toMatchObject({
      ok: false,
      error: 'invalidPlacement',
    });
    expect(productCreate({ ...body, name: ' ' }, anyone)).toMatchObject({ ok: false, error: 'nameRequired' });
    expect(productCreate({ ...body, sku: 1 }, anyone)).toMatchObject({ ok: false, error: 'badRequest' });
    expect(productCreate(body, peOnly)).toMatchObject({ ok: false, error: 'notAllowedForCategory', status: 403 });
  });

  it('checks the role before the placement, so a refused category reads as one', () => {
    expect(productCreate({ ...body, subCategory1: 'nonsense' }, peOnly)).toMatchObject({
      ok: false,
      error: 'notAllowedForCategory',
    });
  });

  it('leaves the link empty rather than inventing one', () => {
    expect(expectCreated(productCreate({ ...body, url: undefined }, anyone)).url).toBe('');
  });

  it('allows an audio product without a SKU, and folds diacritics into its id', () => {
    const p = expectCreated(
      productCreate(
        { ...body, sku: '', name: 'Tai nghe chống ồn', category: 'audio', subCategory1: 'Tai nghe', subCategory2: 'Choàng đầu' },
        peOnly,
      ),
    );
    expect(p.id).toBe('sony-tai-nghe-chong-on');
    expect(p.specs?.kind).toBe('headphone');
  });

  it('takes the id from the SKU', () => {
    expect(expectCreated(productCreate({ ...body, sku: 'ILME-FX5B/Q FS1' }, anyone)).id).toBe('sony-ilme-fx5b-q-fs1');
  });
});

describe('writeErrorFor', () => {
  it('names a taken SKU', () => {
    expect(
      writeErrorFor({
        code: '23505',
        message: 'duplicate key value violates unique constraint "sony_cameras_nonempty_sku_key"',
        details: 'Key (sku)=(ILCE-7M4) already exists.',
      }),
    ).toEqual({ error: 'skuTaken', status: 409 });
  });

  it('names a product that already exists', () => {
    expect(
      writeErrorFor({ code: '23505', message: 'duplicate key value violates unique constraint "sony_cameras_pkey"' }),
    ).toEqual({ error: 'duplicateProduct', status: 409 });
  });

  it('is a plain failed save otherwise', () => {
    expect(writeErrorFor({ code: '42501', message: 'permission denied' })).toEqual({ error: 'saveFailed', status: 502 });
    expect(writeErrorFor(null)).toEqual({ error: 'saveFailed', status: 502 });
  });
});

describe('every code these rules answer with has a message', () => {
  /* The editor looks a code up under `admin.errors` and falls back to a
     generic "could not save" — which tells an operator nothing about WHICH
     field to fix. `admin-editor.test.ts` reads the codes out of the route
     sources; these live here, so they are pinned here. */
  for (const locale of ['en', 'vi'] as const) {
    it(locale, () => {
      const errors = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8')).admin.errors as Record<string, string>;
      for (const code of PRODUCT_WRITE_ERRORS) expect(errors, `admin.errors.${code}`).toHaveProperty(code);
    });
  }
});
