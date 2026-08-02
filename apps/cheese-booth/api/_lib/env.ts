export const CLOUD_SHARE_TTL_MS = 24 * 60 * 60 * 1000
export const SIGNED_UPLOAD_TTL_SEC = 600
export const SIGNED_DOWNLOAD_TTL_SEC = 300

export interface AppEnv {
  appBaseUrl: string
  databaseUrl: string
  r2AccountId: string
  r2BucketName: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  cronSecret: string | null
}

let cachedEnv: AppEnv | null = null

export function getAppEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  const databaseUrl = readEnvValue('POSTGRES_URL', 'DATABASE_URL')
  const r2AccountId = readEnvValue('R2_ACCOUNT_ID')
  const r2BucketName = readEnvValue('R2_BUCKET_NAME')
  const r2AccessKeyId = readEnvValue('R2_ACCESS_KEY_ID')
  const r2SecretAccessKey = readEnvValue('R2_SECRET_ACCESS_KEY')
  const cronSecret = readEnvValue('CRON_SECRET') || null
  const vercelUrl = process.env.VERCEL_URL?.trim()
  const appBaseUrl = (
    readEnvValue('APP_BASE_URL') ||
    (vercelUrl ? `https://${vercelUrl}` : 'https://cheesebooth.vercel.app')
  ).replace(/\/+$/, '')

  const missing = [
    !databaseUrl ? 'POSTGRES_URL or DATABASE_URL' : null,
    !r2AccountId ? 'R2_ACCOUNT_ID' : null,
    !r2BucketName ? 'R2_BUCKET_NAME' : null,
    !r2AccessKeyId ? 'R2_ACCESS_KEY_ID' : null,
    !r2SecretAccessKey ? 'R2_SECRET_ACCESS_KEY' : null,
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new Error(
      `Thiếu biến môi trường cloud share: ${missing.join(', ')}.`,
    )
  }

  cachedEnv = {
    appBaseUrl,
    databaseUrl: databaseUrl!,
    r2AccountId: r2AccountId!,
    r2BucketName: r2BucketName!,
    r2AccessKeyId: r2AccessKeyId!,
    r2SecretAccessKey: r2SecretAccessKey!,
    cronSecret,
  }

  return cachedEnv
}

function readEnvValue(...names: string[]): string | undefined {
  for (const name of names) {
    const exact = process.env[name]?.trim()

    if (exact) {
      return exact
    }
  }

  const entries = Object.entries(process.env).sort(([left], [right]) =>
    left.localeCompare(right),
  )

  for (const name of names) {
    const suffix = `_${name}`

    for (const [key, value] of entries) {
      const normalized = value?.trim()

      if (key.endsWith(suffix) && normalized) {
        return normalized
      }
    }
  }

  return undefined
}
