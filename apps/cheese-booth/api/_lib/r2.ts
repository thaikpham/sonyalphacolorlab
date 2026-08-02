import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import {
  SIGNED_DOWNLOAD_TTL_SEC,
  SIGNED_UPLOAD_TTL_SEC,
  getAppEnv,
} from './env.js'

interface SignedUploadUrl {
  url: string
  method: 'PUT'
  headers: Record<string, string>
}

interface SignedDownloadUrlOptions {
  storageKey: string
  mimeType: string
  downloadFileName: string
  disposition?: 'attachment' | 'inline'
}

const globalForR2 = globalThis as typeof globalThis & {
  __cheeseBoothR2?: S3Client
}

function getR2Client(): S3Client {
  if (globalForR2.__cheeseBoothR2) {
    return globalForR2.__cheeseBoothR2
  }

  const env = getAppEnv()

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  })

  globalForR2.__cheeseBoothR2 = client

  return client
}

function isMissingObjectError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const withMetadata = error as Error & {
    $metadata?: { httpStatusCode?: number }
  }

  return error.name === 'NotFound' || withMetadata.$metadata?.httpStatusCode === 404
}

export async function createSignedUploadUrl(
  storageKey: string,
  mimeType: string,
): Promise<SignedUploadUrl> {
  const env = getAppEnv()
  const command = new PutObjectCommand({
    Bucket: env.r2BucketName,
    Key: storageKey,
    ContentType: mimeType,
  })

  const url = await getSignedUrl(getR2Client(), command, {
    expiresIn: SIGNED_UPLOAD_TTL_SEC,
  })

  return {
    url,
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
    },
  }
}

export async function verifyObjectExists(storageKey: string): Promise<boolean> {
  const env = getAppEnv()

  try {
    await getR2Client().send(
      new HeadObjectCommand({
        Bucket: env.r2BucketName,
        Key: storageKey,
      }),
    )

    return true
  } catch (error) {
    if (isMissingObjectError(error)) {
      return false
    }

    throw error
  }
}

export async function createSignedDownloadUrl({
  storageKey,
  mimeType,
  downloadFileName,
  disposition = 'attachment',
}: SignedDownloadUrlOptions): Promise<string> {
  const env = getAppEnv()
  const command = new GetObjectCommand({
    Bucket: env.r2BucketName,
    Key: storageKey,
    ResponseContentType: mimeType,
    ResponseContentDisposition: `${disposition}; filename="${downloadFileName}"`,
  })

  return getSignedUrl(getR2Client(), command, {
    expiresIn: SIGNED_DOWNLOAD_TTL_SEC,
  })
}

export async function deleteObjectIfExists(storageKey: string): Promise<void> {
  const env = getAppEnv()

  try {
    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: env.r2BucketName,
        Key: storageKey,
      }),
    )
  } catch (error) {
    if (isMissingObjectError(error)) {
      return
    }

    throw error
  }
}
