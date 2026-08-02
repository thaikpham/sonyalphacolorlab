import './index.css'

import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

import { LandingPage } from './components/LandingPage'
import { KioskLoadingScreen } from './app/KioskLoadingScreen'
import { KioskShell } from './app/KioskShell'
import { useDeviceBasedProfile } from './app/useDeviceBasedProfile'

const LazySessionGalleryPage = lazy(async () => {
  const module = await import('./components/SessionGalleryPage')

  return {
    default: module.SessionGalleryPage,
  }
})

const SESSION_GALLERY_ROUTE = '/session/:token'

function App() {
  const deviceProfile = useDeviceBasedProfile()

  return (
    <>
      <div className="analog-film-grain" />
      <Routes>
        <Route
          path="/"
          element={
            <div className="route-shell route-shell--public-scroll">
              <LandingPage defaultProfile={deviceProfile} />
            </div>
          }
        />
        <Route
          path={SESSION_GALLERY_ROUTE}
          element={
            <div className="route-shell route-shell--public-scroll">
              <Suspense fallback={<KioskLoadingScreen message="Đang tải gallery…" />}>
                <LazySessionGalleryPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path="*"
          element={
            <main className="route-shell route-shell--kiosk-fit app-shell">
              <KioskShell defaultProfile={deviceProfile} />
            </main>
          }
        />
      </Routes>
    </>
  )
}

export default App
