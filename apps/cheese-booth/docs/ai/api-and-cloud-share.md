# API And Cloud Share

## Purpose

Summarize the backend route inventory, shared `api/_lib/*` responsibilities, storage/database dependencies, and which frontend modules call which routes.

## When To Read This

Read this before changing:

- `api/*`
- cloud-share request/response contracts
- tokenized gallery/download behavior
- R2/Postgres integration
- environment variable expectations

## Canonical Modules

- `src/lib/cloudShare.ts`
- `src/lib/cloudShare/sessionClient.ts`
- `src/lib/cloudShare/legacyClient.ts`
- `src/lib/cloudShare/shared.ts`
- `api/_lib/env.ts`
- `api/_lib/http.ts`
- `api/_lib/db.ts`
- `api/_lib/r2.ts`
- `api/_lib/capturePayload.ts`
- `api/capture-sessions/*`
- `api/captures/*`
- `api/download.ts`
- `api/health/cloud-share.ts`
- `api/cron/cleanup-expired.ts`

## Backend Boundary

This backend is not a generic media API. It is a narrow browser-kiosk cloud-share backend with these jobs:

- validate capture metadata before upload
- mint presigned R2 upload URLs
- store metadata in Postgres
- verify object existence before promoting a capture/session to ready
- mint short-lived download/gallery tokens
- redirect guests to presigned download/media URLs
- delete expired objects and mark metadata as deleted

## Shared Backend Helpers

## `api/_lib/env.ts`

Purpose:
- central environment loading and TTL constants

Depends on:

- `POSTGRES_URL` or `DATABASE_URL`
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- optional `CRON_SECRET`
- optional `APP_BASE_URL`

Important rule:

- API requests that originate from the browser are checked against `APP_BASE_URL`.

## `api/_lib/http.ts`

Purpose:
- request IDs
- JSON parsing
- structured HTTP errors
- origin enforcement
- consistent API error responses

Important rule:

- browser-facing init/complete routes reject requests whose `Origin` or `Referer` does not match `APP_BASE_URL`.

## `api/_lib/db.ts`

Purpose:
- Neon/Postgres access
- first-run schema bootstrap
- CRUD helpers for captures and capture sessions

Tables created on demand:

- `capture_downloads`
- `capture_share_sessions`
- `capture_share_session_items`

## `api/_lib/r2.ts`

Purpose:

- create presigned upload URLs
- create presigned download URLs
- verify object existence
- delete expired objects

## `api/_lib/capturePayload.ts`

Purpose:
- validate capture kind, MIME type, extension, byte size, and dimensions
- build storage keys

Current constraints:

- `photo` -> JPEG only
- `boomerang` -> MP4 only
- `performance` -> MP4 only, up to 150 MB, max 2048 px on each edge
- session limit -> 4 items
- `performance` session limit -> exactly 1 item at sequence `1`

## Frontend Caller Map

Primary frontend caller:
- `src/lib/cloudShare.ts`

Client split:

- `sessionClient.ts`
  current browser-session QR/gallery flow
- `legacyClient.ts`
  compatibility-only single-capture flow
- `shared.ts`
  shared fetch/error/upload primitives

Current main session flow calls:

- `POST /api/capture-sessions/init`
- `POST /api/capture-sessions/complete`
- `GET /api/capture-sessions/gallery`

Legacy/single-capture helpers still exist in the client and API:

- `POST /api/captures/init`
- `POST /api/captures/complete`
- `GET /api/download`

Ops/manual routes:

- `GET /api/health/cloud-share`
- `GET /api/cron/cleanup-expired`

## Route Inventory

## `POST /api/captures/init`

Purpose:
- create a pending single capture record and return a presigned R2 upload target

Depends on:

- origin check via `APP_BASE_URL`
- payload validation
- Postgres insert
- R2 signer

Returns / side effects:

- `captureId`
- `storageKey`
- signed upload descriptor
- expiry timestamp

Related frontend caller:
- `initCloudCaptureShare()` in `src/lib/cloudShare.ts`

Current product note:
- single-capture download still exists, but the main kiosk UX now prefers session QR flow.

## `POST /api/captures/complete`

Purpose:
- verify the uploaded single object exists and promote the capture to ready

Depends on:

- origin check
- DB lookup
- R2 object existence check

Returns / side effects:

- mints `downloadToken`
- returns public `downloadUrl`
- marks row as `ready`

