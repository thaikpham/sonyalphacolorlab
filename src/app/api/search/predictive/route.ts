import { NextResponse } from 'next/server';
import { accentHex } from '@/lib/camera/color';
import { getSonyCameras } from '@/lib/cameras/data';
import { splitFeatures } from '@/lib/cameras/features';
import { listRecipes } from '@/lib/recipes/source';
import { calculateMatchScore } from '@/lib/search/fuzzy-search';

/**
 * Type-ahead for the header search box.
 *
 * Scoring is O(products x fields) with an edit-distance step inside, and it runs
 * per keystroke, so the two guards below matter more than they look:
 *
 * - `MAX_QUERY` bounds the work. Edit distance is O(query x field), so an
 *   unbounded `?q=` is a way to make the server do arbitrary work for one cheap
 *   request. Nothing a person types comes close to 64 characters.
 * - `SUGGESTIONS` is the slice the dropdown renders. Scoring the whole
 *   catalogue is what makes the ranking meaningful; returning all of it is not.
 */
const MAX_QUERY = 64;
const SUGGESTIONS = 5;

/**
 * Suggestions are a pure function of the catalogue and the query, and the
 * catalogue changes when an admin saves — minutes apart at best. Letting the
 * CDN answer a repeated prefix keeps the common case off the origin entirely,
 * and `stale-while-revalidate` means the refresh never blocks a keystroke.
 */
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
  const mode = searchParams.get('mode') === 'wiki' ? 'wiki' : 'colorlab';
  const locale = searchParams.get('locale') === 'vi' ? 'vi' : 'en';

  const answer = (results: unknown[]) =>
    NextResponse.json({ query, mode, results }, { headers: { 'Cache-Control': CACHE_CONTROL } });

  if (!query) return answer([]);

  if (mode === 'wiki') {
    const cameras = await getSonyCameras();
    const results = cameras
      .map((camera) => {
        /* The feature bullets are two locales of prose, and both are worth
           searching. This used to hand `JSON.stringify(features)` to the
           scorer, which fed it the object's own punctuation — `{"en":[` — as
           searchable text, and rebuilt that string for every product on every
           keystroke. */
        const { en, vi } = splitFeatures(camera.features);
        const score = calculateMatchScore(query, [
          camera.name,
          camera.fullName,
          camera.sku,
          camera.subCategory1,
          camera.subCategory2,
          ...en,
          ...vi,
        ]);
        return { camera, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, SUGGESTIONS)
      .map(({ camera }) => ({
        id: camera.id,
        title: camera.name,
        subtitle: [camera.sku, camera.subCategory1 || camera.category, camera.subCategory2]
          .filter(Boolean)
          .join(' · '),
        badge: camera.subCategory1 || camera.category,
        price: camera.priceFormatted,
        url: `/cameras/${camera.id}`,
        imageUrl: camera.imageUrl,
      }));

    return answer(results);
  }

  const recipes = await listRecipes(locale);
  const results = recipes
    .map((recipe) => {
      const look = recipe.format === 'cl' ? recipe.settings.look : '';
      const score = calculateMatchScore(query, [
        recipe.name,
        recipe.format,
        look,
        recipe.wbLabel,
        recipe.description,
        ...(recipe.tags ?? []),
      ]);
      return { recipe, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, SUGGESTIONS)
    .map(({ recipe }) => {
      const look = recipe.format === 'cl' ? recipe.settings.look : '';
      return {
        id: recipe.slug,
        title: recipe.name,
        subtitle: `${recipe.format === 'pp' ? 'Picture Profile' : `Creative Look (${look})`} · ${recipe.wbLabel}`,
        badge: recipe.format === 'pp' ? 'PP' : `CL:${look}`,
        url: `/recipe/${recipe.slug}`,
        imageUrl: recipe.images?.[0] || undefined,
        accentHex: recipe.accent ? accentHex(recipe.accent) : undefined,
      };
    });

  return answer(results);
}
