'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from './auth-context';
import { OPEN_PROPOSAL_EVENT } from '@/lib/community/events';
import type { CommentItem } from '@/app/api/comments/route';
import type { ProposalItem } from '@/app/api/proposals/route';
import {
  getColorDepthChannelHexColor,
  getKelvinHexColor,
  getWbShiftAxisHexColor,
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

/*
 * The editor draws one control four dozen times — a parameter name, its value
 * and two steppers — so the recipe is written once here rather than copied to
 * every call site, the same reason `.chip` and `.label` live in globals.css.
 * Depth is a sunken film and a specular highlight; not one of these carries a
 * stroke.
 */

/** A camera control, pressed into the panel it sits in. */
const CONTROL = 'surface-sunken flex items-center justify-between gap-3 px-3.5 py-2.5';

/** The parameter's name. Never a signal colour — the value carries the meaning. */
const CONTROL_LABEL = 'text-body-sm text-ink-muted min-w-0';

/** One step of the camera's own increment. A full touch target on a coarse pointer. */
const STEPPER =
  'w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 rounded-sm bg-white/[0.08] hover:bg-white/[0.13] ' +
  'text-ink text-body-sm font-semibold flex items-center justify-center shrink-0 ' +
  'shadow-[var(--elevation-spec)] transition-colors cursor-pointer';

/*
 * The value between the two steppers: numeric, in a column, so tabular.
 *
 * Split in two because a colour utility here would collide with the one the
 * White Balance and Color Depth readouts get from `@/lib/camera/color` — two
 * `color` utilities on one element resolve by stylesheet order, not by the
 * order they are written, so the tint would win or lose at random.
 */
const VALUE_TINTED = 'text-body-sm font-semibold tabular-nums text-center';
const VALUE = `${VALUE_TINTED} text-ink`;

/** A block of related controls inside the editor sheet. */
const GROUP = 'bg-white/[0.03] rounded-lg p-4 flex flex-col gap-3';

/*
 * These two are 13px but deliberately NOT `.label`: every heading here runs
 * past three words in Vietnamese ("1. Cân bằng trắng (White Balance Shift)"),
 * and uppercase at that length costs the diacritics their ascender room.
 */

/** A group heading inside the editor sheet. */
const GROUP_HEADING = 'text-label font-semibold text-ink';

/** A field's name, above its input. */
const FIELD_LABEL = 'text-label font-semibold text-ink-muted';

/** A text field. Sunken, and its validation is a hint — never a red field. */
const FIELD = 'w-full surface-sunken px-3.5 py-2.5 text-body text-ink placeholder:text-ink-faint';

/** A camera enum, as a select. */
const SELECT = 'surface-sunken text-body-sm text-ink px-3 py-2 cursor-pointer';

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

  /* Recipe pages are statically generated, so comments and proposals cannot be
     server-rendered without serving them stale — the initial load belongs on the
     client.

     `set-state-in-effect` cannot see through `useCallback` that the fetchers
     suspend on `await fetch(...)` before touching state, so no setState here is
     synchronous and no cascading render is possible. Scoped to these lines;
     remove the disable if either fetcher gains a synchronous early setState. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    /* Separate from the comments load because this one depends on the access
       token as well as the slug: `hasVoted` is per-viewer, so signing in has to
       refetch or every heart renders empty until a reload. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProposals();
  }, [fetchProposals]);

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
      const res = await fetch('/api/proposals/vote', {
        method: 'POST',
        headers: authedJson(),
        body: JSON.stringify({ proposalId }),
      });

      /* A rejected write resolves the promise — it does not throw. So a 401 on
         an expired session, or the 429 the route returns above 30 votes a
         minute, used to leave the optimistic heart filled and the count bumped
         while the server had recorded nothing at all; the vote only vanished on
         the next reload. Reconcile against the server on any non-2xx.
         The success path takes the authoritative count from the response
         instead of trusting the guess, so a concurrent vote by someone else
         lands immediately rather than at the next refetch. */
      if (!res.ok) {
        void fetchProposals();
        return;
      }

      const data = (await res.json()) as { voted?: boolean; voteCount?: number };
      if (typeof data.voteCount === 'number') {
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId
              ? { ...p, voteCount: data.voteCount as number, hasVoted: data.voted ?? p.hasVoted }
              : p,
          ),
        );
      }
    } catch {
      // Network failure: the optimistic state is a guess, so throw it away.
      void fetchProposals();
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
   * The section is one panel: a white 5% film, a 30px blur and elevation 1,
   * with the specular highlight standing in for the border it used to draw.
   * The old wrapper painted an opaque fill, a stroke and a shadow *under* a
   * `.glass` child that hard-set all three, so none of them ever rendered.
   *
   * No top margin either: the recipe page stacks this column with `gap-8`, so
   * the old `mt-8` put a double gap above this section and nowhere else.
   */
  return (
    <section
      id="community-section"
      className="surface p-5 sm:p-6 flex flex-col gap-5 text-ink"
    >
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-title-3 font-semibold tracking-[-0.02em] text-ink">{t('title')}</h2>
          <p className="meta">{t('subtitle', { title: recipeTitle })}</p>
        </div>

        {/* The rut is sunken and the current tab is a FILL, never a stroke.
            Proposals tint theirs `proposal` violet, so a pending version is
            tellable from the discussion before a word is read. */}
        <div className="surface-sunken flex items-center gap-1 p-1 self-start sm:self-auto shrink-0">
          <button
            type="button"
            aria-pressed={activeTab === 'comments'}
            onClick={() => setActiveTab('comments')}
            className={`px-4 min-h-11 rounded-sm text-body-sm font-semibold flex items-center transition-colors cursor-pointer ${
              activeTab === 'comments'
                ? 'surface-selected text-white'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('tabComments', { count: comments.length })}
          </button>

          <button
            type="button"
            aria-pressed={activeTab === 'proposals'}
            onClick={() => setActiveTab('proposals')}
            className={`px-4 min-h-11 rounded-sm text-body-sm font-semibold flex items-center transition-colors cursor-pointer ${
              activeTab === 'proposals'
                ? 'surface-selected [--selected-hue:var(--color-proposal)] text-white'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t('tabProposals', { count: proposals.length })}
          </button>
        </div>
      </div>

      <div className="seam" />

      {/* Tab 1: Comments */}
      {activeTab === 'comments' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Add Comment Form or Google Login Prompt */}
          {user ? (
            <form onSubmit={handlePostComment} className="bg-white/[0.03] rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- Google avatar, arbitrary host */}
                <img
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&bold=true`;
                  }}
                  className="w-7 h-7 rounded-full shrink-0"
                />
                <span className="text-body-sm font-semibold text-ink">{user.name}</span>
                <span className="meta truncate">({user.email})</span>
              </div>

              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={t('commentPlaceholder')}
                rows={2}
                maxLength={2000}
                className={`${FIELD} resize-y`}
              />

              <div className="flex flex-wrap justify-between items-center gap-3">
                <span className="meta">{t('commentHint')}</span>
                <button
                  type="submit"
                  disabled={isSubmittingComment || !newCommentText.trim()}
                  className="btn-accent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmittingComment ? t('commentSending') : t('commentSubmit')}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white/[0.03] rounded-lg p-4 text-body-sm text-ink-muted">
              {t.rich('loginPrompt', {
                a: (chunks) => (
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    className="text-accent-400 font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    {chunks}
                  </button>
                ),
              })}
            </div>
          )}

          {/* Comments List */}
          <div className="flex flex-col gap-3">
            {comments.length === 0 ? (
              <p className="meta italic py-4 text-center">{t('noComments')}</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="surface p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {comment.authorAvatar ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- Google avatar, arbitrary host */
                        <img
                          src={comment.authorAvatar}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}&background=0D8ABC&color=fff&bold=true`;
                          }}
                          className="w-6 h-6 rounded-full shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/20 text-ink flex items-center justify-center text-label font-semibold shrink-0">
                          {comment.authorName.charAt(0)}
                        </div>
                      )}
                      <span className="text-body-sm font-semibold text-ink truncate">{comment.authorName}</span>
                    </div>

                    <span className="meta shrink-0 tabular-nums">
                      {new Date(comment.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-body leading-relaxed text-ink-muted pl-8">
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
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Header Action */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-sm text-ink-muted max-w-[58ch]">{t('proposalIntro')}</p>

            <button
              type="button"
              onClick={() => {
                if (!user) openLoginModal();
                else if (isPropFormOpen) setIsPropFormOpen(false);
                else openProposalForm();
              }}
              className="btn-glass shrink-0 cursor-pointer"
            >
              {isPropFormOpen ? t('cancel') : t('newProposal')}
            </button>
          </div>

          {/* Interactive Camera-Accurate Template Editor Form */}
          {isPropFormOpen && user && (
            <form onSubmit={handleCreateProposal} className="surface-raised p-5 sm:p-6 flex flex-col gap-6 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-title-3 font-semibold tracking-[-0.02em] text-ink">
                  {t('templateTitle', {
                    format: recipeFormat === 'pp' ? 'Picture Profile' : 'Creative Look',
                  })}
                </h3>
                {/* A pending version is `proposal` violet wherever it appears. */}
                <span className="text-label font-semibold text-proposal">{t('templateBadge')}</span>
              </div>

              <div className="seam" />

              {/* Proposal Title & Demo Photo URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={FIELD_LABEL}>
                    {t('nameLabel')} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('namePlaceholder')}
                    value={newPropTitle}
                    onChange={(e) => setNewPropTitle(e.target.value)}
                    maxLength={150}
                    className={FIELD}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={FIELD_LABEL}>
                    {t('sampleUrlLabel')} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://images.unsplash.com/photo-..."
                    value={newSampleUrl}
                    onChange={(e) => setNewSampleUrl(e.target.value)}
                    className={FIELD}
                  />
                </div>
              </div>

              {/* BLOCK 1: White Balance Engine */}
              <div className={GROUP}>
                <span className={GROUP_HEADING}>{t('sectionWb')}</span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Kelvin Temperature */}
                  {editWb?.mode === 'kelvin' && (
                    <div className={CONTROL}>
                      <span className={CONTROL_LABEL}>{t('kelvinLabel')}</span>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => adjustKelvin(-1)} className={STEPPER}>
                          -
                        </button>
                        <span className={`${VALUE_TINTED} w-14`} style={{ color: getKelvinHexColor(editWb.kelvin) }}>
                          {editWb.kelvin}K
                        </span>
                        <button type="button" onClick={() => adjustKelvin(1)} className={STEPPER}>
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Shift A/B */}
                  <div className={CONTROL}>
                    <span className={CONTROL_LABEL}>Shift A/B</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => updateWbShift('ab', -1)} className={STEPPER}>
                        -
                      </button>
                      <span className={`${VALUE_TINTED} w-14`} style={{ color: getWbShiftAxisHexColor(editWb?.shift?.ab?.axis || 'A') }}>
                        {editWb?.shift?.ab ? `${editWb.shift!.ab.axis}${editWb.shift!.ab.amount}` : 'A0'}
                      </span>
                      <button type="button" onClick={() => updateWbShift('ab', 1)} className={STEPPER}>
                        +
                      </button>
                    </div>
                  </div>

                  {/* Shift G/M */}
                  <div className={CONTROL}>
                    <span className={CONTROL_LABEL}>Shift G/M</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => updateWbShift('gm', -1)} className={STEPPER}>
                        -
                      </button>
                      <span className={`${VALUE_TINTED} w-14`} style={{ color: getWbShiftAxisHexColor(editWb?.shift?.gm?.axis || 'G') }}>
                        {editWb?.shift?.gm ? `${editWb.shift!.gm.axis}${editWb.shift!.gm.amount}` : 'G0'}
                      </span>
                      <button type="button" onClick={() => updateWbShift('gm', 1)} className={STEPPER}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK 2: Creative Look Settings */}
              {recipeFormat === 'cl' && (
                <div className={GROUP}>
                  <span className={GROUP_HEADING}>{t('sectionCl')}</span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Creative Look Select */}
                    <div className={CONTROL}>
                      <span className={CONTROL_LABEL}>Creative Look</span>
                      <select
                        value={String(editSettings.look || 'ST')}
                        onChange={(e) => updateClLook(e.target.value)}
                        className={SELECT}
                      >
                        {CREATIVE_LOOKS.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.code} ({l.label})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Contrast (-9 to +9) */}
                    <div className={CONTROL}>
                      <span className={CONTROL_LABEL}>Contrast</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateClNum('contrast', -1)}
                          className={STEPPER}
                        >
                          -
                        </button>
                        <span className={`${VALUE} w-10`}>
                          {Number(editSettings.contrast ?? 0) > 0
                            ? `+${editSettings.contrast}`
                            : Number(editSettings.contrast ?? 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateClNum('contrast', 1)}
                          className={STEPPER}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Highlights (-9 to +9) */}
                    <div className={CONTROL}>
                      <span className={CONTROL_LABEL}>Highlights</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateClNum('highlights', -1)}
                          className={STEPPER}
                        >
                          -
                        </button>
                        <span className={`${VALUE} w-10`}>
                          {Number(editSettings.highlights ?? 0) > 0
                            ? `+${editSettings.highlights}`
                            : Number(editSettings.highlights ?? 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateClNum('highlights', 1)}
                          className={STEPPER}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Shadows (-9 to +9) */}
                    <div className={CONTROL}>
                      <span className={CONTROL_LABEL}>Shadows</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateClNum('shadows', -1)}
                          className={STEPPER}
                        >
                          -
                        </button>
                        <span className={`${VALUE} w-10`}>
                          {Number(editSettings.shadows ?? 0) > 0
                            ? `+${editSettings.shadows}`
                            : Number(editSettings.shadows ?? 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateClNum('shadows', 1)}
                          className={STEPPER}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Fade (0 to 9) */}
                    <div className={CONTROL}>
                      <span className={CONTROL_LABEL}>Fade</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateClNum('fade', -1)}
                          className={STEPPER}
                        >
                          -
                        </button>
                        <span className={`${VALUE} w-10`}>
                          {Number(editSettings.fade ?? 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateClNum('fade', 1)}
                          className={STEPPER}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Saturation (-9 to +9, omitted for monochrome BW/SE) */}
                    {!(CL_MONOCHROME_LOOKS as readonly string[]).includes(String(editSettings.look)) && (
                      <div className={CONTROL}>
                        <span className={CONTROL_LABEL}>Saturation</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClNum('saturation', -1)}
                            className={STEPPER}
                          >
                            -
                          </button>
                          <span className={`${VALUE} w-10`}>
                            {Number(editSettings.saturation ?? 0) > 0
                              ? `+${editSettings.saturation}`
                              : Number(editSettings.saturation ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateClNum('saturation', 1)}
                            className={STEPPER}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sharpness (0 to 9) */}
                    <div className={CONTROL}>
                      <span className={CONTROL_LABEL}>Sharpness</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateClNum('sharpness', -1)}
                          className={STEPPER}
                        >
                          -
                        </button>
                        <span className={`${VALUE} w-10`}>
                          {Number(editSettings.sharpness ?? 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateClNum('sharpness', 1)}
                          className={STEPPER}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Sharpness Range (1 to 5) */}
                    <div className={CONTROL}>
                      <span className={CONTROL_LABEL}>Sharpness Range</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateClNum('sharpnessRange', -1)}
                          className={STEPPER}
                        >
                          -
                        </button>
                        <span className={`${VALUE} w-10`}>
                          {Number(editSettings.sharpnessRange ?? 1)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateClNum('sharpnessRange', 1)}
                          className={STEPPER}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Clarity (0 to 9) */}
                    <div className={CONTROL}>
                      <span className={CONTROL_LABEL}>Clarity</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateClNum('clarity', -1)}
                          className={STEPPER}
                        >
                          -
                        </button>
                        <span className={`${VALUE} w-10`}>
                          {Number(editSettings.clarity ?? 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateClNum('clarity', 1)}
                          className={STEPPER}
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
                  <div className={GROUP}>
                    <span className={GROUP_HEADING}>{t('sectionPp')}</span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Black Level */}
                      <div className={CONTROL}>
                        <span className={CONTROL_LABEL}>Black Level</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateNum('blackLevel', -1)}
                            className={STEPPER}
                          >
                            -
                          </button>
                          <span className={`${VALUE} w-10`}>
                            {(editSettings.blackLevel ?? 0) > 0 ? `+${editSettings.blackLevel}` : (editSettings.blackLevel ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateNum('blackLevel', 1)}
                            className={STEPPER}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Gamma Select */}
                      <div className={CONTROL}>
                        <span className={CONTROL_LABEL}>Gamma</span>
                        <select
                          value={editSettings.gamma || 'S-Cinetone'}
                          onChange={(e) =>
                            setEditSettings((prev) => ({
                              ...prev,
                              gamma: asEnum(PP_GAMMA, e.target.value, 'S-Cinetone'),
                            }))
                          }
                          className={SELECT}
                        >
                          {PP_GAMMA.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>

                      {/* Black Gamma (Range & Level) */}
                      {editSettings.blackGamma && (
                        <div className={`${CONTROL} col-span-1 sm:col-span-2`}>
                          <span className={CONTROL_LABEL}>Black Gamma</span>
                          <div className="flex items-center gap-2">
                            <select
                              value={editSettings.blackGamma.range || 'Middle'}
                              onChange={(e) => updateNestedSelect('blackGamma', 'range', e.target.value)}
                              className={SELECT}
                            >
                              {PP_BLACK_GAMMA_RANGE.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateNestedNum('blackGamma', 'level', -1)}
                                className={STEPPER}
                              >
                                -
                              </button>
                              <span className={`${VALUE} w-10`}>
                                {editSettings.blackGamma.level > 0 ? `+${editSettings.blackGamma.level}` : editSettings.blackGamma.level}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateNestedNum('blackGamma', 'level', 1)}
                                className={STEPPER}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Knee (Mode, Point, Slope) */}
                      {editSettings.knee && (
                        <div className="surface-sunken flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2.5 col-span-1 sm:col-span-2 lg:col-span-3">
                          <span className={`${CONTROL_LABEL} font-semibold`}>Knee</span>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <select
                              value={editSettings.knee.mode || 'Auto'}
                              onChange={(e) => updateNestedSelect('knee', 'mode', e.target.value)}
                              className={SELECT}
                            >
                              {PP_KNEE_MODE.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>

                            {editSettings.knee.mode === 'Manual' && (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="meta">Point:</span>
                                  <button
                                    type="button"
                                    onClick={() => updateNestedNum('knee', 'point', -5)}
                                    className={STEPPER}
                                  >
                                    -
                                  </button>
                                  <span className={VALUE}>{editSettings.knee.point ?? 75}%</span>
                                  <button
                                    type="button"
                                    onClick={() => updateNestedNum('knee', 'point', 5)}
                                    className={STEPPER}
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="meta">Slope:</span>
                                  <button
                                    type="button"
                                    onClick={() => updateNestedNum('knee', 'slope', -1)}
                                    className={STEPPER}
                                  >
                                    -
                                  </button>
                                  <span className={VALUE}>
                                    {(editSettings.knee.slope ?? 0) > 0 ? `+${editSettings.knee.slope}` : (editSettings.knee.slope ?? 0)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateNestedNum('knee', 'slope', 1)}
                                    className={STEPPER}
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
                      <div className={CONTROL}>
                        <span className={CONTROL_LABEL}>Color Mode</span>
                        <select
                          value={editSettings.colorMode || 'S-Cinetone'}
                          onChange={(e) =>
                            setEditSettings((prev) => ({
                              ...prev,
                              colorMode: asEnum(PP_COLOR_MODE, e.target.value, 'S-Cinetone'),
                            }))
                          }
                          className={`${SELECT} max-w-[120px] truncate`}
                        >
                          {PP_COLOR_MODE.map((cm) => (
                            <option key={cm} value={cm}>{cm}</option>
                          ))}
                        </select>
                      </div>

                      {/* Saturation (-32 to +32) */}
                      <div className={CONTROL}>
                        <span className={CONTROL_LABEL}>Saturation</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateNum('saturation', -1)}
                            className={STEPPER}
                          >
                            -
                          </button>
                          <span className={`${VALUE} w-10`}>
                            {(editSettings.saturation ?? 0) > 0 ? `+${editSettings.saturation}` : (editSettings.saturation ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateNum('saturation', 1)}
                            className={STEPPER}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Color Phase (-7 to +7) */}
                      <div className={CONTROL}>
                        <span className={CONTROL_LABEL}>Color Phase</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateNum('colorPhase', -1)}
                            className={STEPPER}
                          >
                            -
                          </button>
                          <span className={`${VALUE} w-10`}>
                            {(editSettings.colorPhase ?? 0) > 0 ? `+${editSettings.colorPhase}` : (editSettings.colorPhase ?? 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateNum('colorPhase', 1)}
                            className={STEPPER}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BLOCK 3: Color Depth (6 Channels R, G, B, C, M, Y) */}
                  {editSettings.colorDepth && (
                    <div className={GROUP}>
                      <span className={GROUP_HEADING}>
                        {t('sectionColorDepth')}
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {PP_COLOR_DEPTH_CHANNELS.map((ch) => {
                          const hex = getColorDepthChannelHexColor(ch);
                          return (
                            <div key={ch} className="surface-sunken flex items-center justify-between gap-1.5 px-2.5 py-2">
                              {/* The channel keeps the camera's own colour: R, G, B, C, M
                                  and Y ARE the six phases this control moves, so the tint
                                  is the value, not decoration. Read from
                                  `getColorDepthChannelHexColor`, the same source
                                  settings-table.tsx uses. */}
                              <span className="text-body-sm font-semibold" style={{ color: hex }}>{ch}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateColorDepth(ch, -1)}
                                  className={STEPPER}
                                >
                                  -
                                </button>
                                <span className={`${VALUE_TINTED} w-7`} style={{ color: hex }}>
                                  {(editSettings.colorDepth?.[ch] ?? 0) > 0
                                    ? `+${editSettings.colorDepth?.[ch] ?? 0}`
                                    : (editSettings.colorDepth?.[ch] ?? 0)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateColorDepth(ch, 1)}
                                  className={STEPPER}
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
                    <div className={GROUP}>
                      <span className={GROUP_HEADING}>
                        {t('sectionDetail')}
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Detail Level */}
                        <div className={CONTROL}>
                          <span className={CONTROL_LABEL}>Level</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'level', -1)}
                              className={STEPPER}
                            >
                              -
                            </button>
                            <span className={`${VALUE} w-10`}>
                              {editSettings.detail.level > 0 ? `+${editSettings.detail.level}` : editSettings.detail.level}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'level', 1)}
                              className={STEPPER}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* V/H Balance */}
                        <div className={CONTROL}>
                          <span className={CONTROL_LABEL}>V/H Balance</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'vhBalance', -1)}
                              className={STEPPER}
                            >
                              -
                            </button>
                            <span className={`${VALUE} w-10`}>
                              {editSettings.detail.vhBalance > 0 ? `+${editSettings.detail.vhBalance}` : editSettings.detail.vhBalance}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'vhBalance', 1)}
                              className={STEPPER}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* B/W Balance Select */}
                        <div className={CONTROL}>
                          <span className={CONTROL_LABEL}>B/W Balance</span>
                          <select
                            value={editSettings.detail.bwBalance || 'Type3'}
                            onChange={(e) => updateNestedSelect('detail', 'bwBalance', e.target.value)}
                            className={SELECT}
                          >
                            {PP_DETAIL_BW_BALANCE.map((bw) => (
                              <option key={bw} value={bw}>{bw}</option>
                            ))}
                          </select>
                        </div>

                        {/* Limit */}
                        <div className={CONTROL}>
                          <span className={CONTROL_LABEL}>Limit</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'limit', -1)}
                              className={STEPPER}
                            >
                              -
                            </button>
                            <span className={`${VALUE} w-10`}>
                              {editSettings.detail.limit || 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'limit', 1)}
                              className={STEPPER}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Crispening */}
                        <div className={CONTROL}>
                          <span className={CONTROL_LABEL}>Crispening</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'crispening', -1)}
                              className={STEPPER}
                            >
                              -
                            </button>
                            <span className={`${VALUE} w-10`}>
                              {editSettings.detail.crispening || 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'crispening', 1)}
                              className={STEPPER}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Hi-Light Detail */}
                        <div className={CONTROL}>
                          <span className={CONTROL_LABEL}>Hi-Light Detail</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'hiLightDetail', -1)}
                              className={STEPPER}
                            >
                              -
                            </button>
                            <span className={`${VALUE} w-10`}>
                              {editSettings.detail.hiLightDetail || 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateNestedNum('detail', 'hiLightDetail', 1)}
                              className={STEPPER}
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

              <div className="seam" />

              {/* Submission Button */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="meta max-w-[52ch]">{t('sampleNote')}</span>

                <button
                  type="submit"
                  disabled={isSubmittingProp || !newPropTitle.trim() || !newSampleUrl.trim()}
                  className="btn-accent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmittingProp ? t('proposalSending') : t('proposalSubmit')}
                </button>
              </div>
            </form>
          )}

          {/* Proposal Cards Grid */}
          <div className="grid grid-cols-1 gap-3">
            {proposals.length === 0 ? (
              <p className="meta italic py-4 text-center">{t('noProposals')}</p>
            ) : (
              proposals.map((prop) => {
                const hasVoted = user ? prop.hasVoted : false;
                return (
                  <div
                    key={prop.id}
                    className="surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Proposal Details & Optional Demo Photo Thumbnail */}
                    <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                      {prop.sampleImageUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element -- reader-supplied URL, arbitrary host */
                        <img
                          src={prop.sampleImageUrl}
                          alt={prop.title}
                          className="w-16 h-16 sm:w-20 sm:h-14 rounded-md object-cover shrink-0 shadow-[var(--elevation-1)]"
                        />
                      )}

                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          {prop.authorAvatar ? (
                            /* eslint-disable-next-line @next/next/no-img-element -- Google avatar, arbitrary host */
                            <img
                              src={prop.authorAvatar}
                              alt=""
                              className="w-5 h-5 rounded-full shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-white/20 text-ink flex items-center justify-center text-label font-semibold shrink-0">
                              {prop.authorName.charAt(0)}
                            </div>
                          )}
                          <span className="text-body font-semibold text-ink truncate">{prop.title}</span>
                          <span className="meta shrink-0">{t('by', { author: prop.authorName })}</span>
                        </div>

                        {/* Parameter highlight pills */}
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(prop.settings).slice(0, 6).map(([k, v]) => (
                            <span key={k} className="chip">
                              {formatProposalSettingPill(k, v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Heart Vote Button — a vote is a FILL in the `heart` hue,
                        never a ring, and the count is white on it. */}
                    <button
                      type="button"
                      aria-pressed={hasVoted}
                      onClick={() => handleToggleVote(prop.id)}
                      className={`flex items-center justify-center gap-2 px-4 min-h-[var(--layout-touch-target)] shrink-0 text-body-sm font-semibold transition-colors cursor-pointer ${
                        hasVoted
                          ? 'surface-selected [--selected-hue:var(--color-heart)] text-white'
                          : 'rounded-sm bg-white/[0.08] hover:bg-white/[0.13] text-ink-muted shadow-[var(--elevation-spec)]'
                      }`}
                    >
                      <span aria-hidden>♥</span>
                      <span className="tabular-nums">{prop.voteCount}</span>
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
