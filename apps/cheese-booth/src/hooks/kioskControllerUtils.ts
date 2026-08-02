import type {
  AudioSourceDescriptor,
  OperatorSettings,
  SourceDescriptor,
  TransformSettings,
} from '../types'

const PERMISSION_DENIED_ERROR_NAMES = new Set([
  'NotAllowedError',
  'PermissionDeniedError',
  'SecurityError',
])

const MISSING_DEVICE_ERROR_NAMES = new Set([
  'DevicesNotFoundError',
  'NotFoundError',
  'OverconstrainedError',
])

const RECOVERABLE_STREAM_ERROR_NAMES = new Set([
  'AbortError',
  'NotReadableError',
  'TrackStartError',
])

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : ''
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : ''
}

export function supportsCameraAccess(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return (
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof navigator.mediaDevices?.enumerateDevices === 'function'
  )
}

export function isPermissionDeniedMediaError(error: unknown): boolean {
  return PERMISSION_DENIED_ERROR_NAMES.has(getErrorName(error))
}

export function isMissingDeviceMediaError(error: unknown): boolean {
  return MISSING_DEVICE_ERROR_NAMES.has(getErrorName(error))
}

export function isRecoverableMediaStreamError(error: unknown): boolean {
  return RECOVERABLE_STREAM_ERROR_NAMES.has(getErrorName(error))
}

export function getMediaErrorMessage(error: unknown): string {
  if (isPermissionDeniedMediaError(error)) {
    return 'Bạn đã từ chối quyền truy cập camera.'
  }

  if (isMissingDeviceMediaError(error)) {
    return 'Không tìm thấy nguồn camera phù hợp.'
  }

  if (getErrorName(error) === 'NotReadableError') {
    return 'Nguồn camera đang bị ứng dụng khác chiếm dụng.'
  }

  const message = getErrorMessage(error)

  if (/scope|not allowed/i.test(message)) {
    return 'Thư mục lưu không còn quyền truy cập. Hãy chọn lại thư mục.'
  }

  if (/permission denied|read-only|readonly/i.test(message)) {
    return 'Không thể ghi vào thư mục đã chọn. Hãy chọn thư mục khác.'
  }

  if (message) {
    return message
  }

  return 'Không thể truy cập camera.'
}

function normalizeDeviceLabel(label: string): string {
  return label.trim().toLowerCase()
}

/**
 * Third-party virtual cameras. These present themselves as ordinary video
 * inputs, and several of them hold the physical camera open while they run, so
 * picking one can make the real device unopenable.
 *
 * Sony's own Imaging Edge is deliberately NOT in this list: it is scored
 * separately below as a low-priority Sony fallback, because an operator with
 * nothing else should still be able to use it.
 *
 * Note this app *deprioritises* virtual sources where Sony Live SOP hides them
 * outright. That is a policy difference, not drift: a booth may be the only
 * machine at the venue and must show something, while the SOP demo can afford
 * to insist on a real camera. See sonylivesop-main/src/lib/camera-source.ts.
 */
const VIRTUAL_CAMERA_PATTERNS = [
  'obs virtual',
  'virtual camera',
  'snap camera',
  'droidcam',
  'epoccam',
  'ivcam',
  'iriun',
  'xsplit vcam',
] as const

function isVirtualCameraLabel(normalized: string): boolean {
  return VIRTUAL_CAMERA_PATTERNS.some((pattern) => normalized.includes(pattern))
}

