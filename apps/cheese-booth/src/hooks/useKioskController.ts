import { useRef } from 'react'

import type { KioskProfile } from '../types'
import { useCameraSession } from './useCameraSession'
import { useCaptureActions } from './useCaptureActions'
import { useOperatorSettings } from './useOperatorSettings'
import { usePreviewCanvas } from './usePreviewCanvas'

export function useKioskController(profile: KioskProfile) {
  const previewFrameRef = useRef<HTMLDivElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const { settings, settingsReady, setSettings, updateSettings } =
    useOperatorSettings(profile)

  usePreviewCanvas({
    previewFrameRef,
    previewCanvasRef,
    videoRef,
    profile,
    settings,
  })

  const {
    sources,
    audioSources,
    performanceAudio,
    cameraSession,
    setCameraSession,
    openCapture,
    refreshSources,
    retryPermission,
  } =
    useCameraSession({
      settings,
      setSettings,
      videoRef,
    })

  const {
    isBusy,
    countdownValue,
    recordingProgress,
    captureOutcome,
    browserSession,
    handleShutter,
    startBrowserSession,
    finalizeBrowserSession,
    retryBrowserSessionShare,
    cancelBrowserSession,
    resetBrowserSession,
    removeBrowserSessionItem,
    approveCaptureOutcome,
    rejectCaptureOutcome,
    setMode,
    setCountdown,
    setRotationQuarter,
    rotate,
    toggleFlipHorizontal,
    toggleFlipVertical,
    setDevice,
    setAudioDevice,
  } = useCaptureActions({
    profile,
    settings,
    setSettings,
    setCameraSession,
    updateSettings,
    videoRef,
  })

  return {
    settings,
    settingsReady,
    sources,
    audioSources,
    performanceAudio,
    cameraSession,
    isBusy,
    countdownValue,
    recordingProgress,
    captureOutcome,
    browserSession,
    previewFrameRef,
    previewCanvasRef,
    videoRef,
    openCapture,
    refreshSources,
    retryPermission,
    handleShutter,
    startBrowserSession,
    finalizeBrowserSession,
    retryBrowserSessionShare,
    cancelBrowserSession,
    resetBrowserSession,
    removeBrowserSessionItem,
    approveCaptureOutcome,
    rejectCaptureOutcome,
    setMode,
    setCountdown,
    setRotationQuarter,
    rotate,
    toggleFlipHorizontal,
    toggleFlipVertical,
    setDevice,
    setAudioDevice,
  }
}
