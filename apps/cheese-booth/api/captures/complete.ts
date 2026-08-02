import { randomBytes } from 'crypto'

import {
  type CaptureDownloadRecord,
  findCaptureById,
  markCaptureReady,
} from '../_lib/db.js'
import { getAppEnv } from '../_lib/env.js'
import {
  assertAllowedAppOrigin,
  badRequest,
  conflict,
  createRequestContext,
  handleApiError,
  jsonResponse,
  notFound,
  parseJsonBody,
} from '../_lib/http.js'
import { verifyObjectExists } from '../_lib/r2.js'

export const runtime = 'nodejs'

interface CompleteCaptureRequestBody {
  captureId?: string
}

export async function POST(request: Request): Promise<Response> {
  const requestContext = createRequestContext(request)

  try {
    const env = getAppEnv()
    assertAllowedAppOrigin(request, env.appBaseUrl)

    const body = await parseJsonBody<CompleteCaptureRequestBody>(request)
    const captureId = body.captureId?.trim()

    if (!captureId) {
      badRequest('Thiếu captureId để hoàn tất upload.', 'missing_capture_id')
    }

    const capture = await findCaptureById(captureId)

    if (!capture) {
      notFound('Capture không tồn tại.', 'capture_not_found')
    }

    if (capture.status === 'deleted') {
      notFound('Capture đã bị xóa hoặc hết hạn.', 'capture_not_found')
    }

    if (capture.status === 'ready' && capture.download_token) {
      return jsonResponse(
        toCompleteResponse(capture, env.appBaseUrl),
        requestContext.requestId,
      )
    }

    if (capture.status !== 'pending_upload') {
      conflict(
        'Capture hiện không ở trạng thái chờ upload.',
        'capture_not_pending_upload',
      )
    }

    const uploaded = await verifyObjectExists(capture.storage_key)

    if (!uploaded) {
      conflict(
        'Upload chưa hoàn tất trên object storage.',
        'capture_upload_incomplete',
      )
    }

    const readyCapture = await markCaptureReady(
      captureId,
      randomBytes(24).toString('base64url'),
    )

    if (!readyCapture) {
      const latestCapture = await findCaptureById(captureId)

      if (latestCapture?.status === 'ready' && latestCapture.download_token) {
        return jsonResponse(
          toCompleteResponse(latestCapture, env.appBaseUrl),
          requestContext.requestId,
        )
      }

      conflict(
        'Không thể hoàn tất phiên upload hiện tại.',
        'capture_completion_conflict',
      )
    }

    return jsonResponse(
      toCompleteResponse(readyCapture, env.appBaseUrl),
      requestContext.requestId,
    )
  } catch (error) {
    return handleApiError(
      error,
      'Không thể hoàn tất upload cloud.',
      requestContext,
    )
  }
}

function toCompleteResponse(
  capture: CaptureDownloadRecord,
  appBaseUrl: string,
): {
  downloadToken: string
  downloadUrl: string
  expiresAt: string
} {
  if (!capture.download_token) {
    conflict(
      'Capture chưa có download token hợp lệ.',
      'missing_download_token',
    )
  }

  const expiresAt =
    capture.expires_at instanceof Date
      ? capture.expires_at.toISOString()
      : new Date(capture.expires_at).toISOString()

  return {
    downloadToken: capture.download_token,
    downloadUrl: `${appBaseUrl}/${capture.download_token}`,
    expiresAt,
  }
}
