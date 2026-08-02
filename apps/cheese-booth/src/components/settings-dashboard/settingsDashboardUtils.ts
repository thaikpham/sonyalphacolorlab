import type { CountdownSec, PermissionState, StreamState } from '../../types'

export const COUNTDOWN_OPTIONS: CountdownSec[] = [0, 3, 5, 10]

export type SectionId =
  | 'overview'
  | 'capture'
  | 'camera'
  | 'output'
  | 'transform'
  | 'download'
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
