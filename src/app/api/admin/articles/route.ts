import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { adminGate } from '@/lib/auth/admin-gate'
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze'
import { hasContentConfig } from '@/lib/supabase/server'
import { IMMEDIATE, LAB_TAG } from '@/lib/lab/data'
import { isDevStore } from '@/lib/lab/dev-store'
import {
  insertArticleRecord,
  listArticleRecords,
  normaliseWrite,
  uniqueArticleId,
} from '@/lib/lab/admin-store'
import { validateArticleShape } from '@/lib/lab/parse'

/**
 * The article list, and article creation.
 *
 * Gated by `adminGate(request)` on both verbs — the identity comes from the
 * verified bearer token and never from the body, which is the trap
 * `identity-not-from-body.test.ts` exists for and which an admin route is the
 * worst place to fall into. The admin page itself is not gated; it renders
 * nothing useful without this route answering, and a page has never been an
 * authorisation boundary.
 *
 * `notConfigured` means neither backend is available — not merely that
 * Supabase is absent. With no credentials in development the file-backed store
 * in `dev-store.ts` takes over, which is what makes this screen usable offline;
 * a bare `hasContentConfig()` check here would answer 503 and leave the
 * editor reachable but inert.
 *
 * Any editor with a role may write here. The product routes split by category
 * because DI owns cameras and PE owns audio; the blog has no such split — it
 * is one editorial surface, and `canManageCategory` has no article to answer
 * about.
 */

export async function GET(request: Request) {
  const gate = await adminGate(request)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  if (!hasContentConfig() && !isDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }

  try {
    return NextResponse.json({ articles: await listArticleRecords() })
  } catch (err) {
    console.error('[admin/articles] list failed:', err)
    return NextResponse.json({ error: 'loadFailed' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const gate = await adminGate(request)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 })
  }
  if (!hasContentConfig() && !isDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'titleRequired' }, { status: 400 })

  let id: string
  try {
    id = await uniqueArticleId(title)
  } catch (err) {
    console.error('[admin/articles] slug lookup failed:', err)
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 })
  }

  const write = normaliseWrite(id, body)
  if (!write) return NextResponse.json({ error: 'badRequest' }, { status: 400 })

  /* A new article is always created as a draft, whatever the body asked for.
     Publishing is a second, deliberate action against a shape the editor can
     see — `validateArticleShape` refuses an eight-block minimum on a body that
     has just been created empty, and rejecting the create for it would mean an
     editor could not start writing at all. */
  try {
    await insertArticleRecord(write.article, 'draft', gate.admin.email)
  } catch {
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 })
  }

  revalidateTag(LAB_TAG, IMMEDIATE)

  return NextResponse.json({
    ok: true,
    id,
    dropped: write.dropped,
    /* Reported on create too, even though a new article always fails them.
       The editor renders them as a checklist of what is still missing rather
       than as errors, so the same field drives both screens. */
    problems: validateArticleShape(write.article),
  })
}
