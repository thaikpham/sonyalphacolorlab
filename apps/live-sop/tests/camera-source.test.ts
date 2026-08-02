import { describe, expect, it } from 'vitest'

import {
  buildCameraTrackConstraints,
  buildVideoSourceOptions,
  describeVideoDevice,
  getFittedVideoFrameSize,
  isConflictingCameraSource,
  isSonyCameraSource,
  isSonyUsbLivestreamSource,
  labelsProbablyMatch,
  normalizeRotation,
  pickPreferredVideoSource,
  scoreVideoDevice,
  TARGET_CAMERA_RAW_HEIGHT_PX,
  TARGET_CAMERA_RAW_WIDTH_PX,
  type VideoSourceOption,
} from '../src/lib/camera-source'
import type { StoredCameraPreference } from '../src/lib/showcase-runtime'

/**
 * This is the logic that decides which camera a kiosk opens at a live event.
 * It had no tests while it lived inside a 2385-line page component.
 */

type Device = Pick<MediaDeviceInfo, 'kind' | 'label' | 'deviceId'>

function device(label: string, deviceId = label.toLowerCase().replace(/\W+/g, '-')): Device {
  return { kind: 'videoinput', label, deviceId }
}

describe('virtual camera detection', () => {
  it.each([
    'Imaging Edge Webcam',
    'ImagingEdge Virtual',
    'OBS Virtual Camera',
    'Snap Camera',
    'DroidCam Source 3',
    'EpocCam Camera',
    'iVCam',
    'Iriun Webcam',
    'XSplit VCam',
  ])('flags %s as conflicting', (label) => {
    expect(isConflictingCameraSource(label)).toBe(true)
  })

  it.each(['Sony ZV-E10', 'USB Video Device', 'Integrated Camera'])(
    'does not flag %s',
    (label) => {
      expect(isConflictingCameraSource(label)).toBe(false)
    },
  )

  it('matches case-insensitively and ignores surrounding space', () => {
    expect(isConflictingCameraSource('   OBS VIRTUAL Camera  ')).toBe(true)
  })

  it('never treats a virtual source as a Sony source, even when Sony is in the name', () => {
    // Imaging Edge is Sony's own software, so its label contains "Sony" and
    // would otherwise score 220 — while holding the real camera open.
    const label = 'Sony Imaging Edge Webcam'
    expect(isSonyCameraSource(label)).toBe(false)
    expect(isSonyUsbLivestreamSource(label)).toBe(false)
    expect(scoreVideoDevice({ label })).toBe(-1000)
  })
})

describe('scoreVideoDevice', () => {
  it('ranks a Sony USB stream above a plain Sony body', () => {
    expect(scoreVideoDevice({ label: 'Sony ZV-E10 USB Streaming' })).toBe(300)
    expect(scoreVideoDevice({ label: 'Sony Alpha 7 IV' })).toBe(220)
  })

  it('ranks a generic USB device above a generic camera', () => {
    expect(scoreVideoDevice({ label: 'USB Video Device' })).toBe(120)
    expect(scoreVideoDevice({ label: 'Elgato Cam' })).toBe(30)
  })

  it('puts a built-in laptop webcam last among usable devices', () => {
    expect(scoreVideoDevice({ label: 'Integrated Camera' })).toBe(10)
    expect(scoreVideoDevice({ label: 'FaceTime HD Camera' })).toBe(10)
    expect(scoreVideoDevice({ label: 'Built-in Webcam' })).toBe(10)
  })

  it('ranks a capture card above the laptop webcam', () => {
    // Regression: "Integrated Camera" contains the substring "camera", so it
    // used to match the generic branch at 60 and beat a capture card at 30 —
    // a kiosk with a capture card plugged in opened the laptop camera instead.
    expect(scoreVideoDevice({ label: 'Elgato Cam' })).toBeGreaterThan(
      scoreVideoDevice({ label: 'Integrated Camera' }),
    )
    expect(scoreVideoDevice({ label: 'Capture Card' })).toBeGreaterThan(
      scoreVideoDevice({ label: 'FaceTime HD Camera' }),
    )
  })

  it('pushes conflicting sources far below everything else', () => {
    expect(scoreVideoDevice({ label: 'OBS Virtual Camera' })).toBeLessThan(
      scoreVideoDevice({ label: 'Integrated Camera' }),
    )
  })

  it('scores an unlabelled device as an ordinary camera rather than crashing', () => {
    // Before permission is granted the label is empty; the fallback string
    // contains "Camera" so it lands on the generic tier.
    expect(scoreVideoDevice({ label: '' })).toBe(60)
  })
})

