const CLOUD_SHARE_ENV_KEYS = [
  'APP_BASE_URL',
  'POSTGRES_URL',
  'DATABASE_URL',
  'R2_ACCOUNT_ID',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'CRON_SECRET',
] as const

interface JsonRequestOptions {
  method?: string
  origin?: string
  headers?: HeadersInit
  body?: unknown
}

export function resetCloudShareEnv(): void {
  CLOUD_SHARE_ENV_KEYS.forEach((key) => {
    delete process.env[key]
  })
}

export function applyCloudShareEnv(
  overrides: Partial<Record<(typeof CLOUD_SHARE_ENV_KEYS)[number], string>> = {},
): void {
  resetCloudShareEnv()

  const defaults: Record<(typeof CLOUD_SHARE_ENV_KEYS)[number], string> = {
    APP_BASE_URL: 'https://cheesebooth.vercel.app',
    POSTGRES_URL: 'postgres://user:pass@example.com/cloudshare',
    DATABASE_URL: '',
    R2_ACCOUNT_ID: 'test-account',
    R2_BUCKET_NAME: 'test-bucket',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    CRON_SECRET: 'test-cron-secret',
  }

  Object.entries({
    ...defaults,
    ...overrides,
  }).forEach(([key, value]) => {
    if (value) {
      process.env[key] = value
    } else {
      delete process.env[key]
    }
  })
}

export function createJsonRequest(
  url: string,
  options: JsonRequestOptions = {},
): Request {
  const headers = new Headers(options.headers)

  if (options.origin) {
    headers.set('origin', options.origin)
  }

  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  return new Request(url, {
    method: options.method ?? 'POST',
    headers,
    body:
      options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}
