import { NextResponse } from 'next/server';
import { hasControlConfig, controlAdmin, controlRead } from '@/lib/supabase/server';
import { requireUser, UNAUTHENTICATED } from '@/lib/auth/require-user';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { COMMUNITY_ERRORS, communityErrorBody, outageErrorCode } from '@/lib/community/errors';
import { hasContentConfig } from '@/lib/supabase/server';
import { publishedRecipeExists } from '@/lib/recipes/existence';

/**
 * PostgREST rejects with a plain object, not an Error, so `String(err)` gave
 * "[object Object]" — which is how a missing table read as an empty comment
 * list for weeks instead of an obvious failure. Log the real shape server-side;
 * the client only learns that persistence is unavailable, never schema details.
 */
function logFallback(where: string, err: unknown) {
  const detail =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err
        ? JSON.stringify(err)
        : String(err);
  console.error(`[${where}] Supabase unavailable, serving in-process memory:`, detail);
}


export type ProposalItem = {
  id: string;
  recipeSlug: string;
  title: string;
  authorName: string;
  authorAvatar: string | null;
  sampleImageUrl?: string | null;
  settings: Record<string, unknown>;
  whiteBalance: Record<string, unknown>;
  voteCount: number;
  hasVoted: boolean; // Whether the *requesting* viewer voted. Never a list of
                     // emails — that would publish every voter's address.
  createdAt: string;
};

