import type { RefObject } from 'react'

import { safeStopStream } from '../kioskControllerUtils'

export async function maximizeVideoTrackResolution(
  mediaStream: MediaStream,
): Promise<void> {
  const [videoTrack] = mediaStream.getVideoTracks()

  if (
    !videoTrack ||
    typeof videoTrack.getCapabilities !== 'function' ||
    typeof videoTrack.applyConstraints !== 'function'
  ) {
    return
  }

  const capabilities = videoTrack.getCapabilities()
  const nextConstraints: MediaTrackConstraints = {}

  if (typeof capabilities.width?.max === 'number' && capabilities.width.max > 0) {
    nextConstraints.width = { ideal: capabilities.width.max }
  }

  if (typeof capabilities.height?.max === 'number' && capabilities.height.max > 0) {
    nextConstraints.height = { ideal: capabilities.height.max }
  }

  if (Object.keys(nextConstraints).length === 0) {
    return
  }

  await videoTrack.applyConstraints(nextConstraints).catch(() => undefined)
}

export async function releaseAttachedStream({
  stream,
  streamRef,
  videoRef,
}: {
  stream: MediaStream | null
  streamRef: { current: MediaStream | null }
  videoRef: RefObject<HTMLVideoElement | null>
}): Promise<void> {
  await safeStopStream(stream)

  if (stream && streamRef.current === stream) {
    streamRef.current = null
  }

  const video = videoRef.current

  if (video && (!stream || video.srcObject === stream)) {
    video.pause()
    video.srcObject = null
  }
}
