import { randomUUID } from 'crypto'

import {
  buildCaptureStorageKey,
  parseCaptureKind,
  parseExtension,
  parseMimeType,
  parsePositiveInteger,
  validateCapturePayload,
} from '../_lib/capturePayload.js'
import { createPendingCaptureSession } from '../_lib/db.js'
import { CLOUD_SHARE_TTL_MS, getAppEnv } from '../_lib/env.js'
import {
  assertAllowedAppOrigin,
  badRequest,
  createRequestContext,
  handleApiError,
  jsonResponse,
  parseJsonBody,
} from '../_lib/http.js'
import { createSignedUploadUrl } from '../_lib/r2.js'

export const runtime = 'nodejs'

const MAX_SESSION_ITEMS = 4
const PERFORMANCE_SESSION_ITEMS = 1

interface InitCaptureSessionRequestBody {
  items?: Array<{
    kind?: string
    mimeType?: string
    extension?: string
    byteSize?: number
    width?: number
    height?: number
    sequence?: number
  }>
}

export async function POST(request: Request): Promise<Response> {
  const requestContext = createRequestContext(request)

  try {
    const env = getAppEnv()
    assertAllowedAppOrigin(request, env.appBaseUrl)

    const body = await parseJsonBody<InitCaptureSessionRequestBody>(request)
    const rawItems = body.items

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      badRequest(
        'Session cần ít nhất một capture item.',
        'missing_capture_session_items',
      )
    }

    if (rawItems.length > MAX_SESSION_ITEMS) {
      badRequest(
        `Session chỉ hỗ trợ tối đa ${MAX_SESSION_ITEMS} item.`,
        'capture_session_item_limit_exceeded',
      )
    }

    const seenSequences = new Set<number>()
    const sessionId = randomUUID()
    const expiresAt = new Date(Date.now() + CLOUD_SHARE_TTL_MS)
    const items = rawItems.map((item, index) => {
      const sequence = parsePositiveInteger(
        item.sequence,
        `Thứ tự item ${index + 1}`,
        'invalid_capture_session_sequence',
      )

      if (sequence > MAX_SESSION_ITEMS || seenSequences.has(sequence)) {
        badRequest(
          `Sequence ${sequence} không hợp lệ cho session hiện tại.`,
          'invalid_capture_session_sequence',
        )
      }

      seenSequences.add(sequence)

      const kind = parseCaptureKind(item.kind)
      const mimeType = parseMimeType(item.mimeType)
      const extension = parseExtension(item.extension)
      const byteSize = parsePositiveInteger(item.byteSize, 'Kích thước file')
      const width = parsePositiveInteger(item.width, 'Chiều rộng')
      const height = parsePositiveInteger(item.height, 'Chiều cao')

      validateCapturePayload({
        kind,
        mimeType,
        extension,
        byteSize,
        width,
        height,
      })

      const captureId = randomUUID()

      return {
        captureId,
        sequence,
        kind,
        mimeType,
        extension,
        byteSize,
        width,
        height,
        storageKey: buildCaptureStorageKey(kind, captureId, extension),
      }
    })

    const containsPerformance = items.some((item) => item.kind === 'performance')

    if (
      containsPerformance &&
      (items.length !== PERFORMANCE_SESSION_ITEMS ||
        items[0]?.kind !== 'performance' ||
        items[0]?.sequence !== 1)
    ) {
      badRequest(
        'Session performance chỉ hỗ trợ đúng 1 clip MP4 ở sequence 1.',
        'capture_session_performance_limit_exceeded',
      )
    }

    await createPendingCaptureSession({
      sessionId,
      expiresAt,
      items,
    })

    const uploadTargets = await Promise.all(
      items.map(async (item) => ({
        captureId: item.captureId,
        sequence: item.sequence,
        upload: await createSignedUploadUrl(item.storageKey, item.mimeType),
      })),
    )

    return jsonResponse(
      {
        sessionId,
        expiresAt: expiresAt.toISOString(),
        items: uploadTargets,
      },
      requestContext.requestId,
    )
  } catch (error) {
    return handleApiError(
      error,
      'Không thể khởi tạo session upload cloud.',
      requestContext,
    )
  }
}
