import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase/server';
import { requireUser, UNAUTHENTICATED } from '@/lib/auth/require-user';
import { checkRateLimit } from '@/lib/ai/rate-limit';

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
        { error: 'Bạn đang vote quá nhanh. Thử lại sau ít giây.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const { proposalId } = body;
    const userEmail = user.email;

    if (!proposalId) {
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      // In-memory toggle for offline mode
      return NextResponse.json({ ok: true, source: 'memory' });
    }

    const db = supabaseAdmin();

    // Check existing vote
    const { data: existingVote } = await db
      .from('proposal_votes')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('user_email', userEmail)
      .maybeSingle();

    if (existingVote) {
      // Remove vote
      await db.from('proposal_votes').delete().eq('id', existingVote.id);
      
      // Decrement vote_count
      const { data: proposal } = await db
        .from('recipe_proposals')
        .select('vote_count')
        .eq('id', proposalId)
        .single();

      const newCount = Math.max(0, (proposal?.vote_count || 1) - 1);
      await db
        .from('recipe_proposals')
        .update({ vote_count: newCount })
        .eq('id', proposalId);

      return NextResponse.json({ ok: true, voted: false, voteCount: newCount, source: 'supabase' });
    } else {
      // Add vote
      await db.from('proposal_votes').insert({ proposal_id: proposalId, user_email: userEmail });

      // Increment vote_count
      const { data: proposal } = await db
        .from('recipe_proposals')
        .select('vote_count')
        .eq('id', proposalId)
        .single();

      const newCount = (proposal?.vote_count || 0) + 1;
      await db
        .from('recipe_proposals')
        .update({ vote_count: newCount })
        .eq('id', proposalId);

      return NextResponse.json({ ok: true, voted: true, voteCount: newCount, source: 'supabase' });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed to process vote', details: String(err) }, { status: 500 });
  }
}