Related frontend caller:
- `completeCloudCaptureShare()` in `src/lib/cloudShare.ts`

## `POST /api/capture-sessions/init`

Purpose:
- create a pending session record with up to four items and return presigned upload targets for each item

Depends on:

- origin check
- payload validation
- session item limit and sequence validation
- special-case validation so `performance` sessions only accept one MP4 clip
- Postgres insert
- R2 signer

Returns / side effects:

- `sessionId`
- session expiry
- per-item `captureId`, `sequence`, and upload target

Related frontend caller:
- `initCloudCaptureSession()` in `src/lib/cloudShare.ts`
- called by `useCaptureActions.finalizeBrowserSession()`

## `POST /api/capture-sessions/complete`

Purpose:
- verify every session item exists in R2 and promote the session to ready

Depends on:

- origin check
- DB lookup
- session item listing
- R2 existence checks for every item

Returns / side effects:

- mints session `downloadToken`
- returns `galleryUrl`
- marks session row as `ready`

Related frontend caller:
- `completeCloudCaptureSession()` in `src/lib/cloudShare.ts`
- called by `useCaptureActions.finalizeBrowserSession()`

## `GET /api/capture-sessions/gallery?token=...`

Purpose:
- public token-based gallery metadata endpoint for the session gallery page

Depends on:

- session token validation
- expiry checks
- DB lookup for session and its items

Returns / side effects:

- session metadata
- ordered gallery items
- per-item `previewUrl` and `downloadUrl` that point back to `api/capture-sessions/media`

Behavior note:

- gallery/media payloads now include `kind: 'performance'` for single-clip MP4 sessions without changing the public wire shape.

Related frontend caller:
- `fetchCloudCaptureSessionGallery()` in `src/lib/cloudShare.ts`
- rendered by `src/components/SessionGalleryPage.tsx`

## `GET /api/capture-sessions/media?token=...&captureId=...`

Purpose:
- token-validated redirect endpoint for an individual session item

Depends on:

- session token validation
- capture ID validation
- item membership check
- R2 presigned download generation

Returns / side effects:

- `302` redirect to a presigned R2 URL
- supports `inline` and `attachment` disposition

Related frontend caller:
- indirect; gallery payload embeds these URLs for image/video preview and downloads

## `GET /api/download?token=...`

Purpose:
- legacy single-capture token redirect endpoint

Depends on:

- single-capture token validation
- expiry and status checks
- R2 presigned download generation

Returns / side effects:

- `302` redirect to a presigned R2 URL

Related frontend caller:
- indirect single-capture flow only

## `GET /api/health/cloud-share`

Purpose:
- operational readiness probe for env, DB, and R2 signing

Depends on:

- env loading
- `pingDatabase()`
- R2 signer

Returns / side effects:

- `ok`
- per-check readiness
- `appBaseUrl`

Related frontend caller:
- none in the product UI
- used by humans, ops scripts, and deployment validation

## `GET /api/cron/cleanup-expired`

Purpose:
- delete expired objects and mark expired DB rows as deleted

Depends on:

- `CRON_SECRET`
- DB listing helpers
- R2 deletion helpers

Returns / side effects:

- processed/deleted/failure counts
- destructive cleanup of expired captures and session items

Related frontend caller:
- none

## Important Contracts

### Session gallery URL

`api/capture-sessions/complete.ts` returns:

- `galleryUrl = {APP_BASE_URL}/#/session/{downloadToken}`

This is why the public session page must remain under `HashRouter`.

### Origin enforcement

Browser init/complete requests must come from the same origin as `APP_BASE_URL`.

If local development changes origin behavior, review:

- `src/lib/cloudShare.ts`
- `api/_lib/http.ts`
- the existing Vercel quickstart docs

### Expiry model

- metadata expiry lives in Postgres
- object cleanup is driven by the cleanup cron
- R2 lifecycle rules are only a fallback safety net

## Existing Operational Docs

Use these for longer runbooks and deployment checklists:

- [../vercel-r2-cloud-share-checklist.md](../vercel-r2-cloud-share-checklist.md)
- [../vercel-dev-cloud-share-quickstart.md](../vercel-dev-cloud-share-quickstart.md)
- [../cloud-share-operator-runbook.md](../cloud-share-operator-runbook.md)
- [../internal-event-ops-go-live-checklist.md](../internal-event-ops-go-live-checklist.md)

Do not duplicate those docs here; only summarize boundaries and code ownership.
