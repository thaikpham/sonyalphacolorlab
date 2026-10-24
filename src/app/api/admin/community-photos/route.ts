import { NextResponse } from 'next/server';
import { adminGate } from '@/lib/auth/admin-gate';
import { controlAdmin, hasControlConfig } from '@/lib/supabase/server';
import { MODERATION_PHOTO_COLUMNS } from '@/lib/community/columns';
import { recipeSlugSchema } from '@/lib/community/request';
import {
  MODERATION_LIST_LIMIT,
  moderationPatchSchema,
  toModeratedPhoto,
  type ModerationRow,
} from '@/lib/community/moderation';

/**
 * Community photo moderation: one recipe's photos, hidden ones included, and
 * the switch that hides or shows one.
 *
 * Until now a photo could only be hidden by editing `community_photos` in the
 * database by hand. This is the control plane's table, so it is reached with
 * `controlAdmin()` — the anon client cannot see a hidden row (RLS) or the
 * `approved` and `id` columns (0019's grant), which is exactly what keeps the
 * public gallery honest and exactly why it cannot serve this screen.
 *
 * Gated by `adminGate(request)` on both verbs, before the query string or the
 * body is read and before any client is opened. Any editor with a role may
 * moderate, as any may edit a recipe: the photos belong to the recipe surface,
 * which has no category for `canManageCategory` to answer about.
 *
 * Not behind `contentAdminWritesFrozen()`. The freeze holds still the content
 * rows a cutover is copying; this writes the control plane, where community
 * writes stay up during a freeze — and so must the means of hiding one.
 *
 * Nothing sent back carries an address: the column list names none, and
 * `toModeratedPhoto` picks five fields by name whatever the row holds.
 */

export async function GET(request: Request) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!hasControlConfig()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  const slug = recipeSlugSchema.safeParse(new URL(request.url).searchParams.get('slug'));
  if (!slug.success) return NextResponse.json({ error: 'badRequest' }, { status: 400 });

  try {
    /* No `approved` filter: the point of this read is the rows readers no
       longer see. Newest first, as the gallery orders them. */
    const { data, error } = await controlAdmin()
      .from('community_photos')
      .select(MODERATION_PHOTO_COLUMNS)
      .eq('recipe_slug', slug.data)
      .order('created_at', { ascending: false })
      .limit(MODERATION_LIST_LIMIT);
    if (error) {
      console.error('[admin/community-photos] list failed:', error.message);
      return NextResponse.json({ error: 'loadFailed' }, { status: 502 });
    }
    const rows = (data ?? []) as ModerationRow[];
    return NextResponse.json({ photos: rows.map(toModeratedPhoto) });
  } catch (err) {
    console.error('[admin/community-photos] list failed:', err);
    return NextResponse.json({ error: 'loadFailed' }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const gate = await adminGate(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!hasControlConfig()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'badRequest' }, { status: 400 });
  }
  /* A strict object: `{ id, approved }` and no third key, so a body cannot
     carry a slug, a URL or a credit into the update. */
  const parsed = moderationPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'badRequest' }, { status: 400 });

  try {
    /* `.select()` turns "no row has that id" into an empty answer rather than
       PostgREST's silent success, so a photo that is gone reads as 404. */
    const { data, error } = await controlAdmin()
      .from('community_photos')
      .update({ approved: parsed.data.approved })
      .eq('id', parsed.data.id)
      .select(MODERATION_PHOTO_COLUMNS)
      .maybeSingle();
    if (error) {
      console.error('[admin/community-photos] update failed:', error.message);
      return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
    }
    if (!data) return NextResponse.json({ error: 'notFound' }, { status: 404 });
    return NextResponse.json({ ok: true, photo: toModeratedPhoto(data as ModerationRow) });
  } catch (err) {
    console.error('[admin/community-photos] update failed:', err);
    return NextResponse.json({ error: 'saveFailed' }, { status: 502 });
  }
}
