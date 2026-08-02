import type { Dispatch, SetStateAction } from 'react'

import {
  getKioskRotationOptions,
  sanitizeRotationQuarterForProfile,
} from '../../lib/kioskProfiles'
import type {
  CaptureMode,
  CountdownSec,
  KioskProfile,
  OperatorSettings,
} from '../../types'

export function createSettingsActionHandlers({
  profile,
  updateSettings,
  setSettings,
}: {
  profile: KioskProfile
  updateSettings: (next: Partial<OperatorSettings>) => void
  setSettings: Dispatch<SetStateAction<OperatorSettings>>
}): {
  setMode: (captureMode: CaptureMode) => void
  setCountdown: (countdownSec: CountdownSec) => void
  setRotationQuarter: (rotationQuarter: OperatorSettings['rotationQuarter']) => void
  rotate: () => void
  toggleFlipHorizontal: () => void
  toggleFlipVertical: () => void
  setDevice: (deviceId: string) => void
  setAudioDevice: (deviceId: string) => void
} {
  return {
    setMode: (captureMode: CaptureMode) =>
      setSettings((current) => ({
        ...current,
        captureMode,
        rotationQuarter: sanitizeRotationQuarterForProfile(
          profile,
          profile === 'portrait' &&
          captureMode === 'performance' &&
          current.captureMode !== 'performance'
            ? 0
            : current.rotationQuarter,
          captureMode,
        ),
      })),
    setCountdown: (countdownSec: CountdownSec) => updateSettings({ countdownSec }),
    setRotationQuarter: (rotationQuarter: OperatorSettings['rotationQuarter']) =>
      setSettings((current) => ({
        ...current,
        rotationQuarter: sanitizeRotationQuarterForProfile(
          profile,
          rotationQuarter,
          current.captureMode,
        ),
      })),
    rotate: () =>
      setSettings((current) => {
        const rotationOptions = getKioskRotationOptions(profile, current.captureMode)
        const currentIndex = rotationOptions.indexOf(current.rotationQuarter)
        const nextRotation =
          rotationOptions[(currentIndex + 1) % rotationOptions.length] ??
          rotationOptions[0]

        return {
          ...current,
          rotationQuarter: nextRotation,
        }
      }),
    toggleFlipHorizontal: () =>
      setSettings((current) => ({
        ...current,
        flipHorizontal: !current.flipHorizontal,
      })),
    toggleFlipVertical: () =>
      setSettings((current) => ({
        ...current,
        flipVertical: !current.flipVertical,
      })),
    setDevice: (deviceId: string) => updateSettings({ deviceId: deviceId || null }),
    setAudioDevice: (deviceId: string) =>
      updateSettings({ audioDeviceId: deviceId || null }),
  }
}
