import { randomUUID } from 'crypto'

import {
  buildCaptureStorageKey,
  parseCaptureKind,
  parseExtension,
  parseMimeType,
  parsePositiveInteger,
  validateCapturePayload,
} from '../_lib/capturePayload.js'
import { createPendingCapture } from '../_lib/db.js'
import { CLOUD_SHARE_TTL_MS, getAppEnv } from '../_lib/env.js'
import {
  assertAllowedAppOrigin,
  createRequestContext,
  handleApiError,
  jsonResponse,
  parseJsonBody,
} from '../_lib/http.js'
import { createSignedUploadUrl } from '../_lib/r2.js'

export const runtime = 'nodejs'

interface InitCaptureRequestBody {
  kind?: string
  mimeType?: string
  extension?: string
  byteSize?: number
  width?: number
  height?: number
}

export async function POST(request: Request): Promise<Response> {
  const requestContext = createRequestContext(request)

  try {
    const env = getAppEnv()
    assertAllowedAppOrigin(request, env.appBaseUrl)

    const body = await parseJsonBody<InitCaptureRequestBody>(request)
    const kind = parseCaptureKind(body.kind)
    const mimeType = parseMimeType(body.mimeType)
    const extension = parseExtension(body.extension)
    const byteSize = parsePositiveInteger(body.byteSize, 'Kích thước file')
    const width = parsePositiveInteger(body.width, 'Chiều rộng')
    const height = parsePositiveInteger(body.height, 'Chiều cao')

    validateCapturePayload({
      kind,
      mimeType,
      extension,
      byteSize,
      width,
      height,
    })

    const captureId = randomUUID()
    const expiresAt = new Date(Date.now() + CLOUD_SHARE_TTL_MS)
    const storageKey = buildCaptureStorageKey(kind, captureId, extension)

    await createPendingCapture({
      captureId,
      kind,
      storageKey,
      mimeType,
      extension,
      byteSize,
      width,
      height,
      expiresAt,
    })

    const upload = await createSignedUploadUrl(storageKey, mimeType)

    return jsonResponse(
      {
        captureId,
        storageKey,
        upload,
        expiresAt: expiresAt.toISOString(),
      },
      requestContext.requestId,
    )
  } catch (error) {
    return handleApiError(
      error,
      'Không thể khởi tạo phiên upload cloud.',
      requestContext,
    )
  }
}
