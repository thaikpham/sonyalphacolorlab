export type CaptureMode = 'photo' | 'boomerang' | 'performance'
export type KioskProfile = 'portrait' | 'landscape'

export type CountdownSec = 0 | 3 | 5 | 10

export type PermissionState = 'unknown' | 'granted' | 'denied'

export type StreamState = 'idle' | 'starting' | 'live' | 'missing-device' | 'error'

export interface OperatorSettings {
  captureMode: CaptureMode
  deviceId: string | null
  audioDeviceId: string | null
  countdownSec: CountdownSec
  rotationQuarter: 0 | 1 | 2 | 3
  flipHorizontal: boolean
  flipVertical: boolean
}

export interface SourceDescriptor {
  deviceId: string
  label: string
  isSonyPreferred: boolean
}

export interface AudioSourceDescriptor {
  deviceId: string
  label: string
  isCamLinkPreferred: boolean
}

export interface CameraSessionState {
  permissionState: PermissionState
  streamState: StreamState
  lastError: string | null
}

export interface TransformSettings {
  rotationQuarter: number
  flipHorizontal: boolean
  flipVertical: boolean
}

export interface RecordingProgressIndicator {
  mode: Exclude<CaptureMode, 'photo'>
  elapsedMs: number
  maxDurationMs: number
  remainingMs: number
  progress: number
}

export interface PerformanceAudioState {
  status: 'paired' | 'available' | 'unavailable' | 'unsupported'
  message: string
  selectedLabel: string | null
  recordingSupported: boolean
  recordingMimeType: string | null
}

export interface CaptureOutcome {
  kind: CaptureMode
  previewUrl: string
  mimeType: string
  width: number
  height: number
}

export type BrowserCaptureSessionStatus =
  | 'idle'
  | 'active'
  | 'reviewing-shot'
  | 'finalizing'
  | 'ready'
  | 'error'

export interface BrowserSessionItem {
  id: string
  kind: CaptureMode
  sequence: number
  createdAt: number
  previewUrl: string
  posterUrl: string
  mimeType: string
  extension: string
  width: number
  height: number
  blob: Blob
}

export interface BrowserSessionShareState {
  status: 'idle' | 'finalizing' | 'ready' | 'error'
  sessionId?: string
  downloadToken?: string
  galleryUrl?: string
  expiresAt?: string
  errorMessage?: string
}

export interface BrowserCaptureSessionState {
  status: BrowserCaptureSessionStatus
  startedAt: number | null
  captureMode: CaptureMode | null
  maxItems: number
  items: BrowserSessionItem[]
  share: BrowserSessionShareState
}

export const DEFAULT_PORTRAIT_OPERATOR_SETTINGS: OperatorSettings = {
  captureMode: 'photo',
  deviceId: null,
  audioDeviceId: null,
  countdownSec: 3,
  rotationQuarter: 1,
  flipHorizontal: true,
  flipVertical: false,
}

export const DEFAULT_LANDSCAPE_OPERATOR_SETTINGS: OperatorSettings = {
  captureMode: 'photo',
  deviceId: null,
  audioDeviceId: null,
  countdownSec: 3,
  rotationQuarter: 0,
  flipHorizontal: true,
  flipVertical: false,
}

export const DEFAULT_OPERATOR_SETTINGS: OperatorSettings =
  DEFAULT_LANDSCAPE_OPERATOR_SETTINGS

export const DEFAULT_CAMERA_SESSION_STATE: CameraSessionState = {
  permissionState: 'unknown',
  streamState: 'idle',
  lastError: null,
}

export const DEFAULT_BROWSER_CAPTURE_SESSION_STATE: BrowserCaptureSessionState = {
  status: 'idle',
  startedAt: null,
  captureMode: null,
  maxItems: 4,
  items: [],
  share: {
    status: 'idle',
  },
}
