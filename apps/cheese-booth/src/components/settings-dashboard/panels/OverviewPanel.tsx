import type { OperatorSettings } from '../../../types'
import type { RuntimeEnvironment } from '../../../lib/runtime'
import type { DashboardStatusSummary } from '../settingsDashboardUtils'
import type { PerformanceAudioState } from '../../../types'

interface SettingsDashboardOverviewPanelProps {
  settings: OperatorSettings
  captureModeLabel: string
  currentSourceLabel: string
  currentAudioSourceLabel: string
  performanceAudio: PerformanceAudioState
  runtime: RuntimeEnvironment
  permissionSummary: DashboardStatusSummary
  streamSummary: DashboardStatusSummary
  orientationLabel: string
  profileAspectLabel: string
  isBusy: boolean
  lastError: string | null
}

export function SettingsDashboardOverviewPanel({
  settings,
  captureModeLabel,
  currentSourceLabel,
  currentAudioSourceLabel,
  performanceAudio,
  runtime,
  permissionSummary,
  streamSummary,
  orientationLabel,
  profileAspectLabel,
  isBusy,
  lastError,
}: SettingsDashboardOverviewPanelProps) {
  return (
    <div className="sd-panel">
      <header className="sd-panel-header">
        <h2>Tổng quan</h2>
        <p className="sd-panel-sub">Trạng thái browser kiosk hiện tại</p>
      </header>

      <div className="sd-kv-grid">
        <div className="sd-kv">
          <span className="sd-kv-label">Chế độ chụp</span>
          <span className="sd-kv-value">{captureModeLabel}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Đếm ngược</span>
          <span className="sd-kv-value">{settings.countdownSec}s</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Camera</span>
          <span className="sd-kv-value">{currentSourceLabel}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Audio HDMI</span>
          <span className="sd-kv-value">{currentAudioSourceLabel}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Runtime</span>
          <span className="sd-kv-value">
            <span className="sd-status-dot" data-tone={runtime.tone} />
            {runtime.label}
          </span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Hướng</span>
          <span className="sd-kv-value">
            {orientationLabel} · {profileAspectLabel}
          </span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Share</span>
          <span className="sd-kv-value">
            <span className="sd-status-dot" data-tone={runtime.tone} />
            {runtime.storageSummary}
          </span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Flip</span>
          <span className="sd-kv-value">
            H: {settings.flipHorizontal ? 'Bật' : 'Tắt'} · V:{' '}
            {settings.flipVertical ? 'Bật' : 'Tắt'}
          </span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Đích gallery</span>
          <span className="sd-kv-value">{runtime.storageTargetLabel}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Performance</span>
          <span className="sd-kv-value">
            <span
              className="sd-status-dot"
              data-tone={performanceAudio.status === 'paired' ? 'good' : performanceAudio.status === 'unsupported' ? 'warn' : 'neutral'}
            />
            {performanceAudio.recordingSupported ? performanceAudio.message : 'MP4 native chưa hỗ trợ'}
          </span>
        </div>
      </div>

      <div className="sd-status-strip">
        <div className="sd-status-item">
          <span className="sd-status-dot" data-tone={permissionSummary.tone} />
          <span className="sd-status-text">Quyền: {permissionSummary.label}</span>
        </div>
        <div className="sd-status-item">
          <span className="sd-status-dot" data-tone={streamSummary.tone} />
          <span className="sd-status-text">Stream: {streamSummary.label}</span>
        </div>
        <div className="sd-status-item">
          <span className="sd-status-dot" data-tone={isBusy ? 'warn' : 'good'} />
          <span className="sd-status-text">{isBusy ? 'Đang xử lý' : 'Sẵn sàng'}</span>
        </div>
      </div>

      {lastError ? (
        <div className="sd-error-banner">
          <p>{lastError}</p>
        </div>
      ) : null}
    </div>
  )
}
