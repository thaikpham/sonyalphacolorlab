import { describe, expect, it } from 'vitest'
import { CL_PARAM_ORDER, PP_MENU_ITEMS } from '@/lib/camera/constants'
import { CL_EXPLANATIONS, PP_EXPLANATIONS, WB_EXPLANATIONS } from '@/lib/camera/explanations'
import { CONCEPTS, conceptTitle, conceptsForRecipe, isConceptKey } from './concepts'

describe('the concept vocabulary', () => {
  it('names every explained parameter, and nothing else', () => {
    const expected = [
      'wb',
      ...Object.keys(WB_EXPLANATIONS).map((k) => `wb.${k}`),
      'pp',
      ...Object.keys(PP_EXPLANATIONS).map((k) => `pp.${k}`),
      'cl',
      'cl.look',
      ...Object.keys(CL_EXPLANATIONS).map((k) => `cl.${k}`),
    ]
    expect(CONCEPTS.map((c) => c.key)).toEqual(expected)
  })

  it('labels Picture Profile concepts with the menu items Sony prints', () => {
    for (const c of CONCEPTS.filter((c) => c.group === 'pp' && c.key !== 'pp')) {
      expect(PP_MENU_ITEMS).toContain(c.label)
    }
  })

  it('covers every Creative Look adjustment', () => {
    for (const p of CL_PARAM_ORDER) expect(isConceptKey(`cl.${p}`)).toBe(true)
  })

  it('composes a readable title', () => {
    expect(conceptTitle('pp.colorDepth')).toBe('Picture Profile · Color Depth')
    expect(conceptTitle('wb')).toBe('White Balance')
  })

  it('gives each format its own parameters plus all of White Balance', () => {
    const pp = conceptsForRecipe('pp')
    const cl = conceptsForRecipe('cl')
    expect(pp).toContain('wb.shiftAb')
    expect(cl).toContain('wb.shiftAb')
    expect(pp).toContain('pp.colorDepth')
    expect(pp).not.toContain('cl.fade')
    expect(cl).toContain('cl.look')
    expect(cl).not.toContain('pp.knee')
  })
})
