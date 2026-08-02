import { matchPath, Navigate, useLocation } from 'react-router-dom'

import { getCaptureRoute, isKioskProfile } from '../lib/kioskProfiles'
import type { KioskProfile } from '../types'
import { KioskExperience } from './KioskExperience'

export function KioskShell({ defaultProfile }: { defaultProfile: KioskProfile }) {
  const location = useLocation()
  const captureMatch = matchPath('/capture/:profile', location.pathname)
  const settingsMatch = matchPath('/settings/:profile', location.pathname)
  const profileParam =
    captureMatch?.params.profile ?? settingsMatch?.params.profile ?? null

  if (profileParam && !isKioskProfile(profileParam)) {
    return <Navigate to={getCaptureRoute(defaultProfile)} replace />
  }

  const profile: KioskProfile = isKioskProfile(profileParam)
    ? profileParam
    : defaultProfile

  return (
    <KioskExperience
      key={profile}
      profile={profile}
      defaultProfile={defaultProfile}
    />
  )
}
