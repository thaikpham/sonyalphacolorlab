import cheeseLogo from '../../cheese_icon_transparent.svg'

import { APP_NAME, APP_SUBTITLE } from '../lib/branding'

export function KioskLoadingScreen({
  message = 'Đang khởi tạo kiosk…',
}: {
  message?: string
}) {
  return (
    <main className="app-shell loading-shell">
      <div className="loading-card">
        <img
          src={cheeseLogo}
          alt={APP_NAME}
          className="loading-logo"
          width={92}
          height={69}
        />
        <p className="eyebrow">{APP_SUBTITLE}</p>
        <h1>{APP_NAME}</h1>
        <p className="lede">{message}</p>
      </div>
    </main>
  )
}
