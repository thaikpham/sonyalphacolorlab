import { DEFAULT_KIOSK_PROFILE } from './kioskProfiles'
import type { KioskProfile } from '../types'

export type BrowserDeviceKind = 'desktop' | 'mobile'

type DeviceDetectionWindow = Pick<Window, 'innerWidth' | 'matchMedia'>
type DeviceDetectionNavigator = Pick<Navigator, 'maxTouchPoints' | 'userAgent'> & {
  userAgentData?: { mobile?: boolean }
}

export function resolveBrowserDeviceKind(
  currentWindow: DeviceDetectionWindow,
  currentNavigator: DeviceDetectionNavigator,
): BrowserDeviceKind {
  const hasTouchPoints = currentNavigator.maxTouchPoints > 0
  const coarsePointer = currentWindow.matchMedia('(pointer: coarse)').matches
  const narrowViewport = currentWindow.innerWidth <= 900
  const uaMobile =
    currentNavigator.userAgentData?.mobile ??
    /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(currentNavigator.userAgent)

  if ((hasTouchPoints && coarsePointer) || uaMobile || (coarsePointer && narrowViewport)) {
    return 'mobile'
  }

  return 'desktop'
}

export function resolveDefaultKioskProfile(
  currentWindow?: DeviceDetectionWindow,
  currentNavigator?: DeviceDetectionNavigator,
): KioskProfile {
  if (!currentWindow || !currentNavigator) {
    return DEFAULT_KIOSK_PROFILE
  }

  return resolveBrowserDeviceKind(currentWindow, currentNavigator) === 'mobile'
    ? 'portrait'
    : 'landscape'
}
