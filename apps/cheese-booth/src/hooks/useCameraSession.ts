import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'

import { getPerformanceRecordingSupport } from '../lib/media'
import {
  type AudioSourceDescriptor,
  DEFAULT_CAMERA_SESSION_STATE,
  type CameraSessionState,
  type OperatorSettings,
  type PerformanceAudioState,
  type SourceDescriptor,
} from '../types'
import { resolveAudioSourceRefresh } from './cameraSession/audioSourceRefresh'
import {
  getUnsupportedCameraSessionState,
  resolvePermissionProbeState,
} from './cameraSession/permissionState'
import { resolveCameraSourceRefresh } from './cameraSession/sourceRefresh'
import {
  maximizeVideoTrackResolution,
  releaseAttachedStream,
} from './cameraSession/streamLifecycle'
import {
  getMediaErrorMessage,
  isMissingDeviceMediaError,
  isPermissionDeniedMediaError,
  isRecoverableMediaStreamError,
  supportsCameraAccess,
  toAudioSourceDescriptor,
  toSourceDescriptor,
} from './kioskControllerUtils'

interface UseCameraSessionOptions {
  settings: OperatorSettings
  setSettings: Dispatch<SetStateAction<OperatorSettings>>
  videoRef: RefObject<HTMLVideoElement | null>
}

interface UseCameraSessionResult {
  sources: SourceDescriptor[]
  audioSources: AudioSourceDescriptor[]
  performanceAudio: PerformanceAudioState
  cameraSession: CameraSessionState
  setCameraSession: Dispatch<SetStateAction<CameraSessionState>>
  openCapture: () => Promise<void>
  refreshSources: () => Promise<void>
  retryPermission: () => Promise<boolean>
}

function toPerformanceAudioState(
  state: Omit<PerformanceAudioState, 'recordingSupported' | 'recordingMimeType'>,
): PerformanceAudioState {
  const support = getPerformanceRecordingSupport()

  if (!support.supported) {
    return {
      status: 'unsupported',
      message: 'Runtime hiện tại không hỗ trợ MP4 native cho 60s Performance.',
      selectedLabel: null,
      recordingSupported: false,
      recordingMimeType: null,
    }
  }

  return {
    ...state,
    recordingSupported: true,
    recordingMimeType: support.mimeType,
  }
}