// In-memory proposals fallback when running offline
const memoryProposals: ProposalItem[] = [
  {
    id: 'seed-prop-1',
    recipeSlug: 'daylight-cinema',
    title: 'Biến thể Ấm Áp Hoàng Hôn (Golden Hour Tone)',
    authorName: 'Hoàng Nhiếp Ảnh',
    authorAvatar: 'https://ui-avatars.com/api/?name=Hoang+Photo&background=FF9800&color=fff',
    sampleImageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
    settings: {
      blackLevel: -4,
      saturation: +6,
      colorPhase: +1,
    },
    whiteBalance: {
      mode: 'kelvin',
      kelvin: 6300,
      shift: { ab: { axis: 'A', amount: 3 }, gm: { axis: 'M', amount: 0.5 } },
    },
    voteCount: 12,
    hasVoted: false,
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: 'seed-prop-2',
    recipeSlug: 'daylight-cinema',
    title: 'Biến thể Cine Nhật Bản (Soft Film Mood)',
    authorName: 'Linh Trần',
    authorAvatar: 'https://ui-avatars.com/api/?name=Linh+Tran&background=9C27B0&color=fff',
    sampleImageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    settings: {
      blackLevel: +3,
      saturation: -4,
      colorPhase: -1,
    },
    whiteBalance: {
      mode: 'kelvin',
      kelvin: 5200,
      shift: { ab: { axis: 'B', amount: 1 }, gm: { axis: 'G', amount: 0.5 } },
    },
    voteCount: 8,
    hasVoted: false,
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  /* Whose vote state to resolve. Taken from the session, not a `?viewer=`
     query param: an address in a URL is copied into every access log and
     referrer, and anyone could have passed someone else's to learn how they
     voted. Anonymous readers simply get hasVoted: false. */
  let viewer: string | null = null;
  try {
    viewer = (await requireUser(request))?.email ?? null;
  } catch {
    /* A control outage while resolving the viewer is not fatal to a public
       read. Everything below degrades to the seeded list anyway, and the worst
       a null viewer costs a signed-in reader is their own heart showing hollow
       for the duration. */
    viewer = null;
  }

  if (!slug) {
    return NextResponse.json(communityErrorBody('missingFields'), { status: 400 });
  }

  if (!hasControlConfig()) {
    const filtered = memoryProposals.filter((p) => p.recipeSlug === slug);
    return NextResponse.json({ proposals: filtered, source: 'memory' });
  }

  try {
    /* Explicit columns, never `*`: author_email must not ride along into a
       response the whole internet can fetch. */
    const { data: proposalRows, error } = await controlRead()
      .from('recipe_proposals')
      .select(
        'id, recipe_slug, title, author_name, author_avatar, settings, white_balance, vote_count, created_at',
      )
      .eq('recipe_slug', slug)
      .order('vote_count', { ascending: false });

    if (error) throw error;

    /* Only ever resolve the *viewer's* own vote.
       This used to return every voter's email address to every browser, so
       `GET /api/proposals?slug=…` enumerated the Google address of everyone who
       had ever voted. The UI only needs "did I vote?", so that is all that
       crosses the wire. */
    const proposalIds = (proposalRows || []).map((p) => p.id);
    const votedByViewer = new Set<string>();

    if (viewer && proposalIds.length > 0) {
      // Service role, not the anon key: proposal_votes is nothing but email
      // addresses, so the public roles are not granted select on it at all.
      const { data: voteRows } = await controlAdmin()
        .from('proposal_votes')
        .select('proposal_id')
        .eq('user_email', viewer)
        .in('proposal_id', proposalIds);

      voteRows?.forEach((v) => votedByViewer.add(v.proposal_id));
    }

    const proposals: ProposalItem[] = (proposalRows || []).map((row) => ({
      id: row.id,
      recipeSlug: row.recipe_slug,
      title: row.title,
      authorName: row.author_name,
      authorAvatar: row.author_avatar,
      settings: row.settings,
      whiteBalance: row.white_balance,
      voteCount: row.vote_count,
      hasVoted: votedByViewer.has(row.id),
      createdAt: row.created_at,
    }));

    return NextResponse.json({ proposals, source: 'supabase' });
  } catch (err) {
    const filtered = memoryProposals.filter((p) => p.recipeSlug === slug);
    logFallback('proposals', err);
    return NextResponse.json({ proposals: filtered, source: 'fallback', degraded: true });
  }
}

export async function POST(request: Request) {
  try {
    // Same rule as comments: the author is the session, not the payload.
    const user = await requireUser(request);
    if (!user) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

    const limit = checkRateLimit(`proposal:${user.email}`, Date.now(), 5);
    if (!limit.allowed) {
      return NextResponse.json(
        communityErrorBody('rateLimited'),
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const { recipeSlug, title, sampleImageUrl, settings, whiteBalance } = body;

    if (!recipeSlug || !title || !sampleImageUrl || !settings || !whiteBalance) {
      return NextResponse.json(communityErrorBody('sampleUrlRequired'), { status: 400 });
    }

    /* Confirm the recipe against the content project before writing anything
       to the control one. A proposal is worse than a stray comment when it
       orphans: it also seeds `community_photos` further down this handler. */
    if (hasContentConfig() && !(await publishedRecipeExists(recipeSlug))) {
      return NextResponse.json(communityErrorBody('recipeNotFound'), { status: 404 });
    }

    const newProposal: ProposalItem = {
      id: `prop-${Date.now()}`,
      recipeSlug,
      title: title.slice(0, 150),
      authorName: user.name,
      authorAvatar: user.avatarUrl,
      sampleImageUrl: sampleImageUrl || null,
      settings,
      whiteBalance,
      voteCount: 0,
      hasVoted: false,
      createdAt: new Date().toISOString(),
    };

    if (!hasControlConfig()) {
      memoryProposals.unshift(newProposal);
      return NextResponse.json({ proposal: newProposal, source: 'memory' });
    }

    const db = controlAdmin();
    const { data, error } = await db
      .from('recipe_proposals')
      .insert({
        recipe_slug: recipeSlug,
        title: title.slice(0, 150),
        author_name: user.name,
        author_email: user.email,
        author_avatar: user.avatarUrl,
        settings,
        white_balance: whiteBalance,
        vote_count: 0,
      })
      // Narrow here too: whatever this returns is what the response is built
      // from, so not fetching the email is what keeps it from being sent.
      .select(
        'id, recipe_slug, title, author_name, author_avatar, settings, white_balance, vote_count, created_at',
      )
      .single();

    if (error) throw error;

    /* The sample photograph also joins the recipe's gallery.
     *
     * Deliberately not fatal to the proposal: the proposal row is already
     * committed above, and failing the request now would tell the author their
     * submission did not go through when it did.
     *
     * The `try`/`catch` this replaced caught nothing. supabase-js reports a
     * constraint violation in `error`, it does not throw — so the duplicate the
     * comment claimed to ignore was never reaching the handler, and neither was
     * an RLS refusal or an outage. Every failure here was silent. Now the
     * duplicate is ignored by name and everything else is logged. */
    if (sampleImageUrl && typeof sampleImageUrl === 'string' && sampleImageUrl.startsWith('https://')) {
      const { error: photoError } = await db.from('community_photos').insert({
        recipe_slug: recipeSlug,
        image_url: sampleImageUrl,
        author_name: `${user.name} (${title.slice(0, 150)})`,
        author_social: null,
        submitted_by: user.email,
      });
      // 23505 is unique_violation: this photo is already in the gallery.
      if (photoError && photoError.code !== '23505') {
        logFallback('proposals/gallery', photoError);
      }
    }

    const savedProposal: ProposalItem = {
      id: data.id,
      recipeSlug: data.recipe_slug,
      title: data.title,
      authorName: data.author_name,
      authorAvatar: data.author_avatar,
      sampleImageUrl: sampleImageUrl || null,
      settings: data.settings,
      whiteBalance: data.white_balance,
      voteCount: data.vote_count,
    hasVoted: false,
      createdAt: data.created_at,
    };

    return NextResponse.json({ proposal: savedProposal, source: 'supabase' });
  } catch (err) {
    logFallback('proposals', err);
    const outage = outageErrorCode(err);
    if (outage) {
      return NextResponse.json(communityErrorBody(outage), { status: COMMUNITY_ERRORS[outage] });
    }
    return NextResponse.json(communityErrorBody('saveFailed'), { status: 500 });
  }
}
