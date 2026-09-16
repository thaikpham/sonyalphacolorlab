import { NextResponse } from 'next/server'
import { adminGate } from '@/lib/auth/admin-gate'
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze'
import { hasContentConfig } from '@/lib/supabase/server'
import { isDevStore } from '@/lib/lab/dev-store'
import { processLabImage } from '@/lib/lab/image-process'
import { uploadDraftAsset } from '@/lib/lab/asset-store'

/**
 * Article media: one still, attached to one draft article.
 *
 * What this used to do was store the uploaded file. Three things were wrong
 * with that and they are all fixed here rather than mitigated:
 *
 * 1. **It published the original.** A 12 MB phone screenshot was served at
 *    12 MB to every reader. The project this runs on is currently restricted
 *    for exactly that mistake, made on recipe photography. Every upload is now
 *    decoded and re-encoded to three bounded WebP widths.
 * 2. **It published EXIF.** GPS coordinates, device serial, capture time. Sharp
 *    drops all of it unless asked to keep it, and `image-process.ts` never asks.
 * 3. **It went straight into a public bucket.** A draft article's photography
 *    was addressable the moment it was uploaded. Bytes land in the private
 *    bucket now; the publish step copies them.
 *
 * The order of the checks is load-bearing:
 *
 * 1. `adminGate()`, before the body is read at all — an unauthenticated caller
 *    should not be able to make the server buffer megabytes.
 * 2. The freeze, for the same reason, one step later.
 * 3. The owning article, because an asset with no owner is an orphan by
 *    construction and `lab_assets.article_id` is NOT NULL.
 * 4. The **bytes**, never `file.type`. That is a string the browser sends; a
 *    `.svg` renamed to `.png` arrives as `image/png`. Sharp decides, from the
 *    actual header.
 *
 * The response carries an asset UUID and a signed preview. It deliberately
 * carries no public URL — there is not one yet — and no editor email.
 */

/** The declared ceiling, so an obvious overrun is refused before buffering. */
const MAX_DECLARED_BYTES = 8 * 1024 * 1024

export async function POST(request: Request) {
  const gate = await adminGate(request)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 })
  }
  if (!hasContentConfig() && !isDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }

  let file: File | null = null
  let articleId = ''
  try {
    const form = await request.formData()
    const entry = form.get('file')
    if (entry instanceof File) file = entry
    const id = form.get('articleId')
    if (typeof id === 'string') articleId = id.trim()
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 })
  }

  /* An upload needs somewhere to belong. The editor disables the control until
     the article has been saved once, so reaching this is a client bug or a
     direct call — either way there is no owner to record. */
  if (!articleId) return NextResponse.json({ error: 'saveBeforeUpload' }, { status: 400 })
  if (!file) return NextResponse.json({ error: 'noFile' }, { status: 400 })
  if (file.size > MAX_DECLARED_BYTES) {
    return NextResponse.json({ error: 'tooLarge' }, { status: 413 })
  }

  const processed = await processLabImage(new Uint8Array(await file.arrayBuffer()))
  if (!processed.ok) {
    const status = processed.error === 'unsupportedType' ? 415 : 413
    return NextResponse.json({ error: processed.error }, { status })
  }

  let result
  try {
    result = await uploadDraftAsset(articleId, processed.image, gate.admin.email)
  } catch (err) {
    console.error('[admin/articles/upload] threw:', err)
    return NextResponse.json({ error: 'uploadFailed' }, { status: 502 })
  }

  if (!result.ok) {
    const status = result.error === 'articleNotFound' ? 404 : 502
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    assetId: result.asset.assetId,
    previewUrl: result.asset.previewUrl,
  })
}
