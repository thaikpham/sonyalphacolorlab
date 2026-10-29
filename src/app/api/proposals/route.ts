import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasControlConfig, controlAdmin, controlRead } from '@/lib/supabase/server';
import { requireUser, UNAUTHENTICATED } from '@/lib/auth/require-user';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import {
  COMMUNITY_ERRORS,
  communityErrorBody,
  outageErrorCode,
  type CommunityErrorCode,
} from '@/lib/community/errors';
import { hasContentConfig } from '@/lib/supabase/server';
import { publishedRecipeFormat } from '@/lib/recipes/existence';
import { slugAliases } from '@/lib/recipes/slug-aliases';
import { clSettingsSchema, ppSettingsSchema, whiteBalanceSchema } from '@/lib/camera/schema';
import { MAX_PHOTOS_PER_RECIPE, clientKey, photoInGallery, visiblePhotoCount } from '@/lib/community/gallery';
import {
  EXPIRING_IMAGE_HOST_ISSUE,
  httpsImageUrlSchema,
  readJsonBody,
  recipeSlugSchema,
} from '@/lib/community/request';
/* One list for the read and the insert's return, so the two cannot drift. */
import { PROPOSAL_COLUMNS } from '@/lib/community/columns';
import { MODERATION_LIST_LIMIT, withoutHiddenSamples } from '@/lib/community/moderation';

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
  console.error(`[${where}] Supabase failed:`, detail);
}

/** Proposals are ranked by votes; nobody reads past the first hundred. */
const PROPOSAL_LIST_LIMIT = 100;

/**
 * The recipe's hidden gallery photos, by URL — or `null` when that is unknown.
 *
 * A proposal's sample is the same URL as a gallery photo, and moderation hides
 * the gallery row only, so every sample this route sends is checked against
 * this first (`withoutHiddenSamples`).
 *
 * The service role, because nothing else can answer: anon sees approved rows
 * only (RLS) and holds no grant on `approved`. Asking anon for the *visible*
 * set instead would also blank samples that never joined the gallery — the
 * cap was reached, or the insert failed — which no editor ever hid. Only
 * `image_url` is named, so nothing else of the row leaves the database.
 *
 * Never fails the list: an error, returned or thrown, is "unknown", and so is
 * a read that fills its bound, since it may have stopped short of a hidden
 * row. Unknown fails closed downstream.
 */
async function hiddenPhotoUrls(slug: string): Promise<ReadonlySet<string> | null> {
  try {
    const { data, error } = await controlAdmin()
      .from('community_photos')
      .select('image_url')
      .in('recipe_slug', slugAliases(slug))
      .eq('approved', false)
      .limit(MODERATION_LIST_LIMIT);
    if (error) {
      logFallback('proposals/hidden-photos', error);
      return null;
    }
    const rows = (data ?? []) as { image_url: string }[];
    if (rows.length >= MODERATION_LIST_LIMIT) {
      console.error(`[proposals/hidden-photos] ${slug} has ${rows.length}+ hidden photos; dropping every sample`);
      return null;
    }
    return new Set(rows.map((r) => r.image_url));
  } catch (err) {
    logFallback('proposals/hidden-photos', err);
    return null;
  }
}

/**
 * The proposal payload, checked before anything is written.
 *
 * `settings` and `whiteBalance` used to go straight into jsonb after a
 * truthiness check — `{ saturation: 99 }` was stored and rendered as a pill on
 * the recipe page, and so was a 4 MB blob. White balance has one schema for
 * both formats; settings are checked below, once the recipe's own format is
 * known, because a Picture Profile proposal on a Creative Look recipe is
 * Rule 2 broken in a column nothing else validates.
 */
const proposalBody = z.object({
  recipeSlug: recipeSlugSchema,
  title: z.string().trim().min(1).max(150),
  sampleImageUrl: httpsImageUrlSchema,
  settings: z.record(z.string(), z.unknown()),
  whiteBalance: whiteBalanceSchema,
});

/** Which code names the first thing wrong with the body. */
function bodyErrorCode(
  issue: z.ZodError['issues'][number] | undefined,
  body: Record<string, unknown>,
): CommunityErrorCode {
  switch (issue?.path[0]) {
    case 'sampleImageUrl': {
      if (issue?.message === EXPIRING_IMAGE_HOST_ISSUE) return 'expiringImageHost';
      const sample = body.sampleImageUrl;
      return typeof sample === 'string' && sample.trim() ? 'invalidImageUrl' : 'sampleUrlRequired';
    }
    case 'settings':
    case 'whiteBalance':
      return 'invalidSettings';
    default:
      return 'missingFields';
  }
}

