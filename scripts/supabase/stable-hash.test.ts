import { describe, expect, it } from 'vitest';

import { stableHash, stableStringify, tableHash } from './stable-hash';

/**
 * Whether the two projects hold the same rows.
 *
 * That question is only answerable if identical rows hash identically, and
 * PostgREST does not promise a key order — it differs between `select *` and a
 * named column list, which is exactly the difference between how the old
 * scripts read and how the new export does.
 *
 * The opposite error matters more, though: a hash that is *too* forgiving
 * reports a real difference as a match, and the whole cutover is gated on this
 * comparison. Array order is data and is never normalised.
 */

describe('stableStringify', () => {
  it('sorts object keys, at every depth', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('never reorders an array', () => {
    /* `tags: ['a','b']` and `tags: ['b','a']` are different rows. Sorting here
       would report a real difference as a match. */
    expect(stableStringify(['b', 'a'])).toBe('["b","a"]');
    expect(stableHash({ tags: ['a', 'b'] })).not.toBe(stableHash({ tags: ['b', 'a'] }));
  });

  it('leaves a timestamp exactly as the database returned it', () => {
    /* Reparsing and reformatting would hide a precision change introduced by
       the import — drift that surfaces months later as an ordering bug. */
    const a = { updated_at: '2026-09-11T10:00:00+00:00' };
    const b = { updated_at: '2026-09-11T10:00:00.000Z' };
    expect(stableHash(a)).not.toBe(stableHash(b));
  });

  it('distinguishes null from absent', () => {
    expect(stableHash({ dek: null })).not.toBe(stableHash({}));
  });

  it('handles nested jsonb the catalogue actually stores', () => {
    const settings = { creativeLook: 'FL', sharpness: -2, detail: { range: 0 } };
    expect(stableHash({ settings })).toBe(
      stableHash({ settings: { detail: { range: 0 }, sharpness: -2, creativeLook: 'FL' } }),
    );
  });
});

describe('stableHash', () => {
  it('is a SHA-256 hex digest', () => {
    expect(stableHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable across key order', () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
  });
});

describe('tableHash', () => {
  it('is order-sensitive, because the export orders every table explicitly', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(tableHash(rows)).not.toBe(tableHash([...rows].reverse()));
  });

  it('is empty-safe', () => {
    expect(tableHash([])).toMatch(/^[0-9a-f]{64}$/);
  });
});
