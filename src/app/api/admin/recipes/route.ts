import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { adminGate } from '@/lib/auth/admin-gate';
import { CONTENT_ADMIN_FROZEN, contentAdminWritesFrozen } from '@/lib/admin/content-freeze';
import { hasContentConfig } from '@/lib/supabase/server';
import { CATALOGUE_TAG, IMMEDIATE } from '@/lib/catalogue-cache';
import { isRecipeDevStore } from '@/lib/recipes/dev-store';
import {
  insertRecipeRecord,
  listRecipeRows,
  nextRecipeId,
  normaliseRecipe,
  uniqueRecipeSlug,
} from '@/lib/recipes/admin-store';

/**
 * The recipe list, and recipe creation — the write path ColorLab never had.
 *
 * Until now the only thing in the repository that could write a recipe was
 * `scripts/push-supabase.ts`, run from a laptop with a secret key. The app
 * itself had no `/api/admin/recipes`, no admin read that could see a draft,
 * and no allocator for the `SCL-PP-###` id space.
 *
 * Gated by `adminGate(request)` on both verbs, before the body is parsed and
 * before any content client is opened, so an unauthorised request costs
 * nothing. The identity comes from the verified bearer token and never from
 * the body.
 *
 * `notConfigured` means neither backend is available — not merely that
 * Supabase is absent. With no credentials in development the file-backed store
 * takes over, which is what makes this screen usable offline; a bare
 * `hasContentConfig()` check would answer 503 and leave the editor reachable
 * and inert.
 *
 * Any editor with a role may write here. The product routes split by category
 * because DI owns cameras and PE owns audio; recipes are one editorial
 * surface, and `canManageCategory` has no recipe to answer about.
 */

export async function GET(request: Request) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!hasContentConfig() && !isRecipeDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  try {
    /* `unreadable` is the rows `fromRow` refuses, by id, so the editor can
       list them and take them offline — dropped, nothing could. */
    const { records, unreadable } = await listRecipeRows();
    return NextResponse.json({ recipes: records, unreadable });
  } catch (err) {
    console.error('[admin/recipes] list failed:', err);
    return NextResponse.json({ error: 'loadFailed' }, { status: 502 });
  }
}

/** How many times a create re-allocates after losing its id or slug to another. */
const CREATE_ATTEMPTS = 5;

export async function POST(request: Request) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (contentAdminWritesFrozen()) {
    return NextResponse.json(CONTENT_ADMIN_FROZEN, { status: 503 });
  }
  if (!hasContentConfig() && !isRecipeDevStore()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }
  /* Valid JSON is not necessarily an object: `null` threw at `body.format`. */
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }

  const format = body.format === 'cl' ? 'cl' : body.format === 'pp' ? 'pp' : null;
  if (!format) return NextResponse.json({ error: 'formatRequired' }, { status: 400 });

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
  if (!name) return NextResponse.json({ error: 'nameRequired' }, { status: 400 });

  /* Allocation is max+1 and a slug lookup, read before the insert, so two
     creates from two tabs can be handed the same id or slug. The unique key
     is what decides, and losing to it means "allocate again", not "could not
     save". Bounded: each loss costs one more read, and a loop with no ceiling
     against a database is a way to hang a request. */
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt += 1) {
    let id: string;
    let slug: string;
    try {
      id = await nextRecipeId(format);
      slug = await uniqueRecipeSlug(name);
    } catch (err) {
      if (err instanceof Error && err.message === 'idSpaceExhausted') {
        /* 999 per format is the table's CHECK constraint, not an arbitrary
           cap. Saying so beats failing later with a message about a regex. */
        return NextResponse.json({ error: 'idSpaceExhausted' }, { status: 409 });
      }
      console.error('[admin/recipes] allocation failed:', err);
      return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
    }

    /* A new recipe is always created as a draft, whatever the body asked for.
       Publishing is a second, deliberate action taken against a form the
       editor can see — and the slug is fixed at creation, because the control
       plane's community rows reference it as a plain string across a project
       boundary no foreign key spans. */
    /* `name` is the trimmed, capped value checked above. Spreading `body`
       alone validated that and stored the raw one — a 5,000-character name in
       full. */
    const write = normaliseRecipe(id, { ...body, name, slug, published: false });
    if (!write.ok) {
      return NextResponse.json({ error: 'invalidRecipe', issues: write.issues }, { status: 400 });
    }

    let inserted: 'inserted' | 'taken';
    try {
      inserted = await insertRecipeRecord(write.recipe);
    } catch (err) {
      console.error('[admin/recipes] insert failed:', err);
      return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
    }
    if (inserted === 'taken') continue;

    revalidateTag(CATALOGUE_TAG, IMMEDIATE);

    return NextResponse.json({ ok: true, id, slug });
  }

  console.error('[admin/recipes] allocation kept colliding; nothing was written');
  return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
}
