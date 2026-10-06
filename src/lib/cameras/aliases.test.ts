import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { modelCode, productAliases, resolveCamera } from './aliases'

const catalogue = JSON.parse(readFileSync('data/sony-cameras.seed.json', 'utf8')) as {
  id: string
  sku: string
  name: string
  category: string
}[]
const byId = (id: string) => catalogue.find((c) => c.id === id)!

describe('modelCode', () => {
  it.each([
    ['ILCE-7CM2/SQAP2', 'ILCE-7CM2'],
    ['ILME-FX6V//CAP2', 'ILME-FX6V'],
    ['DSC-RX1RM3  AP2', 'DSC-RX1RM3'],
    ['ZV-1M2/WQ   E32', 'ZV-1M2'],
    ['', ''],
  ])('%s → %s', (sku, code) => {
    expect(modelCode(sku)).toBe(code)
  })
})

describe('productAliases', () => {
  it('derives every spelling of the a7C II from the catalogue row', () => {
    /* The brief's own example: `a7cii`, `A7C II`, `ILCE-7CM2`. All three must
       land on the one product the catalogue holds under that SKU. */
    const aliases = productAliases(byId('sony-ilce-7cm2-sqap2'))
    for (const spelling of ['a7cii', '7cii', 'ilce7cm2', '7cm2', 'a7c2', 'alpha7cii']) {
      expect(aliases).toContain(spelling)
    }
  })

  it('does not invent an Alpha prefix for a body that is not an ILCE', () => {
    const fx3 = productAliases(byId('sony-ilme-fx3a-q-ap2'))
    expect(fx3).toContain('fx3')
    expect(fx3).toContain('ilmefx3a')
    expect(fx3.some((a) => a.startsWith('alpha'))).toBe(false)
  })

  it('spells roman numerals as digits too', () => {
    expect(productAliases(byId('sony-ilce-7rm5-bqap2'))).toEqual(
      expect.arrayContaining(['7rv', 'a7rv', '7r5', 'a7r5', '7rm5']),
    )
  })

  it('gives no two cameras the same alias', () => {
    /* An alias shared by two bodies would make an "exact" match ambiguous —
       the 7 IV and the 7R IV are the pair most likely to collide. */
    const owners = new Map<string, string>()
    for (const c of catalogue.filter((c) => c.category === 'camera')) {
      for (const alias of productAliases(c)) {
        const prior = owners.get(alias)
        expect(prior === undefined || prior === c.id, `${alias}: ${prior} vs ${c.id}`).toBe(true)
        owners.set(alias, c.id)
      }
    }
  })
})

describe('resolveCamera', () => {
  const cameras = catalogue.filter((c) => c.category === 'camera')

  it.each([
    ['ILCE-7M4', 'sony-ilce-7m4-bq-ap2'],
    ['α7 IV', 'sony-ilce-7m4-bq-ap2'],
    ['a7iv', 'sony-ilce-7m4-bq-ap2'],
    ['ILCE-7CM2', 'sony-ilce-7cm2-sqap2'],
    ['α6700', 'sony-ilce-6700-bqap2'],
    ['ZV-E10M2', 'sony-zv-e10m2-bq-ap2'],
  ])('%s → %s', (text, id) => {
    expect(resolveCamera(text, cameras)?.id).toBe(id)
  })

  it('resolves nothing it cannot name exactly', () => {
    expect(resolveCamera('ILCE-9999', cameras)).toBeNull()
    expect(resolveCamera('1', cameras)).toBeNull()
    expect(resolveCamera('', cameras)).toBeNull()
  })

  it('is null, not a guess, when two products answer', () => {
    const twins = [
      { id: 'x', sku: 'ILCE-7M4/A', name: '7 IV' },
      { id: 'y', sku: 'ILCE-7M4/B', name: '7 IV' },
    ]
    expect(resolveCamera('ILCE-7M4', twins)).toBeNull()
  })
})
