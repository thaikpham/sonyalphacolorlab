import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'

import { getKioskProfileAspectRatio } from '../lib/kioskProfiles'
import {
  type RenderedCapture,
  startPerformanceRecording,
  type PerformanceRecordingController,
} from '../lib/media'
import {
  completeCloudCaptureSession,
  initCloudCaptureSession,
  uploadCaptureToSignedUrl,
} from '../lib/cloudShare'
import type {
  BrowserCaptureSessionState,
  BrowserSessionItem,
  CameraSessionState,
  CaptureMode,
  CaptureOutcome,
  CountdownSec,
  KioskProfile,
  OperatorSettings,
  RecordingProgressIndicator,
} from '../types'
import {
  disposeBrowserSessionItem,
  disposeCaptureOutcome,
} from './captureActions/blobLifecycle'
import {
  createCaptureOutcome,
  createStagedBrowserSessionItem,
  renderCaptureFromVideo,
  runCaptureCountdown,
} from './captureActions/captureRender'
import { createSettingsActionHandlers } from './captureActions/settingsActions'
import {
  mapSessionItemsToInitPayload,
  resolveSessionUploadPairs,
} from './captureActions/sessionUploadUtils'
import { useBrowserCaptureSession } from './useBrowserCaptureSession'
import { getMediaErrorMessage, transformFromSettings } from './kioskControllerUtils'

interface UseCaptureActionsOptions {
  profile: KioskProfile
  settings: OperatorSettings
  setSettings: Dispatch<SetStateAction<OperatorSettings>>
  setCameraSession: Dispatch<SetStateAction<CameraSessionState>>
  updateSettings: (next: Partial<OperatorSettings>) => void
  videoRef: RefObject<HTMLVideoElement | null>
}

interface UseCaptureActionsResult {
  isBusy: boolean
  countdownValue: number | null
  recordingProgress: RecordingProgressIndicator | null
  captureOutcome: CaptureOutcome | null
  browserSession: BrowserCaptureSessionState
  handleShutter: () => Promise<boolean>
  startBrowserSession: () => void
  finalizeBrowserSession: () => Promise<boolean>
  retryBrowserSessionShare: () => Promise<boolean>
  cancelBrowserSession: () => void
  resetBrowserSession: () => void
  removeBrowserSessionItem: (itemId: string) => void
  approveCaptureOutcome: () => void
  rejectCaptureOutcome: () => void
  setMode: (captureMode: CaptureMode) => void
  setCountdown: (countdownSec: CountdownSec) => void
  setRotationQuarter: (rotationQuarter: OperatorSettings['rotationQuarter']) => void
  rotate: () => void
  toggleFlipHorizontal: () => void
  toggleFlipVertical: () => void
  setDevice: (deviceId: string) => void
  setAudioDevice: (deviceId: string) => void
}

