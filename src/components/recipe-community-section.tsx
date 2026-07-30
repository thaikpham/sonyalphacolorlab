'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import type { CommentItem } from '@/app/api/comments/route';
import type { ProposalItem } from '@/app/api/proposals/route';
import {
  PP_GAMMA,
  PP_COLOR_MODE,
  PP_BLACK_GAMMA_RANGE,
  PP_KNEE_MODE,
  PP_DETAIL_BW_BALANCE,
  PP_COLOR_DEPTH_CHANNELS,
  CREATIVE_LOOKS,
} from '@/lib/camera/constants';
import { createClient } from '@supabase/supabase-js';
import {
  getColorDepthChannelColor,
  getColorDepthChannelHexColor,
  getKelvinColor,
  getKelvinHexColor,
  getWbShiftAxisColor,
  getWbShiftAxisHexColor,
} from '@/lib/camera/color';

type Props = {
  recipeSlug: string;
  recipeTitle: string;
  recipeFormat?: 'pp' | 'cl';
  currentSettings: Record<string, any>;
  currentWb: Record<string, any>;
};

function formatProposalSettingPill(key: string, value: any): string {
  if (key === 'blackGamma' && typeof value === 'object' && value !== null) {
    const level = value.level > 0 ? `+${value.level}` : String(value.level);
    return `Black Gamma: ${value.range || 'Middle'} ${level}`;
  }
  if (key === 'knee' && typeof value === 'object' && value !== null) {
    if (value.mode === 'Auto') {
      return `Knee: Auto${value.maxPoint ? ` ${value.maxPoint}%` : ''}${value.sensitivity ? ` ${value.sensitivity}` : ''}`;
    }
    const slope = value.slope > 0 ? `+${value.slope}` : String(value.slope);
    return `Knee: Manual ${value.point ?? 75}% ${slope}`;
  }
  if (key === 'detail' && typeof value === 'object' && value !== null) {
    const lvl = value.level > 0 ? `+${value.level}` : String(value.level);
    return `Detail Level: ${lvl}`;
  }
  if (key === 'colorDepth' && typeof value === 'object' && value !== null) {
    const parts = Object.entries(value)
      .map(([k, v]: [string, any]) => `${k}${v > 0 ? `+${v}` : v}`)
      .join(' ');
    return `Depth: ${parts}`;
  }
  if (typeof value === 'number') {
    return `${key}: ${value > 0 ? `+${value}` : value}`;
  }
  if (typeof value === 'object') {
    return `${key}: ${JSON.stringify(value)}`;
  }
  return `${key}: ${String(value)}`;
}