export type ProposalItem = {
  id: string;
  recipeSlug: string;
  title: string;
  authorName: string;
  authorAvatar: string | null;
  sampleImageUrl: string | null;
  settings: Record<string, unknown>;
  whiteBalance: Record<string, unknown>;
  voteCount: number;
  hasVoted: boolean; // Whether the *requesting* viewer voted. Never a list of
                     // emails — that would publish every voter's address.
  createdAt: string;
};

/* Examples for a deployment with no control project at all. Never a fallback
   for a configured project that failed — see the GET's catch. */
const memoryProposals: ProposalItem[] = [
  {
    id: 'seed-prop-1',
    recipeSlug: 'pp-027',
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
    recipeSlug: 'pp-027',
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
     voted. Anonymous readers simply get hasVoted: false.

     `voteStateUnknown` is set whenever a signed-in reader's votes could not be
     read. The vote route toggles, so a heart shown hollow for a proposal the
     reader did vote for turns their next click into an un-vote; the client
     disables the hearts rather than offer that click. */
  let viewer: string | null = null;
  let voteStateUnknown = false;
  try {
    viewer = (await requireUser(request))?.email ?? null;
  } catch {
    /* A control outage while resolving the viewer is not fatal to a public
       read — the list itself may still load. But who the reader is, and so
       what they voted for, is now unknown, and is reported as such. */
    viewer = null;
    voteStateUnknown = true;
  }

  if (!slug) {
    return NextResponse.json(communityErrorBody('missingFields'), { status: 400 });
  }

  if (!hasControlConfig()) {
    const aliases = slugAliases(slug);
    const filtered = memoryProposals.filter((p) => aliases.includes(p.recipeSlug));
    return NextResponse.json({ proposals: filtered, voteStateUnknown: false, source: 'memory' });
  }

  try {
    const { data: proposalRows, error } = await controlRead()
      .from('recipe_proposals')
      .select(PROPOSAL_COLUMNS)
      /* Every spelling the recipe's slug has had (`slug-aliases.ts`). */
      .in('recipe_slug', slugAliases(slug))
      .order('vote_count', { ascending: false })
      .limit(PROPOSAL_LIST_LIMIT);

    if (error) throw error;

    /* Started now and awaited below, beside the vote read. It never rejects:
       a failure is `null`, which drops every sample rather than the list. */
    const hiddenRead = (proposalRows || []).some((p) => p.sample_image_url)
      ? hiddenPhotoUrls(slug)
      : Promise.resolve(new Set<string>());

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
      const { data: voteRows, error: voteError } = await controlAdmin()
        .from('proposal_votes')
        .select('proposal_id')
        .eq('user_email', viewer)
        .in('proposal_id', proposalIds);

      /* The error used to be discarded: a failed read gave hasVoted: false
         everywhere, which is the exact bug the vote route's own comment
         describes, one request earlier. */
      if (voteError) {
        logFallback('proposals/votes', voteError);
        voteStateUnknown = true;
      } else {
        voteRows?.forEach((v) => votedByViewer.add(v.proposal_id));
      }
    }

    const rows: ProposalItem[] = (proposalRows || []).map((row) => ({
      id: row.id,
      recipeSlug: row.recipe_slug,
      title: row.title,
      authorName: row.author_name,
      authorAvatar: row.author_avatar,
      sampleImageUrl: row.sample_image_url ?? null,
      settings: row.settings,
      whiteBalance: row.white_balance,
      voteCount: row.vote_count,
      hasVoted: votedByViewer.has(row.id),
      createdAt: row.created_at,
    }));
    /* A photo hidden in /admin/colorlab leaves the proposal cards with it. */
    const proposals = withoutHiddenSamples(rows, await hiddenRead);

    return NextResponse.json({ proposals, voteStateUnknown, source: 'supabase' });
  } catch (err) {
    /* Configuration decides the source; failure is failure. This used to serve
       the offline examples with 12 and 8 votes as daylight-cinema's real
       proposals, and hearting one sent `seed-prop-1` at a uuid column. */
    logFallback('proposals', err);
    return NextResponse.json(
      { ...communityErrorBody('controlUnavailable'), proposals: [] },
      { status: COMMUNITY_ERRORS.controlUnavailable },
    );
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

    const read = await readJsonBody(request);
    if (!read.ok) {
      return NextResponse.json(communityErrorBody(read.error), { status: COMMUNITY_ERRORS[read.error] });
    }
    const parsed = proposalBody.safeParse(read.body);
    if (!parsed.success) {
      const code = bodyErrorCode(parsed.error.issues[0], read.body);
      return NextResponse.json(communityErrorBody(code), { status: COMMUNITY_ERRORS[code] });
    }
    const { recipeSlug, title, sampleImageUrl, whiteBalance } = parsed.data;

    /* Confirm the recipe against the content project before writing anything
       to the control one. A proposal is worse than a stray comment when it
       orphans: it also seeds `community_photos` further down this handler.
       The probe also says which format the recipe is, which decides the
       settings schema. */
    const format = hasContentConfig() ? await publishedRecipeFormat(recipeSlug) : undefined;
    if (format === null) {
      return NextResponse.json(communityErrorBody('recipeNotFound'), { status: 404 });
    }
    /* With no content project there is no format to ask for, so either
       camera schema will do — each is still strict, so no hybrid passes. */
    const settingsSchema =
      format === 'pp'
        ? ppSettingsSchema
        : format === 'cl'
          ? clSettingsSchema
          : z.union([ppSettingsSchema, clSettingsSchema]);
    const settings = settingsSchema.safeParse(parsed.data.settings);
    if (!settings.success) {
      return NextResponse.json(communityErrorBody('invalidSettings'), { status: 400 });
    }

    const db = controlAdmin();
    const { data, error } = await db
      .from('recipe_proposals')
      .insert({
        recipe_slug: recipeSlug,
        title,
        author_name: user.name,
        author_email: user.email,
        author_avatar: user.avatarUrl,
        sample_image_url: sampleImageUrl,
        settings: settings.data,
        white_balance: whiteBalance,
        vote_count: 0,
      })
      // Narrow here too: whatever this returns is what the response is built
      // from, so not fetching the email is what keeps it from being sent.
      .select(PROPOSAL_COLUMNS)
      .single();

    if (error) throw error;

    /* The sample photograph also joins the recipe's gallery.
     *
     * Deliberately not fatal to the proposal: the proposal row is already
     * committed above, and failing the request now would tell the author their
     * submission did not go through when it did. supabase-js reports a
     * constraint violation in `error`, it does not throw, so every result is
     * checked by hand.
     *
     * Held to the same rules as `POST /api/community-photos`: the per-recipe
     * cap on visible photos (`visiblePhotoCount`), the session's name as the credit (the old `name (title)` reached 253
     * characters against a CHECK of 100, so the insert failed and only the log
     * knew), an origin marker rather than the author's address in
     * `submitted_by`, and a URL already in the gallery under either spelling
     * of the slug — an editor may have hidden it — left alone, as a 23505
     * would leave it (`photoInGallery`: the unique key sees one spelling). */
    const dup = await photoInGallery(db, recipeSlug, sampleImageUrl);
    if (dup.error) {
      logFallback('proposals/gallery', dup.error);
    } else if (!dup.taken) {
      const { count, error: countError } = await visiblePhotoCount(db, recipeSlug);
      if (countError) {
        logFallback('proposals/gallery', countError);
      } else if (count < MAX_PHOTOS_PER_RECIPE) {
        const { error: photoError } = await db.from('community_photos').insert({
          recipe_slug: recipeSlug,
          image_url: sampleImageUrl,
          author_name: user.name,
          author_social: null,
          submitted_by: clientKey(request),
        });
        // 23505 is unique_violation: this photo is already in the gallery.
        if (photoError && photoError.code !== '23505') {
          logFallback('proposals/gallery', photoError);
        }
      }
    }

    /* The poster's page draws this answer straight into the list, so it is
       held to the GET's rule: a URL an editor hid (the gallery step above
       found it already there) comes back with no sample, as it will on reload. */
    const [savedProposal] = withoutHiddenSamples(
      [
        {
          id: data.id,
          recipeSlug: data.recipe_slug,
          title: data.title,
          authorName: data.author_name,
          authorAvatar: data.author_avatar,
          sampleImageUrl: data.sample_image_url ?? null,
          settings: data.settings,
          whiteBalance: data.white_balance,
          voteCount: data.vote_count,
          hasVoted: false,
          createdAt: data.created_at,
        } satisfies ProposalItem,
      ],
      await hiddenPhotoUrls(recipeSlug),
    );

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
