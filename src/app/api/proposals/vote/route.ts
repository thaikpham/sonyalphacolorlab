import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { proposalId, userEmail } = body;

    if (!proposalId || !userEmail) {
      return NextResponse.json({ error: 'Missing proposalId or userEmail' }, { status: 400 });
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
