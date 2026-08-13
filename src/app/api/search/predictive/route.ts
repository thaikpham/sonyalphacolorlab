import { NextResponse } from 'next/server';
import { accentHex } from '@/lib/camera/color';
import { getSonyCameras } from '@/lib/cameras/data';
import type { SonyCamera } from '@/lib/cameras/types';
import { listRecipes, type RecipeView } from '@/lib/recipes/source';
import { calculateMatchScore } from '@/lib/search/fuzzy-search';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';
  const mode = searchParams.get('mode') === 'wiki' ? 'wiki' : 'colorlab';
  const locale = searchParams.get('locale') === 'vi' ? 'vi' : 'en';

  if (!query || query.length < 1) {
    return NextResponse.json({ query, mode, results: [] });
  }

  if (mode === 'wiki') {
    const cameras = await getSonyCameras();
    const scored = cameras
      .map((c: SonyCamera) => {
        const score = calculateMatchScore(query, [
          c.name,
          c.fullName,
          c.sku,
          c.subCategory1,
          c.subCategory2,
          typeof c.features === 'string' ? c.features : JSON.stringify(c.features),
        ]);
        return { camera: c, score };
      })
      .filter((item: { camera: SonyCamera; score: number }) => item.score > 0)
      .sort((a: { camera: SonyCamera; score: number }, b: { camera: SonyCamera; score: number }) => b.score - a.score)
      .slice(0, 5);

    const results = scored.map(({ camera }: { camera: SonyCamera }) => ({
      id: camera.id,
      title: camera.name,
      subtitle: `${camera.sku} · ${camera.subCategory1 || camera.category} · ${camera.subCategory2 || ''}`.trim(),
      badge: camera.subCategory1 || camera.category,
      price: camera.priceFormatted,
      url: `/cameras/${camera.id}`,
      imageUrl: camera.imageUrl,
    }));

    return NextResponse.json({ query, mode, results });
  } else {
    const recipes = await listRecipes(locale);
    const scored = recipes
      .map((r: RecipeView) => {
        const lookStr = r.format === 'cl' ? r.settings.look : '';
        const score = calculateMatchScore(query, [
          r.name,
          r.format,
          lookStr,
          r.wbLabel,
          r.description,
          ...(r.tags || []),
        ]);
        return { recipe: r, score };
      })
      .filter((item: { recipe: RecipeView; score: number }) => item.score > 0)
      .sort((a: { recipe: RecipeView; score: number }, b: { recipe: RecipeView; score: number }) => b.score - a.score)
      .slice(0, 5);

    const results = scored.map(({ recipe }: { recipe: RecipeView }) => {
      const lookStr = recipe.format === 'cl' ? recipe.settings.look : '';
      return {
        id: recipe.slug,
        title: recipe.name,
        subtitle: `${recipe.format === 'pp' ? 'Picture Profile' : `Creative Look (${lookStr})`} · ${recipe.wbLabel}`,
        badge: recipe.format === 'pp' ? 'PP' : `CL:${lookStr}`,
        url: `/recipe/${recipe.slug}`,
        imageUrl: recipe.images?.[0] || undefined,
        accentHex: recipe.accent ? accentHex(recipe.accent) : undefined,
      };
    });

    return NextResponse.json({ query, mode, results });
  }
}
