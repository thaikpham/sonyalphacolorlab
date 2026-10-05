import { describe, expect, it } from 'vitest'
import {
  CL_EXPLANATIONS,
  COLOR_DEPTH_EXPLANATIONS,
  PP_DETAIL_EXPLANATIONS,
  PP_EXPLANATIONS,
  WB_EXPLANATIONS,
} from '@/lib/camera/explanations'
import { CONCEPTS } from '@/lib/content/concepts'
import { buildGlossary, conceptAnchor, glossaryEntries } from './glossary'

describe('the generated glossary', () => {
  it.each(['en', 'vi'] as const)('carries every explained parameter in %s', (locale) => {
    const entries = glossaryEntries(locale)
    const expected =
      Object.keys(WB_EXPLANATIONS).length +
      Object.keys(PP_EXPLANATIONS).length +
      Object.keys(COLOR_DEPTH_EXPLANATIONS).length +
      Object.keys(PP_DETAIL_EXPLANATIONS).length +
      Object.keys(CL_EXPLANATIONS).length
    expect(entries).toHaveLength(expected)
    for (const e of entries) expect(e.text.length).toBeGreaterThan(10)
  })

  it('uses the explanation text verbatim — the glossary adds no claim', () => {
    const vi = glossaryEntries('vi')
    expect(vi.find((e) => e.id === 'pp-colorDepth-R')?.text).toBe(COLOR_DEPTH_EXPLANATIONS.R.vi)
    expect(vi.find((e) => e.id === 'cl-fade')?.text).toBe(CL_EXPLANATIONS.fade.vi)
  })

  it('gives every entry a unique, stable anchor', () => {
    const ids = glossaryEntries('en').map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^(wb|pp|cl)-[A-Za-z]+(-[A-Za-z]+)?$/)
  })

  it('has an anchor for every parameter concept a page can link to', () => {
    /* Group concepts land on the group heading; `cl.look` on the Look list;
       everything else on its own entry. */
    const groups = new Set<string>(buildGlossary('en').map((g) => g.group))
    const ids = new Set(glossaryEntries('en').map((e) => e.id))
    for (const c of CONCEPTS) {
      if (c.key === c.group) expect(groups.has(c.key)).toBe(true)
      else if (c.key === 'cl.look') expect(buildGlossary('en').find((g) => g.group === 'cl')?.looks).toHaveLength(10)
      else expect(ids.has(conceptAnchor(c.key))).toBe(true)
    }
  })

  it('keeps technical labels in English in both locales (Rule 3)', () => {
    const en = glossaryEntries('en').map((e) => e.label)
    const vi = glossaryEntries('vi').map((e) => e.label)
    expect(vi).toEqual(en)
  })

  it('cites a help-guide page for every group', () => {
    for (const g of buildGlossary('vi')) {
      expect(g.sources.length).toBeGreaterThan(0)
      for (const s of g.sources) expect(s.url).toMatch(/^https:\/\/helpguide\.sony\.net\//)
    }
  })
})
