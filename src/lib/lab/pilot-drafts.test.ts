import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CL_RANGES,
  CREATIVE_LOOK_CODES,
  HELP_GUIDE_SOURCES,
  PP_COLOR_MODE,
  PP_GAMMA,
  PP_RANGES,
  WB_SHIFT_AXIS,
} from '@/lib/camera/constants'
import { ARTICLES } from './articles'
import { parseMeta } from './meta'
import { PLACEHOLDER_MARK, RESERVED_IDS, parseBlocks, validateForPublish } from './parse'
import { PILOT_DRAFTS, PILOT_EXTRA_SOURCES } from './pilot-drafts'

/**
 * The pilot pages are drafts for the owner to review. These tests hold them
 * to the two promises in the file's header: they cannot become public by
 * accident, and they claim nothing a dated Sony page cannot back.
 */

const knowledge = PILOT_DRAFTS.filter((d) => d.kind === 'knowledge')
const frames = PILOT_DRAFTS.filter((d) => d.kind === 'article')

describe('the pilot pages', () => {
  it('are the six reference pages and three experiment frames the brief asks for', () => {
    expect(knowledge).toHaveLength(6)
    expect(frames).toHaveLength(3)
  })

  it('have unique ids no route or published article owns', () => {
    const ids = PILOT_DRAFTS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(RESERVED_IDS.has(id)).toBe(false)
      expect(ARTICLES.some((a) => a.id === id)).toBe(false)
    }
  })

  it.each(PILOT_DRAFTS.map((d) => [d.id, d] as const))(
    '%s survives the block and metadata parsers untouched',
    (_id, draft) => {
      /* What the editor saves is what the parser keeps. A drop here would mean
         the draft says something the admin screen would silently lose. */
      const blocks = parseBlocks(draft.blocks)
      expect(blocks.dropped).toBe(0)
      expect(blocks.blocks).toEqual(draft.blocks)
      const meta = parseMeta(JSON.parse(JSON.stringify(draft.meta)))
      expect(meta.dropped).toBe(0)
      expect(meta.meta).toEqual(draft.meta)
    },
  )

  it('never reaches the reading path', () => {
    /* `data.ts` serves the store or the compiled ARTICLES — never this file.
       Only the development store and the push script may import it. */
    for (const path of ['src/lib/lab/data.ts', 'src/lib/lab/articles.ts', 'src/app/sitemap.ts']) {
      expect(readFileSync(path, 'utf8')).not.toContain('pilot-drafts')
    }
    expect(readFileSync('src/lib/lab/dev-store.ts', 'utf8')).toMatch(
      /PILOT_DRAFTS\.map\(\(a\) => \(\{ \.\.\.a, status: 'draft' as const/,
    )
    expect(readFileSync('scripts/push-lab-articles.ts', 'utf8')).toMatch(
      /PILOT_DRAFTS\.map\(\(a\) => \(\{ article: a, status: 'draft' as const \}\)\)/,
    )
  })
})

describe('the reference pages', () => {
  it.each(knowledge.map((d) => [d.id, d] as const))(
    '%s cites only Help Guide pages read in full, each dated',
    (_id, draft) => {
      /* Written while the help-guide host was unreachable, then re-read in
         raw text on 2026-10-05. The date is what the public page prints as
         "checked", so it comes from the one place that records the reading —
         `HELP_GUIDE_SOURCES` or `PILOT_EXTRA_SOURCES` — never typed here. */
      const allowed = new Map<string, string>(
        [...Object.values(HELP_GUIDE_SOURCES), ...Object.values(PILOT_EXTRA_SOURCES)].map(
          (s) => [s.url, s.checkedAt] as const,
        ),
      )
      expect(draft.meta.sources.length).toBeGreaterThan(0)
      for (const s of draft.meta.sources) {
        expect(s.url).toMatch(/^https:\/\/helpguide\.sony\.net\//)
        expect(allowed.get(s.url), s.url).toBeDefined()
        expect(s.checkedAt).toBe(allowed.get(s.url))
      }
    },
  )

  it.each(knowledge.map((d) => [d.id, d] as const))(
    '%s passes the publish rules, and is still only a draft',
    (_id, draft) => {
      /* Publishable is not published: which pilots go live is the owner's
         call in the page's editor (/blog/<id>/edit). The store-side draft
         status is pinned above. */
      expect(validateForPublish(draft)).toEqual([])
    },
  )

  it('restate the ranges constants.ts holds, not remembered ones', () => {
    const prose = (id: string) => JSON.stringify(knowledge.find((d) => d.id === id)?.blocks)
    const range = (min: number, max: number) =>
      `${min < 0 ? `−${-min}` : min} đến ${max > 0 && min < 0 ? `+${max}` : max}`

    expect(prose('picture-profile-va-creative-look')).toContain(
      range(PP_RANGES.saturation.min, PP_RANGES.saturation.max),
    )
    expect(prose('picture-profile-va-creative-look')).toContain(
      range(CL_RANGES.saturation.min, CL_RANGES.saturation.max),
    )
    expect(prose('color-depth')).toContain(range(PP_RANGES.colorDepth.min, PP_RANGES.colorDepth.max))
    expect(prose('picture-profile-va-creative-look')).toContain(
      `Sharpness Range ${CL_RANGES.sharpnessRange.min} đến ${CL_RANGES.sharpnessRange.max}`,
    )

    /* Every other number the prose restates, each against its constant, so a
       range widened in constants.ts (Rule 5) fails here instead of leaving a
       reference page silently wrong. */
    const ppcl = prose('picture-profile-va-creative-look')
    expect(ppcl).toContain(
      `Limit và Crispening ${range(PP_RANGES.detailLimit.min, PP_RANGES.detailLimit.max)}`,
    )
    expect(PP_RANGES.detailCrispening).toEqual(PP_RANGES.detailLimit)
    expect(ppcl).toContain(
      `Hi-Light Detail ${range(PP_RANGES.detailHiLightDetail.min, PP_RANGES.detailHiLightDetail.max)}`,
    )
    expect(ppcl).toContain(`Fade, Sharpness, Clarity ${range(CL_RANGES.fade.min, CL_RANGES.fade.max)}`)
    expect(CL_RANGES.sharpness).toEqual(CL_RANGES.fade)
    expect(CL_RANGES.clarity).toEqual(CL_RANGES.fade)
    for (const code of CREATIVE_LOOK_CODES) expect(ppcl).toContain(code)

    const wb = prose('white-balance-shift')
    expect(wb).toContain(`tối đa ${WB_SHIFT_AXIS.max} mỗi phía`)
    expect(wb).toContain(`bước ${String(WB_SHIFT_AXIS.step).replace('.', ',')}`)

    const depth = `${prose('color-depth')}${JSON.stringify(knowledge.find((d) => d.id === 'color-depth')?.dek)}`
    expect(depth).toContain(`Color Phase (${range(PP_RANGES.colorPhase.min, PP_RANGES.colorPhase.max)})`)
    expect(depth).toContain(`Saturation (${range(PP_RANGES.saturation.min, PP_RANGES.saturation.max)})`)
    // Every "−N đến +N" on the page is one of the three PP ranges it names.
    const ppRanges = [PP_RANGES.colorDepth, PP_RANGES.colorPhase, PP_RANGES.saturation].map((r) =>
      range(r.min, r.max),
    )
    const stated = [...depth.matchAll(/−\d+ đến \+\d+/g)].map((m) => m[0])
    expect(stated.length).toBeGreaterThan(3)
    for (const s of stated) expect(ppRanges).toContain(s)

    /* The two lists name every value constants.ts holds. "Cine1 đến Cine4"
       is read as the run it abbreviates. */
    const expand = (s: string) =>
      s.replace(/([A-Za-z]+)(\d) đến \1(\d)/g, (_m, stem: string, a: string, b: string) =>
        Array.from({ length: Number(b) - Number(a) + 1 }, (_, i) => `${stem}${Number(a) + i}`).join(', '),
      )
    const gamma = expand(prose('gamma-va-color-mode'))
    for (const g of PP_GAMMA) expect(gamma, g).toContain(g)
    for (const mode of PP_COLOR_MODE) expect(gamma, mode).toContain(mode)
  })
})

describe('the experiment frames', () => {
  it.each(frames.map((d) => [d.id, d] as const))(
    '%s is refused at publish for what it still owes, and only for that',
    (_id, draft) => {
      /* The open markers, and the reading time, which cannot be known until
         the shoot has been written up. */
      expect(validateForPublish(draft)).toEqual(['emptyRead', 'placeholder'])
    },
  )

  it.each(frames.map((d) => [d.id, d] as const))('%s invents no result', (_id, draft) => {
    for (const b of draft.blocks) {
      if (b.t === 'table') {
        // Every measured cell is empty until a real shoot fills it.
        for (const row of b.rows) expect([row[1], row[2]]).toEqual(['', ''])
      }
      if (b.t === 'compare') {
        expect(b.beforeAssetId).toBeUndefined()
        expect(b.afterAssetId).toBeUndefined()
      }
      expect(b.t).not.toBe('figure')
    }
    expect(JSON.stringify(draft)).toContain(PLACEHOLDER_MARK)
  })
})
