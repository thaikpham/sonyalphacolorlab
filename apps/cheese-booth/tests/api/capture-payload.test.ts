import { describe, expect, it } from 'vitest'

import {
  parseCaptureKind,
  validateCapturePayload,
} from '../../api/_lib/capturePayload.js'

describe('capture payload validation', () => {
  it('accepts high-resolution PNG photos within the updated booth limits', () => {
    expect(() =>
      validateCapturePayload({
        kind: 'photo',
        mimeType: 'image/png',
        extension: 'png',
        byteSize: 32 * 1024 * 1024,
        width: 6000,
        height: 4000,
      }),
    ).not.toThrow()
  })

  it('accepts performance captures as MP4 up to the 2K/150MB limits', () => {
    expect(parseCaptureKind('performance')).toBe('performance')

    expect(() =>
      validateCapturePayload({
        kind: 'performance',
        mimeType: 'video/mp4',
        extension: 'mp4',
        byteSize: 120 * 1024 * 1024,
        width: 2048,
        height: 1152,
      }),
    ).not.toThrow()
  })

  it('rejects oversized performance payloads', () => {
    expect(() =>
      validateCapturePayload({
        kind: 'performance',
        mimeType: 'video/mp4',
        extension: 'mp4',
        byteSize: 151 * 1024 * 1024,
        width: 2048,
        height: 1152,
      }),
    ).toThrow(/150 MB/)
  })
})
