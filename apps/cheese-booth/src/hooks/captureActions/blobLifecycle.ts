import type { BrowserSessionItem, CaptureOutcome } from '../../types'

export function revokeBlobUrl(url?: string): void {
  if (url?.startsWith('blob:')) {
    window.URL.revokeObjectURL(url)
  }
}

export function disposeBrowserSessionItem(item: BrowserSessionItem | null): void {
  if (!item) {
    return
  }

  revokeBlobUrl(item.previewUrl)

  if (item.posterUrl !== item.previewUrl) {
    revokeBlobUrl(item.posterUrl)
  }
}

export function disposeCaptureOutcome(outcome: CaptureOutcome | null): void {
  if (!outcome) {
    return
  }

  revokeBlobUrl(outcome.previewUrl)
}
