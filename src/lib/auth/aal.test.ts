import { describe, expect, it } from 'vitest';
import { assuranceLevelOf } from './aal';

/**
 * Reading the assurance level off a token that has already been verified.
 *
 * The tests that matter here are the negative ones. This function decides
 * whether a second factor was satisfied, and every way of failing to parse a
 * token has to come back as "not elevated" — never as a default that lets a
 * one-factor session through.
 */

const token = (payload: object) => {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.signature`;
};

describe('assuranceLevelOf', () => {
  it('reads aal2 from a stepped-up session', () => {
    expect(assuranceLevelOf(token({ aal: 'aal2', sub: 'u' }))).toBe('aal2');
  });

  it('reads aal1 from a single-factor session', () => {
    expect(assuranceLevelOf(token({ aal: 'aal1', sub: 'u' }))).toBe('aal1');
  });

  it('decodes base64url, not plain base64', () => {
    /* A payload containing `-` or `_` in its base64 is common — any token with
       the right bytes produces them. Decoded as plain base64 it yields
       different bytes, fails to parse, and reads as "no claim", which would
       silently drop a stepped-up admin back to one factor. */
    const wide = token({ aal: 'aal2', sub: 'u', note: 'ÿÿÿ~~~???>>>' });
    expect(wide).toMatch(/[-_]/);
    expect(assuranceLevelOf(wide)).toBe('aal2');
  });

  it.each([
    ['not a jwt', 'abc'],
    ['two segments', 'a.b'],
    ['payload is not base64', 'a.!!!!.c'],
    ['payload is not JSON', `a.${Buffer.from('nope').toString('base64url')}.c`],
    ['payload is a JSON array', `a.${Buffer.from('[1,2]').toString('base64url')}.c`],
    ['payload is JSON null', `a.${Buffer.from('null').toString('base64url')}.c`],
    ['empty string', ''],
  ])('returns null for %s rather than guessing', (_label, input) => {
    expect(assuranceLevelOf(input)).toBeNull();
  });

  it('refuses an unknown claim value instead of passing it through', () => {
    /* `aal3` does not exist today. If it ever does, this function must be
       updated deliberately rather than admitting a level nothing has reasoned
       about. */
    expect(assuranceLevelOf(token({ aal: 'aal3' }))).toBeNull();
    expect(assuranceLevelOf(token({ aal: true }))).toBeNull();
    expect(assuranceLevelOf(token({}))).toBeNull();
  });
});
