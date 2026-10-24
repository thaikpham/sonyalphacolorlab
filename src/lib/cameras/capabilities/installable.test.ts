import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PP_COLOR_MODE, PP_GAMMA } from '@/lib/camera/constants'
import type { Recipe } from '@/lib/camera/schema'
import camerasSeed from '../../../../data/sony-cameras.seed.json'
import { modelCode } from '../aliases'
import type { ConfirmedClaim } from './checks'
import {
  EVIDENCED_MODELS,
  OLDER_CREATIVE_STYLE_CAMERA,
  UNKNOWN_CAMERA,
  capabilitiesForChoice,
  capabilitiesForModel,
  capabilitiesFromClaims,
  installability,
  type CameraCapabilities,
  type InstallableRecipe,
} from './installable'
import type { CapabilityKey } from './keys'

/**
 * The camera filter's rules (ADR 0006), against the real evidence and the
 * real catalogue. The camera facts asserted here were read from each body's
 * own Help Guide on 2026-10-24 and are confirmed by the checks file —
 * `evidence.test.ts` fails first if they are not.
 */

const recipes = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as Recipe[]
const cl = recipes.filter((r) => r.format === 'cl')
const pp = recipes.filter((r): r is Extract<Recipe, { format: 'pp' }> => r.format === 'pp')
const sCinetone = pp.find((r) => r.settings.gamma === 'S-Cinetone')!

const OLDER = ['ILCE-7M3', 'ILCE-6400', 'ILCE-7C', 'ILCE-7RM3A', 'ILCE-7RM4A', 'ZV-E10', 'DSC-RX100M7', 'ZV-1']

describe('fixtures this file relies on', () => {
  it('the seed has Creative Look recipes and an S-Cinetone Picture Profile', () => {
    expect(cl.length).toBeGreaterThan(0)
    expect(sCinetone).toBeDefined()
  })

  it('every body asked for is a catalogue camera, keyed by its SKU model code', () => {
    const models = new Set(
      (camerasSeed as { sku: string; category: string }[]).filter((c) => c.category === 'camera').map((c) => modelCode(c.sku)),
    )
    for (const m of [...OLDER, 'ILCE-7M4']) {
      expect(models.has(m), m).toBe(true)
      expect(EVIDENCED_MODELS, m).toContain(m)
    }
  })
})

describe('a7 III', () => {
  const caps = capabilitiesForModel('ILCE-7M3')

  it('is confirmed on Creative Style with a Picture Profile, and its lists are complete', () => {
    expect(caps.creativeLook).toBe(false)
    expect(caps.pictureProfile).toBe(true)
    expect(caps.gammas).not.toBeNull()
    expect(caps.colorModes).not.toBeNull()
    expect(caps.gammas).not.toContain('S-Cinetone')
    expect(caps.colorModes).not.toContain('S-Cinetone')
  })

  it('cannot install a single Creative Look recipe', () => {
    for (const r of cl) {
      expect(installability(r, caps), r.id).toEqual({
        installable: false,
        reasons: [{ setting: 'creativeLook', label: 'Creative Look', confirmed: true }],
      })
    }
  })

  it('cannot install an S-Cinetone Picture Profile — one line, not one per dial', () => {
    expect(installability(sCinetone, caps)).toEqual({
      installable: false,
      reasons: [{ setting: 'gamma', label: 'S-Cinetone', confirmed: true }],
    })
  })
})

describe('S-Cinetone', () => {
  it.each(OLDER)('%s: confirmed absent, so hidden', (model) => {
    const v = installability(sCinetone, capabilitiesForModel(model))
    expect(v.installable).toBe(false)
    expect(v.reasons[0]).toMatchObject({ label: 'S-Cinetone', confirmed: true })
  })

  it('a camera whose Picture Profile is confirmed but whose Gamma list is unknown installs it', () => {
    const caps: CameraCapabilities = { ...UNKNOWN_CAMERA, pictureProfile: true }
    expect(installability(sCinetone, caps)).toEqual({ installable: true, reasons: [] })
  })

  it('a7 IV has it, and Creative Look', () => {
    const caps = capabilitiesForModel('ILCE-7M4')
    expect(caps.creativeLook).toBe(true)
    expect(caps.gammas).toContain('S-Cinetone')
    expect(caps.colorModes).toContain('S-Cinetone')
    for (const r of recipes) expect(installability(r, caps).installable, r.id).toBe(true)
  })
})

