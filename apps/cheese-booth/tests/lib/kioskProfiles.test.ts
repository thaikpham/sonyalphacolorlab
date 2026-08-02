import { describe, expect, it } from 'vitest'

import {
  DEFAULT_KIOSK_PROFILE,
  getKioskPreviewAspect,
  getKioskProfileAspectLabel,
  getKioskRotationOptions,
  normalizeOperatorSettingsForProfile,
  sanitizeRotationQuarterForProfile,
} from '../../src/lib/kioskProfiles'
import { getDefaultOperatorSettings } from '../../src/lib/kioskProfiles'

describe('kioskProfiles portrait policy', () => {
  it('uses portrait as the default kiosk profile', () => {
    expect(DEFAULT_KIOSK_PROFILE).toBe('portrait')
  })

  it('keeps portrait preview/output on a 3:4 profile contract', () => {
    expect(getKioskPreviewAspect('portrait')).toBe('3 / 4')
    expect(getKioskProfileAspectLabel('portrait')).toBe('3:4')
  })

  it('locks portrait rotation to the portrait-safe preset', () => {
    expect(getKioskRotationOptions('portrait')).toEqual([1])
    expect(sanitizeRotationQuarterForProfile('portrait', 0)).toBe(1)
    expect(sanitizeRotationQuarterForProfile('portrait', 2)).toBe(1)
    expect(sanitizeRotationQuarterForProfile('portrait', 3)).toBe(1)
  })

  it('releases portrait rotation lock for performance mode', () => {
    expect(getKioskRotationOptions('portrait', 'performance')).toEqual([0, 1, 2, 3])
    expect(sanitizeRotationQuarterForProfile('portrait', 0, 'performance')).toBe(0)
    expect(sanitizeRotationQuarterForProfile('portrait', 3, 'performance')).toBe(3)
  })

  it('preserves landscape rotation freedom', () => {
    expect(getKioskRotationOptions('landscape')).toEqual([0, 1, 2, 3])
    expect(sanitizeRotationQuarterForProfile('landscape', 3)).toBe(3)
  })

  it('normalizes portrait settings without mutating the rest of the profile', () => {
    expect(
      normalizeOperatorSettingsForProfile('portrait', {
        ...getDefaultOperatorSettings('portrait'),
        deviceId: 'portrait-cam',
        audioDeviceId: 'portrait-audio',
        rotationQuarter: 3,
        flipHorizontal: false,
      }),
    ).toEqual({
      ...getDefaultOperatorSettings('portrait'),
        deviceId: 'portrait-cam',
        audioDeviceId: 'portrait-audio',
        rotationQuarter: 1,
        flipHorizontal: false,
      })
  })

  it('preserves portrait performance rotation without forcing 90 degrees', () => {
    expect(
      normalizeOperatorSettingsForProfile('portrait', {
        ...getDefaultOperatorSettings('portrait'),
        captureMode: 'performance',
        rotationQuarter: 0,
      }),
    ).toMatchObject({
      captureMode: 'performance',
      rotationQuarter: 0,
    })
  })
})