describe('buildVideoSourceOptions', () => {
  const devices: Device[] = [
    device('Integrated Camera'),
    device('OBS Virtual Camera'),
    device('Sony ZV-E10 USB Streaming'),
    device('USB Video Device'),
    { kind: 'audioinput', label: 'Microphone', deviceId: 'mic' },
  ]

  it('drops audio inputs and virtual cameras from the choices', () => {
    const { visibleOptions } = buildVideoSourceOptions(devices)
    expect(visibleOptions.map((option) => option.label)).toEqual([
      'Sony ZV-E10 USB Streaming',
      'USB Video Device',
      'Integrated Camera',
    ])
  })

  it('reports hidden virtual cameras so the UI can explain the absence', () => {
    const { hiddenLabels } = buildVideoSourceOptions(devices)
    expect(hiddenLabels).toEqual(['OBS Virtual Camera'])
  })

  it('recommends only the Sony USB stream', () => {
    const { visibleOptions } = buildVideoSourceOptions(devices)
    expect(visibleOptions.filter((option) => option.recommended).map((o) => o.label)).toEqual([
      'Sony ZV-E10 USB Streaming',
    ])
  })

  it('breaks score ties alphabetically so the order is stable across reloads', () => {
    const tied = [device('Zebra Cam', 'z'), device('Alpha Cam', 'a')]
    const { visibleOptions } = buildVideoSourceOptions(tied)
    expect(visibleOptions.map((o) => o.label)).toEqual(['Alpha Cam', 'Zebra Cam'])
  })

  it('names an unlabelled device rather than showing an empty row', () => {
    const { visibleOptions } = buildVideoSourceOptions([
      { kind: 'videoinput', label: '', deviceId: 'x' },
    ])
    expect(visibleOptions[0].label).toBe('Camera chưa rõ tên')
    expect(visibleOptions[0].note).toBe('Camera khả dụng')
  })

  it('returns empty lists for no devices', () => {
    expect(buildVideoSourceOptions([])).toEqual({ visibleOptions: [], hiddenLabels: [] })
  })
})

describe('describeVideoDevice', () => {
  it.each([
    ['Sony ZV-E10 USB Streaming', 'Ưu tiên: Sony USB Livestream / UVC'],
    ['Sony Alpha 7 IV', 'Nguồn Sony vật lý'],
    ['USB Video Device', 'Nguồn USB khả dụng'],
    ['Integrated Camera', 'Camera tích hợp'],
    ['Elgato Cam', 'Camera khả dụng'],
  ])('%s -> %s', (label, expected) => {
    expect(describeVideoDevice(label)).toBe(expected)
  })
})

describe('labelsProbablyMatch', () => {
  it('matches a decorated label against its bare form', () => {
    expect(labelsProbablyMatch('Sony ZV-E10 (054c:0d97)', 'sony zv-e10')).toBe(true)
  })

  it('matches regardless of which side is longer', () => {
    expect(labelsProbablyMatch('sony zv-e10', 'Sony ZV-E10 (054c:0d97)')).toBe(true)
  })

  it('is false when either side is missing', () => {
    expect(labelsProbablyMatch(null, 'sony')).toBe(false)
    expect(labelsProbablyMatch('sony', undefined)).toBe(false)
    expect(labelsProbablyMatch('', 'sony')).toBe(false)
  })

  it('does not match unrelated cameras', () => {
    expect(labelsProbablyMatch('Sony ZV-E10', 'Integrated Camera')).toBe(false)
  })
})

