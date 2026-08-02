import type { CaptureMode } from '../../types'
import {
  type CloudShareUploadDescriptor,
  requestCloudShareJson,
} from './shared'

export interface InitCloudCaptureShareInput {
  kind: CaptureMode
  mimeType: string
  extension: string
  byteSize: number
  width: number
  height: number
}

export interface InitCloudCaptureShareResponse {
  captureId: string
  storageKey: string
  upload: CloudShareUploadDescriptor
  expiresAt: string
}

export interface CompleteCloudCaptureShareResponse {
  downloadToken: string
  downloadUrl: string
  expiresAt: string
}

export async function initCloudCaptureShare(
  payload: InitCloudCaptureShareInput,
  signal?: AbortSignal,
): Promise<InitCloudCaptureShareResponse> {
  return requestCloudShareJson<InitCloudCaptureShareResponse>({
    path: '/api/captures/init',
    stage: 'init',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    },
  })
}

export async function completeCloudCaptureShare(
  captureId: string,
  signal?: AbortSignal,
): Promise<CompleteCloudCaptureShareResponse> {
  return requestCloudShareJson<CompleteCloudCaptureShareResponse>({
    path: '/api/captures/complete',
    stage: 'complete',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ captureId }),
      signal,
    },
  })
}
