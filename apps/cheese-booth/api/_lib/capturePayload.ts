import { badRequest } from './http.js'

export type CaptureKind = 'photo' | 'boomerang' | 'performance'

const MIN_CAPTURE_EDGE = 240

export const CAPTURE_CONSTRAINTS = {
  photo: {
    mimeTypes: ['image/jpeg', 'image/png'],
    extensions: ['jpg', 'jpeg', 'png'],
    maxByteSize: 50 * 1024 * 1024,
    maxWidth: 8192,
    maxHeight: 8192,
  },
  boomerang: {
    mimeTypes: ['video/mp4'],
    extensions: ['mp4'],
    maxByteSize: 25 * 1024 * 1024,
    maxWidth: 2048,
    maxHeight: 2048,
  },
  performance: {
    mimeTypes: ['video/mp4'],
    extensions: ['mp4'],
    maxByteSize: 150 * 1024 * 1024,
    maxWidth: 2048,
    maxHeight: 2048,
  },
} as const

export interface ValidatedCapturePayload {
  kind: CaptureKind
  mimeType: string
  extension: string
  byteSize: number
  width: number
  height: number
}

export function parseCaptureKind(value?: string): CaptureKind {
  if (value === 'photo' || value === 'boomerang' || value === 'performance') {
    return value
  }

  badRequest('Loại capture không hợp lệ.', 'invalid_capture_kind')
}

export function parseMimeType(value?: string): string {
  const normalized = value?.trim().toLowerCase()

  if (!normalized) {
    badRequest(
      'Thiếu MIME type của file capture.',
      'missing_capture_mime_type',
    )
  }

  return normalized
}

export function parseExtension(value?: string): string {
  const normalized = value?.trim().toLowerCase().replace(/^\./, '') ?? ''
  const sanitized = normalized.replace(/[^a-z0-9]+/g, '')

  if (!sanitized) {
    badRequest(
      'Thiếu phần mở rộng file capture.',
      'missing_capture_extension',
    )
  }

  return sanitized
}

export function parsePositiveInteger(
  value: number | undefined,
  label: string,
  code = 'invalid_capture_dimension',
): number {
  if (!Number.isFinite(value) || !value || value <= 0) {
    badRequest(`${label} không hợp lệ.`, code)
  }

  return Math.max(1, Math.round(value))
}

export function validateCapturePayload(
  payload: ValidatedCapturePayload,
): void {
  const constraints = CAPTURE_CONSTRAINTS[payload.kind]

  if (
    !constraints.mimeTypes.some(
      (allowedMimeType) => allowedMimeType === payload.mimeType,
    )
  ) {
    badRequest(
      `MIME type ${payload.mimeType} không hỗ trợ cho ${payload.kind}.`,
      'invalid_capture_mime_type',
    )
  }

  if (
    !constraints.extensions.some(
      (allowedExtension) => allowedExtension === payload.extension,
    )
  ) {
    badRequest(
      `Phần mở rộng .${payload.extension} không hỗ trợ cho ${payload.kind}.`,
      'invalid_capture_extension',
    )
  }

  if (payload.byteSize > constraints.maxByteSize) {
    badRequest(
      `File capture vượt quá giới hạn ${Math.round(
        constraints.maxByteSize / (1024 * 1024),
      )} MB cho ${payload.kind}.`,
      'capture_payload_too_large',
    )
  }

  if (payload.width < MIN_CAPTURE_EDGE || payload.height < MIN_CAPTURE_EDGE) {
    badRequest(
      'Kích thước capture quá nhỏ cho booth hiện tại.',
      'capture_dimensions_too_small',
    )
  }

  if (
    payload.width > constraints.maxWidth ||
    payload.height > constraints.maxHeight
  ) {
    badRequest(
      `Kích thước capture vượt ngưỡng cho ${payload.kind}.`,
      'capture_dimensions_exceeded',
    )
  }
}

export function buildCaptureStorageKey(
  kind: CaptureKind,
  captureId: string,
  extension: string,
): string {
  const dateFolder = new Date().toISOString().slice(0, 10)

  return `captures/${kind}/${dateFolder}/${captureId}.${extension}`
}