describe('pickPreferredVideoSource', () => {
  const options: VideoSourceOption[] = [
    { deviceId: 'sony', label: 'Sony ZV-E10 USB', note: '', score: 300, recommended: true },
    { deviceId: 'usb', label: 'USB Video Device', note: '', score: 120, recommended: false },
    { deviceId: 'builtin', label: 'Integrated Camera', note: '', score: 10, recommended: false },
  ]

  function preference(partial: Partial<StoredCameraPreference>): StoredCameraPreference {
    return {
      deviceId: null,
      label: null,
      normalizedLabel: null,
      lastConnectedAt: null,
      ...partial,
    }
  }

  it('returns null when there is nothing to pick', () => {
    expect(pickPreferredVideoSource([], null)).toBeNull()
  })

  it('falls back to the highest scorer with no stored preference', () => {
    expect(pickPreferredVideoSource(options, null)?.deviceId).toBe('sony')
  })

  it('honours an exact deviceId even when it scores lower', () => {
    expect(pickPreferredVideoSource(options, preference({ deviceId: 'builtin' }))?.deviceId).toBe(
      'builtin',
    )
  })

  it('falls back to the label when the stored deviceId has gone stale', () => {
    // deviceId is regenerated per permission grant, so this is the common case
    // on the second visit — not an edge case.
    const stale = preference({ deviceId: 'no-longer-exists', normalizedLabel: 'usb video device' })
    expect(pickPreferredVideoSource(options, stale)?.deviceId).toBe('usb')
  })

  it('falls back to the highest scorer when neither id nor label matches', () => {
    const gone = preference({ deviceId: 'gone', normalizedLabel: 'canon eos' })
    expect(pickPreferredVideoSource(options, gone)?.deviceId).toBe('sony')
  })
})

describe('buildCameraTrackConstraints', () => {
  it('requests the portrait-transposed resolution', () => {
    const constraints = buildCameraTrackConstraints()
    expect(constraints.width).toEqual({
      ideal: TARGET_CAMERA_RAW_WIDTH_PX,
      max: TARGET_CAMERA_RAW_WIDTH_PX,
    })
    expect(constraints.height).toEqual({
      ideal: TARGET_CAMERA_RAW_HEIGHT_PX,
      max: TARGET_CAMERA_RAW_HEIGHT_PX,
    })
  })

  it('pins an exact deviceId when one is given', () => {
    expect(buildCameraTrackConstraints('abc').deviceId).toEqual({ exact: 'abc' })
  })

  it('omits deviceId entirely when none is given, rather than sending undefined', () => {
    expect('deviceId' in buildCameraTrackConstraints()).toBe(false)
  })
})

describe('normalizeRotation', () => {
  it.each([
    [0, 0],
    [90, 90],
    [360, 0],
    [450, 90],
    [-90, 270],
    [-450, 270],
  ])('%i -> %i', (input, expected) => {
    expect(normalizeRotation(input)).toBe(expected)
  })
})

describe('getFittedVideoFrameSize', () => {
  const viewport = { width: 394, height: 700 }
  const frame = { width: 1920, height: 1080 }

  it('covers the viewport without rotation', () => {
    const fitted = getFittedVideoFrameSize(viewport, frame, 0)
    expect(fitted.width).toBeGreaterThanOrEqual(viewport.width)
    expect(fitted.height).toBeGreaterThanOrEqual(viewport.height)
  })

  it('still covers the viewport after a quarter turn', () => {
    const fitted = getFittedVideoFrameSize(viewport, frame, 90)
    // After rotation the frame's width spans the viewport's height.
    expect(fitted.width).toBeGreaterThanOrEqual(viewport.height)
    expect(fitted.height).toBeGreaterThanOrEqual(viewport.width)
  })

  it('treats 270 the same as 90', () => {
    expect(getFittedVideoFrameSize(viewport, frame, 270)).toEqual(
      getFittedVideoFrameSize(viewport, frame, 90),
    )
  })

  it('preserves the frame aspect ratio', () => {
    const fitted = getFittedVideoFrameSize(viewport, frame, 0)
    expect(fitted.width / fitted.height).toBeCloseTo(frame.width / frame.height, 10)
  })

  it('returns the frame untouched when the viewport has not been measured yet', () => {
    // Happens on the first render, before the element has a layout box. Scaling
    // by Infinity here would blow the frame up to nothing.
    expect(getFittedVideoFrameSize({ width: 0, height: 0 }, frame, 0)).toEqual(frame)
    expect(getFittedVideoFrameSize({ width: 394, height: 0 }, frame, 0)).toEqual(frame)
  })

  it('returns the frame untouched when the frame has no dimensions yet', () => {
    const empty = { width: 0, height: 0 }
    expect(getFittedVideoFrameSize(viewport, empty, 0)).toEqual(empty)
  })
})
