import type { RuntimeEnvironment } from '../../../lib/runtime'
import type { CaptureMode, PerformanceAudioState } from '../../../types'

interface SettingsDashboardOutputPanelProps {
  orientationLabel: string
  captureMode: CaptureMode
  performanceAudio: PerformanceAudioState
  runtime: RuntimeEnvironment
}

export function SettingsDashboardOutputPanel({
  orientationLabel,
  captureMode,
  performanceAudio,
  runtime,
}: SettingsDashboardOutputPanelProps) {
  return (
    <div className="sd-panel">
      <header className="sd-panel-header">
        <h2>Cloud share</h2>
        <p className="sd-panel-sub">Browser kiosk luôn upload session lên cloud share</p>
      </header>

      <div className="sd-kv-grid">
        <div className="sd-kv">
          <span className="sd-kv-label">Đích lưu</span>
          <span className="sd-kv-value">{runtime.storageTargetLabel}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Chế độ</span>
          <span className="sd-kv-value">{runtime.label}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Session max</span>
          <span className="sd-kv-value">
            {captureMode === 'performance' ? '1 performance clip / QR' : '4 media / QR'}
          </span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Orientation mặc định</span>
          <span className="sd-kv-value">{orientationLabel}</span>
        </div>
        <div className="sd-kv">
          <span className="sd-kv-label">Performance output</span>
          <span className="sd-kv-value">MP4 · tối đa 2K · 60s · {performanceAudio.recordingSupported ? 'native ready' : 'native unavailable'}</span>
        </div>
      </div>

      <div className="sd-field-hint">
        Repo browser-only này không còn hỗ trợ local-save hay chọn thư mục trên máy
        kiosk. Mọi shot đã chốt sẽ được upload khi kết thúc session và sinh một QR
        gallery duy nhất cho khách.
      </div>

      <div className={`sd-field-hint ${performanceAudio.status === 'paired' ? '' : 'warn'}`}>
        60s Performance dùng crop 16:9 hoặc 9:16 tối đa 2K và ưu tiên audio HDMI
        từ Cam Link. Nếu audio không sẵn sàng, clip vẫn được lưu ở dạng MP4 không
        tiếng.
      </div>
    </div>
  )
}
