'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from './auth-context';
import { OPEN_PROPOSAL_EVENT } from '@/lib/community/events';
import type { CommentItem } from '@/app/api/comments/route';
import type { ProposalItem } from '@/app/api/proposals/route';
import { createClient } from '@supabase/supabase-js';
import {
  getColorDepthChannelHexColor,
  getKelvinColor,
  getWbShiftAxisColor,
} from '@/lib/camera/color';
// Rule 1: every legal enum and range is imported, never retyped at a call site.
import {
  CL_MONOCHROME_LOOKS,
  CL_RANGES,
  CREATIVE_LOOKS,
  CREATIVE_LOOK_CODES,
  PP_BLACK_GAMMA_RANGE,
  PP_COLOR_DEPTH_CHANNELS,
  PP_COLOR_MODE,
  PP_DETAIL_BW_BALANCE,
  PP_GAMMA,
  PP_KNEE_MODE,
  PP_RANGES,
  WB_KELVIN,
  WB_SHIFT_AXIS,
} from '@/lib/camera/constants';
import type { ClSettings, PpSettings, WhiteBalance } from '@/lib/camera/schema';

type Props = {
  recipeSlug: string;
  recipeTitle: string;
  recipeFormat?: 'pp' | 'cl';
  currentSettings: Record<string, unknown>;
  /** The real schema type — the editor writes camera values, so it must not
      fall back to an untyped record where a bad field goes unnoticed. */
  currentWb: WhiteBalance;
};

