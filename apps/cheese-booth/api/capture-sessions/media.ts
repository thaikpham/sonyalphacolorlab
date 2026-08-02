import {
  findCaptureSessionByToken,
  listCaptureSessionItems,
} from '../_lib/db.js'
import {
  createRequestContext,
  gone,
  handleApiError,
  notFound,
} from '../_lib/http.js'
import { createSignedDownloadUrl } from '../_lib/r2.js'

export const runtime = 'nodejs'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/
const CAPTURE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request): Promise<Response> {
  const requestContext = createRequestContext(request)

  try {
    const requestUrl = new URL(request.url)
    const token = requestUrl.searchParams.get('token')?.trim()
    const captureId = requestUrl.searchParams.get('captureId')?.trim()
    const disposition =
      requestUrl.searchParams.get('disposition') === 'inline'
        ? 'inline'
        : 'attachment'

    if (!token || !TOKEN_PATTERN.test(token)) {
      notFound(
        'Link media session không hợp lệ.',
        'invalid_capture_session_token',
      )
    }

    if (!captureId || !CAPTURE_ID_PATTERN.test(captureId)) {
      notFound(
        'Capture media không hợp lệ.',
        'invalid_capture_session_media_id',
      )
    }

    const captureSession = await findCaptureSessionByToken(token)

    if (!captureSession) {
      notFound(
        'Capture session không tồn tại.',
        'capture_session_token_not_found',
      )
    }

    if (
      captureSession.status === 'deleted' ||
      new Date(captureSession.expires_at).getTime() <= Date.now()
    ) {
      gone(
        'Capture session đã hết hạn.',
        'capture_session_token_expired',
      )
    }

    if (captureSession.status !== 'ready') {
      notFound(
        'Capture session chưa sẵn sàng.',
        'capture_session_not_ready',
      )
    }

    const items = await listCaptureSessionItems(captureSession.session_id)
    const item = items.find((currentItem) => currentItem.capture_id === captureId)

    if (!item) {
      notFound(
        'Capture media không thuộc session này.',
        'capture_session_media_not_found',
      )
    }

    const downloadUrl = await createSignedDownloadUrl({
      storageKey: item.storage_key,
      mimeType: item.mime_type,
      disposition,
      downloadFileName: `${item.kind}-${String(item.sequence).padStart(2, '0')}-${item.capture_id}.${item.extension}`,
    })

    return new Response(null, {
      status: 302,
      headers: {
        location: downloadUrl,
        'x-request-id': requestContext.requestId,
      },
    })
  } catch (error) {
    return handleApiError(
      error,
      'Không thể tạo link media cho capture session.',
      requestContext,
    )
  }
}
