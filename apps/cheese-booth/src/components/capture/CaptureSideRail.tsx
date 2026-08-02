import { Settings2 } from 'lucide-react'

import { getCaptureModeDockLabel } from '../../lib/captureModes'
import type { BrowserCaptureSessionState, CaptureMode } from '../../types'
import { SessionFlowButton } from './SessionFlowButton'
import { getSessionFlowResetKey } from './sessionButtonState'

interface CaptureSideRailProps {
  layout: 'portrait' | 'landscape'
  uiDensity: 'roomy' | 'compact' | 'dense'
  captureMode: CaptureMode
  captureModeLabel: string
  recordingMode: 'boomerang' | 'performance' | null
  browserSession: BrowserCaptureSessionState
  shutterDisabled: boolean
  onOpenSettings: () => void
  onShutter: () => void
  onStartBrowserSession?: () => void
  onFinalizeBrowserSession?: () => void
  onRetryBrowserSessionShare?: () => void
  onCancelBrowserSession?: () => void
  onResetBrowserSession?: () => void
}

export function CaptureSideRail({
  layout,
  uiDensity,
  captureMode,
  captureModeLabel,
  recordingMode,
  browserSession,
  shutterDisabled,
  onOpenSettings,
  onShutter,
  onStartBrowserSession,
  onFinalizeBrowserSession,
  onRetryBrowserSessionShare,
  onCancelBrowserSession,
  onResetBrowserSession,
}: CaptureSideRailProps) {
  const sessionCountLabel = `${browserSession.items.length}/${browserSession.maxItems}`

  return (
    <aside
      className={[
        'capture-control-dock',
        `capture-control-dock--${layout}`,
        `capture-control-dock--${uiDensity}`,
      ].join(' ')}
      data-density={uiDensity}
      aria-label="Capture controls"
    >
      <div className="capture-bottom-controls">
        <button
          className="capture-dock-button"
          type="button"
          onClick={onOpenSettings}
          aria-label="Mở cài đặt"
        >
          <Settings2 size={24} />
          <span className="capture-dock-button-label">Cài đặt</span>
        </button>

        <div className="capture-shutter-stack">
          <button
            className="capture-shutter-button"
            onClick={onShutter}
            disabled={shutterDisabled}
            aria-label={
              recordingMode === 'performance'
                ? 'Dừng 60s Performance'
                : `Chụp ${captureModeLabel}`
            }
          >
            <span className="capture-shutter-ring" />
            <span className="capture-shutter-core" />
          </button>
          <p className="capture-shutter-label">
            {recordingMode === 'performance'
              ? '⏹ Dừng Performance'
              : getCaptureModeDockLabel(captureMode)}
          </p>
        </div>

        <SessionFlowButton
          key={getSessionFlowResetKey(browserSession)}
          browserSession={browserSession}
          sessionCountLabel={sessionCountLabel}
          onStartBrowserSession={onStartBrowserSession}
          onFinalizeBrowserSession={onFinalizeBrowserSession}
          onRetryBrowserSessionShare={onRetryBrowserSessionShare}
          onCancelBrowserSession={onCancelBrowserSession}
          onResetBrowserSession={onResetBrowserSession}
        />
      </div>
    </aside>
  )
}
