import { findCaptureByToken } from './_lib/db.js'
import {
  createRequestContext,
  gone,
  handleApiError,
  notFound,
} from './_lib/http.js'
import { createSignedDownloadUrl } from './_lib/r2.js'

export const runtime = 'nodejs'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/

export async function GET(request: Request): Promise<Response> {
  const requestContext = createRequestContext(request)

  try {
    const token = new URL(request.url).searchParams.get('token')?.trim()

    if (!token || !TOKEN_PATTERN.test(token)) {
      notFound('Link tải không hợp lệ.', 'invalid_download_token')
    }

    const capture = await findCaptureByToken(token)

    if (!capture) {
      notFound('Link tải không tồn tại.', 'download_token_not_found')
    }

    if (
      capture.status === 'deleted' ||
      new Date(capture.expires_at).getTime() <= Date.now()
    ) {
      gone('Link tải đã hết hạn.', 'download_token_expired')
    }

    if (capture.status !== 'ready') {
      notFound('Link tải chưa sẵn sàng.', 'download_not_ready')
    }

    const downloadUrl = await createSignedDownloadUrl({
      storageKey: capture.storage_key,
      mimeType: capture.mime_type,
      downloadFileName: `${capture.kind}-${capture.capture_id}.${capture.extension}`,
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
      'Không thể tạo download link tạm thời.',
      requestContext,
    )
  }
}
