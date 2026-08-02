import { describe, expect, it } from 'vitest'

import { pickBestDeviceId, toSourceDescriptor } from '../../src/hooks/kioskControllerUtils'
import type { SourceDescriptor } from '../../src/types'

/**
 * Which camera the booth opens by itself.
 *
 * This had no direct tests. It is also the decision that fails at an event and
 * cannot be debugged there — an operator sees "wrong picture" and has no way to
 * know a virtual camera won the ranking.
 *
 * The ranking here is deliberately NOT the same as Sony Live SOP's. This app
 * puts a capture card first, because a booth is usually driven by one; Live SOP
 * has no capture-card concept and hard-excludes virtual sources instead. Two
 * products, two policies — see the note in src/hooks/kioskControllerUtils.ts.
 */

function source(label: string, deviceId = label.toLowerCase().replace(/\W+/g, '-')): SourceDescriptor {
  return { deviceId, label, isSonyPreferred: false }
}

function rank(labels: string[]): string[] {
  // pickBestDeviceId returns only the winner, so rank by removing the winner
  // and asking again.
  const remaining = labels.map((l) => source(l))
  const order: string[] = []

  while (remaining.length) {
    const winnerId = pickBestDeviceId(remaining, null)
    const index = remaining.findIndex((s) => s.deviceId === winnerId)
    order.push(remaining[index].label)
    remaining.splice(index, 1)
  }

  return order
}

describe('pickBestDeviceId', () => {
  it('returns null when there are no sources', () => {
    expect(pickBestDeviceId([], null)).toBeNull()
  })

  it('keeps the current device when it is still present', () => {
    const sources = [source('Sony ZV-E10', 'sony'), source('Elgato Cam Link 4K', 'elgato')]
    expect(pickBestDeviceId(sources, 'sony')).toBe('sony')
  })

  it('reseats to the best remaining device when the current one disappears', () => {
    const sources = [source('Integrated Camera', 'builtin'), source('Elgato Cam Link 4K', 'elgato')]
    expect(pickBestDeviceId(sources, 'unplugged')).toBe('elgato')
  })

  it('puts a capture card first — that is this app’s policy', () => {
    expect(rank(['Integrated Camera', 'Sony ZV-E10', 'Elgato Cam Link 4K'])[0]).toBe(
      'Elgato Cam Link 4K',
    )
  })

  it('prefers a Sony body over a generic webcam', () => {
    expect(rank(['Integrated Camera', 'Sony ZV-E10'])[0]).toBe('Sony ZV-E10')
  })

  it('prefers native USB streaming over a plain Sony label', () => {
    const order = rank(['Sony ZV-E10', 'Sony USB Streaming'])
    expect(order[0]).toBe('Sony USB Streaming')
  })

  it('ranks Imaging Edge below a real Sony device without excluding it', () => {
    // Deliberate: an operator may have no other option, and unlike Live SOP
    // this app lets them use it rather than hiding it.
    const order = rank(['Sony Imaging Edge Webcam', 'Sony ZV-E10'])
    expect(order).toEqual(['Sony ZV-E10', 'Sony Imaging Edge Webcam'])
  })

  it('never auto-selects a virtual camera over a real one', () => {
    // Regression: only "imaging edge" was recognised as virtual, so every other
    // virtual source tied with a real webcam on score and the winner came down
    // to alphabetical order — "DroidCam Source 3" beat "Integrated Camera".
    for (const virtual of [
      'OBS Virtual Camera',
      'DroidCam Source 3',
      'Snap Camera',
      'Iriun Webcam',
      'EpocCam Camera',
      'iVCam',
      'XSplit VCam',
      'AlwaysFirst Virtual Camera',
    ]) {
      expect(rank([virtual, 'Integrated Camera'])[0], `${virtual} outranked a real camera`).toBe(
        'Integrated Camera',
      )
    }
  })

  it('still returns a virtual camera when it is the only source', () => {
    // Deprioritised, not excluded: a booth with nothing else must still show
    // something rather than a blank screen.
    expect(pickBestDeviceId([source('OBS Virtual Camera', 'obs')], null)).toBe('obs')
  })

  it('breaks ties alphabetically so the choice is stable across reloads', () => {
    expect(rank(['Zebra Cam', 'Alpha Cam'])).toEqual(['Alpha Cam', 'Zebra Cam'])
  })
})

describe('toSourceDescriptor', () => {
  it('names an unlabelled device by its position', () => {
    const descriptor = toSourceDescriptor(
      { deviceId: 'x', label: '', kind: 'videoinput' } as MediaDeviceInfo,
      2,
    )
    expect(descriptor.label).toBe('Camera 3')
  })

  it('flags a Sony source as preferred', () => {
    const descriptor = toSourceDescriptor(
      { deviceId: 'x', label: 'Sony ZV-E10', kind: 'videoinput' } as MediaDeviceInfo,
      0,
    )
    expect(descriptor.isSonyPreferred).toBe(true)
  })

  it('does not flag a virtual camera as preferred', () => {
    const descriptor = toSourceDescriptor(
      { deviceId: 'x', label: 'OBS Virtual Camera', kind: 'videoinput' } as MediaDeviceInfo,
      0,
    )
    expect(descriptor.isSonyPreferred).toBe(false)
  })
})
