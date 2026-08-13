import { describe, expect, it } from 'vitest';
import { sanitizeSpecs } from './products/[id]/route';
import { SPEC_ROWS, type CameraSpecs, type ProductSpecs } from '@/lib/cameras/types';

/**
 * The admin editor is the one path that writes spec values back into the
 * catalogue, so it is the one path that can break the catalogue's central
 * invariant: **every null is declared in `specsMissing`**.
 *
 * That invariant is what `specs.test.ts` enforces over the seed and what makes
 * a gap in the data distinguishable from a field somebody forgot. Breaking it
 * from here is uniquely nasty because nothing fails at the time — the write
 * succeeds, the page renders, and the suite only turns red later, when
 * `pull:supabase` brings the row back into the file the tests read. There is no
 * edit in that diff to blame.
 */

const cameraSpecs = (over: Partial<CameraSpecs> = {}): CameraSpecs => ({
  kind: 'camera',
  specsSource: 'https://www.sony.com.vn/example',
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
});

/** The invariant itself, asserted the same way `specs.test.ts` states it. */
function expectMissingMatchesNulls(specs: ProductSpecs) {
  const row = specs as unknown as Record<string, unknown>;
  const nulls = SPEC_ROWS[specs.kind].filter((f) => row[f] === null || row[f] === undefined).sort();
  expect(nulls, 'nulls not declared in specsMissing').toEqual([...specs.specsMissing].sort());
  for (const key of specs.specsMissing) {
    expect(row[key], `"${key}" is in specsMissing but holds a value`).toBeNull();
  }
}

describe('sanitizeSpecs', () => {
  it('declares a field the editor cleared', () => {
    const out = sanitizeSpecs({ lcd: '' }, cameraSpecs());
    expect((out as CameraSpecs).lcd).toBeNull();
    expect(out.specsMissing).toContain('lcd');
    expectMissingMatchesNulls(out);
  });

  it('drops a field back out of specsMissing once it is filled', () => {
    const out = sanitizeSpecs({ lcd: '3,2"' }, cameraSpecs({ lcd: null, specsMissing: ['lcd'] }));
    expect((out as CameraSpecs).lcd).toBe('3,2"');
    expect(out.specsMissing).not.toContain('lcd');
    expectMissingMatchesNulls(out);
  });

  /**
   * The regression. A non-string is not a spec value, so the existing value is
   * kept — but when that existing value is already null, the field is still
   * missing and still has to say so. The loop used to record a field only on
   * the branch that cleared it, so this combination wrote a null that nothing
   * declared.
   */
  it('still declares a null field when the body sends a non-string for it', () => {
    const out = sanitizeSpecs(
      { weight: 679, lcd: { nested: true }, sensor: ['array'] },
      cameraSpecs({ weight: null, lcd: null, sensor: null, specsMissing: ['lcd', 'sensor', 'weight'] }),
    );
    expect((out as CameraSpecs).weight).toBeNull();
    expect(out.specsMissing).toEqual(expect.arrayContaining(['weight', 'lcd', 'sensor']));
    expectMissingMatchesNulls(out);
  });

  it('never takes specsMissing from the body', () => {
    /* A client claiming everything is present must not be able to hide a gap. */
    const out = sanitizeSpecs({ specsMissing: [], lcd: '' }, cameraSpecs());
    expect(out.specsMissing).toContain('lcd');
    expectMissingMatchesNulls(out);
  });

  it('strips Sony prose qualifiers and ignores unknown keys', () => {
    const out = sanitizeSpecs(
      { weight: 'Xấp xỉ 659 g', notASpecField: 'should not land' },
      cameraSpecs(),
    );
    expect((out as CameraSpecs).weight).toBe('659 g');
    expect(out).not.toHaveProperty('notASpecField');
    expectMissingMatchesNulls(out);
  });

  it('accepts an https specsSource and rejects anything else', () => {
    expect(sanitizeSpecs({ specsSource: 'https://sony.com/a' }, cameraSpecs()).specsSource).toBe(
      'https://sony.com/a',
    );
    const kept = sanitizeSpecs({ specsSource: 'javascript:alert(1)' }, cameraSpecs());
    expect(kept.specsSource).toBe('https://www.sony.com.vn/example');
  });
});

/**
 * PATCH means "change these fields". It used to mean "this is the whole spec
 * block now": a body naming one field nulled the other eleven and rewrote
 * `specsMissing` to eleven entries, wiping a sourced spec table in one request.
 *
 * Nothing caught it because both callers post the entire block, so the failure
 * was waiting on the first caller that did not — a `curl`, a future editor, a
 * retry that serialised only the dirty field.
 */
describe('sanitizeSpecs — partial bodies', () => {
  it('leaves fields the body does not mention alone', () => {
    const before = cameraSpecs();
    const out = sanitizeSpecs({ lcd: '3,2"' }, before) as CameraSpecs;

    expect(out.lcd).toBe('3,2"');
    for (const field of SPEC_ROWS.camera) {
      if (field === 'lcd') continue;
      expect(
        (out as unknown as Record<string, unknown>)[field],
        `"${field}" was not in the body and must be untouched`,
      ).toBe((before as unknown as Record<string, unknown>)[field]);
    }
    expect(out.specsMissing).toEqual([]);
    expectMissingMatchesNulls(out);
  });

  it('still clears a field the body sends empty', () => {
    // The distinction the merge rests on: absent is not the same as blank.
    const out = sanitizeSpecs({ weight: '' }, cameraSpecs()) as CameraSpecs;
    expect(out.weight).toBeNull();
    expect(out.sensor).toBe('Full-Frame Exmor R CMOS BSI');
    expect(out.specsMissing).toEqual(['weight']);
    expectMissingMatchesNulls(out);
  });

  it('clears on an explicit null too', () => {
    const out = sanitizeSpecs({ battery: null }, cameraSpecs()) as CameraSpecs;
    expect(out.battery).toBeNull();
    expect(out.specsMissing).toEqual(['battery']);
    expectMissingMatchesNulls(out);
  });

  it('handles a full block exactly as before', () => {
    /* The path both callers actually take, pinned so the merge above cannot
       quietly change what the admin editor does today. */
    const before = cameraSpecs();
    const full: Record<string, unknown> = {};
    for (const f of SPEC_ROWS.camera) full[f] = (before as unknown as Record<string, string>)[f];
    full.lcd = '';

    const out = sanitizeSpecs(full, before) as CameraSpecs;
    expect(out.lcd).toBeNull();
    expect(out.sensor).toBe('Full-Frame Exmor R CMOS BSI');
    expect(out.specsMissing).toEqual(['lcd']);
    expectMissingMatchesNulls(out);
  });
});
