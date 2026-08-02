import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getPerformanceOutputSize,
  getPerformanceRecordingSupport,
  getSupportedPerformanceRecorderMimeType,
} from '../../src/lib/media'

describe('media performance helpers', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'MediaRecorder')
    vi.restoreAllMocks()
  })

  it('returns fixed 2K output targets for landscape and portrait performance', () => {
    expect(getPerformanceOutputSize('landscape')).toEqual({
      width: 2048,
      height: 1152,
    })
    expect(getPerformanceOutputSize('portrait')).toEqual({
      width: 1152,
      height: 2048,
    })
  })

  it('detects native MP4 recorder support when the runtime exposes it', () => {
    ;(globalThis as typeof globalThis & {
      MediaRecorder?: { isTypeSupported: (value: string) => boolean }
    }).MediaRecorder = {
      isTypeSupported: (value: string) => value.startsWith('video/mp4'),
    }

    expect(getSupportedPerformanceRecorderMimeType()).toMatch(/^video\/mp4/)
    expect(getPerformanceRecordingSupport()).toMatchObject({
      supported: true,
    })
  })

  it('disables performance recording when native MP4 support is missing', () => {
    ;(globalThis as typeof globalThis & {
      MediaRecorder?: { isTypeSupported: (value: string) => boolean }
    }).MediaRecorder = {
      isTypeSupported: () => false,
    }

    expect(getSupportedPerformanceRecorderMimeType()).toBeNull()
    expect(getPerformanceRecordingSupport()).toEqual({
      supported: false,
      mimeType: null,
    })
  })
})
