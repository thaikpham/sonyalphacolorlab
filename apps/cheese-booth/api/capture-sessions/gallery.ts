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

export const runtime = 'nodejs'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/

export async function GET(request: Request): Promise<Response> {
  const requestContext = createRequestContext(request)

  try {
    const requestUrl = new URL(request.url)
    const token = requestUrl.searchParams.get('token')?.trim()

    if (!token || !TOKEN_PATTERN.test(token)) {
      notFound(
        'Link gallery session không hợp lệ.',
        'invalid_capture_session_token',
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

    return Response.json(
      {
        sessionId: captureSession.session_id,
        downloadToken: token,
        expiresAt:
          captureSession.expires_at instanceof Date
            ? captureSession.expires_at.toISOString()
            : new Date(captureSession.expires_at).toISOString(),
        createdAt:
          captureSession.created_at instanceof Date
            ? captureSession.created_at.toISOString()
            : new Date(captureSession.created_at).toISOString(),
        items: items.map((item) => ({
          captureId: item.capture_id,
          sequence: item.sequence,
          kind: item.kind,
          mimeType: item.mime_type,
          extension: item.extension,
          width: item.width,
          height: item.height,
          previewUrl: buildMediaUrl(requestUrl, token, item.capture_id, 'inline'),
          downloadUrl: buildMediaUrl(requestUrl, token, item.capture_id, 'attachment'),
        })),
      },
      {
        status: 200,
        headers: {
          'x-request-id': requestContext.requestId,
        },
      },
    )
  } catch (error) {
    return handleApiError(
      error,
      'Không thể tải gallery capture session.',
      requestContext,
    )
  }
}

function buildMediaUrl(
  requestUrl: URL,
  token: string,
  captureId: string,
  disposition: 'inline' | 'attachment',
): string {
  const mediaUrl = new URL('/api/capture-sessions/media', requestUrl.origin)

  mediaUrl.searchParams.set('token', token)
  mediaUrl.searchParams.set('captureId', captureId)
  mediaUrl.searchParams.set('disposition', disposition)

  return mediaUrl.toString()
}

