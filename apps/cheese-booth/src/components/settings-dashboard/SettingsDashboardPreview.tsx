import {
  Camera,
  Clock3,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  Usb,
} from 'lucide-react'
import type { RefObject } from 'react'

import { getKioskProfileAspectLabel } from '../../lib/kioskProfiles'
import type {
  KioskProfile,
  OperatorSettings,
  PermissionState,
  SourceDescriptor,
  StreamState,
} from '../../types'
import { CapturePreview } from '../capture/CapturePreview'
import type { DashboardStatusSummary } from './settingsDashboardUtils'

interface SettingsDashboardPreviewProps {
  profile: KioskProfile
  settings: OperatorSettings
  sources: SourceDescriptor[]
  permissionState: PermissionState
  streamState: StreamState
  lastError: string | null
  previewFrameRef: RefObject<HTMLDivElement | null>
  previewCanvasRef: RefObject<HTMLCanvasElement | null>
  previewAspect: string
  isPortrait: boolean
  currentSourceLabel: string
  streamSummary: DashboardStatusSummary
  captureModeLabel: string
  onRetryPermission: () => void
  onRefreshSources: () => void
}

export function SettingsDashboardPreview({
  profile,
  settings,
  sources,
  permissionState,
  streamState,
  lastError,
  previewFrameRef,
  previewCanvasRef,
  previewAspect,
  isPortrait,
  currentSourceLabel,
  streamSummary,
  captureModeLabel,
  onRetryPermission,
  onRefreshSources,
}: SettingsDashboardPreviewProps) {
  return (
    <aside className={`sd-preview sd-preview--${profile}`}>
      <div className="sd-preview-shell">
        <div className="sd-preview-header">
          <div className="sd-preview-heading">
            <div className="sd-preview-label">Live Preview</div>
            <div className="sd-preview-title-row">
              <strong className="sd-preview-title">Kiosk Camera</strong>
              <span className="sd-preview-pill">
                <span className="sd-status-dot" data-tone={streamSummary.tone} />
                {streamSummary.label}
              </span>
            </div>
          </div>

          <div className="sd-preview-compact-meta">
            <span className="sd-preview-orientation">
              🧭 {getKioskProfileAspectLabel(profile)} {isPortrait ? 'portrait' : 'landscape'}
            </span>
          </div>
        </div>

        <div className="sd-preview-stage">
          <div className={`sd-preview-stage-shell ${isPortrait ? 'is-portrait' : 'is-landscape'}`}>
            <CapturePreview
              previewAspect={previewAspect}
              previewFrameRef={previewFrameRef}
              previewCanvasRef={previewCanvasRef}
              permissionState={permissionState}
              streamState={streamState}
              sourceUnavailable={streamState === 'missing-device' || sources.length === 0}
              lastError={lastError}
              countdownValue={null}
              onRetryPermission={onRetryPermission}
              onRefreshSources={onRefreshSources}
            />
          </div>
        </div>

        <div className="sd-preview-toolbar">
          <div className="sd-preview-chip">
            <Camera size={14} />
            <span>📷 {captureModeLabel}</span>
          </div>
          <div className="sd-preview-chip">
            <Clock3 size={14} />
            <span>⏱ {settings.countdownSec}s</span>
          </div>
          <div className="sd-preview-chip">
            <RotateCw size={14} />
            <span>{profile === 'portrait' ? '↻ R90' : `↻ ${settings.rotationQuarter * 90}°`}</span>
          </div>
          <div className="sd-preview-chip">
            <FlipHorizontal2 size={14} />
            <span>↔ H{settings.flipHorizontal ? '1' : '0'}</span>
          </div>
          <div className="sd-preview-chip">
            <FlipVertical2 size={14} />
            <span>↕ V{settings.flipVertical ? '1' : '0'}</span>
          </div>
          <div className="sd-preview-chip sd-preview-chip--wide" title={currentSourceLabel}>
            <Usb size={14} />
            <span>{currentSourceLabel}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
