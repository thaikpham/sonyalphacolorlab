import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import { loadOperatorSettings, saveOperatorSettings } from '../lib/settingsStore'
import { getDefaultOperatorSettings, normalizeOperatorSettingsForProfile } from '../lib/kioskProfiles'
import type { KioskProfile, OperatorSettings } from '../types'

interface UseOperatorSettingsResult {
  settings: OperatorSettings
  settingsReady: boolean
  setSettings: Dispatch<SetStateAction<OperatorSettings>>
  updateSettings: (next: Partial<OperatorSettings>) => void
}

export function useOperatorSettings(profile: KioskProfile): UseOperatorSettingsResult {
  const [settings, setSettings] = useState(() => getDefaultOperatorSettings(profile))
  const [settingsReady, setSettingsReady] = useState(false)

  useEffect(() => {
    let active = true

    void (async () => {
      const loaded = await loadOperatorSettings(profile)

      if (!active) return
      setSettings(loaded)
      setSettingsReady(true)
    })()

    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    if (!settingsReady) return

    void saveOperatorSettings(profile, settings)
  }, [profile, settings, settingsReady])

  function updateSettings(next: Partial<OperatorSettings>): void {
    setSettings((current) => ({
      ...normalizeOperatorSettingsForProfile(profile, {
        ...current,
        ...next,
      }),
    }))
  }

  return {
    settings,
    settingsReady,
    setSettings,
    updateSettings,
  }
}
