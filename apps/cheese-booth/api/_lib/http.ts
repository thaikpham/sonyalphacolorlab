import { randomUUID } from 'crypto'

export class HttpError extends Error {
  status: number
  code: string

  constructor(status: number, message: string, code = 'internal_error') {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

export interface RequestContext {
  requestId: string
}

interface ErrorResponseOptions {
  code?: string
  requestId?: string
}

function buildRequestIdHeaders(requestId: string): Headers {
  const headers = new Headers()
  headers.set('x-request-id', requestId)

  return headers
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getRequestOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')?.trim()

  if (origin) {
    return normalizeOrigin(origin)
  }

  const referer = request.headers.get('referer')?.trim()

  if (referer) {
    return normalizeOrigin(referer)
  }

  return null
}

function isCloudShareConfigurationError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('thiếu biến môi trường cloud share')
  )
}

export function createRequestContext(request?: Request): RequestContext {
  const inboundRequestId = request?.headers.get('x-request-id')?.trim()

  return {
    requestId: inboundRequestId || randomUUID(),
  }
}

export function jsonResponse(
  body: unknown,
  requestId: string,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: buildRequestIdHeaders(requestId),
  })
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new HttpError(400, 'Payload JSON không hợp lệ.', 'invalid_json_payload')
  }
}

export function badRequest(message: string, code = 'bad_request'): never {
  throw new HttpError(400, message, code)
}

export function unauthorized(message: string, code = 'unauthorized'): never {
  throw new HttpError(401, message, code)
}

export function forbidden(message: string, code = 'forbidden'): never {
  throw new HttpError(403, message, code)
}

export function notFound(message: string, code = 'not_found'): never {
  throw new HttpError(404, message, code)
}

export function conflict(message: string, code = 'conflict'): never {
  throw new HttpError(409, message, code)
}

export function gone(message: string, code = 'gone'): never {
  throw new HttpError(410, message, code)
}

export function serviceUnavailable(
  message: string,
  code = 'service_unavailable',
): never {
  throw new HttpError(503, message, code)
}

export function assertAllowedAppOrigin(
  request: Request,
  appBaseUrl: string,
): void {
  const allowedOrigin = normalizeOrigin(appBaseUrl)

  if (!allowedOrigin) {
    serviceUnavailable(
      'APP_BASE_URL không hợp lệ cho cloud share API.',
      'invalid_app_base_url',
    )
  }

  const requestOrigin = getRequestOrigin(request)

  if (!requestOrigin) {
    forbidden(
      'Cloud share API yêu cầu Origin hoặc Referer khớp với `APP_BASE_URL`.',
      'origin_required',
    )
  }

  if (requestOrigin !== allowedOrigin) {
    forbidden(
      `Origin không được phép cho cloud share API. Hãy gửi request từ ${allowedOrigin}.`,
      'origin_not_allowed',
    )
  }
}

export function errorResponse(
  message: string,
  status: number,
  options: ErrorResponseOptions = {},
): Response {
  const requestId = options.requestId ?? randomUUID()

  return Response.json(
    {
      error: message,
      code: options.code ?? 'internal_error',
      requestId,
    },
    {
      status,
      headers: buildRequestIdHeaders(requestId),
    },
  )
}

function isDatabaseConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const maybeCode = (error as Error & { code?: string }).code
  const normalizedMessage = error.message.toLowerCase()

  return (
    maybeCode === 'CONNECT_TIMEOUT' ||
    maybeCode === 'ECONNREFUSED' ||
    maybeCode === 'ENOTFOUND' ||
    maybeCode === 'EHOSTUNREACH' ||
    maybeCode === 'ETIMEDOUT' ||
    normalizedMessage.includes('connect_timeout') ||
    normalizedMessage.includes('econnrefused') ||
    normalizedMessage.includes('connection terminated unexpectedly')
  )
}

export function handleApiError(
  error: unknown,
  fallbackMessage: string,
  requestContext?: RequestContext,
): Response {
  const requestId = requestContext?.requestId ?? randomUUID()

  if (error instanceof HttpError) {
    return errorResponse(error.message, error.status, {
      code: error.code,
      requestId,
    })
  }

  console.error(`[${requestId}] ${fallbackMessage}`, error)

  if (isDatabaseConnectivityError(error)) {
    return errorResponse(
      'Cloud share backend chưa kết nối được database. Hãy kiểm tra `POSTGRES_URL` hoặc `DATABASE_URL` và kết nối Postgres từ môi trường hiện tại.',
      503,
      {
        code: 'database_unavailable',
        requestId,
      },
    )
  }

  if (isCloudShareConfigurationError(error)) {
    return errorResponse(error.message, 503, {
      code: 'missing_environment',
      requestId,
    })
  }

  return errorResponse(
    error instanceof Error && error.message ? error.message : fallbackMessage,
    500,
    {
      code: 'internal_error',
      requestId,
    },
  )
}
