import { describe, expect, it } from 'vitest';
import type { AccessorySpecs, CameraSpecs, HeadphoneSpecs, SonyCamera } from '@/lib/cameras/types';
import {
  afterSave,
  asDraft,
  changes,
  choosePlacement,
  highlightsDropped,
  isDirty,
  localesEmptied,
  placementDrops,
  priceDigits,
  saveBody,
  withPackaging,
  withPlacement,
  type Draft,
} from './product-draft';

/**
 * What a Save sends from the product editor, executed against the pure draft
 * functions the component calls.
 */

const V1 = '2026-10-01T09:00:00.123456+00:00';
const V2 = '2026-10-02T10:30:00.654321+00:00';

function specs(over: Partial<CameraSpecs> = {}): CameraSpecs {
  return {
    kind: 'camera',
    specsSource: 'https://www.sony.com.vn/a7m4',
    specsMissing: [],
    sensor: 'Full-Frame Exmor R CMOS BSI',
    effectivePixels: '33,0 MP',
    isoRange: '100–51200',
    autofocus: '759 điểm',
    video: '4K 60p',
    stabilization: '5-axis',
    viewfinder: '3,69 triệu điểm ảnh',
    lcd: '3,0"',
    mediaSlots: 'CFexpress A / SD',
    battery: '580 ảnh',
    weight: '659 g',
    dimensions: '131 x 96 x 80 mm',
    ...over,
  };
}

function product(over: Partial<SonyCamera> = {}): SonyCamera {
  return {
    id: 'sony-ilce-7m4',
    sku: 'ILCE-7M4',
    name: 'A7 IV',
    fullName: 'Máy ảnh Sony Alpha 7 IV',
    category: 'camera',
    subCategory1: 'Full Frame',
    subCategory2: 'Máy ảnh Alpha',
    priceVnd: 52_990_000,
    priceFormatted: '52.990.000 đ',
    url: 'https://www.sony.com.vn/a7m4',
    imageUrl: 'https://static.bhphoto.com/a.jpg',
    galleryUrls: ['https://static.bhphoto.com/a.jpg'],
    features: { en: ['33MP sensor'], vi: ['Cảm biến 33MP'] },
    specs: specs(),
    highlights: null,
    ...over,
  };
}

/** An accessory whose database copy has no spec block — five shipped that way. */
function blockless(over: Partial<SonyCamera> = {}): SonyCamera {
  return product({
    id: 'sony-np-fz100',
    sku: 'NP-FZ100',
    name: 'NP-FZ100',
    category: 'accessory',
    subCategory1: 'Power',
    subCategory2: 'Battery',
    specs: undefined,
    ...over,
  });
}

const edit = (d: Draft, patch: Partial<Draft>): Draft => ({ ...d, ...patch });

