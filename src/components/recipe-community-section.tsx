'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useAuth } from './auth-context';
import { OPEN_PROPOSAL_EVENT } from '@/lib/community/events';
import { communityErrorOf, type CommunityAlertCode } from '@/lib/community/errors';
import { kneeForMode, proposalPills, stepInRange } from '@/lib/community/proposal-draft';
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
  CL_PARAM_LABELS,
  CL_RANGES,
  CREATIVE_LOOKS,
  CREATIVE_LOOK_CODES,
  PP_BLACK_GAMMA_RANGE,
  PP_COLOR_DEPTH_CHANNELS,
  PP_COLOR_MODE,
  PP_DETAIL_BW_BALANCE,
  PP_DETAIL_LABELS,
  PP_GAMMA,
  PP_KNEE_MODE,
  PP_PARAM_LABELS,
  PP_RANGES,
  WB_KELVIN,
  WB_SHIFT_AXIS,
} from '@/lib/camera/constants';
import { signed } from '@/lib/camera/format';
import type { ClSettings, PpSettings, WhiteBalance } from '@/lib/camera/schema';

type Props = {
  recipeSlug: string;
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

/** The optimistic half of a vote: flip the heart and move the count by one. */
function flipVote(list: ProposalItem[], proposalId: string): ProposalItem[] {
  return list.map((p) =>
    p.id !== proposalId
      ? p
      : {
          ...p,
          hasVoted: !p.hasVoted,
          voteCount: p.hasVoted ? Math.max(0, p.voteCount - 1) : p.voteCount + 1,
        },
  );
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

/** An error line. Copy is the code's, looked up in `community.errors`. */
const ALERT = 'text-body-sm text-danger';

/**
 * Two steppers and the value between them. Each press is one camera increment
 * in a direction — never a raw delta, which is how the knee point once moved
 * by 5 through a range whose step is 0.5.
 */
function Steps({
  value,
  onStep,
  valueClassName = `${VALUE} w-10`,
  valueStyle,
}: {
  value: React.ReactNode;
  onStep: (direction: -1 | 1) => void;
  valueClassName?: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onStep(-1)} className={STEPPER}>
        -
      </button>
      <span className={valueClassName} style={valueStyle}>
        {value}
      </span>
      <button type="button" onClick={() => onStep(1)} className={STEPPER}>
        +
      </button>
    </div>
  );
}

/** A labelled stepper control, the editor's most common row. */
function StepControl({
  label,
  value,
  onStep,
}: {
  label: string;
  value: React.ReactNode;
  onStep: (direction: -1 | 1) => void;
}) {
  return (
    <div className={CONTROL}>
      <span className={CONTROL_LABEL}>{label}</span>
      <Steps value={value} onStep={onStep} />
    </div>
  );
}

/** One community error, in the reader's locale. */
export function CommunityAlert({ code }: { code: CommunityAlertCode }) {
  const t = useTranslations('community');
  return (
    <p role="alert" className={ALERT}>
      {t(`errors.${code}`)}
    </p>
  );
}

const AVATAR_SIZE = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-7 h-7' } as const;

/**
 * A reader's avatar, or their initial on a token colour.
 *
 * One component for all three places this section draws a person. Two of them
 * swapped a dead Google avatar for a generated image from a third-party
 * service, with a raw hex in its URL; the third had no fallback at all and drew
 * a broken image. `no-referrer` because Google's avatar host refuses some
 * referrers outright.
 */
export function Avatar({
  src,
  name,
  size,
}: {
  src: string | null | undefined;
  name: string;
  size: keyof typeof AVATAR_SIZE;
}) {
  // Keyed to the URL, so a new src gets its own chance to load.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && failedSrc !== src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- Google avatar, arbitrary host */
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)}
        className={`${AVATAR_SIZE[size]} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${AVATAR_SIZE[size]} rounded-full bg-white/20 text-ink flex items-center justify-center text-label font-semibold shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** One comment. Its line breaks are the reader's, so they are kept. */
export function CommentCard({ comment }: { comment: CommentItem }) {
  const format = useFormatter();
  return (
    <div className="surface p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar src={comment.authorAvatar} name={comment.authorName} size="md" />
          <span className="text-body-sm font-semibold text-ink truncate">{comment.authorName}</span>
        </div>

        <span className="meta shrink-0 tabular-nums">
          {/* Formatted in the reader's locale, not a fixed 'vi-VN', and pinned
              to one time zone so the server and client render the
              same string. */}
          {format.dateTime(new Date(comment.createdAt), {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <p className="text-body leading-relaxed text-ink-muted pl-8 whitespace-pre-line break-words">
        {comment.content}
      </p>
    </div>
  );
}

/**
 * One proposal and its heart.
 *
 * `voteDisabled` is set when the server could not read this reader's votes:
 * the vote route toggles, so a heart drawn hollow for a proposal they did vote
 * for would turn their next click into an un-vote. `pending` holds the heart
 * while its own request is in flight — a double tap used to send two toggles
 * and apply their answers in arrival order.
 */
export function ProposalCard({
  proposal,
  recipeFormat,
  hasVoted,
  voteDisabled,
  pending,
  onToggleVote,
}: {
  proposal: ProposalItem;
  recipeFormat: 'pp' | 'cl';
  hasVoted: boolean;
  voteDisabled: boolean;
  pending: boolean;
  onToggleVote: (proposalId: string) => void;
}) {
  const t = useTranslations('community');
  /* A reader-supplied URL can rot at any time. A dead one is dropped rather
     than drawn as a broken tile, as the recipe gallery does. */
  const [sampleFailed, setSampleFailed] = useState(false);

  return (
    <div className="surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Proposal Details & Demo Photo Thumbnail */}
      <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
        {proposal.sampleImageUrl && !sampleFailed && (
          /* eslint-disable-next-line @next/next/no-img-element -- reader-supplied URL, arbitrary host */
          <img
            src={proposal.sampleImageUrl}
            alt={proposal.title}
            onError={() => setSampleFailed(true)}
            className="w-16 h-16 sm:w-20 sm:h-14 rounded-md object-cover shrink-0 shadow-[var(--elevation-1)]"
          />
        )}

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={proposal.authorAvatar} name={proposal.authorName} size="sm" />
            <span className="text-body font-semibold text-ink truncate">{proposal.title}</span>
            <span className="meta shrink-0">{t('by', { author: proposal.authorName })}</span>
          </div>

          {/* Parameter highlight pills, labelled and signed as the camera shows them */}
          <div className="flex flex-wrap gap-1.5">
            {proposalPills(recipeFormat, proposal.settings).map((pill) => (
              <span key={pill} className="chip">
                {pill}
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
        aria-busy={pending || undefined}
        disabled={voteDisabled || pending}
        onClick={() => onToggleVote(proposal.id)}
        className={`flex items-center justify-center gap-2 px-4 min-h-[var(--layout-touch-target)] shrink-0 text-body-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          hasVoted
            ? 'surface-selected [--selected-hue:var(--color-heart)] text-white'
            : 'rounded-sm bg-white/[0.08] hover:bg-white/[0.13] text-ink-muted shadow-[var(--elevation-spec)]'
        }`}
      >
        <span aria-hidden>♥</span>
        <span className="tabular-nums">{proposal.voteCount}</span>
      </button>
    </div>
  );
}

export function RecipeCommunitySection({
  recipeSlug,
  recipeFormat = 'pp',
  currentSettings,
  currentWb,
}: Props) {
  const t = useTranslations('community');
  /* `isReady` separates "signed out" from "still restoring". Branching on
     `user` alone flashed the sign-in prompt at a reader who was signed in, and
     sent an early heart or "Propose" click to the login dialog. */
  const { user, isReady, openLoginModal, accessToken } = useAuth();

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

  /* Each list knows whether it has loaded and, if it failed, why. A failed read
     used to look exactly like an empty one — "be the first" during an outage —
     and a tab label counted "(0)" for a list nobody had fetched. */

  // Comments state
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoadError, setCommentsLoadError] = useState<CommunityAlertCode | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<CommunityAlertCode | null>(null);

  // Proposals state
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [proposalsLoaded, setProposalsLoaded] = useState(false);
  const [proposalsLoadError, setProposalsLoadError] = useState<CommunityAlertCode | null>(null);
  /* The server could not read this reader's votes, so `hasVoted` is a guess.
     The hearts are disabled rather than offer a toggle whose effect is
     unknowable. */
  const [voteStateUnknown, setVoteStateUnknown] = useState(false);
  const [voteError, setVoteError] = useState<CommunityAlertCode | null>(null);
  /* A ref for the guard, because two taps land before a re-render; state for
     the busy hearts it draws. */
  const pendingVotesRef = useRef(new Set<string>());
  const [pendingVotes, setPendingVotes] = useState<ReadonlySet<string>>(() => new Set());
  /* Every proposals load is numbered and only the latest may write: a refetch
     after a failed vote can otherwise land before the load it followed. */
  const proposalsRequest = useRef(0);

  const [newPropTitle, setNewPropTitle] = useState('');
  const [newSampleUrl, setNewSampleUrl] = useState('');
  const [isSubmittingProp, setIsSubmittingProp] = useState(false);
  const [proposalError, setProposalError] = useState<CommunityAlertCode | null>(null);
  const [isPropFormOpen, setIsPropFormOpen] = useState(false);
  /* Read by the gallery-event listener, which must not re-seed an editor that
     is already open. A ref, so the listener is not re-registered per toggle. */
  const isPropFormOpenRef = useRef(false);
  useEffect(() => {
    isPropFormOpenRef.current = isPropFormOpen;
  }, [isPropFormOpen]);

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
    setProposalError(null);
    setIsPropFormOpen(true);
  }, [currentSettings, currentWb]);

  // Load comments
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?slug=${encodeURIComponent(recipeSlug)}`);
      if (!res.ok) {
        /* 503 controlUnavailable carries an empty list beside its code. It is
           not "no comments", and is not rendered as one. */
        setCommentsLoadError(await communityErrorOf(res));
        return;
      }
      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
      setCommentsLoaded(true);
      setCommentsLoadError(null);
    } catch {
      setCommentsLoadError('unknown');
    }
  }, [recipeSlug]);

  // Load proposals
  const fetchProposals = useCallback(async () => {
    const request = ++proposalsRequest.current;
    const isLatest = () => request === proposalsRequest.current;
    try {
      const token = accessToken();
      const res = await fetch(`/api/proposals?slug=${encodeURIComponent(recipeSlug)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const code = await communityErrorOf(res);
        if (isLatest()) setProposalsLoadError(code);
        return;
      }
      const data = await res.json();
      if (!isLatest()) return;
      setProposals(Array.isArray(data.proposals) ? data.proposals : []);
      setVoteStateUnknown(data.voteStateUnknown === true);
      setProposalsLoaded(true);
      setProposalsLoadError(null);
    } catch {
      if (isLatest()) setProposalsLoadError('unknown');
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
    /* Only once the proposals tab is actually showing. `comments` is the
       default, so this used to fetch a panel most readers never opened — one
       Supabase read per recipe view, for nothing. Every route into the tab goes
       through `setActiveTab('proposals')`, including the gallery's
       "Propose & vote" card via OPEN_PROPOSAL_EVENT, so nothing can display
       proposals without first tripping this.

       Separate from the comments load because this one also depends on the
       access token: `hasVoted` is per-viewer, so signing in has to refetch or
       every heart renders empty until a reload. */
    if (activeTab !== 'proposals') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProposals();
  }, [activeTab, fetchProposals]);

  /* Opened from the gallery's "Propose & vote" card, which has no way to reach
     this state directly — see `OPEN_PROPOSAL_EVENT`. `openProposalForm` is in
     the deps because it seeds the draft from `currentSettings`: pinned to the
     first render, a later recipe would have opened the editor on stale values. */
  useEffect(() => {
    const handleOpenProposalSection = () => {
      setActiveTab('proposals');
      /* Signed out, the editor does not render at all — without this the card
         scrolled the reader to the proposals tab and then did nothing visible.
         Same branch the section's own "Propose a new version" button takes.
         An editor already open is left alone: the card can be tapped again,
         and seeding a second time threw away every edit in progress. */
      if (isReady) {
        if (!user) openLoginModal();
        else if (!isPropFormOpenRef.current) openProposalForm();
      }
      requestAnimationFrame(() => {
        document
          .getElementById('community-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    window.addEventListener(OPEN_PROPOSAL_EVENT, handleOpenProposalSection);
    return () => window.removeEventListener(OPEN_PROPOSAL_EVENT, handleOpenProposalSection);
  }, [openProposalForm, user, isReady, openLoginModal]);

  // Post comment handler
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCommentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    setCommentError(null);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: authedJson(),
        body: JSON.stringify({
          recipeSlug,
          content: newCommentText.trim(),
        }),
      });

      /* A refusal resolves; it does not throw. This used to act on `res.ok`
         alone, so a 429 or an expired session reset the button with the text
         still there and no word of why. The draft is kept for the retry. */
      if (!res.ok) {
        setCommentError(await communityErrorOf(res));
        if (res.status === 401) openLoginModal();
        return;
      }
      const data = await res.json();
      setComments((prev) => [data.comment, ...prev]);
      setNewCommentText('');
    } catch {
      setCommentError('unknown');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Create tweak proposal handler
  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPropTitle.trim() || !newSampleUrl.trim() || isSubmittingProp) return;

    const sampleImageUrl = newSampleUrl.trim();
    /* The route stores https only; `type="url"` lets http:// through, and the
       answer would be the same code a round trip later. */
    if (!sampleImageUrl.startsWith('https://')) {
      setProposalError('invalidImageUrl');
      return;
    }

    setIsSubmittingProp(true);
    setProposalError(null);
    try {
      /* Checked against the recipe's own format schema before it is sent — the
         same strict check the route makes. Loaded on submit, so the schema is
         not in the page bundle of every reader who never proposes anything. */
      const { clSettingsSchema, ppSettingsSchema, whiteBalanceSchema } = await import(
        '@/lib/camera/schema'
      );
      const settingsSchema = recipeFormat === 'pp' ? ppSettingsSchema : clSettingsSchema;
      if (
        !settingsSchema.safeParse(editSettings).success ||
        !whiteBalanceSchema.safeParse(editWb).success
      ) {
        setProposalError('invalidSettings');
        return;
      }

      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: authedJson(),
        body: JSON.stringify({
          recipeSlug,
          title: newPropTitle.trim(),
          sampleImageUrl,
          settings: editSettings,
          whiteBalance: editWb,
        }),
      });

      if (!res.ok) {
        setProposalError(await communityErrorOf(res));
        if (res.status === 401) openLoginModal();
        return;
      }
      const data = await res.json();
      setProposals((prev) => [data.proposal, ...prev]);
      setNewPropTitle('');
      setNewSampleUrl('');
      setIsPropFormOpen(false);
    } catch {
      setProposalError('unknown');
    } finally {
      setIsSubmittingProp(false);
    }
  };

  const setVotePending = (proposalId: string, isPending: boolean) => {
    if (isPending) pendingVotesRef.current.add(proposalId);
    else pendingVotesRef.current.delete(proposalId);
    setPendingVotes(new Set(pendingVotesRef.current));
  };

  // Heart Vote handler
  const handleToggleVote = async (proposalId: string) => {
    if (!isReady) return;
    if (!user) {
      openLoginModal();
      return;
    }
    if (voteStateUnknown || pendingVotesRef.current.has(proposalId)) return;

    setVotePending(proposalId, true);
    setVoteError(null);
    // Optimistic UI update
    setProposals((prev) => flipVote(prev, proposalId));

    try {
      const res = await fetch('/api/proposals/vote', {
        method: 'POST',
        headers: authedJson(),
        body: JSON.stringify({ proposalId }),
      });

      /* A rejected write resolves the promise — it does not throw. So a 401 on
         an expired session, or the 429 the route returns above 30 votes a
         minute, used to leave the optimistic heart filled and the count bumped
         while the server had recorded nothing at all. Undo the guess, say
         why, and reconcile against the server.
         The success path takes the authoritative count from the response
         instead of trusting the guess, so a concurrent vote by someone else
         lands immediately rather than at the next refetch. */
      if (!res.ok) {
        setVoteError(await communityErrorOf(res));
        setProposals((prev) => flipVote(prev, proposalId));
        if (res.status === 401) openLoginModal();
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
      setVoteError('unknown');
      setProposals((prev) => flipVote(prev, proposalId));
      void fetchProposals();
    } finally {
      setVotePending(proposalId, false);
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

  /* Every stepper passes a direction, and the size of a step is the range's
     own (`stepInRange`). Raw deltas let one call site move the knee point by
     5 in a range whose step is 0.5, so the corpus's 92.5% could not be reached
     again once left. */

  const updateNum = (key: NumKey, direction: -1 | 1) => {
    setEditSettings((prev) => {
      const cur = typeof prev[key] === 'number' ? prev[key] : 0;
      return { ...prev, [key]: stepInRange(cur, direction, NUM_RANGE[key]) };
    });
  };

  const updateNestedNum = (
    parent: 'blackGamma' | 'knee' | 'detail',
    child: string,
    direction: -1 | 1,
  ) => {
    const range = NESTED_RANGE[`${parent}.${child}` as NestedKey];
    setEditSettings((prev) => {
      const parentObj = (prev[parent] ?? {}) as Record<string, unknown>;
      const cur = typeof parentObj[child] === 'number' ? (parentObj[child] as number) : 0;
      return {
        ...prev,
        [parent]: { ...parentObj, [child]: stepInRange(cur, direction, range) },
      };
    });
  };

  const setBlackGammaRange = (value: string) => {
    setEditSettings((prev) =>
      prev.blackGamma
        ? {
            ...prev,
            blackGamma: {
              ...prev.blackGamma,
              range: asEnum(PP_BLACK_GAMMA_RANGE, value, prev.blackGamma.range),
            },
          }
        : prev,
    );
  };

  const setDetailBwBalance = (value: string) => {
    setEditSettings((prev) =>
      prev.detail
        ? {
            ...prev,
            detail: {
              ...prev.detail,
              bwBalance: asEnum(PP_DETAIL_BW_BALANCE, value, prev.detail.bwBalance),
            },
          }
        : prev,
    );
  };

  /* A fresh knee for the mode, never a merge into the old one: see
     `kneeForMode`. What the editor shows afterwards is what gets saved. */
  const setKneeMode = (mode: string) => {
    setEditSettings((prev) => ({ ...prev, knee: kneeForMode(mode, currentSettings.knee) }));
  };

  const updateColorDepth = (channel: (typeof PP_COLOR_DEPTH_CHANNELS)[number], direction: -1 | 1) => {
    setEditSettings((prev) => {
      const cd = prev.colorDepth ?? { R: 0, G: 0, B: 0, C: 0, M: 0, Y: 0 };
      const cur = cd[channel] ?? 0;
      return {
        ...prev,
        colorDepth: { ...cd, [channel]: stepInRange(cur, direction, PP_RANGES.colorDepth) },
      };
    });
  };

  const updateClNum = (key: keyof typeof CL_RANGES, direction: -1 | 1) => {
    setEditSettings((prev) => {
      const cur = typeof prev[key] === 'number' ? (prev[key] as number) : CL_RANGES[key].min;
      return { ...prev, [key]: stepInRange(cur, direction, CL_RANGES[key]) };
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

  const knee = editSettings.knee;
  const detail = editSettings.detail;

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
        <h2 className="min-w-0 text-title-3 font-semibold tracking-[-0.02em] text-ink">{t('title')}</h2>

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
            {/* A count only for a list that has loaded. Proposals load when
                their tab opens, so this read "(0)" on every page. */}
            {commentsLoaded ? t('tabComments', { count: comments.length }) : t('tabCommentsPlain')}
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
            {proposalsLoaded
              ? t('tabProposals', { count: proposals.length })
              : t('tabProposalsPlain')}
          </button>
        </div>
      </div>

      <div className="seam" />

      {/* Tab 1: Comments */}
      {activeTab === 'comments' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Add Comment Form or Google Login Prompt — neither until the
              session is known. */}
          {!isReady ? null : user ? (
            <form onSubmit={handlePostComment} className="bg-white/[0.03] rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar src={user.avatarUrl || null} name={user.name} size="lg" />
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

              {commentError && <CommunityAlert code={commentError} />}

              <div className="flex flex-wrap justify-end items-center gap-3">
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
                /* The dialog, not a bare sign-in call: Google sign-in reports
                   an outage or a misconfiguration inside the dialog, so a
                   click from here used to fail with nothing on screen. */
                a: (chunks) => (
                  <button
                    type="button"
                    onClick={openLoginModal}
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
            {commentsLoadError && <CommunityAlert code={commentsLoadError} />}
            {comments.length > 0
              ? comments.map((comment) => <CommentCard key={comment.id} comment={comment} />)
              : commentsLoaded &&
                !commentsLoadError && <p className="meta italic py-4 text-center">{t('noComments')}</p>}
          </div>
        </div>
      )}

      {/* Tab 2: Proposals & Heart Voting */}
      {activeTab === 'proposals' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Header Action */}
          <div className="flex flex-wrap items-center justify-end gap-3">

            <button
              type="button"
              onClick={() => {
                if (!isReady) return;
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
                    placeholder="https://images.unsplash.com/photo-…"
                    value={newSampleUrl}
                    onChange={(e) => setNewSampleUrl(e.target.value)}
                    maxLength={2048}
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
                      <Steps
                        value={`${editWb.kelvin}K`}
                        onStep={adjustKelvin}
                        valueClassName={`${VALUE_TINTED} w-14`}
                        valueStyle={{ color: getKelvinHexColor(editWb.kelvin) }}
                      />
                    </div>
                  )}

                  {/* Shift A/B */}
                  <div className={CONTROL}>
                    <span className={CONTROL_LABEL}>Shift A/B</span>
                    <Steps
                      value={editWb?.shift?.ab ? `${editWb.shift.ab.axis}${editWb.shift.ab.amount}` : 'A0'}
                      onStep={(d) => updateWbShift('ab', d)}
                      valueClassName={`${VALUE_TINTED} w-14`}
                      valueStyle={{ color: getWbShiftAxisHexColor(editWb?.shift?.ab?.axis || 'A') }}
                    />
                  </div>

                  {/* Shift G/M */}
                  <div className={CONTROL}>
                    <span className={CONTROL_LABEL}>Shift G/M</span>
                    <Steps
                      value={editWb?.shift?.gm ? `${editWb.shift.gm.axis}${editWb.shift.gm.amount}` : 'G0'}
                      onStep={(d) => updateWbShift('gm', d)}
                      valueClassName={`${VALUE_TINTED} w-14`}
                      valueStyle={{ color: getWbShiftAxisHexColor(editWb?.shift?.gm?.axis || 'G') }}
                    />
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

                    {/* Signed: contrast, highlights, shadows (-9 to +9) */}
                    {(['contrast', 'highlights', 'shadows'] as const).map((key) => (
                      <StepControl
                        key={key}
                        label={CL_PARAM_LABELS[key]}
                        value={signed(Number(editSettings[key] ?? 0))}
                        onStep={(d) => updateClNum(key, d)}
                      />
                    ))}

                    {/* Fade (0 to 9) — unsigned, never a `+` */}
                    <StepControl
                      label={CL_PARAM_LABELS.fade}
                      value={Number(editSettings.fade ?? 0)}
                      onStep={(d) => updateClNum('fade', d)}
                    />

                    {/* Saturation (-9 to +9, omitted for monochrome BW/SE) */}
                    {!(CL_MONOCHROME_LOOKS as readonly string[]).includes(String(editSettings.look)) && (
                      <StepControl
                        label={CL_PARAM_LABELS.saturation}
                        value={signed(Number(editSettings.saturation ?? 0))}
                        onStep={(d) => updateClNum('saturation', d)}
                      />
                    )}

                    {/* Sharpness (0 to 9), Sharpness Range (1 to 5), Clarity (0 to 9) — unsigned */}
                    {(['sharpness', 'sharpnessRange', 'clarity'] as const).map((key) => (
                      <StepControl
                        key={key}
                        label={CL_PARAM_LABELS[key]}
                        value={Number(editSettings[key] ?? CL_RANGES[key].min)}
                        onStep={(d) => updateClNum(key, d)}
                      />
                    ))}
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
                      <StepControl
                        label={PP_PARAM_LABELS.blackLevel}
                        value={signed(editSettings.blackLevel ?? 0)}
                        onStep={(d) => updateNum('blackLevel', d)}
                      />

                      {/* Gamma Select */}
                      <div className={CONTROL}>
                        <span className={CONTROL_LABEL}>{PP_PARAM_LABELS.gamma}</span>
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
                          <span className={CONTROL_LABEL}>{PP_PARAM_LABELS.blackGamma}</span>
                          <div className="flex items-center gap-2">
                            <select
                              value={editSettings.blackGamma.range}
                              onChange={(e) => setBlackGammaRange(e.target.value)}
                              className={SELECT}
                            >
                              {PP_BLACK_GAMMA_RANGE.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <Steps
                              value={signed(editSettings.blackGamma.level)}
                              onStep={(d) => updateNestedNum('blackGamma', 'level', d)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Knee (Mode, Point, Slope). Point and slope are shown
                          only when stored — never a placeholder number. */}
                      {knee && (
                        <div className="surface-sunken flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3.5 py-2.5 col-span-1 sm:col-span-2 lg:col-span-3">
                          <span className={`${CONTROL_LABEL} font-semibold`}>{PP_PARAM_LABELS.knee}</span>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <select
                              value={knee.mode}
                              onChange={(e) => setKneeMode(e.target.value)}
                              className={SELECT}
                            >
                              {PP_KNEE_MODE.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>

                            {knee.mode === 'Manual' && (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="meta">Point:</span>
                                  <Steps
                                    value={`${knee.point}%`}
                                    onStep={(d) => updateNestedNum('knee', 'point', d)}
                                    valueClassName={VALUE}
                                  />
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="meta">Slope:</span>
                                  <Steps
                                    value={signed(knee.slope)}
                                    onStep={(d) => updateNestedNum('knee', 'slope', d)}
                                    valueClassName={VALUE}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Color Mode Select */}
                      <div className={CONTROL}>
                        <span className={CONTROL_LABEL}>{PP_PARAM_LABELS.colorMode}</span>
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
                      <StepControl
                        label={PP_PARAM_LABELS.saturation}
                        value={signed(editSettings.saturation ?? 0)}
                        onStep={(d) => updateNum('saturation', d)}
                      />

                      {/* Color Phase (-7 to +7) */}
                      <StepControl
                        label={PP_PARAM_LABELS.colorPhase}
                        value={signed(editSettings.colorPhase ?? 0)}
                        onStep={(d) => updateNum('colorPhase', d)}
                      />
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
                              <Steps
                                value={signed(editSettings.colorDepth?.[ch] ?? 0)}
                                onStep={(d) => updateColorDepth(ch, d)}
                                valueClassName={`${VALUE_TINTED} w-7`}
                                valueStyle={{ color: hex }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* BLOCK 4: Detail Sub-Parameters */}
                  {detail && (
                    <div className={GROUP}>
                      <span className={GROUP_HEADING}>
                        {t('sectionDetail')}
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Signed: Level, V/H Balance */}
                        {(['level', 'vhBalance'] as const).map((key) => (
                          <StepControl
                            key={key}
                            label={PP_DETAIL_LABELS[key]}
                            value={signed(detail[key])}
                            onStep={(d) => updateNestedNum('detail', key, d)}
                          />
                        ))}

                        {/* B/W Balance Select */}
                        <div className={CONTROL}>
                          <span className={CONTROL_LABEL}>{PP_DETAIL_LABELS.bwBalance}</span>
                          <select
                            value={detail.bwBalance}
                            onChange={(e) => setDetailBwBalance(e.target.value)}
                            className={SELECT}
                          >
                            {PP_DETAIL_BW_BALANCE.map((bw) => (
                              <option key={bw} value={bw}>{bw}</option>
                            ))}
                          </select>
                        </div>

                        {/* Unsigned: Limit, Crispening, Hi-Light Detail */}
                        {(['limit', 'crispening', 'hiLightDetail'] as const).map((key) => (
                          <StepControl
                            key={key}
                            label={PP_DETAIL_LABELS[key]}
                            value={detail[key]}
                            onStep={(d) => updateNestedNum('detail', key, d)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="seam" />

              {proposalError && <CommunityAlert code={proposalError} />}

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

          {proposalsLoadError && <CommunityAlert code={proposalsLoadError} />}
          {voteStateUnknown && (
            <p role="alert" className={ALERT}>
              {t('voteStateUnknown')}
            </p>
          )}
          {voteError && <CommunityAlert code={voteError} />}

          {/* Proposal Cards Grid */}
          <div className="grid grid-cols-1 gap-3">
            {proposals.length > 0
              ? proposals.map((prop) => (
                  <ProposalCard
                    key={prop.id}
                    proposal={prop}
                    recipeFormat={recipeFormat}
                    hasVoted={user ? prop.hasVoted : false}
                    voteDisabled={voteStateUnknown}
                    pending={pendingVotes.has(prop.id)}
                    onToggleVote={handleToggleVote}
                  />
                ))
              : proposalsLoaded &&
                !proposalsLoadError && (
                  <p className="meta italic py-4 text-center">{t('noProposals')}</p>
                )}
          </div>
        </div>
      )}
    </section>
  );
}
