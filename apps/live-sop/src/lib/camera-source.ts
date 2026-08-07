/**
 * Choosing which camera to open, and how to fit its frame into the phone
 * mock-up. Pure functions only — no `navigator`, no `localStorage`, no React.
 *
 * These were 150 lines buried in the middle of a 2385-line page component,
 * where nothing could reach them to test. They decide which device a kiosk
 * grabs when several are plugged in, which is exactly the logic that fails at a
 * live event and cannot be debugged there.
 *
 * `pickPreferredVideoSource` takes the stored preference as an argument rather
 * than reading it from localStorage itself: the storage access is the caller's
 * concern, and injecting it is what makes the choice testable.
 */

import type { StoredCameraPreference } from './showcase-runtime'

export interface VideoSourceOption {
  deviceId: string
  label: string
  note: string
  score: number
  recommended: boolean
}

export type CameraTrackConstraints = MediaTrackConstraints & {
  resizeMode?: ConstrainDOMString
}

export interface FrameSize {
  width: number
  height: number
}

/* ---------------------------------------------------------------------------
   Target geometry

   The mock-up is a portrait phone: 1080x1920. A camera hands us landscape
   frames, so the *raw* request is the transpose — 1920x1080 — and the rotation
   happens downstream.
--------------------------------------------------------------------------- */

export const TARGET_CAMERA_VIEWPORT_WIDTH_PX = 1080
export const TARGET_CAMERA_VIEWPORT_HEIGHT_PX = 1920
export const TARGET_CAMERA_RAW_WIDTH_PX = TARGET_CAMERA_VIEWPORT_HEIGHT_PX
export const TARGET_CAMERA_RAW_HEIGHT_PX = TARGET_CAMERA_VIEWPORT_WIDTH_PX
export const TARGET_CAMERA_RAW_ASPECT_RATIO =
  TARGET_CAMERA_RAW_WIDTH_PX / TARGET_CAMERA_RAW_HEIGHT_PX

export const CAMERA_BASE_CONSTRAINTS: CameraTrackConstraints = {
  width: { ideal: TARGET_CAMERA_RAW_WIDTH_PX, max: TARGET_CAMERA_RAW_WIDTH_PX },
  height: { ideal: TARGET_CAMERA_RAW_HEIGHT_PX, max: TARGET_CAMERA_RAW_HEIGHT_PX },
  aspectRatio: { ideal: TARGET_CAMERA_RAW_ASPECT_RATIO },
  frameRate: { ideal: 30, max: 60 },
  resizeMode: 'crop-and-scale',
}

export const DEFAULT_CAMERA_FRAME_SIZE: FrameSize = {
  width: TARGET_CAMERA_RAW_WIDTH_PX,
  height: TARGET_CAMERA_RAW_HEIGHT_PX,
}

/* ---------------------------------------------------------------------------
   Device classification

   Two families of label matter. Virtual cameras (Imaging Edge, OBS, DroidCam…)
   must never be auto-selected: several of them *hold the physical Sony device
   open*, so picking one guarantees the real camera cannot be opened at all.
   Built-in laptop webcams are legal but always the last resort.
--------------------------------------------------------------------------- */

/**
 * CheeseBooth keeps the same list but *deprioritises* these instead of hiding
 * them (see apps/cheese-booth/src/hooks/kioskControllerUtils.ts). That is a
 * deliberate policy split, not drift: a photobooth may be the only machine at
 * the venue and must show something, while this demo can insist on a real
 * camera. It also ranks capture cards first, which this app has no concept of.
 * Do not "unify" the two rankings — unify the patterns if anything, and only
 * after deciding whose policy wins.
 */
const CONFLICTING_CAMERA_PATTERNS = [
  'imaging edge',
  'imagingedge',
  'obs virtual',
  'virtual camera',
  'snap camera',
  'droidcam',
  'epoccam',
  'ivcam',
  'iriun',
  'xsplit vcam',
] as const

const LAPTOP_CAMERA_PATTERNS = [
  'integrated camera',
  'built-in',
  'facetime',
  'hd webcam',
] as const

export function normalizeCameraLabel(label: string): string {
  return label.trim().toLowerCase()
}

export function isConflictingCameraSource(label: string): boolean {
  const normalized = normalizeCameraLabel(label)
  return CONFLICTING_CAMERA_PATTERNS.some((pattern) => normalized.includes(pattern))
}

export function isSonyUsbLivestreamSource(label: string): boolean {
  const normalized = normalizeCameraLabel(label)
  const mentionsSony = normalized.includes('sony')
  const mentionsUsbStream =
    normalized.includes('usb') ||
    normalized.includes('uvc') ||
    normalized.includes('stream') ||
    normalized.includes('live')

  return mentionsSony && mentionsUsbStream && !isConflictingCameraSource(label)
}

export function isSonyCameraSource(label: string): boolean {
  const normalized = normalizeCameraLabel(label)
  return normalized.includes('sony') && !isConflictingCameraSource(label)
}

