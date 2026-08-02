import { neon } from '@neondatabase/serverless'

import type { CaptureKind } from './capturePayload.js'
import { getAppEnv } from './env.js'

export interface CaptureDownloadRecord {
  capture_id: string
  kind: CaptureKind
  storage_key: string
  mime_type: string
  extension: string
  byte_size: number
  width: number
  height: number
  download_token: string | null
  status: 'pending_upload' | 'ready' | 'deleted'
  expires_at: string | Date
  created_at: string | Date
  uploaded_at: string | Date | null
  deleted_at: string | Date | null
}

interface CreatePendingCaptureInput {
  captureId: string
  kind: CaptureKind
  storageKey: string
  mimeType: string
  extension: string
  byteSize: number
  width: number
  height: number
  expiresAt: Date
}

export interface CaptureShareSessionRecord {
  session_id: string
  download_token: string | null
  status: 'pending_upload' | 'ready' | 'deleted'
  expires_at: string | Date
  created_at: string | Date
  uploaded_at: string | Date | null
  deleted_at: string | Date | null
}

export interface CaptureShareSessionItemRecord {
  capture_id: string
  session_id: string
  sequence: number
  kind: CaptureKind
  storage_key: string
  mime_type: string
  extension: string
  byte_size: number
  width: number
  height: number
  created_at: string | Date
}

interface CreatePendingCaptureSessionInput {
  sessionId: string
  expiresAt: Date
  items: Array<{
    captureId: string
    sequence: number
    kind: CaptureKind
    storageKey: string
    mimeType: string
    extension: string
    byteSize: number
    width: number
    height: number
  }>
}

type DatabaseClient = ReturnType<typeof neon>

const globalForDatabase = globalThis as typeof globalThis & {
  __cheeseBoothSql?: DatabaseClient
  __cheeseBoothSchemaReady?: Promise<void>
}

const sql = globalForDatabase.__cheeseBoothSql ?? neon(getAppEnv().databaseUrl)

if (!globalForDatabase.__cheeseBoothSql) {
  globalForDatabase.__cheeseBoothSql = sql
}

export async function ensureSchema(): Promise<void> {
  globalForDatabase.__cheeseBoothSchemaReady ??= (async () => {
    await sql.transaction((tx) => [
      // Serialize first-run schema bootstrap across concurrent function workers.
      tx`SELECT pg_advisory_xact_lock(947201, 1)`,
      tx`
        CREATE TABLE IF NOT EXISTS capture_downloads (
          capture_id uuid PRIMARY KEY,
          kind text NOT NULL CHECK (kind IN ('photo', 'boomerang', 'performance')),
          storage_key text NOT NULL UNIQUE,
          mime_type text NOT NULL,
          extension text NOT NULL,
          byte_size integer NOT NULL,
          width integer NOT NULL,
          height integer NOT NULL,
          download_token text,
          status text NOT NULL CHECK (status IN ('pending_upload', 'ready', 'deleted')),
          expires_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          uploaded_at timestamptz,
          deleted_at timestamptz
        )
      `,
      tx`
        CREATE UNIQUE INDEX IF NOT EXISTS capture_downloads_download_token_idx
        ON capture_downloads (download_token)
        WHERE download_token IS NOT NULL
      `,
      tx`
        CREATE INDEX IF NOT EXISTS capture_downloads_status_expires_at_idx
        ON capture_downloads (status, expires_at)
      `,
      tx`
        ALTER TABLE capture_downloads
        DROP CONSTRAINT IF EXISTS capture_downloads_kind_check
      `,
      tx`
        ALTER TABLE capture_downloads
        ADD CONSTRAINT capture_downloads_kind_check
        CHECK (kind IN ('photo', 'boomerang', 'performance'))
      `,
      tx`
        CREATE TABLE IF NOT EXISTS capture_share_sessions (
          session_id uuid PRIMARY KEY,
          download_token text,
          status text NOT NULL CHECK (status IN ('pending_upload', 'ready', 'deleted')),
          expires_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          uploaded_at timestamptz,
          deleted_at timestamptz
        )
      `,
      tx`
        CREATE UNIQUE INDEX IF NOT EXISTS capture_share_sessions_download_token_idx
        ON capture_share_sessions (download_token)
        WHERE download_token IS NOT NULL
      `,
      tx`
        CREATE INDEX IF NOT EXISTS capture_share_sessions_status_expires_at_idx
        ON capture_share_sessions (status, expires_at)
      `,
      tx`
        CREATE TABLE IF NOT EXISTS capture_share_session_items (
          capture_id uuid PRIMARY KEY,
          session_id uuid NOT NULL REFERENCES capture_share_sessions (session_id),
          sequence integer NOT NULL,
          kind text NOT NULL CHECK (kind IN ('photo', 'boomerang', 'performance')),
          storage_key text NOT NULL UNIQUE,
          mime_type text NOT NULL,
          extension text NOT NULL,
          byte_size integer NOT NULL,
          width integer NOT NULL,
          height integer NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT capture_share_session_items_sequence_unique
            UNIQUE (session_id, sequence)
        )
      `,
      tx`
        CREATE INDEX IF NOT EXISTS capture_share_session_items_session_sequence_idx
        ON capture_share_session_items (session_id, sequence)
      `,
      tx`
        ALTER TABLE capture_share_session_items
        DROP CONSTRAINT IF EXISTS capture_share_session_items_kind_check
      `,
      tx`
        ALTER TABLE capture_share_session_items
        ADD CONSTRAINT capture_share_session_items_kind_check
        CHECK (kind IN ('photo', 'boomerang', 'performance'))
      `,
    ])
  })()

  await globalForDatabase.__cheeseBoothSchemaReady
}

export async function pingDatabase(): Promise<void> {
  await ensureSchema()
  await sql`SELECT 1`
}

