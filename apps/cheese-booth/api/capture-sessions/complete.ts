import { randomBytes } from 'crypto'

import {
  findCaptureSessionById,
  listCaptureSessionItems,
  markCaptureSessionReady,
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

interface CompleteCaptureSessionRequestBody {
  sessionId?: string
}

export async function POST(request: Request): Promise<Response> {
  const requestContext = createRequestContext(request)

  try {
    const env = getAppEnv()
    assertAllowedAppOrigin(request, env.appBaseUrl)

    const body = await parseJsonBody<CompleteCaptureSessionRequestBody>(request)
    const sessionId = body.sessionId?.trim()

    if (!sessionId) {
      badRequest(
        'Thiếu sessionId để hoàn tất upload.',
        'missing_capture_session_id',
      )
    }

    const captureSession = await findCaptureSessionById(sessionId)

    if (!captureSession || captureSession.status === 'deleted') {
      notFound('Capture session không tồn tại.', 'capture_session_not_found')
    }

    if (captureSession.status === 'ready' && captureSession.download_token) {
      return jsonResponse(
        toCompleteResponse(captureSession.download_token, captureSession.expires_at, env.appBaseUrl),
        requestContext.requestId,
      )
    }

    if (captureSession.status !== 'pending_upload') {
      conflict(
        'Capture session hiện không ở trạng thái chờ upload.',
        'capture_session_not_pending_upload',
      )
    }

    const items = await listCaptureSessionItems(sessionId)

    if (items.length === 0) {
      conflict(
        'Capture session chưa có item hợp lệ để hoàn tất.',
        'capture_session_empty',
      )
    }

    const uploadChecks = await Promise.all(
      items.map((item) => verifyObjectExists(item.storage_key)),
    )

    if (uploadChecks.some((uploaded) => !uploaded)) {
      conflict(
        'Vẫn còn item chưa upload xong lên object storage.',
        'capture_session_upload_incomplete',
      )
    }

    const readySession = await markCaptureSessionReady(
      sessionId,
      randomBytes(24).toString('base64url'),
    )

    if (!readySession) {
      const latestSession = await findCaptureSessionById(sessionId)

      if (latestSession?.status === 'ready' && latestSession.download_token) {
        return jsonResponse(
          toCompleteResponse(
            latestSession.download_token,
            latestSession.expires_at,
            env.appBaseUrl,
          ),
          requestContext.requestId,
        )
      }

      conflict(
        'Không thể hoàn tất capture session hiện tại.',
        'capture_session_completion_conflict',
      )
    }

    return jsonResponse(
      toCompleteResponse(
        readySession.download_token!,
        readySession.expires_at,
        env.appBaseUrl,
      ),
      requestContext.requestId,
    )
  } catch (error) {
    return handleApiError(
      error,
      'Không thể hoàn tất capture session cloud.',
      requestContext,
    )
  }
}

function toCompleteResponse(
  downloadToken: string,
  expiresAtValue: string | Date,
  appBaseUrl: string,
): {
  downloadToken: string
  galleryUrl: string
  expiresAt: string
} {
  const expiresAt =
    expiresAtValue instanceof Date
      ? expiresAtValue.toISOString()
      : new Date(expiresAtValue).toISOString()

  return {
    downloadToken,
    galleryUrl: `${appBaseUrl}/#/session/${downloadToken}`,
    expiresAt,
  }
}

