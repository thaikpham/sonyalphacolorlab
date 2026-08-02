import type { CSSProperties, RefObject } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'

import cheeseLogo from '../../../cheese_icon_transparent.svg'
import { APP_NAME } from '../../lib/branding'
import type {
  BrowserCaptureSessionState,
  KioskProfile,
  OperatorSettings,
  PermissionState,
  RecordingProgressIndicator,
  StreamState,
} from '../../types'
import { BrowserSessionFilmStripRail } from './BrowserSessionFilmStripRail'
import { CapturePreview } from './CapturePreview'
import { CapturePreviewTelemetry } from './CapturePreviewTelemetry'

export function CaptureShellHeader({
  profile,
  isBusy,
  countdownValue,
  onToggleOrientation,
}: {
  profile: KioskProfile
  isBusy: boolean
  countdownValue: number | null
  onToggleOrientation: () => void
}) {
  const OrientationIcon = profile === 'portrait' ? Monitor : Smartphone
  const orientationHint =
    profile === 'portrait' ? 'Chuyển sang landscape' : 'Chuyển sang portrait'

  return (
    <header className="capture-shell-header">
      <Link to="/" className="capture-brand-link">
        <span className="capture-brand-mark">
          <img
            src={cheeseLogo}
            alt=""
            className="capture-brand-logo"
            width={28}
            height={22}
          />
        </span>
        <span className="capture-brand-stack">
          <span className="capture-brand-name">{APP_NAME}</span>
          <span className="capture-brand-note">Capture Console</span>
        </span>
      </Link>
      <button
        type="button"
        className="capture-orientation-toggle capture-orientation-toggle--icon-only"
        onClick={onToggleOrientation}
        disabled={isBusy || countdownValue !== null}
        aria-label={orientationHint}
        title={orientationHint}
      >
        <OrientationIcon size={18} />
      </button>
    </header>
  )
}

interface CaptureStageSectionProps {
  variant: 'portrait' | 'landscape'
  profile: KioskProfile
  settings: OperatorSettings
  previewAspect: string
  previewFrameRef: RefObject<HTMLDivElement | null>
  previewCanvasRef: RefObject<HTMLCanvasElement | null>
  permissionState: PermissionState
  streamState: StreamState
  sourceUnavailable: boolean
  lastError: string | null
  countdownValue: number | null
  recordingProgress: RecordingProgressIndicator | null
  performanceNotice: string | null
  performanceNoticeTone: 'neutral' | 'warn'
  disabled: boolean
  modeLocked: boolean
  performanceEnabled: boolean
  onRetryPermission: () => void
  onRefreshSources: () => void
  onModeChange: (mode: OperatorSettings['captureMode']) => void
  onCountdownChange: (countdownSec: OperatorSettings['countdownSec']) => void
  onSetRotationQuarter: (rotationQuarter: OperatorSettings['rotationQuarter']) => void
  onFlipHorizontal: () => void
  onFlipVertical: () => void
}

export function CaptureStageSection({
  variant,
  profile,
  settings,
  previewAspect,
  previewFrameRef,
  previewCanvasRef,
  permissionState,
  streamState,
  sourceUnavailable,
  lastError,
  countdownValue,
  recordingProgress,
  performanceNotice,
  performanceNoticeTone,
  disabled,
  modeLocked,
  performanceEnabled,
  onRetryPermission,
  onRefreshSources,
  onModeChange,
  onCountdownChange,
  onSetRotationQuarter,
  onFlipHorizontal,
  onFlipVertical,
}: CaptureStageSectionProps) {
  const telemetry = (
    <CapturePreviewTelemetry
      profile={profile}
      settings={settings}
      disabled={disabled}
      modeLocked={modeLocked}
      performanceEnabled={performanceEnabled}
      onModeChange={onModeChange}
      onCountdownChange={onCountdownChange}
      onSetRotationQuarter={onSetRotationQuarter}
      onFlipHorizontal={onFlipHorizontal}
      onFlipVertical={onFlipVertical}
    />
  )

  if (variant === 'portrait') {
    return (
      <>
        <div className="capture-stage-meta capture-stage-meta--portrait">{telemetry}</div>
        <div className="capture-stage capture-stage--portrait">
          <div
            className="capture-stage-wrapper capture-stage-wrapper--portrait-only"
            style={{ '--aspect-ratio': 3 / 4 } as CSSProperties}
          >
            <CapturePreview
              previewAspect={previewAspect}
              previewFrameRef={previewFrameRef}
              previewCanvasRef={previewCanvasRef}
              permissionState={permissionState}
              streamState={streamState}
              sourceUnavailable={sourceUnavailable}
              lastError={lastError}
              countdownValue={countdownValue}
              recordingProgress={recordingProgress}
              performanceNotice={performanceNotice}
              performanceNoticeTone={performanceNoticeTone}
              onRetryPermission={onRetryPermission}
              onRefreshSources={onRefreshSources}
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="capture-stage">
      <div
        className="capture-stage-wrapper capture-stage-wrapper--landscape"
        style={{ '--aspect-ratio': 4 / 3 } as CSSProperties}
      >
        <div className="capture-stage-meta">{telemetry}</div>
        <CapturePreview
          previewAspect={previewAspect}
          previewFrameRef={previewFrameRef}
          previewCanvasRef={previewCanvasRef}
          permissionState={permissionState}
          streamState={streamState}
          sourceUnavailable={sourceUnavailable}
          lastError={lastError}
          countdownValue={countdownValue}
          recordingProgress={recordingProgress}
          performanceNotice={performanceNotice}
          performanceNoticeTone={performanceNoticeTone}
          onRetryPermission={onRetryPermission}
          onRefreshSources={onRefreshSources}
        />
      </div>
    </div>
  )
}

export function CaptureSessionTraySection({
  session,
  layout,
  uiDensity,
  canRemoveItems,
  onRemoveItem,
}: {
  session: BrowserCaptureSessionState
  layout: 'portrait' | 'landscape'
  uiDensity: 'roomy' | 'compact' | 'dense'
  canRemoveItems: boolean
  onRemoveItem: (itemId: string) => void
}) {
  return (
    <BrowserSessionFilmStripRail
      session={session}
      layout={layout}
      uiDensity={uiDensity}
      canRemoveItems={canRemoveItems}
      onRemoveItem={onRemoveItem}
    />
  )
}
