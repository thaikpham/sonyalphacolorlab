import { NextResponse } from 'next/server';
import { hasControlConfig, controlAdmin } from '@/lib/supabase/server';
import { requireUser, UNAUTHENTICATED } from '@/lib/auth/require-user';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { COMMUNITY_ERRORS, communityErrorBody, outageErrorCode } from '@/lib/community/errors';

/**
 * A vote is a purely control-plane transaction.
 *
 * `proposal_votes` references `recipe_proposals` with a real foreign key, and
 * both tables live in the control project, so there is nothing to validate
 * across the boundary — deliberately no recipe-existence lookup here, unlike
 * the three routes whose rows reference a recipe slug. Adding one would make
 * every heart depend on the content project being up, for a constraint Postgres
 * is already enforcing locally.
 */
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

    if (!hasControlConfig()) {
      // In-memory toggle for offline mode
      return NextResponse.json({ ok: true, source: 'memory' });
    }

    const db = controlAdmin();

    /* Every result below is checked, and that is a fix rather than a style.
       All four of these calls used to have their `error` discarded, so the
       route answered `{ ok: true, voted: true }` whether or not a vote had been
       stored — a heart that filled in, survived a refresh as empty, and left
       nothing in any log. The read is the subtlest of the four: a failed
       `select` produced `existingVote === null`, which reads as "has not voted"
       and sent the handler down the insert branch, straight into the unique
       constraint it was supposed to respect. */
    const existing = await db
      .from('proposal_votes')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('user_email', userEmail)
      .maybeSingle();
    if (existing.error) throw new Error(`read vote: ${existing.error.message}`);

    const existingVote = existing.data;
    const voted = !existingVote;

    const write = existingVote
      ? await db.from('proposal_votes').delete().eq('id', existingVote.id)
      : await db.from('proposal_votes').insert({ proposal_id: proposalId, user_email: userEmail });
    if (write.error) throw new Error(`${voted ? 'insert' : 'delete'} vote: ${write.error.message}`);

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
    const tally = await db
      .from('proposal_votes')
      .select('id', { count: 'exact', head: true })
      .eq('proposal_id', proposalId);
    if (tally.error) throw new Error(`count votes: ${tally.error.message}`);

    const voteCount = tally.count ?? 0;
    const counter = await db
      .from('recipe_proposals')
      .update({ vote_count: voteCount })
      .eq('id', proposalId);
    if (counter.error) throw new Error(`write vote_count: ${counter.error.message}`);

    return NextResponse.json({ ok: true, voted, voteCount, source: 'supabase' });
  } catch (err) {
    /* Server-side only. `details: String(err)` used to go back in the response
       body, which hands an unauthenticated caller the Postgres error text —
       table and column names included. The client only learns the write failed. */
    console.error('[proposals/vote] failed:', err instanceof Error ? err.message : err);
    const outage = outageErrorCode(err);
    if (outage) {
      return NextResponse.json(communityErrorBody(outage), { status: COMMUNITY_ERRORS[outage] });
    }
    return NextResponse.json(communityErrorBody('saveFailed'), { status: 500 });
  }
}
