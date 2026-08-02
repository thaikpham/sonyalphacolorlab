import { RefreshCw, Settings2 } from 'lucide-react'

import type {
  AudioSourceDescriptor,
  OperatorSettings,
  PerformanceAudioState,
  PermissionState,
  SourceDescriptor,
} from '../../../types'
import type { DashboardStatusSummary } from '../settingsDashboardUtils'

interface SettingsDashboardCameraPanelProps {
  settings: OperatorSettings
  sources: SourceDescriptor[]
  audioSources: AudioSourceDescriptor[]
  performanceAudio: PerformanceAudioState
  permissionState: PermissionState
  isBusy: boolean
  permissionSummary: DashboardStatusSummary
  streamSummary: DashboardStatusSummary
  currentSourceLabel: string
  currentAudioSourceLabel: string
  onDeviceChange: (deviceId: string) => void
  onAudioDeviceChange: (deviceId: string) => void
  onRetryPermission: () => void
  onRefreshSources: () => void
}

export function SettingsDashboardCameraPanel({
  settings,
  sources,
  audioSources,
  performanceAudio,
  permissionState,
  isBusy,
  permissionSummary,
  streamSummary,
  currentSourceLabel,
  currentAudioSourceLabel,
  onDeviceChange,
  onAudioDeviceChange,
  onRetryPermission,
  onRefreshSources,
}: SettingsDashboardCameraPanelProps) {
  return (
    <div className="sd-panel">
      <header className="sd-panel-header">
        <h2>Camera</h2>
        <p className="sd-panel-sub">Chọn nguồn video, audio HDMI và quản lý quyền</p>
      </header>

      <div className="sd-field">
        <label className="sd-field-label">Nguồn camera</label>
        <select
          className="sd-input"
          value={settings.deviceId ?? ''}
          onChange={(event) => onDeviceChange(event.target.value)}
          disabled={permissionState !== 'granted' || isBusy || sources.length === 0}
        >
          <option value="">Chọn nguồn camera</option>
          {sources.map((source) => (
            <option key={source.deviceId} value={source.deviceId}>
              {source.isSonyPreferred ? '★ ' : ''}
              {source.label}
            </option>
          ))}
        </select>
      </div>

      <div className="sd-field">
        <label className="sd-field-label">Audio HDMI cho Performance</label>
        <select
          className="sd-input"
          value={settings.audioDeviceId ?? ''}
          onChange={(event) => onAudioDeviceChange(event.target.value)}
          disabled={permissionState !== 'granted' || isBusy || audioSources.length === 0}
        >
          <option value="">Auto pair / silent fallback</option>
          {audioSources.map((source) => (
            <option key={source.deviceId} value={source.deviceId}>
              {source.isCamLinkPreferred ? '★ ' : ''}
              {source.label}
            </option>
          ))}
        </select>
      </div>

      <div className="sd-btn-row">
        {permissionState !== 'granted' ? (
          <button className="sd-action-btn" type="button" onClick={onRetryPermission}>
            <Settings2 size={16} />
            Xin quyền camera
          </button>
        ) : null}
        <button className="sd-action-btn" type="button" onClick={onRefreshSources}>
          <RefreshCw size={16} />
          Làm mới
        </button>
      </div>

      <div className="sd-kv-grid sd-kv-grid--compact">
        <div className="sd-kv">
          <span className="sd-kv-label">Quyền</span>
          <span className="sd-kv-value">
            <span className="sd-status-dot" data-tone={permissionSummary.tone} />
            {permissionSummary.label}
          </span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Stream</span>
          <span className="sd-kv-value">
            <span className="sd-status-dot" data-tone={streamSummary.tone} />
            {streamSummary.label}
          </span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Số nguồn</span>
          <span className="sd-kv-value">{sources.length}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Đang dùng</span>
          <span className="sd-kv-value">{currentSourceLabel}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Audio HDMI</span>
          <span className="sd-kv-value">{currentAudioSourceLabel}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Performance</span>
          <span className="sd-kv-value">
            <span
              className="sd-status-dot"
              data-tone={
                performanceAudio.status === 'paired'
                  ? 'good'
                  : performanceAudio.status === 'unsupported'
                    ? 'warn'
                    : 'neutral'
              }
            />
            {performanceAudio.recordingSupported ? 'MP4 ready' : 'MP4 unavailable'}
          </span>
        </div>
      </div>

      <div className={`sd-field-hint ${performanceAudio.status === 'paired' ? '' : 'warn'}`}>
        {performanceAudio.message}
      </div>
    </div>
  )
}
