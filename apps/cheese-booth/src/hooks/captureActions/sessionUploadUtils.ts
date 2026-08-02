import type {
  InitCloudCaptureSessionItemInput,
  InitCloudCaptureSessionResponse,
} from '../../lib/cloudShare'
import type { BrowserSessionItem } from '../../types'

export function mapSessionItemsToInitPayload(
  items: BrowserSessionItem[],
): InitCloudCaptureSessionItemInput[] {
  return items.map((item) => ({
    kind: item.kind,
    mimeType: item.mimeType,
    extension: item.extension,
    byteSize: item.blob.size,
    width: item.width,
    height: item.height,
    sequence: item.sequence,
  }))
}

export function resolveSessionUploadPairs(
  localItems: BrowserSessionItem[],
  remoteItems: InitCloudCaptureSessionResponse['items'],
): Array<{
  localItem: BrowserSessionItem
  remoteItem: InitCloudCaptureSessionResponse['items'][number]
}> {
  const localItemsBySequence = new Map(
    localItems.map((item) => [item.sequence, item] as const),
  )

  return remoteItems.map((remoteItem) => {
    const localItem = localItemsBySequence.get(remoteItem.sequence)

    if (!localItem) {
      throw new Error(`Không tìm thấy item local cho sequence ${remoteItem.sequence}.`)
    }

    return {
      localItem,
      remoteItem,
    }
  })
}
