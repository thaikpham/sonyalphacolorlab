import { Camera, Clock3, Video } from 'lucide-react'

import type { CaptureMode, CountdownSec, OperatorSettings } from '../../../types'
import { COUNTDOWN_OPTIONS } from '../settingsDashboardUtils'

interface SettingsDashboardCapturePanelProps {
  settings: OperatorSettings
  captureModeLabel: string
  isBusy: boolean
  modeLocked: boolean
  performanceEnabled: boolean
  onModeChange: (mode: CaptureMode) => void
  onCountdownChange: (countdown: CountdownSec) => void
}

export function SettingsDashboardCapturePanel({
  settings,
  captureModeLabel,
  isBusy,
  modeLocked,
  performanceEnabled,
  onModeChange,
  onCountdownChange,
}: SettingsDashboardCapturePanelProps) {
  return (
    <div className="sd-panel">
      <header className="sd-panel-header">
        <h2>Chế độ chụp</h2>
        <p className="sd-panel-sub">Chọn chế độ và thời gian đếm ngược</p>
      </header>

      <div className="sd-field">
        <label className="sd-field-label">Chế độ</label>
        <div className="sd-segmented">
          <button
            className={`sd-seg-btn ${settings.captureMode === 'photo' ? 'active' : ''}`}
            type="button"
            onClick={() => onModeChange('photo')}
            disabled={isBusy || modeLocked}
          >
            <Camera size={16} />
            Photo
          </button>
          <button
            className={`sd-seg-btn ${settings.captureMode === 'boomerang' ? 'active' : ''}`}
            type="button"
            onClick={() => onModeChange('boomerang')}
            disabled={isBusy || modeLocked}
          >
            <Video size={16} />
            Boomerang
          </button>
          <button
            className={`sd-seg-btn ${settings.captureMode === 'performance' ? 'active' : ''}`}
            type="button"
            onClick={() => onModeChange('performance')}
            disabled={isBusy || modeLocked || !performanceEnabled}
            title={
              performanceEnabled
                ? 'Quay MP4 60s với audio HDMI nếu có'
                : 'Runtime này chưa hỗ trợ MP4 native cho performance'
            }
          >
            <Video size={16} />
            60s Performance
          </button>
        </div>
      </div>

      <div className="sd-field">
        <label className="sd-field-label">Đếm ngược</label>
        <div className="sd-chip-row">
          {COUNTDOWN_OPTIONS.map((option) => (
            <button
              key={option}
              className={`sd-chip ${settings.countdownSec === option ? 'active' : ''}`}
              type="button"
              onClick={() => onCountdownChange(option)}
              disabled={isBusy}
              title={option === 0 ? 'Chụp ngay, không đếm ngược' : `Đếm ngược ${option} giây`}
            >
              <Clock3 size={14} />
              {option === 0 ? '0s · Ngay' : `${option}s`}
            </button>
          ))}
        </div>
      </div>

      <div className="sd-field-hint">
        Chế độ <strong>{captureModeLabel}</strong> với đếm ngược{' '}
        <strong>{settings.countdownSec}s</strong> đang được sử dụng.
      </div>

      {modeLocked ? (
        <div className="sd-field-hint warn">
          Session hiện tại đã khóa mode capture. Hãy reset session trước khi chuyển
          giữa Photo, Boomerang và 60s Performance.
        </div>
      ) : null}
    </div>
  )
}