describe('changes', () => {
  it('sends nothing for an untouched draft', () => {
    const p = product();
    expect(changes(asDraft(p, V1), p)).toEqual({});
    expect(isDirty(asDraft(p, V1), p)).toBe(false);
  });

  it('sends only the spec sheet when only a spec changed', () => {
    /* The bug: every save carried name, full name, image, gallery and
       features, so a second tab's weight fix reverted the first tab's new
       bullet. */
    const p = product();
    const d = asDraft(p, V1);
    const body = saveBody(edit(d, { specs: { ...d.specs, weight: '658 g' } }), p);
    expect(Object.keys(body).sort()).toEqual(['expectedUpdatedAt', 'specs']);
    expect(body.expectedUpdatedAt).toBe(V1);
    expect((body as Record<string, unknown>).specs).toMatchObject({
      weight: '658 g',
      kind: 'camera',
      sensor: 'Full-Frame Exmor R CMOS BSI',
    });
  });

  it('sends the features block and nothing else for a new bullet', () => {
    const p = product();
    const d = asDraft(p, V1);
    expect(changes(edit(d, { vi: `${d.vi}\nMới` }), p)).toEqual({
      features: { en: ['33MP sensor'], vi: ['Cảm biến 33MP', 'Mới'] },
    });
  });

  it('ignores whitespace-only edits', () => {
    const p = product();
    const d = asDraft(p, V1);
    expect(changes(edit(d, { name: ' A7 IV  ', en: '33MP sensor\n\n', sku: ' ILCE-7M4 ', url: `${p.url} ` }), p)).toEqual({});
  });

  it('never sends an emptied name, which the route would ignore anyway', () => {
    const p = product();
    expect(changes(edit(asDraft(p, V1), { name: '  ' }), p)).toEqual({});
  });

  it('falls the primary image back to the first gallery photo', () => {
    const p = product();
    const d = edit(asDraft(p, V1), { imageUrl: '', galleryUrls: 'https://static.bhphoto.com/b.jpg' });
    expect(changes(d, p)).toEqual({
      galleryUrls: ['https://static.bhphoto.com/b.jpg'],
      imageUrl: 'https://static.bhphoto.com/b.jpg',
    });
  });

  it('sends highlights only for a camera, and only when touched', () => {
    const lens = product({ category: 'lens', subCategory1: 'Full Frame', subCategory2: 'GM', specs: undefined });
    const d = asDraft(lens, V1);
    const touched = edit(d, { hl: { ...d.hl, en: { ...d.hl.en, points: 'A :: b' } } });
    expect(changes(touched, lens)).toEqual({});
    const cam = product();
    const c = asDraft(cam, V1);
    expect(Object.keys(changes(edit(c, { hl: { ...c.hl, en: { ...c.hl.en, points: 'A :: b' } } }), cam))).toEqual([
      'highlights',
    ]);
  });

  it('names a never-edited row\'s version as null, not absent', () => {
    const p = product();
    const d = asDraft(p, null);
    expect(saveBody(edit(d, { name: 'α7 IV' }), p)).toEqual({ name: 'α7 IV', expectedUpdatedAt: null });
  });
});

describe('changes — the fields that were read-only', () => {
  it('sends SKU, price and URL only when they change, trimmed, and the price as a number', () => {
    const p = product();
    const d = asDraft(p, V1);
    expect(d).toMatchObject({ sku: 'ILCE-7M4', priceVnd: '52990000', url: 'https://www.sony.com.vn/a7m4' });
    expect(
      changes(edit(d, { sku: ' ILCE-7M4/B ', priceVnd: '49990000', url: ' https://www.sony.com.vn/a7m4-b ' }), p),
    ).toEqual({ sku: 'ILCE-7M4/B', priceVnd: 49_990_000, url: 'https://www.sony.com.vn/a7m4-b' });
  });

  it('never sends the formatted price — the server derives it', () => {
    const d = asDraft(product(), V1);
    expect(changes(edit(d, { priceVnd: '1' }), product())).toEqual({ priceVnd: 1 });
  });

  it('reads an empty price as "no published figure", which is 0', () => {
    const d = asDraft(product(), V1);
    expect(changes(edit(d, { priceVnd: '' }), product())).toEqual({ priceVnd: 0 });
    const unpriced = asDraft(product({ priceVnd: 0, priceFormatted: 'Liên hệ' }), V1);
    expect(unpriced.priceVnd).toBe('');
    expect(changes(unpriced, product())).toEqual({});
  });

  it('sends a sub-category change, and nothing about the spec block when the kind holds', () => {
    const d = asDraft(product(), V1);
    expect(changes(withPlacement(d, choosePlacement(d, { subCategory1: 'APS-C' })), product())).toEqual({
      subCategory1: 'APS-C',
    });
  });

  it('drops touched highlights when the camera is moved out of the category', () => {
    /* The route refuses highlights on anything but a camera; sending them
       with the move would fail the whole save. */
    const p = product();
    const d = asDraft(p, V1);
    const touched = edit(d, { hl: { ...d.hl, en: { ...d.hl.en, points: 'A :: b' } } });
    expect(changes(withPlacement(touched, choosePlacement(touched, { category: 'lens' })), p)).not.toHaveProperty(
      'highlights',
    );
  });
});

