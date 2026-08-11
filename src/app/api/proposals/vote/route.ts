import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase/server';
import { requireUser, UNAUTHENTICATED } from '@/lib/auth/require-user';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { communityErrorBody } from '@/lib/community/errors';

export async function POST(request: Request) {
  try {
    /* The voter is whoever the token says, not whoever the body claims. Taking
       `userEmail` from the payload made the unique(proposal_id, user_email)
       constraint meaningless: invent a new address, cast another vote. */
    const user = await requireUser(request);
    if (!user) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

    const limit = checkRateLimit(`vote:${user.email}`, Date.now(), 30);
    if (!limit.allowed) {
      return NextResponse.json(
        communityErrorBody('rateLimited'),
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const { proposalId } = body;
    const userEmail = user.email;

    if (!proposalId) {
      return NextResponse.json(communityErrorBody('missingFields'), { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      // In-memory toggle for offline mode
      return NextResponse.json({ ok: true, source: 'memory' });
    }

    const db = supabaseAdmin();

    const { data: existingVote } = await db
      .from('proposal_votes')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('user_email', userEmail)
      .maybeSingle();

    const voted = !existingVote;

    if (existingVote) {
      await db.from('proposal_votes').delete().eq('id', existingVote.id);
    } else {
      await db.from('proposal_votes').insert({ proposal_id: proposalId, user_email: userEmail });
    }

    /* `vote_count` is recomputed from the votes table, never adjusted by ±1
       against its own previous value.
       Reading the counter and writing back `counter ± 1` is a read-modify-write
       across two round trips: two people hearting the same proposal at once both
       read N and both write N+1, and one vote disappears from the count while
       staying in `proposal_votes` — visibly wrong, and permanent, because
       nothing ever recomputed it. Counting the rows that are the actual source
       of truth makes a lost update self-healing instead: the next vote on that
       proposal writes the correct total regardless of what the column said.
       The durable fix is a Postgres function doing both writes in one
       statement; that needs a migration applied to Supabase by hand, so it is
       deliberately not on this path. */
    const { count } = await db
      .from('proposal_votes')
      .select('id', { count: 'exact', head: true })
      .eq('proposal_id', proposalId);

    const voteCount = count ?? 0;
    await db.from('recipe_proposals').update({ vote_count: voteCount }).eq('id', proposalId);

    return NextResponse.json({ ok: true, voted, voteCount, source: 'supabase' });
  } catch (err) {
    /* Server-side only. `details: String(err)` used to go back in the response
       body, which hands an unauthenticated caller the Postgres error text —
       table and column names included. The client only learns the write failed. */
    console.error('[proposals/vote] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(communityErrorBody('saveFailed'), { status: 500 });
  }
}