function scoreSonyPreference(label: string): number {
  const normalized = normalizeDeviceLabel(label)

  // 1. TOP PRIORITY: Capture Cards (Highest Quality/Stability)
  if (
    normalized.includes('cam link') ||
    normalized.includes('video capture') ||
    normalized.includes('capture card') ||
    normalized.includes('magewell')
  ) {
    return 0
  }

  // 2. HIGH PRIORITY: Native USB Streaming (UVC/UAC 4K/FHD)
  if (normalized.includes('usb streaming') || normalized.includes('usb livestream')) {
    return 1
  }

  // 3. STANDARD SONY: General Sony UVC Devices
  if (normalized.includes('sony')) {
    // If it's Imaging Edge, it's a fallback (low priority)
    if (normalized.includes('imaging edge')) return 5
    return 2
  }

  // 4. LAST RESORT: third-party virtual cameras. Ranked below an unknown
  //    physical device (10) rather than excluded, so a booth with nothing else
  //    plugged in still has a picture. Before this tier existed they scored 10
  //    too, and the tie was broken alphabetically — which is how
  //    "DroidCam Source 3" came to beat "Integrated Camera".
  if (isVirtualCameraLabel(normalized)) {
    return 20
  }

  return 10
}

export function toSourceDescriptor(
  device: MediaDeviceInfo,
  index: number,
): SourceDescriptor {
  return {
    deviceId: device.deviceId,
    label: device.label || `Camera ${index + 1}`,
    isSonyPreferred: scoreSonyPreference(device.label) < 10,
  }
}

function scoreAudioPairingPreference(
  label: string,
  selectedVideoLabel?: string | null,
): number {
  const normalized = normalizeDeviceLabel(label)
  const normalizedVideoLabel = normalizeDeviceLabel(selectedVideoLabel ?? '')

  if (!normalized) {
    return 20
  }

  if (
    normalizedVideoLabel &&
    (normalized.includes(normalizedVideoLabel) ||
      normalizedVideoLabel.includes(normalized))
  ) {
    return 0
  }

  if (
    normalized.includes('cam link') ||
    normalized.includes('capture') ||
    normalized.includes('hdmi') ||
    normalized.includes('magewell')
  ) {
    return 1
  }

  if (normalized.includes('sony')) {
    return 4
  }

  return 10
}

export function toAudioSourceDescriptor(
  device: MediaDeviceInfo,
  index: number,
): AudioSourceDescriptor {
  return {
    deviceId: device.deviceId,
    label: device.label || `Audio ${index + 1}`,
    isCamLinkPreferred: scoreAudioPairingPreference(device.label) < 10,
  }
}

export function pickBestAudioDeviceId(
  sources: AudioSourceDescriptor[],
  currentDeviceId: string | null,
  selectedVideoLabel?: string | null,
): string | null {
  if (currentDeviceId && sources.some((source) => source.deviceId === currentDeviceId)) {
    return currentDeviceId
  }

  const ranked = [...sources].sort((left, right) => {
    const scoreDiff =
      scoreAudioPairingPreference(left.label, selectedVideoLabel) -
      scoreAudioPairingPreference(right.label, selectedVideoLabel)

    if (scoreDiff !== 0) {
      return scoreDiff
    }

    return left.label.localeCompare(right.label)
  })

  return ranked[0]?.deviceId ?? null
}

export function pickBestDeviceId(
  sources: SourceDescriptor[],
  currentDeviceId: string | null,
): string | null {
  if (currentDeviceId && sources.some((source) => source.deviceId === currentDeviceId)) {
    return currentDeviceId
  }

  const ranked = [...sources].sort((left, right) => {
    const scoreDiff =
      scoreSonyPreference(left.label) - scoreSonyPreference(right.label)

    if (scoreDiff !== 0) {
      return scoreDiff
    }

    return left.label.localeCompare(right.label)
  })

  return ranked[0]?.deviceId ?? null
}

export function transformFromSettings(
  settings: OperatorSettings,
): TransformSettings {
  return {
    rotationQuarter: settings.rotationQuarter,
    flipHorizontal: settings.flipHorizontal,
    flipVertical: settings.flipVertical,
  }
}

export async function safeStopStream(stream: MediaStream | null): Promise<void> {
  if (!stream) return

  stream.getTracks().forEach((track) => track.stop())
}
