import { describe, expect, it } from 'vitest'
import { parseTicks, toggleTick } from './storage'

/**
 * What comes back out of `localStorage` is under the reader's control and
 * shares an origin with every other page of this app, so it can be absent,
 * truncated by a tab that was killed mid-write, or left behind by an older
 * version of this feature. Each of those used to be a way to render a
 * checklist of garbage keys, or to throw inside a render and take the whole
 * article down with it.
 */
describe('parseTicks', () => {
  it('reads a well-formed map', () => {
    expect(parseTicks('{"st-vs-pt-10-0":true}')).toEqual({ 'st-vs-pt-10-0': true })
  })

  it('treats a missing or empty value as no ticks', () => {
    expect(parseTicks(null)).toEqual({})
    expect(parseTicks('')).toEqual({})
  })

  it('survives a truncated write instead of throwing mid-render', () => {
    expect(parseTicks('{"a":tr')).toEqual({})
  })

  it('refuses a JSON value that is not an object', () => {
    // `{...'ab'}` is `{0:'a',1:'b'}` — a checklist of nonsense keys.
    expect(parseTicks('"ab"')).toEqual({})
    expect(parseTicks('[1,2]')).toEqual({})
    expect(parseTicks('null')).toEqual({})
  })

  it('keeps only entries that are literally true', () => {
    expect(parseTicks('{"a":true,"b":false,"c":1,"d":"true"}')).toEqual({ a: true })
  })
})

describe('toggleTick', () => {
  it('adds a missing key and removes a present one', () => {
    expect(toggleTick({}, 'a')).toEqual({ a: true })
    expect(toggleTick({ a: true }, 'a')).toEqual({})
  })

  it('never mutates its argument', () => {
    // Two checklists share one map; mutating it in place is how one list's
    // render sees the other's half-applied change.
    const before = { a: true } as const
    toggleTick(before, 'b')
    expect(before).toEqual({ a: true })
  })

  it('leaves every other key alone', () => {
    expect(toggleTick({ a: true, b: true }, 'a')).toEqual({ b: true })
  })
})
