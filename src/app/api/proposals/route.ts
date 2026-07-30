import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin, supabaseRead } from '@/lib/supabase/server';

export type ProposalItem = {
  id: string;
  recipeSlug: string;
  title: string;
  authorName: string;
  authorEmail: string;
  authorAvatar: string | null;
  sampleImageUrl?: string | null;
  settings: Record<string, unknown>;
  whiteBalance: Record<string, unknown>;
  voteCount: number;
  votedBy: string[]; // List of user emails who voted
  createdAt: string;
};

// In-memory proposals fallback when running offline
const memoryProposals: ProposalItem[] = [
  {
    id: 'seed-prop-1',
    recipeSlug: 'daylight-cinema',
    title: 'Biến thể Ấm Áp Hoàng Hôn (Golden Hour Tone)',
    authorName: 'Hoàng Nhiếp Ảnh',
    authorEmail: 'hoangphoto@gmail.com',
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
    votedBy: ['user1@gmail.com', 'user2@gmail.com'],
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: 'seed-prop-2',
    recipeSlug: 'daylight-cinema',
    title: 'Biến thể Cine Nhật Bản (Soft Film Mood)',
    authorName: 'Linh Trần',
    authorEmail: 'linhtran@gmail.com',
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
    votedBy: ['user3@gmail.com'],
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    const filtered = memoryProposals.filter((p) => p.recipeSlug === slug);
    return NextResponse.json({ proposals: filtered, source: 'memory' });
  }

  try {
    const { data: proposalRows, error } = await supabaseRead()
      .from('recipe_proposals')
      .select('*')
      .eq('recipe_slug', slug)
      .order('vote_count', { ascending: false });

    if (error) throw error;

    // Fetch vote list for these proposals
    const proposalIds = (proposalRows || []).map((p) => p.id);
    let votesMap: Record<string, string[]> = {};

    if (proposalIds.length > 0) {
      const { data: voteRows } = await supabaseRead()
        .from('proposal_votes')
        .select('proposal_id, user_email')
        .in('proposal_id', proposalIds);

      if (voteRows) {
        voteRows.forEach((v) => {
          if (!votesMap[v.proposal_id]) votesMap[v.proposal_id] = [];
          votesMap[v.proposal_id].push(v.user_email);
        });
      }
    }

    const proposals: ProposalItem[] = (proposalRows || []).map((row) => ({
      id: row.id,
      recipeSlug: row.recipe_slug,
      title: row.title,
      authorName: row.author_name,
      authorEmail: row.author_email,
      authorAvatar: row.author_avatar,
      settings: row.settings,
      whiteBalance: row.white_balance,
      voteCount: row.vote_count,
      votedBy: votesMap[row.id] || [],
      createdAt: row.created_at,
    }));

    return NextResponse.json({ proposals, source: 'supabase' });
  } catch (err) {
    const filtered = memoryProposals.filter((p) => p.recipeSlug === slug);
    return NextResponse.json({ proposals: filtered, source: 'fallback', error: String(err) });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recipeSlug, title, authorName, authorEmail, authorAvatar, sampleImageUrl, settings, whiteBalance } = body;

    if (!recipeSlug || !title || !authorName || !authorEmail || !sampleImageUrl || !settings || !whiteBalance) {
      return NextResponse.json({ error: 'URL ảnh demo mẫu thực tế là bắt buộc.' }, { status: 400 });
    }

    const newProposal: ProposalItem = {
      id: `prop-${Date.now()}`,
      recipeSlug,
      title: title.slice(0, 150),
      authorName: authorName.slice(0, 100),
      authorEmail: authorEmail.slice(0, 255),
      authorAvatar: authorAvatar || null,
      sampleImageUrl: sampleImageUrl || null,
      settings,
      whiteBalance,
      voteCount: 0,
      votedBy: [],
      createdAt: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) {
      memoryProposals.unshift(newProposal);
      return NextResponse.json({ proposal: newProposal, source: 'memory' });
    }

    const db = supabaseAdmin();
    const { data, error } = await db
      .from('recipe_proposals')
      .insert({
        recipe_slug: recipeSlug,
        title,
        author_name: authorName,
        author_email: authorEmail,
        author_avatar: authorAvatar,
        settings,
        white_balance: whiteBalance,
        vote_count: 0,
      })
      .select('*')
      .single();

    if (error) throw error;

    // If sampleImageUrl is provided, automatically add to community_photos gallery
    if (sampleImageUrl && typeof sampleImageUrl === 'string' && sampleImageUrl.startsWith('https://')) {
      try {
        await db.from('community_photos').insert({
          recipe_slug: recipeSlug,
          image_url: sampleImageUrl,
          author_name: `${authorName} (${title})`,
          author_social: null,
          submitted_by: authorEmail,
        });
      } catch {
        // Ignore duplicate image insertion error
      }
    }

    const savedProposal: ProposalItem = {
      id: data.id,
      recipeSlug: data.recipe_slug,
      title: data.title,
      authorName: data.author_name,
      authorEmail: data.author_email,
      authorAvatar: data.author_avatar,
      sampleImageUrl: sampleImageUrl || null,
      settings: data.settings,
      whiteBalance: data.white_balance,
      voteCount: data.vote_count,
      votedBy: [],
      createdAt: data.created_at,
    };

    return NextResponse.json({ proposal: savedProposal, source: 'supabase' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create proposal', details: String(err) }, { status: 500 });
  }
}
