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

const { RecipeCommunitySection, CommentCard, ProposalCard, CommunityAlert, Avatar } = await import(
  './recipe-community-section'
);

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

  it('marks the heart busy while its vote is in flight', () => {
    const html = card({ pending: true });
    expect(html).toMatch(/<button[^>]*aria-busy="true"/);
    expect(html).toMatch(/<button[^>]*disabled=""/);
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
});
