import { describe, expect, it } from 'vitest';
import type { CameraSpecs, SonyCamera } from '@/lib/cameras/types';
import { afterSave, asDraft, changes, isDirty, saveBody, withPackaging, type Draft } from './product-draft';

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
    subCategory1: 'Mirrorless Full-Frame',
    subCategory2: '',
    priceVnd: 0,
    priceFormatted: '',
    url: '',
    imageUrl: 'https://static.bhphoto.com/a.jpg',
    galleryUrls: ['https://static.bhphoto.com/a.jpg'],
    features: { en: ['33MP sensor'], vi: ['Cảm biến 33MP'] },
    specs: specs(),
    highlights: null,
    ...over,
  };
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
    expect(body).toHaveProperty('specs');
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
    expect(changes(edit(d, { name: ' A7 IV  ', en: '33MP sensor\n\n' }), p)).toEqual({});
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
    const lens = product({ category: 'lens' });
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