describe('the spec block follows the placement', () => {
  it('gives a product with no block the rows of its expected kind', () => {
    const d = asDraft(blockless(), V1);
    expect(d.specKind).toBe('accessory');
    expect(d.specs).toEqual({ compatibility: '', weight: '', dimensions: '' });
    /* Untouched, it stays blockless: nothing is sent. */
    expect(changes(d, blockless())).toEqual({});
  });

  it('sends that block, with its kind, once a value is typed', () => {
    const d = asDraft(blockless(), V1);
    expect(changes(edit(d, { specs: { ...d.specs, weight: '83 g' } }), blockless())).toEqual({
      specs: { compatibility: '', weight: '83 g', dimensions: '', kind: 'accessory', specsSource: '' },
    });
  });

  it('gives an audio product the kind its first level names', () => {
    const speaker = asDraft(blockless({ category: 'audio', subCategory1: 'Loa', subCategory2: 'Di động', sku: '' }), V1);
    expect(speaker.specKind).toBe('speaker');
    expect(Object.keys(speaker.specs)).toContain('power');
  });

  it('has no rows for a legacy audio first level the taxonomy does not know', () => {
    const d = asDraft(blockless({ category: 'audio', subCategory1: 'Loa Bluetooth', sku: '' }), V1);
    expect(d.specKind).toBeNull();
    expect(d.specs).toEqual({});
  });

  it('re-shapes the sheet when the placement changes the kind, and sends the new kind', () => {
    const d = asDraft(product(), V1);
    const moved = withPlacement(d, choosePlacement(d, { category: 'lens' }));
    expect(moved).toMatchObject({ category: 'lens', subCategory1: 'Full Frame', subCategory2: '', specKind: 'lens' });
    expect(moved.specs.weight).toBe('659 g');
    expect(moved.specs.focalLength).toBe('');
    expect(moved.specs).not.toHaveProperty('sensor');
    const body = changes(moved, product());
    expect(body).toMatchObject({ category: 'lens', subCategory2: '' });
    expect(body).not.toHaveProperty('subCategory1');
    expect(body.specs).toMatchObject({ kind: 'lens', weight: '659 g', focalLength: '' });
  });

  it('turns a headphone sheet into a speaker sheet through the rows they share', () => {
    const hp = {
      kind: 'headphone',
      specsSource: 'https://www.sony.com.vn/wh',
      specsMissing: [],
      battery: '30 giờ',
      designType: 'Choàng đầu',
    } as unknown as HeadphoneSpecs;
    const d = asDraft(product({ category: 'audio', subCategory1: 'Tai nghe', subCategory2: 'Choàng đầu', specs: hp }), V1);
    const moved = withPlacement(d, choosePlacement(d, { subCategory1: 'Loa' }));
    expect(moved.subCategory2).toBe('');
    expect(moved.specKind).toBe('speaker');
    expect(moved.specs.battery).toBe('30 giờ');
    expect(moved.specs).not.toHaveProperty('designType');
  });

  it('gives the stored values back when the move is undone before saving', () => {
    const d = asDraft(product(), V1);
    const there = withPlacement(d, choosePlacement(d, { category: 'lens' }));
    const back = withPlacement(there, { category: 'camera', subCategory1: 'Full Frame', subCategory2: 'Máy ảnh Alpha' });
    expect(back.specs).toEqual(d.specs);
    expect(changes(back, product())).toEqual({});
  });
});

describe('choosePlacement', () => {
  it('keeps a first level the new category also has, and clears a second level it does not', () => {
    const d = asDraft(product(), V1);
    expect(choosePlacement(d, { category: 'lens' })).toEqual({ category: 'lens', subCategory1: 'Full Frame', subCategory2: '' });
    expect(choosePlacement(d, { category: 'accessory' })).toEqual({
      category: 'accessory',
      subCategory1: 'Audio',
      subCategory2: '',
    });
  });

  it('keeps a second level the new first level still offers', () => {
    const d = asDraft(product(), V1);
    expect(choosePlacement(d, { subCategory1: 'APS-C' })).toEqual({
      category: 'camera',
      subCategory1: 'APS-C',
      subCategory2: 'Máy ảnh Alpha',
    });
  });
});

