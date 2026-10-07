import { describe, expect, it } from 'vitest';
import { isCommunityErrorCode } from './errors';

describe('isCommunityErrorCode', () => {
  it('accepts a code the catalogue defines', () => {
    expect(isCommunityErrorCode('rateLimited')).toBe(true);
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'rejects the prototype key %s, so it falls back to `unknown`',
    (key) => {
      expect(isCommunityErrorCode(key)).toBe(false);
    },
  );

  it('rejects anything that is not a string', () => {
    expect(isCommunityErrorCode(429)).toBe(false);
    expect(isCommunityErrorCode(null)).toBe(false);
  });
});
