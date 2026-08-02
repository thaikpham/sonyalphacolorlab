import type {
  AudioSourceDescriptor,
  PerformanceAudioState,
  SourceDescriptor,
} from '../../types'
import { pickBestAudioDeviceId } from '../kioskControllerUtils'

export interface AudioSourceRefreshResolution {
  nextAudioDeviceId: string | null
  shouldSelectAudioDevice: boolean
  shouldClearAudioDevice: boolean
  audioState: Omit<PerformanceAudioState, 'recordingSupported' | 'recordingMimeType'>
}

function findSourceLabel(
  sources: SourceDescriptor[],
  deviceId: string | null,
): string | null {
  if (!deviceId) {
    return null
  }

  return sources.find((source) => source.deviceId === deviceId)?.label ?? null
}

function findAudioLabel(
  sources: AudioSourceDescriptor[],
  deviceId: string | null,
): string | null {
  if (!deviceId) {
    return null
  }

  return sources.find((source) => source.deviceId === deviceId)?.label ?? null
}

export function resolveAudioSourceRefresh({
  audioSources,
  selectedAudioDeviceId,
  videoSources,
  selectedVideoDeviceId,
}: {
  audioSources: AudioSourceDescriptor[]
  selectedAudioDeviceId: string | null
  videoSources: SourceDescriptor[]
  selectedVideoDeviceId: string | null
}): AudioSourceRefreshResolution {
  const selectedVideoLabel = findSourceLabel(videoSources, selectedVideoDeviceId)
  const currentStillExists =
    !!selectedAudioDeviceId &&
    audioSources.some((source) => source.deviceId === selectedAudioDeviceId)

  if (currentStillExists) {
    return {
      nextAudioDeviceId: selectedAudioDeviceId,
      shouldSelectAudioDevice: false,
      shouldClearAudioDevice: false,
      audioState: {
        status: 'paired',
        message: `Audio HDMI: ${findAudioLabel(audioSources, selectedAudioDeviceId)}`,
        selectedLabel: findAudioLabel(audioSources, selectedAudioDeviceId),
      },
    }
  }

  if (audioSources.length === 0) {
    return {
      nextAudioDeviceId: null,
      shouldSelectAudioDevice: false,
      shouldClearAudioDevice: selectedAudioDeviceId !== null,
      audioState: {
        status: 'unavailable',
        message: 'Không thấy audio HDMI từ Cam Link. Performance sẽ quay không tiếng.',
        selectedLabel: null,
      },
    }
  }

  const pairedDeviceId = pickBestAudioDeviceId(
    audioSources,
    null,
    selectedVideoLabel,
  )
  const pairedLabel = findAudioLabel(audioSources, pairedDeviceId)
  const matchedByCaptureCard = pairedLabel
    ? audioSources.some(
        (source) =>
          source.deviceId === pairedDeviceId && source.isCamLinkPreferred,
      )
    : false

  if (!pairedDeviceId || !pairedLabel || !matchedByCaptureCard) {
    return {
      nextAudioDeviceId: null,
      shouldSelectAudioDevice: false,
      shouldClearAudioDevice: selectedAudioDeviceId !== null,
      audioState: {
        status: 'unavailable',
        message: 'Không thấy audio HDMI trùng với capture card đang dùng. Performance sẽ quay không tiếng.',
        selectedLabel: null,
      },
    }
  }

  return {
    nextAudioDeviceId: pairedDeviceId,
    shouldSelectAudioDevice: selectedAudioDeviceId !== pairedDeviceId,
    shouldClearAudioDevice: false,
    audioState: {
      status: 'paired',
      message: `Audio HDMI: ${pairedLabel}`,
      selectedLabel: pairedLabel,
    },
  }
}
