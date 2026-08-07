import type { CountdownSec, PermissionState, StreamState } from '../../types'

export const COUNTDOWN_OPTIONS: CountdownSec[] = [0, 3, 5, 10]

// No 'download' section: this is a browser-only kiosk now. There is no desktop
// build to fetch, so the panel that pointed operators at a GitHub Releases
// archive has gone with it.
export type SectionId =
  | 'overview'
  | 'capture'
  | 'camera'
  | 'output'
  | 'transform'
export type DashboardStatusTone = 'good' | 'warn' | 'neutral'

export interface DashboardStatusSummary {
  label: string
  tone: DashboardStatusTone
}

export function getPermissionSummary(
  permissionState: PermissionState,
): DashboardStatusSummary {
  switch (permissionState) {
    case 'granted':
      return { label: 'Đã cấp', tone: 'good' }
    case 'denied':
      return { label: 'Bị từ chối', tone: 'warn' }
    default:
      return { label: 'Chờ', tone: 'neutral' }
  }
}

export function getStreamSummary(streamState: StreamState): DashboardStatusSummary {
  switch (streamState) {
    case 'live':
      return { label: 'Đang phát', tone: 'good' }
    case 'starting':
      return { label: 'Khởi động', tone: 'neutral' }
    case 'missing-device':
      return { label: 'Mất thiết bị', tone: 'warn' }
    case 'error':
      return { label: 'Lỗi', tone: 'warn' }
    default:
      return { label: 'Chờ', tone: 'neutral' }
  }
}