describe('placementDrops', () => {
  it('names the filled values a kind change would discard', () => {
    const d = asDraft(product(), V1);
    const drops = placementDrops(d, product(), choosePlacement(d, { category: 'lens' }));
    expect(drops.sort()).toEqual(['autofocus', 'battery', 'effectivePixels', 'isoRange', 'lcd', 'mediaSlots', 'sensor', 'video', 'viewfinder'].sort());
  });

  it('is empty when the kind holds, or nothing filled would go', () => {
    const d = asDraft(product(), V1);
    expect(placementDrops(d, product(), choosePlacement(d, { subCategory1: 'APS-C' }))).toEqual([]);
    const empty = asDraft(blockless(), V1);
    expect(placementDrops(empty, blockless(), choosePlacement(empty, { category: 'lens' }))).toEqual([]);
  });

  it('counts an accessory’s key specs when it stops being one', () => {
    const acc: AccessorySpecs = {
      kind: 'accessory',
      keySpecs: [{ label: 'Pattern', value: '8' }],
      compatibility: null,
      weight: null,
      dimensions: null,
      specsSource: 'https://www.sony.com.vn/ecm',
      specsMissing: ['compatibility', 'dimensions', 'weight'],
    };
    const p = blockless({ specs: acc });
    const d = asDraft(p, V1);
    expect(placementDrops(d, p, choosePlacement(d, { category: 'lens' }))).toEqual(['keySpecs']);
  });
});

/**
 * A camera that leaves the category loses its highlights: the route clears
 * them, and the editor stops offering them. The editor asks first — even when
 * no spec value would go.
 */
describe('highlightsDropped', () => {
  const side = {
    points: [1, 2, 3, 4].map((i) => ({ title: `T${i}`, body: `B${i}.` })),
    keySpecs: [{ key: 'sensor' as const, value: '33MP' }],
  };
  const withHighlights = () => product({ highlights: { en: side, vi: side } });

  it('is true when a camera with stored highlights moves out of cameras', () => {
    const p = withHighlights();
    const d = asDraft(p, V1);
    expect(highlightsDropped(d, p, choosePlacement(d, { category: 'lens' }))).toBe(true);
    expect(highlightsDropped(d, p, choosePlacement(d, { category: 'accessory' }))).toBe(true);
  });

  it('is true for highlights typed since the camera was opened, with none stored', () => {
    const p = product();
    const d = asDraft(p, V1);
    const touched = edit(d, { hl: { ...d.hl, en: { ...d.hl.en, points: 'A :: b' } } });
    expect(highlightsDropped(touched, p, choosePlacement(touched, { category: 'lens' }))).toBe(true);
    expect(highlightsDropped(d, p, choosePlacement(d, { category: 'lens' }))).toBe(false);
  });

  it('is false on a move within cameras, and once the draft has already left', () => {
    const p = withHighlights();
    const d = asDraft(p, V1);
    expect(highlightsDropped(d, p, choosePlacement(d, { subCategory1: 'APS-C' }))).toBe(false);
    const moved = withPlacement(d, choosePlacement(d, { category: 'lens' }));
    expect(highlightsDropped(moved, p, choosePlacement(moved, { category: 'accessory' }))).toBe(false);
  });

  it('is false for a product that was never a camera', () => {
    const p = blockless();
    const d = asDraft(p, V1);
    expect(highlightsDropped(d, p, choosePlacement(d, { category: 'lens' }))).toBe(false);
  });
});

/**
 * RC4. A save took `sony-np-fz100`'s English features from three lines to
 * none, and nothing asked. The editor asks before any save this names.
 */
describe('localesEmptied', () => {
  it('names a locale that goes from some lines to none', () => {
    const d = asDraft(product(), V1);
    expect(localesEmptied(edit(d, { en: '  \n ' }))).toEqual(['en']);
    expect(localesEmptied(edit(d, { en: '', vi: '' }))).toEqual(['en', 'vi']);
  });

  it('is quiet when a list was already empty, or still has a line', () => {
    const d = asDraft(product({ features: { en: [], vi: ['x'] } }), V1);
    expect(localesEmptied(d)).toEqual([]);
    expect(localesEmptied(edit(d, { vi: 'y' }))).toEqual([]);
  });

  it('reads the legacy flat shape as English', () => {
    const d = asDraft(product({ features: ['Legacy line'] }), V1);
    expect(localesEmptied(edit(d, { en: '', vi: 'Dòng' }))).toEqual(['en']);
  });
});

