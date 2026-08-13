import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compareCameras, type SonyCamera, type WikiSort } from '@/lib/cameras/types';

/**
 * The audio catalogue — headphones and speakers.
 *
 * Its own seed and its own reader, kept apart from `cameras/data.ts` because
 * the two catalogues have different sources and different release cadences:
 * the camera rows come from product pages on sony.com.vn, these come from the
 * FY26 comparison sheets, which are reissued as a set once a year. Mixing them
 * into one file would make "what did FY26 change" unanswerable.
 *
 * They share the `SonyCamera` shape and the `compareCameras` comparator on
 * purpose. The catalogue grid, the sort control and the search box are one
 * component serving both routes; forking them would be two copies of the same
 * ordering rules, which is exactly the drift `compareCameras` was written to
 * end.
 *
 * There is no Supabase branch here yet. The camera reader has one because the
 * admin UI writes camera rows; nothing writes audio rows, so a table read would
 * be a fallback with no primary. Add it when the admin editor learns this
 * catalogue, not before — an empty table that silently shadows the seed is the
 * failure mode that costs a whole catalogue.
 */

let cached: SonyCamera[] | null = null;

function getSeedAudio(): SonyCamera[] {
  if (cached) return cached;
  try {
    const filePath = join(process.cwd(), 'data', 'sony-audio.seed.json');
    cached = JSON.parse(readFileSync(filePath, 'utf8')) as SonyCamera[];
    return cached;
  } catch (err) {
    console.error('Failed to load sony-audio.seed.json:', err);
    return [];
  }
}

export async function getSonyAudio(options?: { sortBy?: WikiSort }): Promise<SonyCamera[]> {
  const products = getSeedAudio();
  if (!options?.sortBy) return products;
  // On a copy: `sort` mutates, and the array above is the module-level cache.
  return [...products].sort(compareCameras(options.sortBy));
}

export async function getSonyAudioById(id: string): Promise<SonyCamera | null> {
  return getSeedAudio().find((p) => p.id === id) ?? null;
}
