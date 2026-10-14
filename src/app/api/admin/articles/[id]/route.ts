import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { adminGate } from '@/lib/auth/admin-gate'
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze'
import { hasContentConfig } from '@/lib/supabase/server'
import { IMMEDIATE, LAB_TAG } from '@/lib/lab/data'
import { isDevStore } from '@/lib/lab/dev-store'
import {
  ArticleMissingError,
  StaleEditError,
  deleteArticleRecord,
  getArticleRecord,
  normaliseWrite,
  updateArticleRecord,
} from '@/lib/lab/admin-store'
import { validateForPublish } from '@/lib/lab/parse'
import { findUnknownReferences } from '@/lib/lab/reference-check'
import { articlePreviews } from '@/lib/lab/asset-store'
import { referencedAssetIds } from '@/lib/lab/assets'
import {
  deleteArticleAssets,
  reconcileArticleAssets,
  type LifecycleResult,
} from '@/lib/lab/asset-lifecycle'

/**
 * One article: read it with its drafts visible, save it, publish it, delete it.
 *
 * The editorial rules in `validateArticleShape` bind here and only on the way
 * to `published`. A draft saves in any shape — an editor at block four is not
 * in error — and the same problem list comes back either way, so the editor
 * can show "3 rules left" while the article is still a draft and refuse only
 * at the moment it would become visible to a reader.
 */

type Ctx = { params: Promise<{ id: string }> }

/**
 * The asset lifecycle reports a Storage failure as a result, but its read of
 * the `lab_assets` ledger throws — and a throw out of a handler is a bare 500
 * with no body. The editor's `res.json()` then fails and they are told a save
 * failed that, on the unpublish path, had already gone through. An outage is
 * the same answer as any other asset failure: `assetSyncFailed`, 502.
 */
async function settled(work: Promise<LifecycleResult>): Promise<LifecycleResult> {
  try {
    return await work
  } catch (err) {
    console.error('[lab] asset lifecycle failed:', err instanceof Error ? err.message : err)
    return { ok: false, error: 'assetSyncFailed' }
  }
}

