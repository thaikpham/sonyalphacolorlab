import 'server-only';
import { isContentAdminFrozen } from '@/lib/supabase/config';

/**
 * A maintenance switch for the one moment the cutover cannot survive a write.
 *
 * Migrating the content tables ends with a delta: whatever changed between the
 * bulk export and the moment the new project goes live. Taking that delta is
 * only correct if nothing is writing to the old project while it is measured —
 * otherwise a product edit lands in the source after the export and is lost,
 * and nobody finds out until an editor notices their change reverted weeks
 * later.
 *
 * So this is narrow on purpose. It rejects product, article and upload
 * mutations — the three things whose rows are being copied — and touches
 * nothing else. Auth stays up, community writes stay up, every public read
 * stays up. A reader cannot tell the freeze is on; an editor gets a translated
 * "saving is paused" and, critically, no success.
 *
 * It is checked after authorisation and *before* the body is parsed, so a
 * frozen server never buffers a 12 MB upload it is going to refuse.
 *
 * Server-only and opt-in: nothing but an exact `CONTENT_ADMIN_FROZEN=true`
 * turns it on, so it cannot be tripped by a truthy leftover value in a
 * dashboard row.
 */
export function contentAdminWritesFrozen(): boolean {
  return isContentAdminFrozen(process.env);
}

/** The body and status every frozen mutation answers with. */
export const CONTENT_ADMIN_FROZEN = { error: 'contentAdminFrozen' as const };
