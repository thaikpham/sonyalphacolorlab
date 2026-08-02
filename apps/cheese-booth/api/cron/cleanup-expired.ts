import {
  listCaptureSessionItems,
  listExpiredCaptures,
  listExpiredCaptureSessions,
  markCaptureDeleted,
  markCaptureSessionDeleted,
} from '../_lib/db.js'
import { getAppEnv } from '../_lib/env.js'
import {
  createRequestContext,
  handleApiError,
  jsonResponse,
  serviceUnavailable,
  unauthorized,
} from '../_lib/http.js'
import { deleteObjectIfExists } from '../_lib/r2.js'

export const runtime = 'nodejs'

const CLEANUP_BATCH_SIZE = 200
const MAX_BATCH_PASSES = 10

export async function GET(request: Request): Promise<Response> {
  const requestContext = createRequestContext(request)

  try {
    authorizeCronRequest(request)

    let processed = 0
    let deleted = 0
    const failedIds: string[] = []

    for (let batchIndex = 0; batchIndex < MAX_BATCH_PASSES; batchIndex += 1) {
      const expiredCaptures = await listExpiredCaptures(CLEANUP_BATCH_SIZE)
      const expiredSessions = await listExpiredCaptureSessions(CLEANUP_BATCH_SIZE)

      if (expiredCaptures.length === 0 && expiredSessions.length === 0) {
        break
      }

      processed += expiredCaptures.length

      for (const capture of expiredCaptures) {
        try {
          await deleteObjectIfExists(capture.storage_key)
          await markCaptureDeleted(capture.capture_id)
          deleted += 1
        } catch (error) {
          console.error('Không thể cleanup capture hết hạn.', capture.capture_id, error)
          failedIds.push(capture.capture_id)
        }
      }

      if (expiredSessions.length === 0) {
        continue
      }

      processed += expiredSessions.length

      for (const captureSession of expiredSessions) {
        try {
          const items = await listCaptureSessionItems(captureSession.session_id)

          await Promise.all(
            items.map((item) => deleteObjectIfExists(item.storage_key)),
          )
          await markCaptureSessionDeleted(captureSession.session_id)
          deleted += 1
        } catch (error) {
          console.error(
            'Không thể cleanup capture session hết hạn.',
            captureSession.session_id,
            error,
          )
          failedIds.push(captureSession.session_id)
        }
      }
    }

    return jsonResponse(
      {
        processed,
        deleted,
        failed: failedIds.length,
        failedCaptureIds: failedIds.slice(0, 20),
      },
      requestContext.requestId,
    )
  } catch (error) {
    return handleApiError(
      error,
      'Không thể dọn capture hết hạn.',
      requestContext,
    )
  }
}

function authorizeCronRequest(request: Request): void {
  const cronSecret = getAppEnv().cronSecret

  if (!cronSecret) {
    serviceUnavailable(
      'Cleanup cron chưa được cấu hình `CRON_SECRET`.',
      'cron_secret_missing',
    )
  }

  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    unauthorized(
      'Authorization cho cleanup cron không hợp lệ.',
      'invalid_cron_secret',
    )
  }
}
