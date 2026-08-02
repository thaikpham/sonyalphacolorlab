import type { CameraSessionState } from '../../types'
import {
  getMediaErrorMessage,
  isMissingDeviceMediaError,
  isPermissionDeniedMediaError,
  isRecoverableMediaStreamError,
} from '../kioskControllerUtils'

export function getUnsupportedCameraSessionState(): CameraSessionState {
  return {
    permissionState: 'unknown',
    streamState: 'error',
    lastError: 'Runtime hiện tại không hỗ trợ camera.',
  }
}

export function resolvePermissionProbeState(
  error: unknown | null,
): Pick<CameraSessionState, 'permissionState' | 'streamState' | 'lastError'> {
  if (!error) {
    return {
      permissionState: 'granted',
      streamState: 'idle',
      lastError: null,
    }
  }

  const lastError = getMediaErrorMessage(error)

  if (isPermissionDeniedMediaError(error)) {
    return {
      permissionState: 'denied',
      streamState: 'idle',
      lastError,
    }
  }

  return {
    permissionState:
      isMissingDeviceMediaError(error) || isRecoverableMediaStreamError(error)
        ? 'granted'
        : 'unknown',
    streamState: isMissingDeviceMediaError(error) ? 'missing-device' : 'error',
    lastError,
  }
}
