import { Link } from 'react-router-dom'
import cheeseLogo from '../../cheese_icon_transparent.svg'
import { getCaptureRoute } from '../lib/kioskProfiles'
import type { KioskProfile } from '../types'
import '../styles/landing-page.css'

export function LandingPage({ defaultProfile }: { defaultProfile: KioskProfile }) {
  return (
    <main className="landing-page">
      <div className="landing-hero-content">
        <Link
          to={getCaptureRoute(defaultProfile)}
          className="landing-cheese-container"
          title="Open Kiosk"
        >
          <div className="landing-backlight" />
          <img
            src={cheeseLogo}
            alt="Cheese Booth"
            className="landing-cheese-svg"
            width={240}
            height={180}
          />
        </Link>
        
        <div className="landing-text-content">
          <h1 className="landing-title">CHEESE BOOTH</h1>
          <div className="landing-subtitle">
            <span className="line1">Another project from Colorlab</span>
            <span className="line2">Print-Free Photobooth - Road to Zero</span>
            <span className="line3">🇯🇵 Sony Electronics 🇻🇳</span>
          </div>
        </div>
      </div>
    </main>
  )
}
