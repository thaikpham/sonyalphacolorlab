import { describe, expect, it } from 'vitest'
import recipesSeed from '../../../../data/recipes.seed.json'
import { CL_PARAM_LABELS, PP_MENU_ITEMS, WB_PARAM_LABELS } from '@/lib/camera/constants'
import { recipeSchema, type Recipe } from '@/lib/camera/schema'
import { readFileSync } from 'node:fs'
import { summariseFeatures } from './features'
import { EVIDENCED_CAMERAS, SHOOTING_MODES, assessRecipe, capabilitiesOf } from './index'
import { CAPABILITY_KEYS, capabilityLabel, isCapabilityKey, requirementsFor } from './keys'

/**
 * The pilot against the real catalogue: every published recipe, on every body
 * with evidence, in both modes. The specific cases are facts read from Sony's
 * pages on 2026-10-05; the invariants hold whatever the evidence becomes.
 */

const recipes: Recipe[] = (recipesSeed as unknown[]).map((r) => recipeSchema.parse(r))
const byId = (id: string) => recipes.find((r) => r.id === id)!

describe('requirements', () => {
  it('a Picture Profile recipe asks for the menu, all nine items, its gamma and colour mode', () => {
    const r = recipes.find((x) => x.format === 'pp')!
    const keys = requirementsFor(r).map((q) => q.capability)
    expect(keys[0]).toBe('picture-profile')
    for (const item of PP_MENU_ITEMS) expect(keys).toContain(`pp.item:${item}`)
    expect(keys).toContain(`pp.gamma:${r.format === 'pp' ? r.settings.gamma : ''}`)
  })

  it('a monochrome Look does not ask for Saturation, as the schema does not', () => {
    const mono = recipes.find((x) => x.format === 'cl' && ['BW', 'SE'].includes(x.settings.look))!
    expect(requirementsFor(mono).map((q) => q.capability)).not.toContain('cl.adjust:saturation')
  })

  it('White Balance asks for its mode, and a shift axis only when it moves', () => {
    const kelvin = recipes.find((x) => x.whiteBalance.mode === 'kelvin' && x.whiteBalance.shift?.ab?.amount)!
    const reqs = requirementsFor(kelvin)
    expect(reqs).toContainEqual({ capability: 'wb.kelvin', values: [kelvin.whiteBalance.mode === 'kelvin' ? kelvin.whiteBalance.kelvin : 0] })
    expect(reqs.some((q) => q.capability === 'wb.shift:ab')).toBe(true)
    const still = { ...kelvin, whiteBalance: { mode: 'auto', auto: 'AWB', shift: { ab: { axis: 'A', amount: 0 } } } } as Recipe
    expect(requirementsFor(still).some((q) => q.capability.startsWith('wb.shift'))).toBe(false)
  })

  it('every requirement of every recipe is a real key', () => {
    for (const r of recipes) for (const q of requirementsFor(r)) expect(isCapabilityKey(q.capability)).toBe(true)
  })

  it('labels are the technical names the tables print, untranslated', () => {
    expect(capabilityLabel('cl.adjust:sharpnessRange')).toBe(CL_PARAM_LABELS.sharpnessRange)
    expect(capabilityLabel('wb.shift:gm')).toBe(WB_PARAM_LABELS.shiftGm)
    expect(capabilityLabel('cl.look:FL')).toBe('FL (Film)')
    expect(capabilityLabel('pp.gamma:S-Cinetone')).toBe('Gamma S-Cinetone')
    for (const k of CAPABILITY_KEYS) expect(capabilityLabel(k).length).toBeGreaterThan(0)
  })
})

describe('the pilot bodies', () => {
  it('are the four whose pages were checked', () => {
    expect([...EVIDENCED_CAMERAS].sort()).toEqual(['ILCE-6700', 'ILCE-7CM2', 'ILCE-7M4', 'ILCE-7M5'])
  })
})

describe('verdicts are what their outcomes say, for every recipe × body × mode', () => {
  const cases = EVIDENCED_CAMERAS.flatMap((camera) => SHOOTING_MODES.map((mode) => [camera, mode] as const))

  it.each(cases)('%s, %s', (camera, mode) => {
    for (const r of recipes) {
      const a = assessRecipe(r, camera, mode)
      const k = a.outcomes.map((o) => o.kind)
      const has = (x: string) => k.includes(x as never)
      if (a.verdict === 'verified') expect(k.every((x) => x === 'supported'), r.id).toBe(true)
      if (a.verdict === 'incompatible') expect(has('unsupported'), r.id).toBe(true)
      if (a.verdict === 'unknown') expect(!has('unsupported') && has('unknown'), r.id).toBe(true)
      if (a.verdict === 'partial') expect(!has('unsupported') && !has('unknown') && has('substituted'), r.id).toBe(true)
      expect(a.outcomes).toHaveLength(requirementsFor(r).length)
    }
  })
})