export async function GET(request: Request, { params }: Ctx) {
  const gate = await adminGate(request)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  if (!hasContentConfig() && !isDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }

  const { id } = await params

  /* An unreachable project is not a missing article. Saying `notFound` here
     would tell the editor their page was deleted when nothing happened to it. */
  let article: Awaited<ReturnType<typeof getArticleRecord>>
  try {
    article = await getArticleRecord(id)
  } catch (err) {
    console.error('[lab] article read failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'loadFailed' }, { status: 502 })
  }
  if (!article) return NextResponse.json({ error: 'notFound' }, { status: 404 })

  /* Signed, ten minutes, private bucket. The editor needs to see the pictures
     an article references, and a published article's public URLs would not
     cover the draft ones — so every preview comes from the private copy, which
     is retained through publication precisely so this stays uniform. */
  const unknownRefs = (await findUnknownReferences(article.meta)) ?? []

  return NextResponse.json({
    article,
    problems: [
      ...validateForPublish(article),
      ...(unknownRefs.length > 0 ? ['relatedUnknown'] : []),
    ],
    unknownRefs,
    previews: await articlePreviews(id, referencedAssetIds(article.blocks)),
  })
}

export async function PATCH(request: Request, { params }: Ctx) {
  const gate = await adminGate(request)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 })
  }
  if (!hasContentConfig() && !isDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 })
  }
  /* Valid JSON is not necessarily an object: `null` threw at the first field. */
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 })
  }

  /* The version the editor opened the row at, from `GET` above or the previous
     save's answer. Required: without it the second of two saves silently
     reverted the first, and both editors were told "Saved". */
  const expected = body.expectedUpdatedAt
  if (typeof expected !== 'string') {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 })
  }

  /* Named before `normaliseWrite`, which answers `null` for a blank title and
     a bad topic alike — and `badRequest` tells the editor to check the topic,
     level and archetype of an article whose only fault is an empty title. */
  if (typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'titleRequired' }, { status: 400 })
  }

  const write = normaliseWrite(id, body)
  if (!write) return NextResponse.json({ error: 'badRequest' }, { status: 400 })

  /* A lookup that fails falls through — the update below is what reports a
     missing row, and its version filter is what refuses a stale one. */
  const existing = await getArticleRecord(id).catch(() => null)

  /* Already behind: refuse before anything is copied or written. */
  if (existing && existing.updatedAt !== expected) {
    return NextResponse.json({ error: 'staleEdit' }, { status: 409 })
  }

  /* A published page keeps its kind. Changing it moves the page between
     `/blog/<id>` and `/learn/<id>`, which breaks every link already shared;
     the editor unpublishes first, which is a deliberate act with a visible
     consequence. */
  if (existing && existing.status === 'published' && existing.kind !== write.article.kind) {
    return NextResponse.json({ error: 'kindLocked' }, { status: 409 })
  }

  const unknownRefs = await findUnknownReferences(write.article.meta)
  const problems = [
    ...validateForPublish(write.article),
    ...(unknownRefs && unknownRefs.length > 0 ? ['relatedUnknown'] : []),
  ]

  /* The gate, and the only place it is applied. Publishing is what makes the
     article a page a reader can land on, so it is the moment the countable
     half of ARTICLE-SPEC has to hold. The problems come back with the refusal
     rather than as a bare 400, because "which rule" is the whole content of
     the answer. */
  if (write.status === 'published' && unknownRefs === null) {
    /* Could not verify the links. A draft would save; a publish does not,
       because "unverified" is not "fine". */
    return NextResponse.json({ error: 'referenceCheckFailed' }, { status: 502 })
  }
  if (write.status === 'published' && problems.length > 0) {
    return NextResponse.json(
      {
        error: 'specViolation',
        problems,
        unknownRefs: unknownRefs ?? [],
        dropped: write.dropped,
        droppedMeta: write.droppedMeta,
      },
      { status: 422 },
    )
  }

  /* Publishing copies the bytes *before* the article becomes visible. A
     failure here leaves a private article with some public objects — invisible
     to a reader, and cleaned up by the next publish. The other order would put
     a live page in front of images that are not there yet. */
  if (write.status === 'published') {
    const synced = await settled(reconcileArticleAssets(id, write.article.blocks, 'published'))
    if (!synced.ok) {
      const status = synced.error === 'assetSyncFailed' ? 502 : 422
      return NextResponse.json({ error: synced.error }, { status })
    }
  }

  let updatedAt: string
  try {
    updatedAt = await updateArticleRecord(write.article, write.status, gate.admin.email, expected)
  } catch (err) {
    /* Saved elsewhere between the read above and this write. */
    if (err instanceof StaleEditError) {
      return NextResponse.json({ error: 'staleEdit' }, { status: 409 })
    }
    /* The row is gone — deleted in another tab, or by someone else. That is a
       404, not a 502: nothing failed, there is simply nothing to save into,
       and reporting it as a write failure would have the editor retry forever. */
    if (err instanceof ArticleMissingError) {
      return NextResponse.json({ error: 'notFound' }, { status: 404 })
    }
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 })
  }

  revalidateTag(LAB_TAG, IMMEDIATE)

  /* What was stored and the version it was stored at. The parser trims, cuts
     and skips without counting it as a drop — a TL;DR line past 140
     characters, a table row with no first cell — so the editor rebuilds its
     screen from this rather than trusting the draft it sent. Sent with the
     asset failure below too: the row is written by then, and an editor left
     holding the old version would have their next save refused as stale. */
  const stored = { article: { ...write.article, status: write.status }, updatedAt }

  /* Unpublishing is the mirror: the article goes private and the cache is
     cleared first, and only then do the public objects come out. Removing them
     first would leave a *published* page with broken images, which is worse
     than a private page whose objects are briefly still fetchable by URL.
     A failure is reported, but the article is already private — so the answer
     is 502 with the assets marked `cleanup_failed` for the cleanup view. */
  if (write.status !== 'published') {
    const synced = await settled(reconcileArticleAssets(id, write.article.blocks, 'draft'))
    if (!synced.ok) {
      return NextResponse.json({ error: synced.error, problems, ...stored }, { status: 502 })
    }
  }

  return NextResponse.json({
    ok: true,
    ...stored,
    problems,
    unknownRefs: unknownRefs ?? [],
    dropped: write.dropped,
    droppedMeta: write.droppedMeta,
  })
}

export async function DELETE(request: Request, { params }: Ctx) {
  const gate = await adminGate(request)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 })
  }
  if (!hasContentConfig() && !isDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }

  const { id } = await params

  /* A hard delete, and the confirmation lives in the editor rather than here.
     Soft-deleting would need a third status the reading path must then filter
     on, and a row nobody can see from any screen is worse than a row that is
     gone.

     The media no longer "stays in the bucket either way" — that was the part
     that would have been expensive to undo, and it is why `lab_assets` exists.
     Objects come out of both buckets first, then their rows, then the article.
     `on delete restrict` enforces the same order in the schema, so a caller
     that skipped this would get a foreign-key violation rather than a bucket
     full of objects nothing can name. */
  const cleaned = await settled(deleteArticleAssets(id))
  if (!cleaned.ok) {
    return NextResponse.json({ error: cleaned.error }, { status: 502 })
  }

  try {
    await deleteArticleRecord(id)
  } catch {
    return NextResponse.json({ error: 'deleteFailed' }, { status: 502 })
  }

  revalidateTag(LAB_TAG, IMMEDIATE)
  return NextResponse.json({ ok: true })
}