/** Narrows a <select> value to a camera enum, falling back if it is not legal. */
function asEnum<T extends readonly string[]>(list: T, value: string, fallback: T[number]): T[number] {
  return (list as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

function formatProposalSettingPill(key: string, value: unknown): string {
  if (key === 'blackGamma' && typeof value === 'object' && value !== null) {
    const bg = value as { range?: string; level?: number };
    const level = (bg.level ?? 0) > 0 ? `+${bg.level}` : String(bg.level ?? 0);
    return `Black Gamma: ${bg.range || 'Middle'} ${level}`;
  }
  if (key === 'knee' && typeof value === 'object' && value !== null) {
    const k = value as { mode?: string; maxPoint?: number; sensitivity?: string; point?: number; slope?: number };
    if (k.mode === 'Auto') {
      return `Knee: Auto${k.maxPoint ? ` ${k.maxPoint}%` : ''}${k.sensitivity ? ` ${k.sensitivity}` : ''}`;
    }
    const slope = (k.slope ?? 0) > 0 ? `+${k.slope}` : String(k.slope ?? 0);
    return `Knee: Manual ${k.point ?? 75}% ${slope}`;
  }
  if (key === 'detail' && typeof value === 'object' && value !== null) {
    const d = value as { level?: number };
    const lvl = (d.level ?? 0) > 0 ? `+${d.level}` : String(d.level ?? 0);
    return `Detail Level: ${lvl}`;
  }
  if (key === 'colorDepth' && typeof value === 'object' && value !== null) {
    const cd = value as Record<string, number>;
    const parts = Object.entries(cd)
      .map(([ch, v]) => `${ch}${v > 0 ? `+${v}` : v}`)
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
  const t = useTranslations('community');
  const { user, openLoginModal, accessToken, loginWithGoogle } = useAuth();

  /* Every write carries the session JWT; the routes reject anything without
     one. Identity is no longer sent in the body — the server reads it from the
     token, so a forged authorName has nowhere to land. */
  const authedJson = () => {
    const token = accessToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };
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
  /* Partial, not the full PpSettings / ClSettings: the draft starts populated
     from currentSettings. The editor branches on `recipeFormat` to render either
     Picture Profile or Creative Look camera controls. */
  const [editSettings, setEditSettings] = useState<Partial<PpSettings> & Partial<ClSettings>>({});
  const [editWb, setEditWb] = useState<WhiteBalance | null>(null);

  /**
   * Seeds the draft from the live recipe. Called when the form is opened rather
   * than from an effect watching `isPropFormOpen` — an effect would re-seed on
   * every render where `currentSettings` is a fresh object, silently discarding
   * edits in progress, and it is the cascading-render pattern React warns about.
   */
  const openProposalForm = useCallback(() => {
    setEditSettings(JSON.parse(JSON.stringify(currentSettings)) as Partial<PpSettings> & Partial<ClSettings>);
    setEditWb(JSON.parse(JSON.stringify(currentWb)) as WhiteBalance);
    setIsPropFormOpen(true);
  }, [currentSettings, currentWb]);

  // Load comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?slug=${recipeSlug}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {
      // Ignore network errors
    }
  }, [recipeSlug]);

  // Load proposals
  const fetchProposals = useCallback(async () => {
    try {
      const token = accessToken();
      const res = await fetch(`/api/proposals?slug=${recipeSlug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch {
      // Ignore network errors
    }
  }, [recipeSlug, accessToken]);

  useEffect(() => {
    /* Recipe pages are statically generated, so comments and proposals cannot
       be server-rendered without serving them stale — the initial load belongs
       on the client.

       `set-state-in-effect` cannot see through `useCallback` that both fetchers
       suspend on `await fetch(...)` before touching state, so no setState here
       is synchronous and no cascading render is possible. Scoped to this line;
       remove it if either fetcher ever gains a synchronous early setState. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchComments();
    void fetchProposals();

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
  }, [recipeSlug, fetchComments, fetchProposals]);

  /* Opened from the gallery's "Propose & vote" card, which has no way to reach
     this state directly — see `OPEN_PROPOSAL_EVENT`. `openProposalForm` is in
     the deps because it seeds the draft from `currentSettings`: pinned to the
     first render, a later recipe would have opened the editor on stale values. */
  useEffect(() => {
    const handleOpenProposalSection = () => {
      setActiveTab('proposals');
      /* Signed out, the editor does not render at all — without this the card
         scrolled the reader to the proposals tab and then did nothing visible.
         Same branch the section's own "Propose a new version" button takes. */
      if (!user) openLoginModal();
      else openProposalForm();
      requestAnimationFrame(() => {
        document
          .getElementById('community-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    window.addEventListener(OPEN_PROPOSAL_EVENT, handleOpenProposalSection);
    return () => window.removeEventListener(OPEN_PROPOSAL_EVENT, handleOpenProposalSection);
  }, [openProposalForm, user, openLoginModal]);

  // Post comment handler
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCommentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: authedJson(),
        body: JSON.stringify({
          recipeSlug,
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
        headers: authedJson(),
        body: JSON.stringify({
          recipeSlug,
          title: newPropTitle.trim(),
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
        const newCount = p.hasVoted ? Math.max(0, p.voteCount - 1) : p.voteCount + 1;
        return { ...p, voteCount: newCount, hasVoted: !p.hasVoted };
      }),
    );

    try {
      await fetch('/api/proposals/vote', {
        method: 'POST',
        headers: authedJson(),
        body: JSON.stringify({ proposalId }),
      });
    } catch {
      // Revert if request failed
      fetchProposals();
    }
  };

  /**
   * Which range in constants.ts governs each editable field.
   *
   * Every call site used to pass its own min/max — `-15, 15`, `75, 105`,
   * `-32, 32` and so on, about twenty times. That is Rule 1 violated at scale:
   * a range changed in constants.ts would leave this editor happily producing
   * proposals the camera rejects, with nothing failing to say so.
   */
  const NUM_RANGE = {
    blackLevel: PP_RANGES.blackLevel,
    saturation: PP_RANGES.saturation,
    colorPhase: PP_RANGES.colorPhase,
  } as const;

  const NESTED_RANGE = {
    'blackGamma.level': PP_RANGES.blackGammaLevel,
    'knee.point': PP_RANGES.kneeManualPoint,
    'knee.slope': PP_RANGES.kneeManualSlope,
    'detail.level': PP_RANGES.detailLevel,
    'detail.vhBalance': PP_RANGES.detailVhBalance,
    'detail.limit': PP_RANGES.detailLimit,
    'detail.crispening': PP_RANGES.detailCrispening,
    'detail.hiLightDetail': PP_RANGES.detailHiLightDetail,
  } as const;

  type NumKey = keyof typeof NUM_RANGE;
  type NestedKey = keyof typeof NESTED_RANGE;

  const clampTo = (value: number, range: { min: number; max: number; step: number }) => {
    const bounded = Math.min(range.max, Math.max(range.min, value));
    // Snap to the camera's own increment so float drift cannot produce a value
    // the schema rejects on submit.
    return Math.round(bounded / range.step) * range.step;
  };

  const updateNum = (key: NumKey, delta: number) => {
    setEditSettings((prev) => {
      const cur = typeof prev[key] === 'number' ? prev[key] : 0;
      return { ...prev, [key]: clampTo(cur + delta, NUM_RANGE[key]) };
    });
  };

  const updateNestedNum = (
    parent: 'blackGamma' | 'knee' | 'detail',
    child: string,
    delta: number,
  ) => {
    const range = NESTED_RANGE[`${parent}.${child}` as NestedKey];
    setEditSettings((prev) => {
      const parentObj = (prev[parent] ?? {}) as Record<string, unknown>;
      const cur = typeof parentObj[child] === 'number' ? (parentObj[child] as number) : 0;
      return {
        ...prev,
        [parent]: { ...parentObj, [child]: clampTo(cur + delta, range) },
      };
    });
  };

  const updateNestedSelect = (
    parent: 'blackGamma' | 'knee' | 'detail',
    child: string,
    value: string,
  ) => {
    setEditSettings((prev) => {
      const parentObj = (prev[parent] ?? {}) as Record<string, unknown>;
      return { ...prev, [parent]: { ...parentObj, [child]: value } };
    });
  };

  const updateColorDepth = (channel: (typeof PP_COLOR_DEPTH_CHANNELS)[number], delta: number) => {
    setEditSettings((prev) => {
      const cd = prev.colorDepth ?? { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 };
      const cur = cd[channel] ?? 0;
      return {
        ...prev,
        colorDepth: { ...cd, [channel]: clampTo(cur + delta, PP_RANGES.colorDepth) },
      };
    });
  };

  const updateClNum = (key: keyof typeof CL_RANGES, delta: number) => {
    setEditSettings((prev) => {
      const cur = typeof prev[key] === 'number' ? (prev[key] as number) : 0;
      return { ...prev, [key]: clampTo(cur + delta, CL_RANGES[key]) };
    });
  };

  const updateClLook = (look: string) => {
    setEditSettings((prev) => {
      const isMono = (CL_MONOCHROME_LOOKS as readonly string[]).includes(look);
      /* Narrowed against the real code list rather than asserted through `any`:
         the <select> only offers legal codes today, but the cast would have let
         any future caller write a Look the camera has never heard of. */
      const next: Partial<PpSettings> & Partial<ClSettings> = {
        ...prev,
        look: asEnum(CREATIVE_LOOK_CODES, look, prev.look ?? CREATIVE_LOOK_CODES[0]),
      };
      if (isMono) {
        delete next.saturation;
      } else if (next.saturation === undefined) {
        next.saturation = 0;
      }
      return next;
    });
  };

  /** Steps Kelvin by one camera increment. No-op unless the draft is in Kelvin mode. */
  const adjustKelvin = (direction: -1 | 1) => {
    setEditWb((prev) => {
      if (!prev || prev.mode !== 'kelvin') return prev;
      return {
        ...prev,
        kelvin: Math.min(
          WB_KELVIN.max,
          Math.max(WB_KELVIN.min, prev.kelvin + direction * WB_KELVIN.step),
        ),
      };
    });
  };

  const updateWbShift = (axisType: 'ab' | 'gm', delta: number) => {
    setEditWb((prev) => {
      if (!prev) return prev;
      const shift = prev.shift ?? {};
      const current = shift[axisType] ?? {
        axis: axisType === 'ab' ? ('A' as const) : ('G' as const),
        amount: 0,
      };

      // The two axes are stored as a letter plus a magnitude, so collapse them
      // to one signed number to step through zero cleanly.
      // A (Amber) and G (Green) are positive; B (Blue) and M (Magenta) negative.
      const isPositiveAxis = current.axis === 'A' || current.axis === 'G';
      let signedVal = isPositiveAxis ? current.amount : -current.amount;

      // Step and bound come from constants.ts. Hardcoding 0.5 here meant the
      // editor could not reach the quarter-steps real recipes already use
      // (M0.25, M0.75, M1.25, G1.75, M2.75) — the camera moves in 0.25.
      signedVal += delta * WB_SHIFT_AXIS.step;
      signedVal = Math.min(WB_SHIFT_AXIS.max, Math.max(-WB_SHIFT_AXIS.max, signedVal));
      // Float drift: 0.1+0.2 style error would produce an amount the schema rejects.
      signedVal = Math.round(signedVal / WB_SHIFT_AXIS.step) * WB_SHIFT_AXIS.step;

      const newAxis =
        axisType === 'ab'
          ? signedVal >= 0
            ? ('A' as const)
            : ('B' as const)
          : signedVal >= 0
            ? ('G' as const)
            : ('M' as const);

      return {
        ...prev,
        shift: {
          ...shift,
          [axisType]: { axis: newAxis, amount: Math.abs(signedVal) },
        },
      };
    });
  };

  /*
   * Opaque fill, border and shadow on the wrapper; `.glass` on the panel inside.
   * `.glass` is unlayered CSS and hard-sets `background`/`box-shadow` with
   * `border: 0 !important`, so `bg-black/40 border-white/10 shadow-xl
   * rounded-2xl` were all dead on the same element — this panel was rendering
   * far more transparent than intended, over whatever photograph sat behind it.
   */
  return (
    <section
      id="community-section"
      className="mt-8 overflow-hidden rounded-[var(--radius-glass)] border border-white/10 bg-black/40 shadow-xl font-sans text-white"
    >
      <div className="glass p-5 sm:p-6">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xs font-bold tracking-wider uppercase text-white/90 font-sans flex items-center gap-2">
              <span>🌐</span>
              <span>{t('title')}</span>
            </h2>
            <p className="text-xs text-white/50 font-sans mt-0.5">
              {t('subtitle', { title: recipeTitle })}
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
              💬 {t('tabComments', { count: comments.length })}
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
              💡 {t('tabProposals', { count: proposals.length })}
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
                  {/* eslint-disable-next-line @next/next/no-img-element -- Google avatar, arbitrary host */}
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-7 h-7 rounded-full border border-white/20 shrink-0"
                  />
                  <span className="text-xs font-semibold text-white/90">{user.name}</span>
                  <span className="text-[10px] text-white/40">({user.email})</span>
                </div>

                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder={t('commentPlaceholder')}
                  rows={2}
                  maxLength={2000}
                  className="w-full resize-y rounded-xl bg-black/60 p-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 font-sans border border-white/10"
                />

                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/40 font-sans">
                    {t('commentHint')}
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !newCommentText.trim()}
                    className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmittingComment ? t('commentSending') : t('commentSubmit')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-3 bg-black/40 p-3.5 rounded-xl border border-white/10 text-xs text-white/70 font-sans">
                <span className="text-base shrink-0">💬</span>
                <span>
                  {t.rich('loginPrompt', {
                    a: (chunks) => (
                      <button
                        type="button"
                        onClick={loginWithGoogle}
                        className="text-white font-bold underline hover:text-community transition-colors cursor-pointer"
                      >
                        {chunks}
                      </button>
                    ),
                  })}
                </span>
              </div>
            )}

            {/* Comments List */}
            <div className="flex flex-col gap-3">
              {comments.length === 0 ? (
                <p className="text-xs text-white/40 italic py-4 text-center">
                  {t('noComments')}
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
                          /* eslint-disable-next-line @next/next/no-img-element -- Google avatar, arbitrary host */
                          <img
                            src={comment.authorAvatar}
                            alt=""
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
                {t('proposalIntro')}
              </p>

              <button
                type="button"
                onClick={() => {
                  if (!user) openLoginModal();
                  else if (isPropFormOpen) setIsPropFormOpen(false);
                  else openProposalForm();
                }}
                className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {isPropFormOpen ? (
                  t('cancel')
                ) : (
                  <>
                    <span>✨</span>
                    <span>{t('newProposal')}</span>
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
                    <span>
                      {t('templateTitle', {
                        format: recipeFormat === 'pp' ? 'Picture Profile' : 'Creative Look',
                      })}
                    </span>
                  </h3>
                  <span className="text-[11px] text-community font-semibold">{t('templateBadge')}</span>
                </div>

                {/* Proposal Title & Demo Photo URL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/90 mb-1.5">
                      {t('nameLabel')} <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t('namePlaceholder')}
                      value={newPropTitle}
                      onChange={(e) => setNewPropTitle(e.target.value)}
                      maxLength={150}
                      className="w-full rounded-xl bg-black/80 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 border border-white/15 focus:outline-none focus:border-white/40 font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/90 mb-1.5">
                      {t('sampleUrlLabel')} <span className="text-danger">*</span>
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
                    {t('sectionWb')}
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Kelvin Temperature */}
                    {editWb?.mode === 'kelvin' && (
                      <div className="flex items-center justify-between bg-black/50 px-3.5 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">{t('kelvinLabel')}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => adjustKelvin(-1)}
                            className="w-6 h-6 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className={`text-xs font-bold w-12 text-center ${getKelvinColor(editWb.kelvin)}`}>
                            {editWb.kelvin}K
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustKelvin(1)}
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
                        <span className={`text-xs font-bold w-12 text-center ${getWbShiftAxisColor(editWb?.shift?.ab?.axis || 'A')}`}>
                          {editWb?.shift?.ab ? `${editWb.shift!.ab.axis}${editWb.shift!.ab.amount}` : 'A0'}
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
                        <span className={`text-xs font-bold w-12 text-center ${getWbShiftAxisColor(editWb?.shift?.gm?.axis || 'G')}`}>
                          {editWb?.shift?.gm ? `${editWb.shift!.gm.axis}${editWb.shift!.gm.amount}` : 'G0'}
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

                {/* BLOCK 2: Creative Look Settings */}
                {recipeFormat === 'cl' && (
                  <div className="bg-black/40 p-4 rounded-xl border border-white/10 flex flex-col gap-3">
                    <span className="eyebrow text-xs tracking-wider text-white/90 font-bold uppercase">
                      2. Creative Look Camera Parameters
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Creative Look Select */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Creative Look</span>
                        <select
                          value={String(editSettings.look || 'ST')}
                          onChange={(e) => updateClLook(e.target.value)}
                          className="bg-black text-xs text-white px-2 py-1 rounded border border-white/20 focus:outline-none"
                        >
                          {CREATIVE_LOOKS.map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.code} ({l.label})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Contrast (-9 to +9) */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Contrast</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClNum('contrast', -1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {Number(editSettings.contrast ?? 0) > 0
                              ? `+${editSettings.contrast}`
                              : Number(editSettings.contrast ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateClNum('contrast', 1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Highlights (-9 to +9) */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Highlights</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClNum('highlights', -1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {Number(editSettings.highlights ?? 0) > 0
                              ? `+${editSettings.highlights}`
                              : Number(editSettings.highlights ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateClNum('highlights', 1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Shadows (-9 to +9) */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Shadows</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClNum('shadows', -1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {Number(editSettings.shadows ?? 0) > 0
                              ? `+${editSettings.shadows}`
                              : Number(editSettings.shadows ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateClNum('shadows', 1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Fade (0 to 9) */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Fade</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClNum('fade', -1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {Number(editSettings.fade ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateClNum('fade', 1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Saturation (-9 to +9, omitted for monochrome BW/SE) */}
                      {!(CL_MONOCHROME_LOOKS as readonly string[]).includes(String(editSettings.look)) && (
                        <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                          <span className="text-xs text-white/70">Saturation</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateClNum('saturation', -1)}
                              className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold w-8 text-center text-white">
                              {Number(editSettings.saturation ?? 0) > 0
                                ? `+${editSettings.saturation}`
                                : Number(editSettings.saturation ?? 0)}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateClNum('saturation', 1)}
                              className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Sharpness (0 to 9) */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Sharpness</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClNum('sharpness', -1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {Number(editSettings.sharpness ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateClNum('sharpness', 1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Sharpness Range (1 to 5) */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Sharpness Range</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClNum('sharpnessRange', -1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {Number(editSettings.sharpnessRange ?? 1)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateClNum('sharpnessRange', 1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Clarity (0 to 9) */}
                      <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                        <span className="text-xs text-white/70">Clarity</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClNum('clarity', -1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-8 text-center text-white">
                            {Number(editSettings.clarity ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateClNum('clarity', 1)}
                            className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                              onClick={() => updateNum('blackLevel', -1)}
                              className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold w-8 text-center text-white">
                              {(editSettings.blackLevel ?? 0) > 0 ? `+${editSettings.blackLevel}` : (editSettings.blackLevel ?? 0)}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNum('blackLevel', 1)}
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
                            onChange={(e) =>
                              setEditSettings((prev) => ({
                                ...prev,
                                gamma: asEnum(PP_GAMMA, e.target.value, 'S-Cinetone'),
                              }))
                            }
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
                                  onClick={() => updateNestedNum('blackGamma', 'level', -1)}
                                  className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                                >
                                  -
                                </button>
                                <span className="text-xs font-bold w-8 text-center text-white">
                                  {editSettings.blackGamma.level > 0 ? `+${editSettings.blackGamma.level}` : editSettings.blackGamma.level}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateNestedNum('blackGamma', 'level', 1)}
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
                                      onClick={() => updateNestedNum('knee', 'point', -5)}
                                      className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-bold text-white">{editSettings.knee.point ?? 75}%</span>
                                    <button
                                      type="button"
                                      onClick={() => updateNestedNum('knee', 'point', 5)}
                                      className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                                    >
                                      +
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-white/50">Slope:</span>
                                    <button
                                      type="button"
                                      onClick={() => updateNestedNum('knee', 'slope', -1)}
                                      className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-bold text-white">
                                      {(editSettings.knee.slope ?? 0) > 0 ? `+${editSettings.knee.slope}` : (editSettings.knee.slope ?? 0)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updateNestedNum('knee', 'slope', 1)}
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
                            onChange={(e) =>
                              setEditSettings((prev) => ({
                                ...prev,
                                colorMode: asEnum(PP_COLOR_MODE, e.target.value, 'S-Cinetone'),
                              }))
                            }
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
                              onClick={() => updateNum('saturation', -1)}
                              className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold w-8 text-center text-white">
                              {(editSettings.saturation ?? 0) > 0 ? `+${editSettings.saturation}` : (editSettings.saturation ?? 0)}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNum('saturation', 1)}
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
                              onClick={() => updateNum('colorPhase', -1)}
                              className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold w-8 text-center text-white">
                              {(editSettings.colorPhase ?? 0) > 0 ? `+${editSettings.colorPhase}` : (editSettings.colorPhase ?? 0)}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNum('colorPhase', 1)}
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
                          {t('sectionColorDepth')}
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
                                    {(editSettings.colorDepth?.[ch] ?? 0) > 0
                                      ? `+${editSettings.colorDepth?.[ch] ?? 0}`
                                      : (editSettings.colorDepth?.[ch] ?? 0)}
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
                          {t('sectionDetail')}
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {/* Detail Level */}
                          <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                            <span className="text-xs text-white/70">Level</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateNestedNum('detail', 'level', -1)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold w-8 text-center text-white">
                                {editSettings.detail.level > 0 ? `+${editSettings.detail.level}` : editSettings.detail.level}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateNestedNum('detail', 'level', 1)}
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
                                onClick={() => updateNestedNum('detail', 'vhBalance', -1)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold w-8 text-center text-white">
                                {editSettings.detail.vhBalance > 0 ? `+${editSettings.detail.vhBalance}` : editSettings.detail.vhBalance}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateNestedNum('detail', 'vhBalance', 1)}
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

                          {/* Limit */}
                          <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                            <span className="text-xs text-white/70">Limit</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateNestedNum('detail', 'limit', -1)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold w-8 text-center text-white">
                                {editSettings.detail.limit || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateNestedNum('detail', 'limit', 1)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Crispening */}
                          <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                            <span className="text-xs text-white/70">Crispening</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateNestedNum('detail', 'crispening', -1)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold w-8 text-center text-white">
                                {editSettings.detail.crispening || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateNestedNum('detail', 'crispening', 1)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Hi-Light Detail */}
                          <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded-lg border border-white/10">
                            <span className="text-xs text-white/70">Hi-Light Detail</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateNestedNum('detail', 'hiLightDetail', -1)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold w-8 text-center text-white">
                                {editSettings.detail.hiLightDetail || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateNestedNum('detail', 'hiLightDetail', 1)}
                                className="w-5 h-5 rounded bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Submission Button */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-[11px] text-white/50">
                    {t('sampleNote')}
                  </span>

                  <button
                    type="submit"
                    disabled={isSubmittingProp || !newPropTitle.trim() || !newSampleUrl.trim()}
                    className="px-6 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-40"
                  >
                    {isSubmittingProp ? t('proposalSending') : t('proposalSubmit')}
                  </button>
                </div>
              </form>
            )}

            {/* Proposal Cards Grid */}
            <div className="grid grid-cols-1 gap-3.5">
              {proposals.length === 0 ? (
                <p className="text-xs text-white/40 italic py-4 text-center">
                  {t('noProposals')}
                </p>
              ) : (
                proposals.map((prop) => {
                  const hasVoted = user ? prop.hasVoted : false;
                  return (
                    <div
                      key={prop.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                    >
                      {/* Proposal Details & Optional Demo Photo Thumbnail */}
                      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                        {prop.sampleImageUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element -- reader-supplied URL, arbitrary host */
                          <img
                            src={prop.sampleImageUrl}
                            alt={prop.title}
                            className="w-16 h-16 sm:w-20 sm:h-14 rounded-lg object-cover border border-white/15 shrink-0 shadow-md"
                          />
                        )}

                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {prop.authorAvatar ? (
                              /* eslint-disable-next-line @next/next/no-img-element -- Google avatar, arbitrary host */
                              <img
                                src={prop.authorAvatar}
                                alt=""
                                className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[9px] font-bold">
                                {prop.authorName.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs font-semibold text-white/90 truncate">{prop.title}</span>
                            <span className="text-[10px] text-white/40 shrink-0">{t('by', { author: prop.authorName })}</span>
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
                            ? 'bg-heart/20 border-heart/50 text-heart font-bold scale-105 shadow-[0_0_12px_color-mix(in_oklch,var(--color-heart)_35%,transparent)]'
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
      </div>
    </section>
  );
}
