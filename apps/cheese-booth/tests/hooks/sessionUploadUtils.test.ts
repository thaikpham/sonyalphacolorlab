import { describe, expect, it } from 'vitest'

import {
  mapSessionItemsToInitPayload,
  resolveSessionUploadPairs,
} from '../../src/hooks/captureActions/sessionUploadUtils'
import type { BrowserSessionItem } from '../../src/types'

function createSessionItem(
  overrides: Partial<BrowserSessionItem> = {},
): BrowserSessionItem {
  return {
    id: 'item-1',
    kind: 'photo',
    sequence: 1,
    createdAt: 1,
    previewUrl: 'blob:preview',
    posterUrl: 'blob:preview',
    mimeType: 'image/jpeg',
    extension: 'jpg',
    width: 1200,
    height: 900,
    blob: new Blob(['photo']),
    ...overrides,
  }
}

describe('sessionUploadUtils', () => {
  it('maps browser session items to the cloud init payload shape', () => {
    const item = createSessionItem({
      kind: 'boomerang',
      mimeType: 'video/mp4',
      extension: 'mp4',
      sequence: 2,
      width: 1080,
      height: 1440,
      blob: new Blob(['clip']),
    })

    expect(mapSessionItemsToInitPayload([item])).toEqual([
      {
        kind: 'boomerang',
        mimeType: 'video/mp4',
        extension: 'mp4',
        byteSize: item.blob.size,
        width: 1080,
        height: 1440,
        sequence: 2,
      },
    ])
  })

  it('keeps performance session payloads as single MP4 uploads', () => {
    const item = createSessionItem({
      kind: 'performance',
      mimeType: 'video/mp4',
      extension: 'mp4',
      width: 2048,
      height: 1152,
      blob: new Blob(['performance']),
    })

    expect(mapSessionItemsToInitPayload([item])).toEqual([
      {
        kind: 'performance',
        mimeType: 'video/mp4',
        extension: 'mp4',
        byteSize: item.blob.size,
        width: 2048,
        height: 1152,
        sequence: 1,
      },
    ])
  })

  it('pairs local items to remote upload targets by sequence', () => {
    const item = createSessionItem({
      id: 'item-2',
      sequence: 2,
    })

    const [pair] = resolveSessionUploadPairs([item], [
      {
        captureId: 'capture-2',
        sequence: 2,
        upload: {
          url: 'https://upload.example/2',
          method: 'PUT',
          headers: {
            'Content-Type': 'image/jpeg',
          },
        },
      },
    ])

    expect(pair.localItem.id).toBe('item-2')
    expect(pair.remoteItem.captureId).toBe('capture-2')
  })
})
