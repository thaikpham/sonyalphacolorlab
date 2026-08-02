import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getDefaultOperatorSettings } from '../../src/lib/kioskProfiles'
import {
  loadOperatorSettings,
  saveOperatorSettings,
} from '../../src/lib/settingsStore'

class MemoryStorage {
  private store = new Map<string, string>()

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

describe('settingsStore profile persistence', () => {
  const LEGACY_SETTINGS_KEY = 'kiosk.v1.operatorSettings'
  const PORTRAIT_SETTINGS_KEY = 'kiosk.v2.operatorSettings.portrait'
  const LANDSCAPE_SETTINGS_KEY = 'kiosk.v2.operatorSettings.landscape'
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()

    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: storage,
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
    vi.restoreAllMocks()
  })

  it('loads portrait and landscape presets from separate keys', async () => {
    storage.setItem(
      PORTRAIT_SETTINGS_KEY,
      JSON.stringify({
        captureMode: 'photo',
        deviceId: 'portrait-device',
        audioDeviceId: 'portrait-audio',
        countdownSec: 0,
        rotationQuarter: 1,
        flipHorizontal: true,
        flipVertical: false,
      }),
    )
    storage.setItem(
      LANDSCAPE_SETTINGS_KEY,
      JSON.stringify({
        captureMode: 'photo',
        deviceId: 'landscape-device',
        audioDeviceId: 'landscape-audio',
        countdownSec: 3,
        rotationQuarter: 0,
        flipHorizontal: true,
        flipVertical: false,
      }),
    )

    await expect(loadOperatorSettings('portrait')).resolves.toEqual({
      ...getDefaultOperatorSettings('portrait'),
      deviceId: 'portrait-device',
      audioDeviceId: 'portrait-audio',
      countdownSec: 0,
    })
    await expect(loadOperatorSettings('landscape')).resolves.toEqual({
      ...getDefaultOperatorSettings('landscape'),
      deviceId: 'landscape-device',
      audioDeviceId: 'landscape-audio',
    })
  })

  it('falls back to profile defaults and ignores legacy v1 settings', async () => {
    storage.setItem(
      LEGACY_SETTINGS_KEY,
      JSON.stringify({
        captureMode: 'boomerang',
        deviceId: 'legacy-device',
        audioDeviceId: 'legacy-audio',
        countdownSec: 10,
        rotationQuarter: 3,
        flipHorizontal: false,
        flipVertical: true,
      }),
    )

    await expect(loadOperatorSettings('portrait')).resolves.toEqual(
      getDefaultOperatorSettings('portrait'),
    )
    await expect(loadOperatorSettings('landscape')).resolves.toEqual(
      getDefaultOperatorSettings('landscape'),
    )
  })

  it('saves settings back to the correct profile key', async () => {
    const portraitSettings = {
      ...getDefaultOperatorSettings('portrait'),
      deviceId: 'portrait-device',
      audioDeviceId: 'portrait-audio',
    }

    await saveOperatorSettings('portrait', portraitSettings)

    expect(storage.getItem(PORTRAIT_SETTINGS_KEY)).toBe(JSON.stringify(portraitSettings))
    expect(storage.getItem(LANDSCAPE_SETTINGS_KEY)).toBeNull()
  })

  it('drops invalid stored values without touching the other profile', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    storage.setItem(PORTRAIT_SETTINGS_KEY, '{"deviceId":123')
    storage.setItem(
      LANDSCAPE_SETTINGS_KEY,
      JSON.stringify({
        ...getDefaultOperatorSettings('landscape'),
        deviceId: 'landscape-device',
        audioDeviceId: 'landscape-audio',
      }),
    )

    await expect(loadOperatorSettings('portrait')).resolves.toEqual(
      getDefaultOperatorSettings('portrait'),
    )
    await expect(loadOperatorSettings('landscape')).resolves.toEqual({
      ...getDefaultOperatorSettings('landscape'),
      deviceId: 'landscape-device',
      audioDeviceId: 'landscape-audio',
    })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(storage.getItem(PORTRAIT_SETTINGS_KEY)).toBeNull()
  })
})
