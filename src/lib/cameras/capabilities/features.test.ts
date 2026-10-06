import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CL_PARAM_LABELS, WB_PARAM_LABELS } from '@/lib/camera/constants'
import { EVIDENCE_SOURCES } from './evidence'
import { summariseFeatures } from './features'
import { capabilitiesOf } from './index'
import { CAPABILITY_KEYS, capabilityLabel } from './keys'

/**
 * A camera page's colour settings, against the real evidence. The specific
 * cases are facts read from Sony's pages on 2026-10-05.
 */

describe('capability labels', () => {
  it('labels are the technical names the tables print, untranslated', () => {
    expect(capabilityLabel('cl.adjust:sharpnessRange')).toBe(CL_PARAM_LABELS.sharpnessRange)
    expect(capabilityLabel('wb.shift:gm')).toBe(WB_PARAM_LABELS.shiftGm)
    expect(capabilityLabel('cl.look:FL')).toBe('FL (Film)')
    expect(capabilityLabel('pp.gamma:S-Cinetone')).toBe('Gamma S-Cinetone')
    for (const k of CAPABILITY_KEYS) expect(capabilityLabel(k).length).toBeGreaterThan(0)
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

  const PILOT = ['ILCE-7M4', 'ILCE-7CM2', 'ILCE-6700', 'ILCE-7M5']

  it('the four pilot bodies, and only they, have evidence', () => {
    const evidenced = [...new Set(EVIDENCE_SOURCES.map((s) => s.camera))].filter((c) => capabilitiesOf(c).size > 0)
    expect(evidenced.sort()).toEqual([...PILOT].sort())
  })

  it.each(PILOT)('%s: Sharpness Range and Flash are stills-only', (camera) => {
    expect(group(camera, 'cl').stillsOnly).toEqual(['Sharpness Range'])
    expect(group(camera, 'wb').stillsOnly).toEqual(['Flash'])
  })

  it.each(['ILCE-7CM2', 'ILCE-6700', 'ILCE-7M5'])('%s has no S-Log2', (camera) => {
    expect(group(camera, 'pp').notOnBody).toContain('S-Log2')
  })

  it('is empty for a body without evidence', () => {
    expect(summariseFeatures(capabilitiesOf('ILCE-7M3'))).toEqual([])
  })
})

describe('the page that shows it', () => {
  it('the camera page shows its colour settings by model code', () => {
    expect(readFileSync('src/app/[locale]/cameras/[id]/page.tsx', 'utf8')).toMatch(/<CameraColourSettings sku=\{product\.sku\} \/>/)
  })

  it('renders nothing without evidence', () => {
    expect(readFileSync('src/components/camera-colour-settings.tsx', 'utf8')).toContain('if (byKey.size === 0) return null')
  })

  it('recipe pages no longer judge camera compatibility', () => {
    expect(readFileSync('src/app/[locale]/recipe/[slug]/page.tsx', 'utf8')).not.toMatch(/Compatibility|capabilities/)
  })
})
