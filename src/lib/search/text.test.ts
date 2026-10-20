import { describe, expect, it } from 'vitest'
import { productAliases } from '@/lib/cameras/aliases'
import { fold, meaningfulWords, squash, words } from './text'

/**
 * The folding every query and every document goes through. A drift here is
 * silent — a word stops matching, nothing errors — so the cases the header
 * comment promises are pinned one by one.
 */
describe('fold', () => {
  it('drops case and diacritics, đ included', () => {
    expect(fold('ĐÀ LẠT')).toBe('da lat')
    expect(fold('Phố đêm')).toBe('pho dem')
  })

  it('reads either tone-mark placement as the same word', () => {
    /* "nhòe" (mark on o) and "nhoè" (mark on e) — two keyboards, one word. */
    expect('nhòe').not.toBe('nhoè')
    expect(fold('nhòe')).toBe(fold('nhoè'))
    expect(fold('nhòe')).toBe('nhoe')
  })

  it('folds decomposed input the same as precomposed', () => {
    const nfd = 'Ảnh trong nhà'.normalize('NFD')
    expect(nfd).not.toBe('Ảnh trong nhà')
    expect(fold(nfd)).toBe(fold('Ảnh trong nhà'))
  })

  it('turns punctuation into single spaces and trims', () => {
    expect(fold('  Shift A/B — ấm!  ')).toBe('shift a b am')
    expect(fold('!!!')).toBe('')
    expect(words('!!!')).toEqual([])
  })

  it('reads the Greek α Sony prints the Alpha line with as a', () => {
    expect(fold('α7 IV')).toBe('a7 iv')
    expect(squash('α7 IV')).toBe('a7iv')
  })
})

describe('squash', () => {
  it('is the form camera aliases are stored in', () => {
    /* One normaliser: an alias derived from a name must equal the query that
       names it, whatever the spelling. */
    const aliases = productAliases({ sku: 'ILCE-7M4/BQAP2', name: '7 IV' })
    for (const typed of ['α7 IV', 'a7 IV', 'ILCE-7M4', 'Alpha 7 IV']) {
      expect(aliases, typed).toContain(squash(typed))
    }
  })
})

describe('meaningfulWords', () => {
  it('leaves stopwords out of what must be found', () => {
    expect(meaningfulWords('ảnh trong nhà bị nhòe')).toEqual(['trong', 'nha', 'nhoe'])
  })

  it('falls back to every word when all of them are stopwords', () => {
    expect(meaningfulWords('và')).toEqual(['va'])
    expect(meaningfulWords('how to')).toEqual(['how', 'to'])
  })
})