export async function createPendingCapture(
  input: CreatePendingCaptureInput,
): Promise<void> {
  await ensureSchema()

  await sql`
    INSERT INTO capture_downloads (
      capture_id,
      kind,
      storage_key,
      mime_type,
      extension,
      byte_size,
      width,
      height,
      status,
      expires_at
    ) VALUES (
      ${input.captureId},
      ${input.kind},
      ${input.storageKey},
      ${input.mimeType},
      ${input.extension},
      ${input.byteSize},
      ${input.width},
      ${input.height},
      'pending_upload',
      ${input.expiresAt.toISOString()}
    )
  `
}

export async function findCaptureById(
  captureId: string,
): Promise<CaptureDownloadRecord | null> {
  await ensureSchema()

  const rows = (await sql`
    SELECT *
    FROM capture_downloads
    WHERE capture_id = ${captureId}
    LIMIT 1
  `) as CaptureDownloadRecord[]

  return rows[0] ?? null
}

export async function findCaptureByToken(
  downloadToken: string,
): Promise<CaptureDownloadRecord | null> {
  await ensureSchema()

  const rows = (await sql`
    SELECT *
    FROM capture_downloads
    WHERE download_token = ${downloadToken}
    LIMIT 1
  `) as CaptureDownloadRecord[]

  return rows[0] ?? null
}

export async function markCaptureReady(
  captureId: string,
  downloadToken: string,
): Promise<CaptureDownloadRecord | null> {
  await ensureSchema()

  const rows = (await sql`
    UPDATE capture_downloads
    SET
      download_token = ${downloadToken},
      status = 'ready',
      uploaded_at = now()
    WHERE capture_id = ${captureId}
      AND status = 'pending_upload'
    RETURNING *
  `) as CaptureDownloadRecord[]

  return rows[0] ?? null
}

export async function listExpiredCaptures(
  limit: number,
): Promise<CaptureDownloadRecord[]> {
  await ensureSchema()

  return (await sql`
    SELECT *
    FROM capture_downloads
    WHERE expires_at <= now()
      AND status <> 'deleted'
    ORDER BY expires_at ASC
    LIMIT ${limit}
  `) as CaptureDownloadRecord[]
}

export async function markCaptureDeleted(captureId: string): Promise<void> {
  await ensureSchema()

  await sql`
    UPDATE capture_downloads
    SET
      status = 'deleted',
      deleted_at = now()
    WHERE capture_id = ${captureId}
      AND status <> 'deleted'
  `
}

export async function createPendingCaptureSession(
  input: CreatePendingCaptureSessionInput,
): Promise<void> {
  await ensureSchema()

  await sql.transaction((tx) => [
    tx`
      INSERT INTO capture_share_sessions (
        session_id,
        status,
        expires_at
      ) VALUES (
        ${input.sessionId},
        'pending_upload',
        ${input.expiresAt.toISOString()}
      )
    `,
    ...input.items.map((item) => tx`
      INSERT INTO capture_share_session_items (
        capture_id,
        session_id,
        sequence,
        kind,
        storage_key,
        mime_type,
        extension,
        byte_size,
        width,
        height
      ) VALUES (
        ${item.captureId},
        ${input.sessionId},
        ${item.sequence},
        ${item.kind},
        ${item.storageKey},
        ${item.mimeType},
        ${item.extension},
        ${item.byteSize},
        ${item.width},
        ${item.height}
      )
    `),
  ])
}

export async function findCaptureSessionById(
  sessionId: string,
): Promise<CaptureShareSessionRecord | null> {
  await ensureSchema()

  const rows = (await sql`
    SELECT *
    FROM capture_share_sessions
    WHERE session_id = ${sessionId}
    LIMIT 1
  `) as CaptureShareSessionRecord[]

  return rows[0] ?? null
}

export async function findCaptureSessionByToken(
  downloadToken: string,
): Promise<CaptureShareSessionRecord | null> {
  await ensureSchema()

  const rows = (await sql`
    SELECT *
    FROM capture_share_sessions
    WHERE download_token = ${downloadToken}
    LIMIT 1
  `) as CaptureShareSessionRecord[]

  return rows[0] ?? null
}

export async function listCaptureSessionItems(
  sessionId: string,
): Promise<CaptureShareSessionItemRecord[]> {
  await ensureSchema()

  return (await sql`
    SELECT *
    FROM capture_share_session_items
    WHERE session_id = ${sessionId}
    ORDER BY sequence ASC
  `) as CaptureShareSessionItemRecord[]
}

export async function markCaptureSessionReady(
  sessionId: string,
  downloadToken: string,
): Promise<CaptureShareSessionRecord | null> {
  await ensureSchema()

  const rows = (await sql`
    UPDATE capture_share_sessions
    SET
      download_token = ${downloadToken},
      status = 'ready',
      uploaded_at = now()
    WHERE session_id = ${sessionId}
      AND status = 'pending_upload'
    RETURNING *
  `) as CaptureShareSessionRecord[]

  return rows[0] ?? null
}

export async function listExpiredCaptureSessions(
  limit: number,
): Promise<CaptureShareSessionRecord[]> {
  await ensureSchema()

  return (await sql`
    SELECT *
    FROM capture_share_sessions
    WHERE expires_at <= now()
      AND status <> 'deleted'
    ORDER BY expires_at ASC
    LIMIT ${limit}
  `) as CaptureShareSessionRecord[]
}

export async function markCaptureSessionDeleted(
  sessionId: string,
): Promise<void> {
  await ensureSchema()

  await sql`
    UPDATE capture_share_sessions
    SET
      status = 'deleted',
      deleted_at = now()
    WHERE session_id = ${sessionId}
      AND status <> 'deleted'
  `
}
