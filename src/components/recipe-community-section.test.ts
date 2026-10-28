import { readFileSync } from 'node:fs';
import { createElement, type ComponentProps, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../messages/en.json';
import { CL_RANGES, PP_DETAIL_LABELS, PP_PARAM_LABELS } from '@/lib/camera/constants';
import type { Recipe } from '@/lib/camera/schema';
import type { CommentItem } from '@/app/api/comments/route';
import type { ProposalItem } from '@/app/api/proposals/route';

/**
 * Render tests for the recipe page's community section.
 *
 * This suite has no DOM, so nothing here clicks: what can be asserted is the
 * markup each state renders, and that is where these defects lived — a login
 * prompt flashed at a reader still being restored, a tab that said "(0)" about
 * a list nobody had loaded, a heart that offered a click whose effect could
 * not be known. The camera logic the editor writes is pinned separately, in
 * `src/lib/community/proposal-draft.test.ts`, and the error reader in
 * `errors.test.ts`.
 *
 * Plain `.ts` with `createElement`, because the vitest include pattern is
 * `src/**\/*.test.ts` and a `.test.tsx` here would silently never run. Copy is
 * real: the provider carries `messages/en.json`, so a missing key renders as a
 * key path and fails the assertion instead of passing it.
 */

type Auth = {
  user: { name: string; email: string; avatarUrl: string } | null;
  isReady: boolean;
};
const auth: Auth = { user: null, isReady: true };

vi.mock('./auth-context', () => ({
  useAuth: () => ({
    ...auth,
    isLoginModalOpen: false,
    openLoginModal: () => {},
    closeLoginModal: () => {},
    loginWithGoogle: async () => {},
    logout: async () => {},
    accessToken: () => null,
  }),
}));

const {
  RecipeCommunitySection,
  CommentCard,
  CommentList,
  ProposalCard,
  ProposalList,
  CommunityAlert,
  Avatar,
} = await import('./recipe-community-section');

const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as Recipe[];
const PP = seed.find((r) => r.format === 'pp')!;
const CL = seed.find((r) => r.format === 'cl')!;

/* The provider's props type requires `children`; the real child is passed
   positionally below, which is what createElement renders. */
const INTL: ComponentProps<typeof NextIntlClientProvider> = {
  locale: 'en',
  messages: en,
  timeZone: 'Asia/Ho_Chi_Minh',
  children: null,
};

const render = (node: ReactNode) =>
  renderToStaticMarkup(createElement(NextIntlClientProvider, INTL, node));

const section = () =>
  render(
    createElement(RecipeCommunitySection, {
      recipeSlug: PP.slug,
      recipeFormat: 'pp',
      currentSettings: PP.settings as Record<string, unknown>,
      currentWb: PP.whiteBalance,
    }),
  );

const source = readFileSync('src/components/recipe-community-section.tsx', 'utf8');

beforeEach(() => {
  auth.user = null;
  auth.isReady = true;
});

describe('the comments tab before the session is known', () => {
  it('shows no sign-in prompt while the session is still restoring', () => {
    auth.isReady = false;
    const html = section();
    expect(html).not.toContain('sign in with Google');
    expect(html).not.toContain('<textarea');
  });

  it('asks a reader who is signed out to sign in', () => {
    expect(section()).toContain('sign in with Google');
  });

  it('opens the sign-in dialog from the prompt, where outage errors render', () => {
    /* `loginWithGoogle` reports its failures through the modal; called
       straight from the prompt, a failed sign-in did nothing visible. */
    expect(source).not.toContain('loginWithGoogle');
  });
});

describe('the tab labels', () => {
  it('do not count a list that has not loaded', () => {
    /* Proposals load only when their tab opens, so the label used to read
       "Proposals & votes (0)" on every page, whatever existed. */
    const html = section();
    expect(html).toContain('Proposals &amp; votes');
    expect(html).not.toContain('(0)');
  });
});

describe('CommunityAlert', () => {
  it('renders the code’s copy from the catalogue as an alert', () => {
    const html = render(createElement(CommunityAlert, { code: 'rateLimited' }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(en.community.errors.rateLimited);
  });

  it('renders the fallback for an unknown code', () => {
    expect(render(createElement(CommunityAlert, { code: 'unknown' }))).toContain(
      en.community.errors.unknown,
    );
  });

  it('does not tell a reader whose list failed to load that nothing was saved', () => {
    /* `errors.controlUnavailable` is a write's copy. A reader who only opened
       the page has not tried to save anything. */
    const html = render(createElement(CommunityAlert, { code: 'controlUnavailable', read: true }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(en.community.loadUnavailable);
    expect(html).not.toContain(en.community.errors.controlUnavailable);
  });
});

describe('CommentCard', () => {
  const comment: CommentItem = {
    id: 'c1',
    recipeSlug: PP.slug,
    authorName: 'An',
    authorAvatar: null,
    content: 'first line\nsecond line',
    createdAt: '2026-10-08T00:00:00.000Z',
  };

  it('keeps the line breaks a reader typed', () => {
    const html = render(createElement(CommentCard, { comment }));
    expect(html).toMatch(/<p class="[^"]*whitespace-pre-line[^"]*">first line\nsecond line<\/p>/);
  });
});

describe('Avatar', () => {
  it('falls back to an initial on a token colour, never a third-party image', () => {
    const html = render(createElement(Avatar, { src: null, name: 'Linh', size: 'sm' }));
    expect(html).not.toContain('<img');
    expect(html).toContain('>L<');
  });

  it('sends no referrer for a Google avatar', () => {
    const html = render(createElement(Avatar, { src: 'https://lh3.example/a.jpg', name: 'Linh', size: 'sm' }));
    expect(html).toContain('referrerPolicy="no-referrer"');
  });

  it('is the only avatar fallback, with no generated-avatar service anywhere', () => {
    expect(source).not.toContain('ui-avatars.com');
    expect(readFileSync('src/components/auth-context.tsx', 'utf8')).not.toContain('ui-avatars.com');
  });
});

describe('ProposalCard', () => {
  const proposal: ProposalItem = {
    id: '6f1c1d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f',
    recipeSlug: CL.slug,
    title: 'Softer',
    authorName: 'Reader',
    authorAvatar: 'https://lh3.example/a.jpg',
    sampleImageUrl: 'https://cdn.example.com/s.jpg',
    settings: { fade: 3, contrast: 2 },
    whiteBalance: CL.whiteBalance,
    voteCount: 4,
    hasVoted: false,
    createdAt: '2026-10-08T00:00:00.000Z',
  };
  const card = (over: Partial<Parameters<typeof ProposalCard>[0]> = {}) =>
    render(
      createElement(ProposalCard, {
        proposal,
        recipeFormat: 'cl',
        hasVoted: false,
        voteDisabled: false,
        pending: false,
        onToggleVote: () => {},
        ...over,
      }),
    );

  it('prints unsigned Creative Look values without a sign', () => {
    expect(CL_RANGES.fade.min).toBe(0);
    const html = card();
    expect(html).toContain('Fade: 3');
    expect(html).toContain('Contrast: +2');
  });

  it('offers the heart while the vote state is known', () => {
    expect(card()).not.toMatch(/<button[^>]*disabled=""/);
  });

  it('disables the heart when the vote state is unknown', () => {
    /* The route toggles, so a heart shown hollow for a proposal the reader did
       vote for turns the next click into an un-vote. */
    expect(card({ voteDisabled: true })).toMatch(/<button[^>]*disabled=""/);
  });

  it('marks the heart busy while its vote is in flight, without taking its focus', () => {
    /* Chrome blurs a focused element the moment it is disabled, so a keyboard
       reader lost their place after every vote. The handler's ref guard is
       what stops a second send; the button only has to say it is busy. */
    const html = card({ pending: true });
    expect(html).toMatch(/<button[^>]*aria-busy="true"/);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"/);
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
  });

  it('gives the proposal avatar the same no-referrer treatment', () => {
    expect(card()).toContain('referrerPolicy="no-referrer"');
  });
});

describe('the editor', () => {
  it('labels Picture Profile controls from constants.ts (Rule 3)', () => {
    const labels = [...Object.values(PP_PARAM_LABELS), ...Object.values(PP_DETAIL_LABELS)];
    for (const label of labels) {
      const esc = label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
      expect(source, `"${label}" is typed into the component`).not.toMatch(new RegExp(`>\\s*${esc}\\s*<`));
      expect(source, `"${label}" is typed into the component`).not.toMatch(new RegExp(`['"\`]${esc}:?['"\`]`));
    }
  });

  it('steps every control by its range’s own increment', () => {
    // A raw delta is how the knee point came to move by 5 in a 0.5-step range.
    expect(source).not.toMatch(/updateNestedNum\([^)]*,\s*-?5\)/);
    expect(source).toContain('stepInRange(');
  });

  it('does not re-seed an editor that is already open', () => {
    /* The gallery's "Propose & vote" card re-dispatches its event on every
       tap, and seeding again silently threw away every edit in progress. */
    expect(source).toMatch(/if \(!isPropFormOpenRef\.current\) openProposalForm\(\)/);
  });

  it('refuses an expiring social-CDN sample before the round trip', () => {
    /* The route's own list: a Facebook or Instagram link expires, and the
       proposal's evidence would go with it. */
    const submit = source.slice(source.indexOf('const handleCreateProposal'));
    const check = submit.indexOf('if (isExpiringImageHost(sampleImageUrl))');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(submit.indexOf('setIsSubmittingProp(true)'));
    expect(submit.slice(check, check + 200)).toContain("setProposalError('expiringImageHost')");
    expect(source).toContain("from '@/lib/community/image-hosts'");
  });
});

describe('CommentList', () => {
  const comment: CommentItem = {
    id: 'c1',
    recipeSlug: PP.slug,
    authorName: 'An',
    authorAvatar: null,
    content: 'hello',
    createdAt: '2026-10-08T00:00:00.000Z',
  };
  const list = (over: Partial<Parameters<typeof CommentList>[0]> = {}) =>
    render(createElement(CommentList, { comments: [], loaded: true, loadError: null, ...over }));

  it('says there are no comments only when an empty list actually loaded', () => {
    expect(list()).toContain(en.community.noComments);
    expect(list({ loaded: false })).not.toContain(en.community.noComments);
  });

  it('renders a failed load as an alert, never as "be the first"', () => {
    /* The GET answers 503 with an empty list beside its code, which used to
       read as an empty discussion during an outage. */
    const html = list({ loaded: false, loadError: 'controlUnavailable' });
    expect(html).toContain('role="alert"');
    expect(html).toContain(en.community.loadUnavailable);
    expect(html).not.toContain(en.community.noComments);
  });

  it('does not call a list empty when its latest load failed', () => {
    const html = list({ loaded: true, loadError: 'unknown' });
    expect(html).toContain(en.community.errors.unknown);
    expect(html).not.toContain(en.community.noComments);
  });

  it('keeps the comments it has when a later load fails', () => {
    const html = list({ comments: [comment], loadError: 'unknown' });
    expect(html).toContain(en.community.errors.unknown);
    expect(html).toContain('hello');
  });
});

describe('ProposalList', () => {
  const proposal = (id: string): ProposalItem => ({
    id,
    recipeSlug: CL.slug,
    title: `Proposal ${id}`,
    authorName: 'Reader',
    authorAvatar: null,
    sampleImageUrl: null,
    settings: { fade: 3 },
    whiteBalance: CL.whiteBalance,
    voteCount: 1,
    hasVoted: true,
    createdAt: '2026-10-08T00:00:00.000Z',
  });
  const list = (over: Partial<Parameters<typeof ProposalList>[0]> = {}) =>
    render(
      createElement(ProposalList, {
        proposals: [proposal('a'), proposal('b')],
        loaded: true,
        loadError: null,
        voteStateUnknown: false,
        voteError: null,
        pendingVotes: new Set<string>(),
        signedIn: true,
        recipeFormat: 'cl',
        onToggleVote: () => {},
        ...over,
      }),
    );
  const hearts = (html: string) => html.match(/<button[^>]*aria-pressed[^>]*>/g) ?? [];

  it('disables every heart and says why when the vote state is unknown', () => {
    const html = list({ voteStateUnknown: true });
    expect(html).toContain(en.community.voteStateUnknown);
    expect(hearts(html)).toHaveLength(2);
    for (const heart of hearts(html)) expect(heart).toContain('disabled=""');
  });

  it('offers every heart when the vote state is known', () => {
    const html = list();
    expect(html).not.toContain(en.community.voteStateUnknown);
    expect(hearts(html)).toHaveLength(2);
    for (const heart of hearts(html)) expect(heart).not.toContain('disabled=""');
  });

  it('marks only the proposal whose vote is in flight as busy', () => {
    const [a, b] = hearts(list({ pendingVotes: new Set(['a']) }));
    expect(a).toContain('aria-busy="true"');
    expect(b).not.toContain('aria-busy');
  });

  it('draws no filled heart for a reader who is signed out', () => {
    const html = list({ signedIn: false });
    expect(hearts(html)).toHaveLength(2);
    for (const heart of hearts(html)) expect(heart).toContain('aria-pressed="false"');
  });

  it('renders a vote refusal from its code', () => {
    expect(list({ voteError: 'rateLimited' })).toContain(en.community.errors.rateLimited);
  });

  it('renders a failed load as an alert, never as "create the first"', () => {
    const html = list({ proposals: [], loaded: false, loadError: 'controlUnavailable' });
    expect(html).toContain(en.community.loadUnavailable);
    expect(html).not.toContain(en.community.noProposals);
  });

  it('does not call the list empty when its latest load failed', () => {
    const html = list({ proposals: [], loaded: true, loadError: 'unknown' });
    expect(html).toContain(en.community.errors.unknown);
    expect(html).not.toContain(en.community.noProposals);
  });

  it('says there are no proposals only when an empty list actually loaded', () => {
    expect(list({ proposals: [] })).toContain(en.community.noProposals);
    expect(list({ proposals: [], loaded: false })).not.toContain(en.community.noProposals);
  });
});

/*
 * The handlers' wiring. Nothing here can click, so what has to hold is pinned
 * as source, one handler at a time — the same approach as
 * `recipe-gallery.test.ts`. Each of these was reverted by mutation in review
 * and nothing failed: the helpers they call were tested, the calls were not.
 */
describe('the section’s handlers', () => {
  /** One handler's text, from its declaration to the next marker. */
  const handler = (start: string, end: string) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    expect(from, `${start} is missing`).toBeGreaterThan(-1);
    expect(to, `${end} is missing after ${start}`).toBeGreaterThan(from);
    return source.slice(from, to);
  };
  /** The first `if (!res.ok) {` branch in a handler, up to its `return;`. */
  const refusal = (text: string) => {
    const from = text.indexOf('if (!res.ok) {');
    expect(from, 'no refusal branch').toBeGreaterThan(-1);
    return text.slice(from, text.indexOf('return;', from) + 'return;'.length);
  };
  /** From `marker` to the next `return;` — the body of an early exit. */
  const exit = (text: string, marker: string) => {
    const from = text.indexOf(marker);
    expect(from, `${marker} is missing`).toBeGreaterThan(-1);
    return text.slice(from, text.indexOf('return;', from));
  };

  const fetchComments = handler('const fetchComments', 'const fetchProposals');
  const fetchProposals = handler('const fetchProposals', 'useEffect(');
  const postComment = handler('const handlePostComment', 'const handleCreateProposal');
  const createProposal = handler('const handleCreateProposal', 'const setVotePending');
  const toggleVote = handler('const handleToggleVote', 'const NUM_RANGE');
  const setKneeMode = handler('const setKneeMode', 'const updateColorDepth');

  it('keeps a failed comments load, and shows it', () => {
    expect(refusal(fetchComments)).toContain('setCommentsLoadError(await communityErrorOf(res))');
    expect(fetchComments).toMatch(/catch \{\s*setCommentsLoadError\('unknown'\)/);
    expect(source).toMatch(/<CommentList[^>]*loadError=\{commentsLoadError\}/);
  });

  it('keeps a failed proposals load, and shows it', () => {
    expect(refusal(fetchProposals)).toMatch(
      /const code = await communityErrorOf\(res\);\s*if \(isLatest\(\)\) setProposalsLoadError\(code\)/,
    );
    expect(fetchProposals).toMatch(/catch \{\s*if \(isLatest\(\)\) setProposalsLoadError\('unknown'\)/);
    expect(source).toMatch(/<ProposalList[^>]*loadError=\{proposalsLoadError\}/);
  });

  it('lets only the latest proposals load write', () => {
    /* A refetch after a failed vote could otherwise land before the load it
       followed, and the older answer would win. */
    const guard = fetchProposals.indexOf('if (!isLatest()) return;');
    expect(guard).toBeGreaterThan(-1);
    for (const write of ['setProposals(', 'setVoteStateUnknown(', 'setProposalsLoaded(true)']) {
      expect(fetchProposals.indexOf(write), `${write} runs before the guard`).toBeGreaterThan(guard);
    }
  });

  it('reads the vote state from the load and hands it to the hearts', () => {
    expect(fetchProposals).toContain('setVoteStateUnknown(data.voteStateUnknown === true)');
    expect(source).toMatch(/<ProposalList[^>]*voteStateUnknown=\{voteStateUnknown\}/);
    expect(source).toMatch(/<ProposalList[^>]*pendingVotes=\{pendingVotes\}/);
    expect(source).toMatch(/<ProposalList[^>]*voteError=\{voteError\}/);
  });

  it('shows why a comment was refused, and keeps the draft', () => {
    const refused = refusal(postComment);
    expect(refused).toContain('setCommentError(await communityErrorOf(res))');
    expect(refused).not.toContain("setNewCommentText('')");
    expect(postComment).toMatch(/catch \{\s*setCommentError\('unknown'\)/);
    expect(source).toContain('{commentError && <CommunityAlert code={commentError} />}');
  });

  it('shows why a proposal was refused, and keeps the editor open', () => {
    const refused = refusal(createProposal);
    expect(refused).toContain('setProposalError(await communityErrorOf(res))');
    expect(refused).not.toContain('setIsPropFormOpen(false)');
    expect(createProposal).toMatch(/catch \{\s*setProposalError\('unknown'\)/);
    expect(source).toContain('{proposalError && <CommunityAlert code={proposalError} />}');
  });

  it('refuses a non-https sample and an invalid draft before anything is sent', () => {
    const send = createProposal.indexOf("fetch('/api/proposals'");
    expect(send).toBeGreaterThan(-1);

    const https = "if (!sampleImageUrl.startsWith('https://')) {";
    expect(createProposal.indexOf(https)).toBeLessThan(send);
    expect(exit(createProposal, https)).toContain("setProposalError('invalidImageUrl')");

    const schema = '!settingsSchema.safeParse(editSettings).success ||';
    expect(createProposal.indexOf(schema)).toBeLessThan(send);
    expect(createProposal).toContain('!whiteBalanceSchema.safeParse(editWb).success');
    expect(exit(createProposal, schema)).toContain("setProposalError('invalidSettings')");
  });

  it('sends no vote while the vote state is unknown or one is already in flight', () => {
    const guard = toggleVote.indexOf(
      'if (voteStateUnknown || pendingVotesRef.current.has(proposalId)) return;',
    );
    expect(guard).toBeGreaterThan(-1);
    for (const effect of ['setVotePending(proposalId, true)', 'flipVote(', "fetch('/api/proposals/vote'"]) {
      expect(toggleVote.indexOf(effect), `${effect} runs before the guard`).toBeGreaterThan(guard);
    }
    expect(toggleVote).toMatch(/finally \{\s*setVotePending\(proposalId, false\)/);
  });

  it('undoes a refused vote and says why', () => {
    const refused = refusal(toggleVote);
    expect(refused).toContain('setVoteError(await communityErrorOf(res))');
    expect(refused).toContain('flipVote(prev, proposalId)');
    expect(toggleVote).toMatch(/setVoteError\('unknown'\);\s*setProposals\(\(prev\) => flipVote\(prev, proposalId\)\)/);
  });

  it('switches the knee mode through kneeForMode, never a merge', () => {
    expect(setKneeMode).toContain('kneeForMode(mode, currentSettings.knee)');
    expect(setKneeMode).not.toContain('...prev.knee');
  });
});