export function useCaptureActions({
  profile,
  settings,
  setSettings,
  setCameraSession,
  updateSettings,
  videoRef,
}: UseCaptureActionsOptions): UseCaptureActionsResult {
  const [isBusy, setIsBusy] = useState(false)
  const [countdownValue, setCountdownValue] = useState<number | null>(null)
  const [recordingProgress, setRecordingProgress] =
    useState<RecordingProgressIndicator | null>(null)
  const [captureOutcome, setCaptureOutcome] = useState<CaptureOutcome | null>(null)
  const [stagedBrowserItem, setStagedBrowserItem] = useState<BrowserSessionItem | null>(
    null,
  )
  const {
    browserSession,
    startBrowserSession: openBrowserSession,
    resetBrowserSession: clearBrowserSession,
    cancelBrowserSession: abortBrowserSession,
    enterReviewingShot,
    rejectReviewedShot,
    addSessionItem,
    removeSessionItem,
    startFinalizing,
    completeSessionShare,
    failSessionShare,
  } = useBrowserCaptureSession()
  const stagedBrowserItemRef = useRef<BrowserSessionItem | null>(null)
  const captureOutcomeRef = useRef<CaptureOutcome | null>(null)
  const performanceRecordingRef = useRef<PerformanceRecordingController | null>(null)
  const outputAspectRatio = getKioskProfileAspectRatio(profile)

  stagedBrowserItemRef.current = stagedBrowserItem
  captureOutcomeRef.current = captureOutcome

  const settingsActions = createSettingsActionHandlers({
    profile,
    updateSettings,
    setSettings,
  })

  useEffect(() => {
    return () => {
      performanceRecordingRef.current?.stop()
      disposeBrowserSessionItem(stagedBrowserItemRef.current)
      disposeCaptureOutcome(captureOutcomeRef.current)
    }
  }, [])

  async function captureAndStage(kind: 'photo' | 'boomerang'): Promise<{
    outcome: CaptureOutcome
    rendered: Awaited<ReturnType<typeof renderCaptureFromVideo>>
  }> {
    const video = videoRef.current

    if (!video || video.readyState < 2) {
      throw new Error('Preview chưa sẵn sàng để capture.')
    }

    const rendered = await renderCaptureFromVideo({
      kind,
      video,
      transform: transformFromSettings(settings),
      outputAspectRatio,
      onRecordingProgress: setRecordingProgress,
    })

    return {
      outcome: createCaptureOutcome(kind, rendered),
      rendered,
    }
  }

  async function recordPerformanceAndStage(): Promise<{
    outcome: CaptureOutcome
    rendered: RenderedCapture
  }> {
    const video = videoRef.current

    if (!video || video.readyState < 2) {
      throw new Error('Preview chưa sẵn sàng để quay performance.')
    }

    const controller = startPerformanceRecording({
      profile,
      video,
      transform: transformFromSettings(settings),
      audioDeviceId: settings.audioDeviceId,
      onProgress: setRecordingProgress,
      onAudioFallback: () => {
        setCameraSession((current) => ({
          ...current,
          lastError:
            'Không lấy được audio HDMI từ Cam Link. Clip này sẽ được lưu không tiếng.',
        }))
      },
    })

    performanceRecordingRef.current = controller

    const rendered = await controller.result

    return {
      outcome: createCaptureOutcome('performance', rendered),
      rendered,
    }
  }

  function clearStagedBrowserShot(): void {
    disposeBrowserSessionItem(stagedBrowserItemRef.current)
    stagedBrowserItemRef.current = null
    setStagedBrowserItem(null)
  }

  function clearCaptureOutcome(): void {
    disposeCaptureOutcome(captureOutcomeRef.current)
    captureOutcomeRef.current = null
    setCaptureOutcome(null)
  }

  function rejectCaptureOutcome(): void {
    clearCaptureOutcome()
    clearStagedBrowserShot()
    rejectReviewedShot()
  }

  function approveCaptureOutcome(): void {
    const stagedItem = stagedBrowserItemRef.current

    if (!stagedItem) {
      return
    }

    addSessionItem(stagedItem)
    stagedBrowserItemRef.current = null
    setStagedBrowserItem(null)
    setCaptureOutcome(null)
    captureOutcomeRef.current = null
  }

  function resetBrowserSessionFlow(): void {
    clearCaptureOutcome()
    clearStagedBrowserShot()
    clearBrowserSession()
  }

  function startBrowserSession(): void {
    resetBrowserSessionFlow()
    openBrowserSession(settings.captureMode)
  }

  function cancelBrowserSession(): void {
    clearCaptureOutcome()
    clearStagedBrowserShot()
    abortBrowserSession()
  }

  async function finalizeBrowserSession(): Promise<boolean> {
    if (isBusy || browserSession.items.length === 0 || recordingProgress !== null) {
      return false
    }

    setIsBusy(true)
    setCameraSession((current) => ({
      ...current,
      lastError: null,
    }))
    startFinalizing()

    try {
      const init = await initCloudCaptureSession(
        mapSessionItemsToInitPayload(browserSession.items),
      )

      await Promise.all(
        resolveSessionUploadPairs(browserSession.items, init.items).map(
          async ({ localItem, remoteItem }) => {
            await uploadCaptureToSignedUrl(remoteItem.upload, localItem.blob)
          },
        ),
      )

      const complete = await completeCloudCaptureSession(init.sessionId)

      completeSessionShare({
        sessionId: init.sessionId,
        downloadToken: complete.downloadToken,
        galleryUrl: complete.galleryUrl,
        expiresAt: complete.expiresAt,
      })

      return true
    } catch (error) {
      failSessionShare(
        error instanceof Error
          ? error.message
          : 'Không thể hoàn tất cloud session hiện tại.',
      )
    } finally {
      setIsBusy(false)
    }

    return false
  }

  async function handleShutter(): Promise<boolean> {
    if (performanceRecordingRef.current) {
      performanceRecordingRef.current.stop()
      return true
    }

    if (
      isBusy ||
      browserSession.status !== 'active' ||
      browserSession.items.length >= browserSession.maxItems
    ) {
      return false
    }

    setIsBusy(true)
    setRecordingProgress(null)
    setCameraSession((current) => ({ ...current, lastError: null }))
    clearCaptureOutcome()
    clearStagedBrowserShot()

    try {
      await runCaptureCountdown({
        countdownSec: Number(settings.countdownSec),
        setCountdownValue,
      })

      const { outcome, rendered } =
        settings.captureMode === 'performance'
          ? await recordPerformanceAndStage()
          : await captureAndStage(settings.captureMode)

      setCaptureOutcome(outcome)
      captureOutcomeRef.current = outcome

      const nextItem: BrowserSessionItem = createStagedBrowserSessionItem({
        kind: settings.captureMode,
        sequence: browserSession.items.length + 1,
        rendered,
        previewUrl: outcome.previewUrl,
      })

      stagedBrowserItemRef.current = nextItem
      setStagedBrowserItem(nextItem)
      enterReviewingShot()

      return true
    } catch (error) {
      setCameraSession((current) => ({
        ...current,
        lastError: getMediaErrorMessage(error),
      }))
    } finally {
      performanceRecordingRef.current = null
      setCountdownValue(null)
      setRecordingProgress(null)
      setIsBusy(false)
    }

    return false
  }

  return {
    isBusy,
    countdownValue,
    recordingProgress,
    captureOutcome,
    browserSession,
    handleShutter,
    startBrowserSession,
    finalizeBrowserSession,
    retryBrowserSessionShare: finalizeBrowserSession,
    cancelBrowserSession,
    resetBrowserSession: resetBrowserSessionFlow,
    removeBrowserSessionItem: removeSessionItem,
    approveCaptureOutcome,
    rejectCaptureOutcome,
    setMode: (captureMode) => {
      if (browserSession.status !== 'idle') {
        return
      }

      settingsActions.setMode(captureMode)
    },
    setCountdown: settingsActions.setCountdown,
    setRotationQuarter: settingsActions.setRotationQuarter,
    rotate: settingsActions.rotate,
    toggleFlipHorizontal: settingsActions.toggleFlipHorizontal,
    toggleFlipVertical: settingsActions.toggleFlipVertical,
    setDevice: settingsActions.setDevice,
    setAudioDevice: settingsActions.setAudioDevice,
  }
}