/**
 * Higher is better. A negative score means "never pick this automatically".
 *
 * The `recommended` flag in buildVideoSourceOptions keys off 300, so only a
 * Sony USB/UVC stream earns the badge.
 *
 * The laptop check MUST come before the generic `camera` one. It used to sit
 * after it, and "Integrated Camera" (Windows) and "FaceTime HD Camera" (macOS)
 * both contain the substring "camera" — so they matched the generic branch at
 * 60 and the laptop tier at 10 was unreachable for the two labels it exists
 * for. The visible consequence: a laptop webcam outranked a capture card named
 * "Elgato Cam" (30), and a kiosk with a capture card plugged in would open the
 * laptop's own camera instead.
 */
export function scoreVideoDevice(device: Pick<MediaDeviceInfo, 'label'>): number {
  const label = device.label || 'Camera chưa cấp quyền'
  const normalized = normalizeCameraLabel(label)

  if (!label) return 0
  if (isConflictingCameraSource(label)) return -1000
  if (isSonyUsbLivestreamSource(label)) return 300
  if (isSonyCameraSource(label)) return 220
  if (normalized.includes('usb')) return 120
  if (LAPTOP_CAMERA_PATTERNS.some((pattern) => normalized.includes(pattern))) return 10
  if (normalized.includes('camera')) return 60
  return 30
}

export function describeVideoDevice(label: string): string {
  if (isSonyUsbLivestreamSource(label)) return 'Ưu tiên: Sony USB Livestream / UVC'
  if (isSonyCameraSource(label)) return 'Nguồn Sony vật lý'
  if (normalizeCameraLabel(label).includes('usb')) return 'Nguồn USB khả dụng'
  if (
    LAPTOP_CAMERA_PATTERNS.some((pattern) => normalizeCameraLabel(label).includes(pattern))
  ) {
    return 'Camera tích hợp'
  }
  return 'Camera khả dụng'
}

/**
 * Splits enumerated devices into the ones a reader may choose and the virtual
 * ones that are hidden. Hidden labels are still returned so the UI can explain
 * *why* a camera the operator can see in Windows is missing from the list.
 */
export function buildVideoSourceOptions(
  devices: ReadonlyArray<Pick<MediaDeviceInfo, 'kind' | 'label' | 'deviceId'>>,
): { visibleOptions: VideoSourceOption[]; hiddenLabels: string[] } {
  const videoInputs = devices.filter((device) => device.kind === 'videoinput')

  const visibleOptions: VideoSourceOption[] = videoInputs
    .filter((device) => !isConflictingCameraSource(device.label))
    .map((device) => {
      const score = scoreVideoDevice(device)
      return {
        deviceId: device.deviceId,
        label: device.label || 'Camera chưa rõ tên',
        note: describeVideoDevice(device.label),
        score,
        recommended: score >= 300,
      }
    })
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))

  const hiddenLabels = videoInputs
    .filter((device) => isConflictingCameraSource(device.label))
    .map((device) => device.label || 'Nguồn camera ảo')

  return { visibleOptions, hiddenLabels }
}

/**
 * deviceId is regenerated per browser profile and per permission grant, so a
 * stored id goes stale. The label is the durable identifier, matched loosely
 * because browsers decorate it inconsistently ("Sony ZV-E10" vs
 * "Sony ZV-E10 (054c:0d97)").
 */
export function labelsProbablyMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) return false

  const normalizedLeft = normalizeCameraLabel(left)
  const normalizedRight = normalizeCameraLabel(right)

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  )
}

/**
 * Exact deviceId first, then a loose label match, then the highest scorer.
 * Returns null only when there is nothing to choose from.
 */
export function pickPreferredVideoSource(
  options: readonly VideoSourceOption[],
  storedPreference: StoredCameraPreference | null,
): VideoSourceOption | null {
  if (!options.length) return null

  if (storedPreference?.deviceId) {
    const exactMatch = options.find((option) => option.deviceId === storedPreference.deviceId)
    if (exactMatch) return exactMatch
  }

  if (storedPreference?.normalizedLabel) {
    const labelMatch = options.find((option) =>
      labelsProbablyMatch(option.label, storedPreference.normalizedLabel),
    )
    if (labelMatch) return labelMatch
  }

  return options[0]
}

export function buildCameraTrackConstraints(deviceId?: string): CameraTrackConstraints {
  return {
    ...CAMERA_BASE_CONSTRAINTS,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  }
}

/* ---------------------------------------------------------------------------
   Frame fitting
--------------------------------------------------------------------------- */

export function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360
}

/**
 * Scales a camera frame so it covers the viewport after rotation — the CSS
 * `object-fit: cover` calculation, done in JS because the element is rotated by
 * a transform and the browser fits the *unrotated* box.
 *
 * A quarter turn swaps which frame axis faces which viewport axis, which is why
 * the scale is computed against the rotated dimensions but applied to the
 * original ones.
 */
export function getFittedVideoFrameSize(
  viewport: FrameSize,
  frame: FrameSize,
  rotation: number,
): FrameSize {
  const normalizedRotation = normalizeRotation(rotation)
  const isQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270
  const rotatedWidth = isQuarterTurn ? frame.height : frame.width
  const rotatedHeight = isQuarterTurn ? frame.width : frame.height

  if (!viewport.width || !viewport.height || !rotatedWidth || !rotatedHeight) {
    return frame
  }

  const scale = Math.max(viewport.width / rotatedWidth, viewport.height / rotatedHeight)

  return {
    width: frame.width * scale,
    height: frame.height * scale,
  }
}
