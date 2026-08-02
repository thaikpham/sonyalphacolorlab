import { describe, expect, it } from 'vitest'

import { resolveAudioSourceRefresh } from '../../src/hooks/cameraSession/audioSourceRefresh'
import {
  getUnsupportedCameraSessionState,
  resolvePermissionProbeState,
} from '../../src/hooks/cameraSession/permissionState'
import { resolveCameraSourceRefresh } from '../../src/hooks/cameraSession/sourceRefresh'

function createNamedError(name: string, message: string): Error {
  const error = new Error(message)

  error.name = name
  return error
}

describe('camera session helpers', () => {
  it('marks permission probes as granted when no error is returned', () => {
    expect(resolvePermissionProbeState(null)).toEqual({
      permissionState: 'granted',
      streamState: 'idle',
      lastError: null,
    })
  })

  it('returns the unsupported-runtime camera state', () => {
    expect(getUnsupportedCameraSessionState()).toEqual({
      permissionState: 'unknown',
      streamState: 'error',
      lastError: 'Runtime hiện tại không hỗ trợ camera.',
    })
  })

  it('reseats the device selection to the best remaining camera when the current device disappears', () => {
    const resolution = resolveCameraSourceRefresh({
      sources: [
        {
          deviceId: 'sony-usb',
          label: 'Sony USB Streaming',
          isSonyPreferred: true,
        },
        {
          deviceId: 'generic',
          label: 'Generic Camera',
          isSonyPreferred: false,
        },
      ],
      selectedDeviceId: 'missing-device',
      isDeviceChange: true,
    })

    expect(resolution.shouldSelectDevice).toBe(true)
    expect(resolution.nextDeviceId).toBe('sony-usb')
    expect(resolution.shouldClearDevice).toBe(false)
  })

  it('falls back to missing-device state when no replacement camera is available', () => {
    const resolution = resolveCameraSourceRefresh({
      sources: [],
      selectedDeviceId: 'missing-device',
      isDeviceChange: true,
    })

    expect(resolution.shouldSelectDevice).toBe(false)
    expect(resolution.shouldClearDevice).toBe(true)
    expect(resolution.streamState).toBe('missing-device')
    expect(resolution.lastError).toMatch(/đã bị ngắt/i)
  })

  it('maps permission denial errors to a stable warning state', () => {
    const resolution = resolvePermissionProbeState(
      createNamedError('NotAllowedError', 'Permission denied'),
    )

    expect(resolution).toEqual({
      permissionState: 'denied',
      streamState: 'idle',
      lastError: 'Bạn đã từ chối quyền truy cập camera.',
    })
  })

  it('auto-pairs HDMI audio with the selected Cam Link source', () => {
    const resolution = resolveAudioSourceRefresh({
      audioSources: [
        {
          deviceId: 'camlink-audio',
          label: 'Cam Link 4K Audio',
          isCamLinkPreferred: true,
        },
        {
          deviceId: 'usb-mic',
          label: 'USB Microphone',
          isCamLinkPreferred: false,
        },
      ],
      selectedAudioDeviceId: null,
      videoSources: [
        {
          deviceId: 'camlink-video',
          label: 'Cam Link 4K',
          isSonyPreferred: true,
        },
      ],
      selectedVideoDeviceId: 'camlink-video',
    })

    expect(resolution.shouldSelectAudioDevice).toBe(true)
    expect(resolution.nextAudioDeviceId).toBe('camlink-audio')
    expect(resolution.audioState.status).toBe('paired')
  })

  it('falls back to silent performance when no HDMI-like audio source exists', () => {
    const resolution = resolveAudioSourceRefresh({
      audioSources: [
        {
          deviceId: 'usb-mic',
          label: 'USB Microphone',
          isCamLinkPreferred: false,
        },
      ],
      selectedAudioDeviceId: null,
      videoSources: [
        {
          deviceId: 'camlink-video',
          label: 'Cam Link 4K',
          isSonyPreferred: true,
        },
      ],
      selectedVideoDeviceId: 'camlink-video',
    })

    expect(resolution.shouldSelectAudioDevice).toBe(false)
    expect(resolution.audioState.status).toBe('unavailable')
    expect(resolution.audioState.message).toMatch(/không tiếng/i)
  })
})