export function RecipeCommunitySection({
  recipeSlug,
  recipeTitle,
  recipeFormat = 'pp',
  currentSettings,
  currentWb,
}: Props) {
  const { user, openLoginModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'comments' | 'proposals'>('comments');

  // Comments state
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Proposals state
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [newPropTitle, setNewPropTitle] = useState('');
  const [newSampleUrl, setNewSampleUrl] = useState('');
  const [isSubmittingProp, setIsSubmittingProp] = useState(false);
  const [isPropFormOpen, setIsPropFormOpen] = useState(false);

  // Full Camera-Format Template Editor State
  const [editSettings, setEditSettings] = useState<Record<string, any>>({});
  const [editWb, setEditWb] = useState<Record<string, any>>({});

  // Initialize template when opening proposal form
  useEffect(() => {
    if (isPropFormOpen) {
      setEditSettings(JSON.parse(JSON.stringify(currentSettings)));
      setEditWb(JSON.parse(JSON.stringify(currentWb)));
    }
  }, [isPropFormOpen, currentSettings, currentWb]);

  // Load comments
  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/comments?slug=${recipeSlug}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {
      // Ignore network errors
    }
  };

  // Load proposals
  const fetchProposals = async () => {
    try {
      const res = await fetch(`/api/proposals?slug=${recipeSlug}`);
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch {
      // Ignore network errors
    }
  };

  useEffect(() => {
    fetchComments();
    fetchProposals();

    // Setup Supabase Realtime client if env variables exist
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return;

    try {
      const client = createClient(url, anonKey);
      const channel = client
        .channel(`recipe-${recipeSlug}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'recipe_comments', filter: `recipe_slug=eq.${recipeSlug}` },
          () => fetchComments(),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'recipe_proposals', filter: `recipe_slug=eq.${recipeSlug}` },
          () => fetchProposals(),
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    } catch {
      // Ignore realtime connection errors
    }
  }, [recipeSlug]);

  // Post comment handler
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCommentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeSlug,
          authorName: user.name,
          authorEmail: user.email,
          authorAvatar: user.avatarUrl,
          content: newCommentText.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [data.comment, ...prev]);
        setNewCommentText('');
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Create tweak proposal handler
  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPropTitle.trim() || !newSampleUrl.trim() || isSubmittingProp) return;

    setIsSubmittingProp(true);
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeSlug,
          title: newPropTitle.trim(),
          authorName: user.name,
          authorEmail: user.email,
          authorAvatar: user.avatarUrl,
          sampleImageUrl: newSampleUrl.trim() || undefined,
          settings: editSettings,
          whiteBalance: editWb,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProposals((prev) => [data.proposal, ...prev]);
        setNewPropTitle('');
        setNewSampleUrl('');
        setIsPropFormOpen(false);
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsSubmittingProp(false);
    }
  };

  // Heart Vote handler
  const handleToggleVote = async (proposalId: string) => {
    if (!user) {
      openLoginModal();
      return;
    }

    // Optimistic UI update
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== proposalId) return p;
        const hasVoted = p.votedBy.includes(user.email);
        const newVotedBy = hasVoted
          ? p.votedBy.filter((e) => e !== user.email)
          : [...p.votedBy, user.email];
        const newCount = hasVoted ? Math.max(0, p.voteCount - 1) : p.voteCount + 1;
        return { ...p, voteCount: newCount, votedBy: newVotedBy };
      }),
    );

    try {
      await fetch('/api/proposals/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          userEmail: user.email,
        }),
      });
    } catch {
      // Revert if request failed
      fetchProposals();
    }
  };

  // Helper state adjusters
  const updateNum = (key: string, delta: number, min: number, max: number) => {
    setEditSettings((prev) => {
      const cur = typeof prev[key] === 'number' ? prev[key] : 0;
      const val = Math.min(max, Math.max(min, cur + delta));
      return { ...prev, [key]: val };
    });
  };

  const updateNestedNum = (parent: string, child: string, delta: number, min: number, max: number) => {
    setEditSettings((prev) => {
      const parentObj = prev[parent] || {};
      const cur = typeof parentObj[child] === 'number' ? parentObj[child] : 0;
      const val = Math.min(max, Math.max(min, cur + delta));
      return {
        ...prev,
        [parent]: { ...parentObj, [child]: val },
      };
    });
  };

  const updateNestedSelect = (parent: string, child: string, value: string) => {
    setEditSettings((prev) => ({
      ...prev,
      [parent]: { ...prev[parent], [child]: value },
    }));
  };

  const updateColorDepth = (channel: string, delta: number) => {
    setEditSettings((prev) => {
      const cd = prev.colorDepth || {};
      const cur = typeof cd[channel] === 'number' ? cd[channel] : 0;
      const val = Math.min(7, Math.max(-7, cur + delta));
      return {
        ...prev,
        colorDepth: { ...cd, [channel]: val },
      };
    });
  };

  const updateWbShift = (axisType: 'ab' | 'gm', delta: number) => {
    setEditWb((prev) => {
      const shift = prev.shift || {};
      const current = shift[axisType] || {
        axis: axisType === 'ab' ? 'A' : 'G',
        amount: 0,
      };

      // Convert axis + amount into signed number:
      // A (Amber) & G (Green) are positive
      // B (Blue) & M (Magenta) are negative
      const isPositiveAxis = current.axis === 'A' || current.axis === 'G';
      let signedVal = isPositiveAxis ? current.amount : -current.amount;

      // Apply step (+0.5 or -0.5)
      signedVal += delta * 0.5;

      // Bound to -7..+7
      signedVal = Math.min(7, Math.max(-7, signedVal));

      const newAxis =
        axisType === 'ab' ? (signedVal >= 0 ? 'A' : 'B') : signedVal >= 0 ? 'G' : 'M';
      const newAmount = Math.abs(signedVal);

      return {
        ...prev,
        shift: {
          ...shift,
          [axisType]: { axis: newAxis, amount: newAmount },
        },
      };
    });
  };

  return (
    <section className="mt-8 glass p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl bg-black/40 font-sans text-white">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xs font-bold tracking-wider uppercase text-white/90 font-sans flex items-center gap-2">
            <span>🌐</span>
            <span>Cộng Đồng & Đề Xuất Tinh Chỉnh</span>
          </h2>
          <p className="text-xs text-white/50 font-sans mt-0.5">
            Thảo luận và bình chọn các biến thể công thức màu tốt nhất cho {recipeTitle}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'comments'
                ? 'bg-white/20 text-white shadow-sm font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            💬 Bình luận ({comments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('proposals')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'proposals'
                ? 'bg-white/20 text-white shadow-sm font-bold'
                : 'text-white/60 hover:text-white'
            }`}
          >
            💡 Đề xuất & Vote ❤️ ({proposals.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Comments */}
      {activeTab === 'comments' && (
        <div className="mt-5 flex flex-col gap-6">
          {/* Add Comment Form or Google Login Prompt */}
          {user ? (
            <form onSubmit={handlePostComment} className="flex flex-col gap-3 bg-black/40 p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-2.5">
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-7 h-7 rounded-full border border-white/20 shrink-0"
                />
                <span className="text-xs font-semibold text-white/90">{user.name}</span>
                <span className="text-[10px] text-white/40">({user.email})</span>
              </div>

              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Viết bình luận, mẹo chụp hoặc cảm nhận của bạn về công thức này..."
                rows={2}
                maxLength={2000}
                className="w-full resize-y rounded-xl bg-black/60 p-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 font-sans border border-white/10"
              />

              <div className="flex justify-between items-center">
                <span className="text-[10px] text-white/40 font-sans">
                  Hãy giữ bình luận văn minh & hữu ích cho cộng đồng.
                </span>
                <button
                  type="submit"
                  disabled={isSubmittingComment || !newCommentText.trim()}
                  className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmittingComment ? 'Đang gửi...' : 'Gửi bình luận'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/50 p-4 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  💬
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Đăng nhập để tham gia bình luận</p>
                  <p className="text-[11px] text-white/50">Sử dụng tài khoản Google (Gmail) để bình luận và trao đổi</p>
                </div>
              </div>

              <button
                type="button"
                onClick={openLoginModal}
                className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white text-black font-bold text-xs hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer shrink-0"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                <span>Đăng nhập với Google</span>
              </button>
            </div>
          )}

          {/* Comments List */}
          <div className="flex flex-col gap-3">
            {comments.length === 0 ? (
              <p className="text-xs text-white/40 italic py-4 text-center">
                Chưa có bình luận nào. Hãy là người đầu tiên để lại ý kiến!
              </p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {comment.authorAvatar ? (
                        <img
                          src={comment.authorAvatar}
                          alt={comment.authorName}
                          className="w-6 h-6 rounded-full border border-white/20 shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-bold">
                          {comment.authorName.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-white">{comment.authorName}</span>
                    </div>

                    <span className="text-[10px] text-white/40">
                      {new Date(comment.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-white/80 pl-8 font-sans">
                    {comment.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Proposals & Heart Voting */}
      {activeTab === 'proposals' && (
        <div className="mt-5 flex flex-col gap-5">
          {/* Header Action */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-white/60">
              Điền trực tiếp thông số chuẩn format camera vào template để đề xuất phiên bản mới cho cộng đồng vote trái tim ❤️.
            </p>

            <button
              type="button"
              onClick={() => {
                if (!user) openLoginModal();
                else setIsPropFormOpen(!isPropFormOpen);
              }}
              className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              {isPropFormOpen ? (
                'Hủy'
              ) : (
                <>
                  <span>✨</span>
                  <span>Đề xuất phiên bản mới</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Camera-Accurate Template Editor Form */}
          {isPropFormOpen && user && (
            <form onSubmit={handleCreateProposal} className="flex flex-col gap-6 bg-black/60 p-5 sm:p-6 rounded-2xl border border-white/20 animate-fade-in shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>💡</span>
                  <span>Template Tinh Chỉnh {recipeFormat === 'pp' ? 'Picture Profile' : 'Creative Look'} Chuẩn Máy</span>
                </h3>
                <span className="text-[11px] text-emerald-400 font-semibold">Format Chuẩn Camera Sony</span>
              </div>

              {/* Proposal Title & Demo Photo URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/90 mb-1.5">
                    Tên đề xuất phiên bản mới <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Biến thể Nắng Chiều Rực Rỡ (Golden Warmth)..."
                    value={newPropTitle}
                    onChange={(e) => setNewPropTitle(e.target.value)}
                    maxLength={150}
                    className="w-full rounded-xl bg-black/80 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 border border-white/15 focus:outline-none focus:border-white/40 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/90 mb-1.5">
                    URL Ảnh demo mẫu thực tế (Direct Image URL) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://images.unsplash.com/photo-..."
                    value={newSampleUrl}
                    onChange={(e) => setNewSampleUrl(e.target.value)}
                    className="w-full rounded-xl bg-black/80 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 border border-white/15 focus:outline-none focus:border-white/40 font-sans"
                  />
                </div>
              </div>

              {/* BLOCK 1: White Balance Engine */}
              <div className="bg-black/40 p-4 rounded-xl border border-white/10 flex flex-col gap-3">
                <span className="eyebrow text-xs tracking-wider text-[oklch(85%_0.3_140)] font-bold uppercase">
                  1. Cân Bằng Trắng (White Balance Shift)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Kelvin Temperature */}
                  {editWb.mode === 'kelvin' && (
                    <div className="flex items-center justify-between bg-black/50 px-3.5 py-2 rounded-lg border border-white/10">
                      <span className="text-xs text-white/70">Nhiệt độ Kelvin</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditWb((prev) => ({ ...prev, kelvin: Math.max(2500, prev.kelvin - 100) }))}
                          className="w-6 h-6 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                        >
                          -
                        </button>
                        <span className={`text-xs font-bold w-12 text-center ${getKelvinColor(editWb.kelvin)}`}>
                          {editWb.kelvin}K
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditWb((prev) => ({ ...prev, kelvin: Math.min(9900, prev.kelvin + 100) }))}
                          className="w-6 h-6 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Shift A/B */}
                  <div className="flex items-center justify-between bg-black/50 px-3.5 py-2 rounded-lg border border-white/10">
                    <span className="text-xs text-white/70">Shift A/B</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateWbShift('ab', -1)}
                        className="w-6 h-6 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                      >
                        -
                      </button>
                      <span className={`text-xs font-bold w-12 text-center ${getWbShiftAxisColor(editWb.shift?.ab?.axis || 'A')}`}>
                        {editWb.shift?.ab ? `${editWb.shift.ab.axis}${editWb.shift.ab.amount}` : 'A0'}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateWbShift('ab', 1)}
                        className="w-6 h-6 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Shift G/M */}
                  <div className="flex items-center justify-between bg-black/50 px-3.5 py-2 rounded-lg border border-white/10">
                    <span className="text-xs text-white/70">Shift G/M</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateWbShift('gm', -1)}
                        className="w-6 h-6 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                      >
                        -
                      </button>
                      <span className={`text-xs font-bold w-12 text-center ${getWbShiftAxisColor(editWb.shift?.gm?.axis || 'G')}`}>
                        {editWb.shift?.gm ? `${editWb.shift.gm.axis}${editWb.shift.gm.amount}` : 'G0'}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateWbShift('gm', 1)}
                        className="w-6 h-6 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK 2: Picture Profile Master Settings */}
              {recipeFormat === 'pp' && (
                <>
                  <div className="bg-black/40 p-4 rounded-xl border border-white/10 flex flex-col gap-3">
                    <span className="eyebrow text-xs tracking-wider text-white/90 font-bold uppercase">
                      2. Picture Profile Master Settings
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Black Level */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Black Level</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateNum('blackLevel', -1, -15, 15)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {editSettings.blackLevel > 0 ? `+${editSettings.blackLevel}` : editSettings.blackLevel}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateNum('blackLevel', 1, -15, 15)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Gamma Select */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Gamma</span>
                        <select
                          value={editSettings.gamma || 'S-Cinetone'}
                          onChange={(e) => setEditSettings((prev) => ({ ...prev, gamma: e.target.value }))}
                          className="bg-black text-xs text-white px-2 py-1 rounded border border-white/20 focus:outline-none"
                        >
                          {PP_GAMMA.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>

                      {/* Black Gamma (Range & Level) */}
                      {editSettings.blackGamma && (
                        <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10 col-span-1 sm:col-span-2">
                          <span className="text-xs text-white/70">Black Gamma</span>
                          <div className="flex items-center gap-2">
                            <select
                              value={editSettings.blackGamma.range || 'Middle'}
                              onChange={(e) => updateNestedSelect('blackGamma', 'range', e.target.value)}
                              className="bg-black text-xs text-white px-2 py-1 rounded border border-white/20 focus:outline-none"
                            >
                              {PP_BLACK_GAMMA_RANGE.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateNestedNum('blackGamma', 'level', -1, -7, 7)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold w-8 text-center text-white">
                                {editSettings.blackGamma.level > 0 ? `+${editSettings.blackGamma.level}` : editSettings.blackGamma.level}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateNestedNum('blackGamma', 'level', 1, -7, 7)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Knee (Mode, Point, Slope) */}
                      {editSettings.knee && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-black/50 px-3 py-2 rounded-lg border border-white/10 col-span-1 sm:col-span-2 lg:col-span-3">
                          <span className="text-xs text-white/70 font-semibold">Knee</span>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <select
                              value={editSettings.knee.mode || 'Auto'}
                              onChange={(e) => updateNestedSelect('knee', 'mode', e.target.value)}
                              className="bg-black text-xs text-white px-2 py-1 rounded border border-white/20 focus:outline-none"
                            >
                              {PP_KNEE_MODE.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>

                            {editSettings.knee.mode === 'Manual' && (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-white/50">Point:</span>
                                  <button
                                    type="button"
                                    onClick={() => updateNestedNum('knee', 'point', -5, 75, 105)}
                                    className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-bold text-white">{editSettings.knee.point ?? 75}%</span>
                                  <button
                                    type="button"
                                    onClick={() => updateNestedNum('knee', 'point', 5, 75, 105)}
                                    className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-white/50">Slope:</span>
                                  <button
                                    type="button"
                                    onClick={() => updateNestedNum('knee', 'slope', -1, -5, 5)}
                                    className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-bold text-white">
                                    {(editSettings.knee.slope ?? 0) > 0 ? `+${editSettings.knee.slope}` : (editSettings.knee.slope ?? 0)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateNestedNum('knee', 'slope', 1, -5, 5)}
                                    className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                                  >
                                    +
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Color Mode Select */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Color Mode</span>
                        <select
                          value={editSettings.colorMode || 'S-Cinetone'}
                          onChange={(e) => setEditSettings((prev) => ({ ...prev, colorMode: e.target.value }))}
                          className="bg-black text-xs text-white px-2 py-1 rounded border border-white/20 focus:outline-none max-w-[120px] truncate"
                        >
                          {PP_COLOR_MODE.map((cm) => (
                            <option key={cm} value={cm}>{cm}</option>
                          ))}
                        </select>
                      </div>

                      {/* Saturation (-32 to +32) */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Saturation</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateNum('saturation', -1, -32, 32)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {editSettings.saturation > 0 ? `+${editSettings.saturation}` : editSettings.saturation}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateNum('saturation', 1, -32, 32)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Color Phase (-7 to +7) */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Color Phase</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateNum('colorPhase', -1, -7, 7)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {editSettings.colorPhase > 0 ? `+${editSettings.colorPhase}` : editSettings.colorPhase}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateNum('colorPhase', 1, -7, 7)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BLOCK 3: Color Depth (6 Channels R, G, B, C, M, Y) */}
                  {editSettings.colorDepth && (
                    <div className="bg-black/40 p-4 rounded-xl border border-white/10 flex flex-col gap-3">
                      <span className="eyebrow text-xs tracking-wider text-white/90 font-bold uppercase">
                        3. Color Depth (6 Kênh Màu)
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        {PP_COLOR_DEPTH_CHANNELS.map((ch) => {
                          const hex = getColorDepthChannelHexColor(ch);
                          return (
                            <div key={ch} className="flex items-center justify-between bg-black/50 px-2.5 py-1.5 rounded-lg border border-white/10">
                              <span className="text-xs font-bold" style={{ color: hex }}>{ch}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateColorDepth(ch, -1)}
                                  className="w-4 h-4 rounded bg-white/10 text-white font-bold text-[10px] hover:bg-white/20 flex items-center justify-center"
                                >
                                  -
                                </button>
                                <span className="text-xs font-bold w-5 text-center" style={{ color: hex }}>
                                  {editSettings.colorDepth[ch] > 0 ? `+${editSettings.colorDepth[ch]}` : editSettings.colorDepth[ch]}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateColorDepth(ch, 1)}
                                  className="w-4 h-4 rounded bg-white/10 text-white font-bold text-[10px] hover:bg-white/20 flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* BLOCK 4: Detail Sub-Parameters */}
                  {editSettings.detail && (
                    <div className="bg-black/40 p-4 rounded-xl border border-white/10 flex flex-col gap-3">
                      <span className="eyebrow text-xs tracking-wider text-white/90 font-bold uppercase">
                        4. Detail (Độ Sắc Nét Chi Tiết)
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Detail Level */}
                        <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                          <span className="text-xs text-white/70">Level</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'level', -1, -7, 7)}
                              className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold w-8 text-center text-white">
                              {editSettings.detail.level > 0 ? `+${editSettings.detail.level}` : editSettings.detail.level}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'level', 1, -7, 7)}
                              className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* V/H Balance */}
                        <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                          <span className="text-xs text-white/70">V/H Balance</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'vhBalance', -1, -2, 2)}
                              className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold w-8 text-center text-white">
                              {editSettings.detail.vhBalance > 0 ? `+${editSettings.detail.vhBalance}` : editSettings.detail.vhBalance}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'vhBalance', 1, -2, 2)}
                              className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* B/W Balance Select */}
                        <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                          <span className="text-xs text-white/70">B/W Balance</span>
                          <select
                            value={editSettings.detail.bwBalance || 'Type3'}
                            onChange={(e) => updateNestedSelect('detail', 'bwBalance', e.target.value)}
                            className="bg-black text-xs text-white px-2 py-1 rounded border border-white/20 focus:outline-none"
                          >
                            {PP_DETAIL_BW_BALANCE.map((bw) => (
                              <option key={bw} value={bw}>{bw}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Submission Button */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-[11px] text-white/50">
                  Ảnh demo mẫu sẽ tự động được thêm vào bộ sưu tập công thức.
                </span>

                <button
                  type="submit"
                  disabled={isSubmittingProp || !newPropTitle.trim() || !newSampleUrl.trim()}
                  className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-40"
                >
                  {isSubmittingProp ? 'Đang gửi...' : 'Đề xuất phiên bản mới'}
                </button>
              </div>
            </form>
          )}

          {/* Proposal Cards Grid */}
          <div className="grid grid-cols-1 gap-3.5">
            {proposals.length === 0 ? (
              <p className="text-xs text-white/40 italic py-4 text-center">
                Chưa có đề xuất tinh chỉnh nào. Hãy tạo phiên bản mới đầu tiên!
              </p>
            ) : (
              proposals.map((prop) => {
                const hasVoted = user ? prop.votedBy.includes(user.email) : false;
                return (
                  <div
                    key={prop.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                  >
                    {/* Proposal Details & Optional Demo Photo Thumbnail */}
                    <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                      {prop.sampleImageUrl && (
                        <img
                          src={prop.sampleImageUrl}
                          alt={prop.title}
                          className="w-16 h-16 sm:w-20 sm:h-14 rounded-lg object-cover border border-white/15 shrink-0 shadow-md"
                        />
                      )}

                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {prop.authorAvatar ? (
                            <img
                              src={prop.authorAvatar}
                              alt={prop.authorName}
                              className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[9px] font-bold">
                              {prop.authorName.charAt(0)}
                            </div>
                          )}
                          <span className="text-xs font-semibold text-white/90 truncate">{prop.title}</span>
                          <span className="text-[10px] text-white/40 shrink-0">bởi {prop.authorName}</span>
                        </div>

                        {/* Parameter highlight pills */}
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {Object.entries(prop.settings).slice(0, 6).map(([k, v]) => (
                            <span
                              key={k}
                              className="text-[10px] px-2 py-0.5 rounded bg-black/40 text-white/70 border border-white/5"
                            >
                              {formatProposalSettingPill(k, v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Heart Vote Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleVote(prop.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all cursor-pointer shrink-0 ${
                        hasVoted
                          ? 'bg-red-500/20 border-red-500/50 text-red-300 font-bold scale-105 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                          : 'bg-black/40 border-white/15 text-white/70 hover:text-white hover:border-white/30'
                      }`}
                    >
                      <span className={`text-sm transition-transform ${hasVoted ? 'scale-125' : ''}`}>
                        {hasVoted ? '❤️' : '🤍'}
                      </span>
                      <span className="text-xs">{prop.voteCount}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
