import { NextResponse } from 'next/server'
import { getSonyAudio } from '@/lib/audio/data'
import { adminGate } from '@/lib/auth/admin-gate'
import { getSonyCameras } from '@/lib/cameras/data'
import { modelCode } from '@/lib/cameras/aliases'
import { listArticleRecords } from '@/lib/lab/admin-store'
import { isDevStore } from '@/lib/lab/dev-store'
import { listRecipeRecords } from '@/lib/recipes/admin-store'
import { hasContentConfig } from '@/lib/supabase/server'

/**
 * The ids the article editor's link picker may offer.
 *
 * Its own route rather than a field on `/api/admin/articles`, because the list
 * is re-read after every save and this one only needs to load once per
 * session. Not under `/api/admin/articles/` either: a static `refs` sibling
 * there would shadow an article whose id happened to be `refs`.
 *
 * Ids and display names only, drafts included — an editor may link to a
 * recipe or page that is not published yet (ADR 0002). No addresses, no
 * timestamps, no bodies.
 */
export async function GET(request: Request) {
  const gate = await adminGate(request)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  if (!hasContentConfig() && !isDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 })
  }

  try {
    const [recipes, cameras, audio, pages] = await Promise.all([
      listRecipeRecords(),
      getSonyCameras(),
      getSonyAudio(),
      listArticleRecords(),
    ])

    return NextResponse.json({
      recipes: recipes.map(({ recipe }) => ({
        id: recipe.id,
        name: recipe.name,
        published: recipe.published,
      })),
      products: [...cameras, ...audio].map((p) => ({
        id: p.id,
        name: p.name,
        code: modelCode(p.sku),
        category: p.category,
      })),
      pages: pages.map((p) => ({ id: p.id, title: p.title, kind: p.kind, status: p.status })),
    })
  } catch (err) {
    console.error('[admin/content-refs] load failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'loadFailed' }, { status: 502 })
  }
}