describe('priceDigits', () => {
  it('keeps the digits of what was typed or pasted', () => {
    expect(priceDigits('52.990.000 đ')).toBe('52990000');
    expect(priceDigits(' 1 234 ')).toBe('1234');
    expect(priceDigits('')).toBe('');
  });
});

describe('isDirty', () => {
  it('is false for a draft of another product', () => {
    /* The translation race: a late reply restoring product A's draft while B
       is selected must not read as B's unsaved edit. */
    const a = product();
    const b = product({ id: 'sony-other', name: 'FX3' });
    expect(isDirty(edit(asDraft(a, V1), { name: 'x' }), b)).toBe(false);
    expect(isDirty(edit(asDraft(b, V1), { name: 'x' }), b)).toBe(true);
  });
});

describe('withPackaging', () => {
  it('fills a null spec block and gallery from the copy the page rendered', () => {
    const loaded = product();
    const stored = { ...product({ name: 'A7 IV (stored)' }), specs: undefined, galleryUrls: undefined };
    const merged = withPackaging(stored, loaded);
    expect(merged.name).toBe('A7 IV (stored)');
    expect(merged.specs).toEqual(loaded.specs);
    expect(merged.galleryUrls).toEqual(loaded.galleryUrls);
  });

  it('never overrides what the database holds, an empty gallery included', () => {
    const stored = product({ galleryUrls: [], specs: specs({ weight: '1 kg' }) });
    const merged = withPackaging(stored, product());
    expect(merged.galleryUrls).toEqual([]);
    expect((merged.specs as CameraSpecs).weight).toBe('1 kg');
  });
});

describe('afterSave', () => {
  it('rebuilds an untouched draft from the stored row and its new version', () => {
    const p = product();
    const sent = edit(asDraft(p, V1), { name: 'α7 IV' });
    const stored = product({ name: 'α7 IV' });
    const next = afterSave(sent, sent, stored, V2);
    expect(next?.version).toBe(V2);
    expect(next?.name).toBe('α7 IV');
    expect(isDirty(next, stored)).toBe(false);
  });

  it('adopts the placement, price text and spec block the server stored', () => {
    const p = product();
    const d = asDraft(p, V1);
    const sent = edit(withPlacement(d, choosePlacement(d, { category: 'lens' })), { priceVnd: '1000' });
    const stored = product({
      category: 'lens',
      subCategory2: '',
      priceVnd: 1000,
      priceFormatted: '1.000 đ',
      specs: { kind: 'lens', specsSource: 'https://www.sony.com.vn/a7m4', specsMissing: [], weight: '659 g' } as never,
    });
    const next = afterSave(sent, sent, stored, V2);
    expect(next).toMatchObject({ category: 'lens', specKind: 'lens', priceVnd: '1000', version: V2 });
    expect(next?.base.category).toBe('lens');
    expect(isDirty(next, stored)).toBe(false);
  });

  it('keeps what was typed while the save was in flight', () => {
    const p = product();
    const sent = edit(asDraft(p, V1), { name: 'α7 IV' });
    const typing = edit(sent, { fullName: 'Sony α7 IV body' });
    const stored = product({ name: 'α7 IV' });
    const next = afterSave(typing, sent, stored, V2);
    expect(next?.fullName).toBe('Sony α7 IV body');
    expect(next?.version).toBe(V2);
    /* Against the new baseline only the newer edit is outstanding. */
    expect(changes(next!, stored)).toEqual({ fullName: 'Sony α7 IV body' });
  });

  it('leaves a draft of another product alone', () => {
    const other = asDraft(product({ id: 'sony-other' }), V1);
    const sent = asDraft(product(), V1);
    expect(afterSave(other, sent, product(), V2)).toBe(other);
    expect(afterSave(null, sent, product(), V2)).toBeNull();
  });
});
