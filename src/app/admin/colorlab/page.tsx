import type { Metadata } from 'next';
import { RecipeAdmin } from '@/components/colorlab/admin/recipe-admin';

/**
 * The ColorLab recipe editor — the surface this app was missing entirely.
 *
 * Nothing is fetched here. The other two sections hand their editor a
 * server-rendered catalogue because both read from tables the public site
 * already serves; recipes cannot, because an editor needs the drafts and every
 * reader-side function in `lib/recipes/source.ts` is hard-filtered to
 * `published = true` and wrapped in a sixty-second cache. So the list comes
 * from `/api/admin/recipes`, which is uncached and behind `adminGate()`.
 */

export const metadata: Metadata = {
  title: 'Công thức',
};

export default function AdminColorLabPage() {
  return <RecipeAdmin />;
}
