import type { CaptureMode } from '../../types'
import {
  type CloudShareUploadDescriptor,
  requestCloudShareJson,
} from './shared'

export interface InitCloudCaptureSessionItemInput {
  kind: CaptureMode
  mimeType: string
  extension: string
  byteSize: number
  width: number
  height: number
  sequence: number
}

export interface InitCloudCaptureSessionResponse {
  sessionId: string
  expiresAt: string
  items: Array<{
    captureId: string
    sequence: number
    upload: CloudShareUploadDescriptor
  }>
}

export interface CompleteCloudCaptureSessionResponse {
  downloadToken: string
  galleryUrl: string
  expiresAt: string
}

export interface CloudCaptureSessionGalleryItem {
  captureId: string
  sequence: number
  kind: CaptureMode
  mimeType: string
  extension: string
  width: number
  height: number
  previewUrl: string
  downloadUrl: string
}

export interface CloudCaptureSessionGalleryResponse {
  sessionId: string
  downloadToken: string
  expiresAt: string
  createdAt: string
  items: CloudCaptureSessionGalleryItem[]
}

export async function initCloudCaptureSession(
  items: InitCloudCaptureSessionItemInput[],
  signal?: AbortSignal,
): Promise<InitCloudCaptureSessionResponse> {
  return requestCloudShareJson<InitCloudCaptureSessionResponse>({
    path: '/api/capture-sessions/init',
    stage: 'init',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
      signal,
    },
  })
}

export async function completeCloudCaptureSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<CompleteCloudCaptureSessionResponse> {
  return requestCloudShareJson<CompleteCloudCaptureSessionResponse>({
    path: '/api/capture-sessions/complete',
    stage: 'complete',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
      signal,
    },
  })
}

export async function fetchCloudCaptureSessionGallery(
  token: string,
  signal?: AbortSignal,
): Promise<CloudCaptureSessionGalleryResponse> {
  return requestCloudShareJson<CloudCaptureSessionGalleryResponse>({
    path: `/api/capture-sessions/gallery?token=${encodeURIComponent(token)}`,
    stage: 'complete',
    init: {
      method: 'GET',
      signal,
    },
  })
}