export function useCameraSession({
  settings,
  setSettings,
  videoRef,
}: UseCameraSessionOptions): UseCameraSessionResult {
  const [sources, setSources] = useState<SourceDescriptor[]>([])
  const [audioSources, setAudioSources] = useState<AudioSourceDescriptor[]>([])
  const [performanceAudio, setPerformanceAudio] = useState<PerformanceAudioState>(
    () =>
      toPerformanceAudioState({
        status: 'unavailable',
        message: 'Chưa dò được audio HDMI cho 60s Performance.',
        selectedLabel: null,
      }),
  )
  const [cameraSession, setCameraSession] = useState(DEFAULT_CAMERA_SESSION_STATE)
  const streamRef = useRef<MediaStream | null>(null)

  const releaseStream = useCallback(async (stream: MediaStream | null): Promise<void> => {
    await releaseAttachedStream({
      stream,
      streamRef,
      videoRef,
    })
  }, [videoRef])

  const syncMissingDeviceState = useEffectEvent(() => {
    void refreshSourcesInternal(true, true)
  })

  useEffect(() => {
    let cancelled = false

    if (cameraSession.permissionState !== 'granted') {
      void releaseStream(streamRef.current)
      setCameraSession((current) => ({
        ...current,
        streamState:
          current.streamState === 'error' || current.streamState === 'missing-device'
            ? current.streamState
            : 'idle',
      }))
      return
    }

    if (!settings.deviceId) {
      void releaseStream(streamRef.current)
      setCameraSession((current) => ({
        ...current,
        streamState: sources.length > 0 ? 'missing-device' : 'idle',
      }))
      return
    }

    const deviceId = settings.deviceId

    async function startStream(): Promise<void> {
      if (!supportsCameraAccess()) {
        setCameraSession((current) => ({
          ...current,
          ...getUnsupportedCameraSessionState(),
        }))
        return
      }

      setCameraSession((current) => ({ ...current, streamState: 'starting' }))
      await releaseStream(streamRef.current)

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 4096 },
            height: { ideal: 3072 },
            facingMode: 'user',
          },
        })

        await maximizeVideoTrackResolution(mediaStream)

        if (cancelled) {
          await releaseAttachedStream({
            stream: mediaStream,
            streamRef,
            videoRef,
          })
          return
        }

        streamRef.current = mediaStream

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          await videoRef.current.play().catch(() => undefined)
        }

        setCameraSession((current) => ({
          ...current,
          streamState: 'live',
          lastError: null,
        }))
      } catch (error) {
        if (cancelled) return

        const lastError = getMediaErrorMessage(error)

        if (isPermissionDeniedMediaError(error)) {
          setCameraSession((current) => ({
            ...current,
            permissionState: 'denied',
            streamState: 'idle',
            lastError,
          }))
          return
        }

        if (isMissingDeviceMediaError(error)) {
          setCameraSession((current) => ({
            ...current,
            permissionState: 'granted',
            streamState: 'missing-device',
            lastError,
          }))
          syncMissingDeviceState()
          return
        }

        setCameraSession((current) => ({
          ...current,
          permissionState:
            isRecoverableMediaStreamError(error) ? 'granted' : current.permissionState,
          streamState: 'error',
          lastError,
        }))
      }
    }

    void startStream()

    return () => {
      cancelled = true
    }
  }, [cameraSession.permissionState, releaseStream, settings.deviceId, sources.length, videoRef])

  useEffect(() => {
    return () => {
      void releaseStream(streamRef.current)
    }
  }, [releaseStream, videoRef])

  async function ensurePermission(): Promise<boolean> {
    if (!supportsCameraAccess()) {
      setCameraSession((current) => ({
        ...current,
        ...getUnsupportedCameraSessionState(),
      }))

      return false
    }

    try {
      const probe = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      })

      probe.getTracks().forEach((track) => track.stop())

      setCameraSession((current) => ({
        ...current,
        ...resolvePermissionProbeState(null),
      }))

      return true
    } catch (error) {
      setCameraSession((current) => ({
        ...current,
        ...resolvePermissionProbeState(error),
      }))

      return false
    }
  }

  async function refreshSourcesInternal(
    isDeviceChange = false,
    hasPermission = cameraSession.permissionState === 'granted',
  ): Promise<void> {
    if (!supportsCameraAccess()) {
      setCameraSession((current) => ({
        ...current,
        streamState: 'error',
        lastError: 'Runtime hiện tại không hỗ trợ camera.',
      }))
      return
    }

    if (!hasPermission) {
      return
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoSources = devices
        .filter((device) => device.kind === 'videoinput')
        .map(toSourceDescriptor)
      const nextAudioSources = devices
        .filter((device) => device.kind === 'audioinput')
        .map(toAudioSourceDescriptor)
      const refreshResolution = resolveCameraSourceRefresh({
        sources: videoSources,
        selectedDeviceId: settings.deviceId,
        isDeviceChange,
      })
      const nextVideoDeviceId = refreshResolution.shouldSelectDevice
        ? refreshResolution.nextDeviceId
        : refreshResolution.shouldClearDevice
          ? null
          : settings.deviceId
      const audioResolution = resolveAudioSourceRefresh({
        audioSources: nextAudioSources,
        selectedAudioDeviceId: settings.audioDeviceId,
        videoSources,
        selectedVideoDeviceId: nextVideoDeviceId,
      })

      setSources(videoSources)
      setAudioSources(nextAudioSources)
      setPerformanceAudio(toPerformanceAudioState(audioResolution.audioState))

      if (
        (refreshResolution.shouldSelectDevice && refreshResolution.nextDeviceId) ||
        refreshResolution.shouldClearDevice ||
        audioResolution.shouldSelectAudioDevice ||
        audioResolution.shouldClearAudioDevice
      ) {
        setSettings((current) => {
          const resolvedDeviceId = refreshResolution.shouldSelectDevice
            ? refreshResolution.nextDeviceId
            : refreshResolution.shouldClearDevice
              ? null
              : current.deviceId
          const resolvedAudioDeviceId = audioResolution.shouldSelectAudioDevice
            ? audioResolution.nextAudioDeviceId
            : audioResolution.shouldClearAudioDevice
              ? null
              : current.audioDeviceId

          if (
            current.deviceId === resolvedDeviceId &&
            current.audioDeviceId === resolvedAudioDeviceId
          ) {
            return current
          }

          return {
            ...current,
            deviceId: resolvedDeviceId,
            audioDeviceId: resolvedAudioDeviceId,
          }
        })
      }

      if (refreshResolution.shouldSelectDevice && refreshResolution.nextDeviceId) {
        if (isDeviceChange) {
          setCameraSession((current) => ({
            ...current,
            lastError: null,
          }))
        }

        return
      }

      if (refreshResolution.shouldClearDevice) {
        await releaseStream(streamRef.current)
        setCameraSession((current) => ({
          ...current,
          streamState: refreshResolution.streamState ?? current.streamState,
          lastError: refreshResolution.lastError,
        }))
      }
    } catch (error) {
      setCameraSession((current) => ({
        ...current,
        streamState: 'error',
        lastError: getMediaErrorMessage(error),
      }))
    }
  }

  const handleDeviceChange = useEffectEvent(() => {
    void refreshSourcesInternal(true)
  })

  useEffect(() => {
    if (!supportsCameraAccess() || typeof navigator.mediaDevices.addEventListener !== 'function') {
      return
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [])

  async function openCapture(): Promise<void> {
    setCameraSession((current) => ({
      ...current,
      lastError: null,
    }))

    const hasPermission = await ensurePermission()

    if (!hasPermission) {
      return
    }

    await refreshSourcesInternal(false, true)
  }

  async function retryPermission(): Promise<boolean> {
    const granted = await ensurePermission()

    if (granted) {
      await refreshSourcesInternal(false, true)
    }

    return granted
  }

  return {
    sources,
    audioSources,
    performanceAudio,
    cameraSession,
    setCameraSession,
    openCapture,
    refreshSources: () => refreshSourcesInternal(false),
    retryPermission,
  }
}