describe('the compact bodies list no Cine3 or Cine4', () => {
  const recipe = (gamma: (typeof PP_GAMMA)[number]): InstallableRecipe => ({ format: 'pp', settings: { gamma, colorMode: 'Still' } })

  it.each(['DSC-RX100M7', 'ZV-1'])('%s', (model) => {
    const caps = capabilitiesForModel(model)
    expect(installability(recipe('Cine4'), caps)).toEqual({
      installable: false,
      reasons: [{ setting: 'gamma', label: 'Cine4', confirmed: true }],
    })
    expect(installability(recipe('Cine1'), caps).installable).toBe(true)
  })

  it('while the a6400 has both', () => {
    expect(installability(recipe('Cine4'), capabilitiesForModel('ILCE-6400')).installable).toBe(true)
  })
})

describe('no data shows everything', () => {
  it.each([
    ['an unknown model', 'NOT-A-CAMERA'],
    ['a catalogue camera with no checked evidence', 'ILCE-9M3'],
    ['no choice', undefined],
    ['the "unknown / skip" choice', 'unknown'],
  ])('%s', (_label, choice) => {
    const caps = capabilitiesForChoice(choice)
    expect(caps).toEqual(UNKNOWN_CAMERA)
    for (const r of recipes) expect(installability(r, caps), r.id).toEqual({ installable: true, reasons: [] })
  })
})

describe('the older-camera choice (Creative Style menu)', () => {
  const caps = capabilitiesForChoice('older-creative-style')

  it('hides every Creative Look recipe', () => {
    expect(caps).toBe(OLDER_CREATIVE_STYLE_CAMERA)
    for (const r of cl) expect(installability(r, caps).installable, r.id).toBe(false)
  })

  it('leaves S-Cinetone installable, with a warning flagged as unconfirmed', () => {
    expect(installability(sCinetone, caps)).toEqual({
      installable: true,
      reasons: [{ setting: 'gamma', label: 'S-Cinetone', confirmed: false }],
    })
  })

  it('warns only about what every checked Creative Style body lacks', () => {
    expect(caps.mayLack?.gammas).toEqual(['S-Cinetone'])
    expect(caps.mayLack?.colorModes).toContain('S-Cinetone')
    expect(caps.mayLack?.gammas).not.toContain('Cine4')
  })

  it('a Picture Profile every older body has installs without a word', () => {
    const plain = pp.find((r) => r.settings.gamma === 'Still' && r.settings.colorMode === 'Still')!
    expect(installability(plain, caps)).toEqual({ installable: true, reasons: [] })
  })
})

describe('from claims to capabilities', () => {
  const claim = (capability: CapabilityKey, status: 'supported' | 'unsupported'): ConfirmedClaim => ({
    capability,
    status,
    match: [],
    mode: 'both',
    source: { id: 'TEST-1/topic', url: 'https://helpguide.sony.net/fixture.html', topic: 'Topic', checkedAt: '2026-10-24' },
  })
  const map = (claims: ConfirmedClaim[]) => {
    const m = new Map<CapabilityKey, ConfirmedClaim[]>()
    for (const c of claims) m.set(c.capability, [...(m.get(c.capability) ?? []), c])
    return m
  }

  it('nothing confirmed is all unknown', () => {
    expect(capabilitiesFromClaims(new Map())).toEqual(UNKNOWN_CAMERA)
  })

  it('a list with one unsettled option is unknown, never read as absence', () => {
    const all = PP_GAMMA.map((g) => claim(`pp.gamma:${g}`, g === 'S-Cinetone' ? 'unsupported' : 'supported'))
    expect(capabilitiesFromClaims(map(all)).gammas).toHaveLength(PP_GAMMA.length - 1)
    expect(capabilitiesFromClaims(map(all.filter((c) => c.capability !== 'pp.gamma:Cine4'))).gammas).toBeNull()
  })

  it('Creative Style confirms no Creative Look; a Creative Look support outranks it', () => {
    expect(capabilitiesFromClaims(map([claim('creative-style', 'supported')])).creativeLook).toBe(false)
    expect(
      capabilitiesFromClaims(map([claim('creative-style', 'supported'), claim('creative-look', 'supported')])).creativeLook,
    ).toBe(true)
  })

  it('lists hold constants.ts spellings only', () => {
    for (const m of EVIDENCED_MODELS) {
      const caps = capabilitiesForModel(m)
      for (const g of caps.gammas ?? []) expect(PP_GAMMA, m).toContain(g)
      for (const c of caps.colorModes ?? []) expect(PP_COLOR_MODE, m).toContain(c)
    }
  })
})
