import type { RefObject } from 'react'
import { useNavigate } from 'react-router-dom'

import { getCaptureModeLabel } from '../lib/captureModes'
import {
  getCaptureRoute,
  getKioskPreviewAspect,
  getSettingsRoute,
} from '../lib/kioskProfiles'
import type {
  BrowserCaptureSessionState,
  CaptureOutcome,
  KioskProfile,
  OperatorSettings,
  PerformanceAudioState,
  PermissionState,
  RecordingProgressIndicator,
  SourceDescriptor,
  StreamState,
} from '../types'
import '../styles/capture-enterprise.css'
import { BrowserSessionOverlay } from './capture/BrowserSessionOverlay'
import {
  CaptureSessionTraySection,
  CaptureShellHeader,
  CaptureStageSection,
} from './capture/CaptureScreenSections'
import { CaptureSideRail } from './capture/CaptureSideRail'
import { useCaptureViewport } from './capture/captureViewport'

interface CaptureScreenProps {
  profile: KioskProfile
  settings: OperatorSettings
  sources: SourceDescriptor[]
  performanceAudio: PerformanceAudioState
  permissionState: PermissionState
  streamState: StreamState
  lastError: string | null
  isBusy: boolean
  countdownValue: number | null
  recordingProgress: RecordingProgressIndicator | null
  captureOutcome: CaptureOutcome | null
  browserSession: BrowserCaptureSessionState
  previewFrameRef: RefObject<HTMLDivElement | null>
  previewCanvasRef: RefObject<HTMLCanvasElement | null>
  onRetryPermission: () => void
  onRefreshSources: () => void
  onShutter: () => void
  onStartBrowserSession: () => void
  onFinalizeBrowserSession: () => void
  onRetryBrowserSessionShare: () => void
  onCancelBrowserSession: () => void
  onResetBrowserSession: () => void
  onRemoveBrowserSessionItem: (itemId: string) => void
  onModeChange: (mode: OperatorSettings['captureMode']) => void
  onCountdownChange: (countdownSec: OperatorSettings['countdownSec']) => void
  onSetRotationQuarter: (
    rotationQuarter: OperatorSettings['rotationQuarter'],
  ) => void
  onFlipHorizontal: () => void
  onFlipVertical: () => void
  onApproveCaptureOutcome: () => void
  onRejectCaptureOutcome: () => void
}

export function CaptureScreen({
  profile,
  settings,
  sources,
  performanceAudio,
  permissionState,
  streamState,
  lastError,
  isBusy,
  countdownValue,
  recordingProgress,
  captureOutcome,
  browserSession,
  previewFrameRef,
  previewCanvasRef,
  onRetryPermission,
  onRefreshSources,
  onShutter,
  onStartBrowserSession,
  onFinalizeBrowserSession,
  onRetryBrowserSessionShare,
  onCancelBrowserSession,
  onResetBrowserSession,
  onRemoveBrowserSessionItem,
  onModeChange,
  onCountdownChange,
  onSetRotationQuarter,
  onFlipHorizontal,
  onFlipVertical,
  onApproveCaptureOutcome,
  onRejectCaptureOutcome,
}: CaptureScreenProps) {
  const navigate = useNavigate()
  const { uiDensity, deviceKind } = useCaptureViewport(profile)

  const previewAspect = getKioskPreviewAspect(profile)
  const captureModeLabel = getCaptureModeLabel(settings.captureMode)
  const sourceUnavailable = streamState === 'missing-device' || sources.length === 0
  const isPerformanceRecording = recordingProgress?.mode === 'performance'
  const sessionShutterLocked =
    browserSession.status !== 'active' ||
    browserSession.items.length >= browserSession.maxItems
  const shutterDisabled =
    (isBusy && !isPerformanceRecording) ||
    permissionState !== 'granted' ||
    streamState !== 'live' ||
    sessionShutterLocked

  const handleOrientationToggle = () => {
    const newProfile: KioskProfile = profile === 'portrait' ? 'landscape' : 'portrait'
    navigate(getCaptureRoute(newProfile))
  }

  const controlDock = (
    <CaptureSideRail
      layout={profile}
      uiDensity={uiDensity}
      captureMode={settings.captureMode}
      captureModeLabel={captureModeLabel}
      recordingMode={recordingProgress?.mode ?? null}
      browserSession={browserSession}
      shutterDisabled={shutterDisabled}
      onOpenSettings={() => navigate(getSettingsRoute(profile))}
      onShutter={onShutter}
      onStartBrowserSession={onStartBrowserSession}
      onFinalizeBrowserSession={onFinalizeBrowserSession}
      onRetryBrowserSessionShare={onRetryBrowserSessionShare}
      onCancelBrowserSession={onCancelBrowserSession}
      onResetBrowserSession={onResetBrowserSession}
    />
  )

  const sessionTray = (
    <CaptureSessionTraySection
      session={browserSession}
      layout={profile}
      uiDensity={uiDensity}
      canRemoveItems={
        browserSession.status === 'active' && !isBusy && countdownValue === null
      }
      onRemoveItem={onRemoveBrowserSessionItem}
    />
  )

  const stage = (
    <CaptureStageSection
      variant={profile}
      profile={profile}
      settings={settings}
      previewAspect={previewAspect}
      previewFrameRef={previewFrameRef}
      previewCanvasRef={previewCanvasRef}
      permissionState={permissionState}
      streamState={streamState}
      sourceUnavailable={sourceUnavailable}
      lastError={lastError}
      countdownValue={countdownValue}
      recordingProgress={recordingProgress}
      performanceNotice={
        settings.captureMode === 'performance' && performanceAudio.status !== 'paired'
          ? performanceAudio.message
          : null
      }
      performanceNoticeTone={performanceAudio.status === 'paired' ? 'neutral' : 'warn'}
      disabled={isBusy || countdownValue !== null}
      modeLocked={browserSession.status !== 'idle'}
      performanceEnabled={performanceAudio.recordingSupported}
      onRetryPermission={onRetryPermission}
      onRefreshSources={onRefreshSources}
      onModeChange={onModeChange}
      onCountdownChange={onCountdownChange}
      onSetRotationQuarter={onSetRotationQuarter}
      onFlipHorizontal={onFlipHorizontal}
      onFlipVertical={onFlipVertical}
    />
  )

  const header = (
    <CaptureShellHeader
      profile={profile}
      isBusy={isBusy}
      countdownValue={countdownValue}
      onToggleOrientation={handleOrientationToggle}
    />
  )

  return (
    <section className="capture-screen capture-screen--enterprise">
      <div
        className={[
          'capture-panel',
          'capture-panel--enterprise',
          `capture-panel--${profile}`,
        ].join(' ')}
      >
        {profile === 'portrait' ? (
          <div
            className={`capture-shell capture-shell--portrait is-${uiDensity} device-${deviceKind}`}
            data-device={deviceKind}
          >
            {header}
            {stage}
            {controlDock}
            {sessionTray}
          </div>
        ) : (
          <div
            className={`capture-shell capture-shell--landscape is-${uiDensity} device-${deviceKind}`}
            data-device={deviceKind}
          >
            {stage}
            <div className="capture-support-region capture-support-region--landscape">
              {header}
              {sessionTray}
              {controlDock}
            </div>
          </div>
        )}
      </div>

      <BrowserSessionOverlay
        session={browserSession}
        outcome={captureOutcome}
        onApproveOutcome={onApproveCaptureOutcome}
        onRejectOutcome={onRejectCaptureOutcome}
        onRetrySessionShare={onRetryBrowserSessionShare}
        onResetBrowserSession={onResetBrowserSession}
      />
    </section>
  )
}
