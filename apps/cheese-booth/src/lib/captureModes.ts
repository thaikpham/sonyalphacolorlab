import type { CaptureMode } from '../types'

export function getCaptureModeLabel(mode: CaptureMode): string {
  switch (mode) {
    case 'boomerang':
      return 'Boomerang'
    case 'performance':
      return '60s Performance'
    default:
      return 'Photo'
  }
}

export function getCaptureModeBadgeLabel(mode: CaptureMode): string {
  switch (mode) {
    case 'boomerang':
      return 'BOOMERANG'
    case 'performance':
      return 'PERFORMANCE'
    default:
      return 'PHOTO'
  }
}

export function getCaptureModeDockLabel(mode: CaptureMode): string {
  switch (mode) {
    case 'boomerang':
      return '🎞 Boomerang'
    case 'performance':
      return '🎬 60s Performance'
    default:
      return '📸 Photo'
  }
}

export function getCaptureModeEmoji(mode: CaptureMode): string {
  switch (mode) {
    case 'boomerang':
      return '🎞'
    case 'performance':
      return '🎬'
    default:
      return '📷'
  }
}

export function getSessionMaxItems(mode: CaptureMode): number {
  return mode === 'performance' ? 1 : 4
}

export function isRecordingMode(mode: CaptureMode): boolean {
  return mode === 'boomerang' || mode === 'performance'
}
