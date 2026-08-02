import { startTransition } from 'react'

import { playCountdownCue, playShutterCue } from '../../lib/captureSounds'
import {
  renderBoomerangFromVideo,
  renderPhotoFromVideo,
  type RenderedCapture,
} from '../../lib/media'
import type {
  BrowserSessionItem,
  CaptureMode,
  CaptureOutcome,
  RecordingProgressIndicator,
  TransformSettings,
} from '../../types'

const SHUTTER_CAPTURE_DELAY_MS = 180

export async function runCaptureCountdown({
  countdownSec,
  setCountdownValue,
}: {
  countdownSec: number
  setCountdownValue: (value: number | null) => void
}): Promise<void> {
  if (countdownSec <= 0) {
    setCountdownValue(null)
    void playShutterCue()
    return
  }

  for (let tick = countdownSec; tick >= 0; tick -= 1) {
    setCountdownValue(tick)
    if (tick === 0) {
      void playShutterCue()
    } else {
      void playCountdownCue(tick)
    }
    await new Promise((resolve) => {
      window.setTimeout(resolve, tick === 0 ? SHUTTER_CAPTURE_DELAY_MS : 1000)
    })
  }

  setCountdownValue(null)
}

export async function renderCaptureFromVideo({
  kind,
  video,
  transform,
  outputAspectRatio,
  onRecordingProgress,
}: {
  kind: CaptureMode
  video: HTMLVideoElement
  transform: TransformSettings
  outputAspectRatio: number
  onRecordingProgress: (progress: RecordingProgressIndicator) => void
}): Promise<RenderedCapture> {
  if (kind === 'photo') {
    return renderPhotoFromVideo(video, transform, outputAspectRatio)
  }

  if (kind === 'boomerang') {
    return renderBoomerangFromVideo(video, transform, outputAspectRatio, {
      onProgress: (progress) => {
        startTransition(() => {
          onRecordingProgress(progress)
        })
      },
    })
  }

  throw new Error('Performance recording sử dụng pipeline riêng.')
}

export function createCaptureOutcome(
  kind: CaptureMode,
  rendered: RenderedCapture,
): CaptureOutcome {
  return {
    kind,
    previewUrl: window.URL.createObjectURL(rendered.blob),
    mimeType: rendered.mimeType,
    width: rendered.width,
    height: rendered.height,
  }
}

export function createStagedBrowserSessionItem({
  kind,
  sequence,
  rendered,
  previewUrl,
}: {
  kind: CaptureMode
  sequence: number
  rendered: RenderedCapture
  previewUrl: string
}): BrowserSessionItem {
  const posterUrl = rendered.posterBlob
    ? window.URL.createObjectURL(rendered.posterBlob)
    : previewUrl

  return {
    id: crypto.randomUUID(),
    kind,
    sequence,
    createdAt: Date.now(),
    previewUrl,
    posterUrl,
    mimeType: rendered.mimeType,
    extension: rendered.extension,
    width: rendered.width,
    height: rendered.height,
    blob: rendered.blob,
  }
}
