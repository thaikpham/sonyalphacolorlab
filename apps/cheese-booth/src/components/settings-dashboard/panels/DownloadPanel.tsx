import { ExternalLink } from 'lucide-react'

import { DESKTOP_RELEASE_ARCHIVE_URL } from '../../../lib/externalLinks'

export function SettingsDashboardDownloadPanel() {
  return (
    <div className="sd-panel sd-download-panel">
      <header className="sd-panel-header">
        <h2>Desktop app</h2>
        <p className="sd-panel-sub">Desktop mode đã được tách khỏi browser project này</p>
      </header>

      <section className="sd-install-section" aria-label="Desktop handoff">
        <div className="sd-install-section-head">
          <div>
            <p className="sd-install-kicker">Archive + handoff</p>
            <h3>Mở release archive desktop</h3>
            <p className="sd-install-section-copy">
              Browser webapp này không còn build hay catalog installer inline nữa.
              Phần desktop được snapshot sang codebase riêng để tiếp tục phát triển,
              còn release public hiện tại vẫn được giữ như archive trên GitHub.
            </p>
          </div>
        </div>

        <div className="sd-release-banner sd-release-banner--neutral">
          <div>
            <h4>Desktop đã tách khỏi kiosk-app</h4>
            <p>
              Những gì đã được tách ra: Tauri runtime, local-save flow, desktop
              release pipeline, và toàn bộ source desktop baseline trong thư mục
              riêng `kiosk-desktop`.
            </p>
          </div>
          <a
            className="sd-release-link"
            href={DESKTOP_RELEASE_ARCHIVE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Mở archive
          </a>
        </div>

        <div className="sd-field-hint">
          Nếu cần phân phối installer ngay lúc này, hãy dùng trang Releases archive.
          Những release desktop mới nên được phát hành từ codebase `kiosk-desktop`
          sau khi gắn remote riêng.
        </div>

        <a
          className="sd-action-btn"
          href={DESKTOP_RELEASE_ARCHIVE_URL}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} />
          Mở GitHub Releases
        </a>
      </section>
    </div>
  )
}
