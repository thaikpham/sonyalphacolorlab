import { useEffect, useState } from 'react'

import { resolveDefaultKioskProfile } from '../lib/browserDevice'
import { DEFAULT_KIOSK_PROFILE } from '../lib/kioskProfiles'
import type { KioskProfile } from '../types'

export function useDeviceBasedProfile(): KioskProfile {
  const [profile, setProfile] = useState<KioskProfile>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_KIOSK_PROFILE
    }

    return resolveDefaultKioskProfile(window, navigator)
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const detectDevice = () => {
      setProfile(resolveDefaultKioskProfile(window, navigator))
    }

    detectDevice()
    window.addEventListener('resize', detectDevice)
    return () => window.removeEventListener('resize', detectDevice)
  }, [])

  return profile
}