describe('what Sony’s pages establish', () => {
  it('no recipe with a Kelvin value is verified anywhere — no page prints a Kelvin range', () => {
    for (const camera of EVIDENCED_CAMERAS) {
      for (const r of recipes.filter((x) => x.whiteBalance.mode === 'kelvin')) {
        const a = assessRecipe(r, camera, 'photo')
        expect(a.verdict, `${r.id} on ${camera}`).not.toBe('verified')
        expect(a.outcomes.find((o) => o.requirement.capability === 'wb.kelvin')).toMatchObject({
          kind: 'unknown',
          reason: 'rangeUnstated',
        })
      }
    }
  })

  it('a Creative Look recipe on Auto White Balance with no shift is verified for stills on every pilot body', () => {
    const plain = recipes.filter((x) => x.format === 'cl' && x.whiteBalance.mode === 'auto' && !x.whiteBalance.shift)
    expect(plain.length).toBeGreaterThan(0)
    for (const camera of EVIDENCED_CAMERAS) {
      for (const r of plain) expect(assessRecipe(r, camera, 'photo').verdict, `${r.id} on ${camera}`).toBe('verified')
    }
  })

  it('every Creative Look recipe is refused in movie mode, for Sharpness Range alone', () => {
    for (const camera of EVIDENCED_CAMERAS) {
      for (const r of recipes.filter((x) => x.format === 'cl')) {
        const refused = assessRecipe(r, camera, 'video').outcomes.filter((o) => o.kind === 'unsupported')
        expect(refused.map((o) => o.requirement.capability), `${r.id} on ${camera}`).toContain('cl.adjust:sharpnessRange')
      }
    }
  })

  it('the S-Log2 recipe is refused by the bodies whose gamma list has no S-Log2', () => {
    const slog2 = recipes.find((x) => x.format === 'pp' && x.settings.gamma === 'S-Log2')!
    for (const camera of ['ILCE-7CM2', 'ILCE-6700', 'ILCE-7M5']) {
      const o = assessRecipe(slog2, camera, 'photo').outcomes.find((x) => x.requirement.capability === 'pp.gamma:S-Log2')
      expect(o, camera).toMatchObject({ kind: 'unsupported', reason: 'absent' })
    }
    const onA7iv = assessRecipe(slog2, 'ILCE-7M4', 'photo').outcomes.find((x) => x.requirement.capability === 'pp.gamma:S-Log2')
    expect(onA7iv?.kind).toBe('supported')
  })

  it('every Picture Profile recipe is refused by ILCE-7M5, which has no Color Depth item', () => {
    for (const r of recipes.filter((x) => x.format === 'pp')) {
      const o = assessRecipe(r, 'ILCE-7M5', 'photo').outcomes.find((x) => x.requirement.capability === 'pp.item:Color Depth')
      expect(o, r.id).toMatchObject({ kind: 'unsupported', reason: 'absent' })
    }
  })

  it('Flash White Balance is for stills only, on every pilot body', () => {
    const flash = { ...byId('SCL-CL-001'), whiteBalance: { mode: 'preset', preset: 'Flash' } } as Recipe
    for (const camera of EVIDENCED_CAMERAS) {
      expect(assessRecipe(flash, camera, 'photo').outcomes.find((o) => o.requirement.capability === 'wb.preset:Flash')?.kind).toBe('supported')
      expect(assessRecipe(flash, camera, 'video').outcomes.find((o) => o.requirement.capability === 'wb.preset:Flash')?.kind).toBe('unsupported')
    }
  })

  it('a body with no evidence is unknown for everything, never compatible by default', () => {
    for (const r of recipes) expect(assessRecipe(r, 'ILCE-7M3', 'photo').verdict).toBe('unknown')
  })
})

describe('a camera page summary', () => {
  const group = (camera: string, g: 'pp' | 'cl' | 'wb') => summariseFeatures(capabilitiesOf(camera)).find((x) => x.group === g)!

  it('lists what the body lacks, from its own lists', () => {
    expect(group('ILCE-7M5', 'pp').notOnBody).toEqual(expect.arrayContaining(['Color Depth', 'S-Log2', '709tone']))
    expect(group('ILCE-7M4', 'pp').notOnBody).toEqual(['709tone'])
  })

  it('keeps the stills-only settings apart', () => {
    expect(group('ILCE-7M4', 'cl').stillsOnly).toEqual(['Sharpness Range'])
    expect(group('ILCE-7M4', 'wb').stillsOnly).toEqual(['Flash'])
  })

  it('reads like the menu: constants order, Sony\'s names', () => {
    const modes = group('ILCE-7M4', 'pp').rows.find((r) => r.row === 'colorMode')!.labels
    expect(modes[0]).toBe('Movie')
    expect(modes.at(-1)).toBe('709')
    expect(group('ILCE-7M4', 'wb').rows.find((r) => r.row === 'temperature')!.labels).toEqual(['C.Temp./Filter'])
  })

  it('is empty for a body without evidence', () => {
    expect(summariseFeatures(capabilitiesOf('ILCE-7M3'))).toEqual([])
  })
})

describe('the pages that show it', () => {
  it('the recipe page shows compatibility from the recipe itself', () => {
    expect(readFileSync('src/app/[locale]/recipe/[slug]/page.tsx', 'utf8')).toContain('<RecipeCompatibility recipe={recipe} />')
  })

  it('the camera page shows its colour settings by model code', () => {
    expect(readFileSync('src/app/[locale]/cameras/[id]/page.tsx', 'utf8')).toMatch(/<CameraColourSettings sku=\{product\.sku\}/)
  })

  it('neither section renders without evidence', () => {
    const src = readFileSync('src/components/compat/camera-compatibility.tsx', 'utf8')
    expect(src).toContain('if (EVIDENCED_CAMERAS.length === 0) return null')
    expect(src).toContain('if (byKey.size === 0) return null')
  })
})
