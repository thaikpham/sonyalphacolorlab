import { pingDatabase } from '../_lib/db.js'
import { getAppEnv } from '../_lib/env.js'
import {
  createRequestContext,
  handleApiError,
  jsonResponse,
} from '../_lib/http.js'
import { createSignedUploadUrl } from '../_lib/r2.js'

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<Response> {
  const requestContext = createRequestContext(request)

  try {
    const env = getAppEnv()

    await pingDatabase()
    await createSignedUploadUrl(
      `healthchecks/${requestContext.requestId}.bin`,
      'application/octet-stream',
    )

    return jsonResponse(
      {
        ok: true,
        requestId: requestContext.requestId,
        checks: {
          env: 'ready',
          database: 'ready',
          r2Signer: 'ready',
        },
        appBaseUrl: env.appBaseUrl,
      },
      requestContext.requestId,
    )
  } catch (error) {
    return handleApiError(
      error,
      'Cloud share health check thất bại.',
      requestContext,
    )
  }
}
