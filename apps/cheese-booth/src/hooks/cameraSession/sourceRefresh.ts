import type { SourceDescriptor, StreamState } from '../../types'
import { pickBestDeviceId } from '../kioskControllerUtils'

export interface CameraSourceRefreshResolution {
  nextDeviceId: string | null
  shouldSelectDevice: boolean
  shouldClearDevice: boolean
  streamState: StreamState | null
  lastError: string | null
}

export function resolveCameraSourceRefresh({
  sources,
  selectedDeviceId,
  isDeviceChange,
}: {
  sources: SourceDescriptor[]
  selectedDeviceId: string | null
  isDeviceChange: boolean
}): CameraSourceRefreshResolution {
  const nextDeviceId = pickBestDeviceId(sources, selectedDeviceId)
  const currentStillExists =
    !!selectedDeviceId &&
    sources.some((source) => source.deviceId === selectedDeviceId)
  const shouldSelectDevice =
    !!nextDeviceId && (!selectedDeviceId || !currentStillExists)

  if (shouldSelectDevice) {
    return {
      nextDeviceId,
      shouldSelectDevice: true,
      shouldClearDevice: false,
      streamState: null,
      lastError: isDeviceChange ? null : null,
    }
  }

  if (selectedDeviceId && !currentStillExists && !nextDeviceId) {
    return {
      nextDeviceId: null,
      shouldSelectDevice: false,
      shouldClearDevice: true,
      streamState: 'missing-device',
      lastError: isDeviceChange
        ? 'Nguồn camera đang dùng đã bị ngắt. Hãy chọn lại source.'
        : null,
    }
  }

  return {
    nextDeviceId: selectedDeviceId,
    shouldSelectDevice: false,
    shouldClearDevice: false,
    streamState: null,
    lastError: null,
  }
}
