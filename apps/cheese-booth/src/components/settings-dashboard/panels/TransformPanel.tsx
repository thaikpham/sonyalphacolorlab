import { FlipHorizontal2, FlipVertical2, RotateCw } from 'lucide-react'

import { getKioskRotationOptions } from '../../../lib/kioskProfiles'
import type { KioskProfile, OperatorSettings } from '../../../types'

interface SettingsDashboardTransformPanelProps {
  profile: KioskProfile
  settings: OperatorSettings
  orientationLabel: string
  isBusy: boolean
  onRotate: () => void
  onFlipHorizontal: () => void
  onFlipVertical: () => void
}

export function SettingsDashboardTransformPanel({
  profile,
  settings,
  orientationLabel,
  isBusy,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
}: SettingsDashboardTransformPanelProps) {
  const rotationOptions = getKioskRotationOptions(profile, settings.captureMode)
  const portraitLocked = profile === 'portrait' && rotationOptions.length === 1

  return (
    <div className="sd-panel">
      <header className="sd-panel-header">
        <h2>{portraitLocked ? 'Căn khung dọc' : 'Xoay / Lật'}</h2>
        <p className="sd-panel-sub">
          {portraitLocked
            ? 'Profile portrait được khóa theo khung 3:4 dọc để framing ổn định.'
            : settings.captureMode === 'performance'
              ? 'Performance không cưỡng bức portrait rotation lock.'
              : 'Điều chỉnh hướng và phản chiếu preview'}
        </p>
      </header>

      <div className="sd-field">
        <label className="sd-field-label">Xoay</label>
        {portraitLocked ? (
          <div className="sd-transform-lock">
            <RotateCw size={16} />
            <span>Portrait lock · 90°</span>
          </div>
        ) : (
          <button
            className="sd-transform-btn"
            type="button"
            onClick={onRotate}
            disabled={isBusy}
          >
            <RotateCw size={16} />
            {settings.rotationQuarter * 90}°
          </button>
        )}
      </div>

      <div className="sd-field">
        <label className="sd-field-label">Lật hình</label>
        <div className="sd-btn-row">
          <button
            className={`sd-transform-btn ${settings.flipHorizontal ? 'active' : ''}`}
            type="button"
            onClick={onFlipHorizontal}
            disabled={isBusy}
          >
            <FlipHorizontal2 size={16} />
            Ngang
          </button>
          <button
            className={`sd-transform-btn ${settings.flipVertical ? 'active' : ''}`}
            type="button"
            onClick={onFlipVertical}
            disabled={isBusy}
          >
            <FlipVertical2 size={16} />
            Dọc
          </button>
        </div>
      </div>

      <div className="sd-kv-grid sd-kv-grid--compact">
        <div className="sd-kv">
          <span className="sd-kv-label">Hướng</span>
          <span className="sd-kv-value">{orientationLabel}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Góc xoay</span>
          <span className="sd-kv-value">
            {portraitLocked ? '90° · Lock' : `${settings.rotationQuarter * 90}°`}
          </span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Flip ngang</span>
          <span className="sd-kv-value">
            <span
              className="sd-status-dot"
              data-tone={settings.flipHorizontal ? 'good' : 'neutral'}
            />
            {settings.flipHorizontal ? 'Bật' : 'Tắt'}
          </span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Flip dọc</span>
          <span className="sd-kv-value">
            <span
              className="sd-status-dot"
              data-tone={settings.flipVertical ? 'good' : 'neutral'}
            />
            {settings.flipVertical ? 'Bật' : 'Tắt'}
          </span>
        </div>
      </div>
    </div>
  )
}
