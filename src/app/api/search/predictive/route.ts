import { NextResponse } from 'next/server';
import { searchContent } from '@/lib/search/service';
import { MAX_QUERY } from '@/lib/search/types';

/**
 * Type-ahead for the ColorLab and Wiki header boxes.
 *
 * The contract is unchanged — `?q&mode=wiki|colorlab&locale`, five
 * suggestions, the same result shape the header renders — but the ranking is
 * no longer its own. It used to score the catalogue with a private copy of
 * the matching rules; it now asks the unified service (ADR 0003) for one
 * scope, so a query cannot rank one way in this dropdown and another on
 * `/search`. `wiki` covers the audio catalogue too, which the old route
 * silently left out on `/audio`.
 *
 * `MAX_QUERY` still bounds the work (edit distance is O(query × field)), and
 * `SUGGESTIONS` is the slice the dropdown renders.
 */
const SUGGESTIONS = 5;

/**
 * No shared cache on this response, deliberately.
 *
 * It used to be a public shared-cache directive with a sixty-second freshness
 * window and a five-minute stale grace, which put a copy of the suggestion list
 * in front of the CDN for up to six minutes after a save — outliving the
 * `revalidateTag` the write route now fires, so an editor would rename a
 * product, see the page update, and still get the old name from the search
 * box.
 *
 * Nothing is lost by dropping it. The expensive part of this route is the
 * catalogue read, and that is still behind the tagged Data Cache: a keystroke
 * invokes the handler but does not issue a PostgREST query.
 */
const CACHE_CONTROL = 'no-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
  const mode = searchParams.get('mode') === 'wiki' ? 'wiki' : 'colorlab';
  const locale = searchParams.get('locale') === 'vi' ? 'vi' : 'en';

  const answer = (results: unknown[]) =>
    NextResponse.json({ query, mode, results }, { headers: { 'Cache-Control': CACHE_CONTROL } });

  if (!query) return answer([]);

  const { hits } = await searchContent({
    q: query,
    locale,
    scope: mode === 'wiki' ? 'products' : 'recipes',
    limit: SUGGESTIONS,
  });

  return answer(
    hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      subtitle: hit.subtitle ?? '',
      badge: hit.badge,
      price: hit.price,
      url: hit.url,
      imageUrl: hit.imageUrl,
      accentHex: hit.accentHex,
    })),
  );
}
