import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireUser, type AuthedUser } from '@/lib/auth/require-user';
import { publishedRecipeExists, publishedRecipeFormat } from '@/lib/recipes/existence';
import { ControlUnavailableError } from '@/lib/supabase/errors';
import { PP_RANGES } from '@/lib/camera/constants';
import type { Recipe } from '@/lib/camera/schema';
import { MAX_PHOTOS_PER_RECIPE } from '@/lib/community/gallery';

import * as comments from './comments/route';
import * as photos from './community-photos/route';
import * as proposals from './proposals/route';
import * as vote from './proposals/vote/route';

/**
 * The four community handlers, executed against a recording fake.
 *
 * The sibling files (`community-boundaries`, `identity-not-from-body`,
 * `community-error-codes`) are source assertions, and they said why: the
 * handlers needed live Supabase to run. They do not — the existence probe and
 * the admin routes already run against fakes — and the defects pinned here
 * were all ones a grep could not see: a sample photo validated by nobody, a
 * gallery credit longer than its own CHECK, a read failure answered with
 * invented comments, a vote lookup whose error was dropped so the next click
 * un-voted.
 *
 * The fake answers each call the way PostgREST would and records it, so a test
 * can assert both what went to the database and what did not.
 */

type Op = 'select' | 'insert' | 'update' | 'delete';
type Call = {
  client: 'controlRead' | 'controlAdmin';
  table: string;
  op: Op;
  columns?: string;
  options?: { count?: string; head?: boolean };
  payload?: Record<string, unknown>;
  filters: [string, unknown][];
  limit?: number;
};
type Result = { data?: unknown; error?: unknown; count?: number | null };

const db = {
  calls: [] as Call[],
  /** Per-test answers; returning undefined falls through to the default. */
  answer: (() => undefined) as (call: Call, terminal: 'many' | 'single' | 'maybe') => Result | undefined,
};

const env = { control: true, content: true };

function defaultAnswer(call: Call, terminal: 'many' | 'single' | 'maybe'): Result {
  if (call.op === 'insert') {
    return {
      data: { id: `${call.table}-1`, created_at: '2026-10-08T00:00:00.000Z', vote_count: 0, ...call.payload },
      error: null,
    };
  }
  if (call.op === 'select' && call.options?.head) return { data: null, error: null, count: 0 };
  if (call.op === 'select') return { data: terminal === 'many' ? [] : null, error: null };
  return { data: null, error: null };
}

function client(name: Call['client']) {
  return {
    from(table: string) {
      let call: Call | null = null;
      const start = (op: Op, extra: Partial<Call> = {}) => {
        call = { client: name, table, op, filters: [], ...extra };
        db.calls.push(call);
      };
      const settle = (terminal: 'many' | 'single' | 'maybe') =>
        Promise.resolve(db.answer(call!, terminal) ?? defaultAnswer(call!, terminal));
      const builder = {
        select(columns: string, options?: Call['options']) {
          if (call) call.columns = columns;
          else start('select', { columns, options });
          return builder;
        },
        insert(payload: Record<string, unknown>) {
          start('insert', { payload });
          return builder;
        },
        update(payload: Record<string, unknown>) {
          start('update', { payload });
          return builder;
        },
        delete() {
          start('delete');
          return builder;
        },
        eq(column: string, value: unknown) {
          call!.filters.push([column, value]);
          return builder;
        },
        in(column: string, value: unknown) {
          call!.filters.push([column, value]);
          return builder;
        },
        order() {
          return builder;
        },
        limit(n: number) {
          call!.limit = n;
          return builder;
        },
        single: () => settle('single'),
        maybeSingle: () => settle('maybe'),
        then<T>(resolve: (r: Result) => T, reject?: (e: unknown) => T) {
          return settle('many').then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  hasControlConfig: () => env.control,
  hasContentConfig: () => env.content,
  controlRead: () => client('controlRead'),
  controlAdmin: () => client('controlAdmin'),
  contentRead: () => {
    throw new Error('community routes reach the content plane only through existence.ts');
  },
  contentAdmin: () => {
    throw new Error('a community route must never hold a content service credential');
  },
}));

vi.mock('@/lib/auth/require-user', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-user')>()),
  requireUser: vi.fn(),
}));

vi.mock('@/lib/recipes/existence', () => ({
  publishedRecipeExists: vi.fn(),
  publishedRecipeFormat: vi.fn(),
}));

// The limiter is per-process and keyed on the address; every test here is the
// same reader, so the real one would start answering 429 halfway down the file.
vi.mock('@/lib/ai/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0 }),
}));

const USER: AuthedUser = {
  id: 'user-1',
  email: 'reader@gmail.com',
  name: 'Nguyễn Văn An',
  avatarUrl: null,
  assuranceLevel: null,
};

/* Real recipes from the seed, never settings typed from memory (Rule 1). */
const seed = JSON.parse(readFileSync('data/recipes.seed.json', 'utf8')) as Recipe[];
const PP = seed.find((r) => r.format === 'pp')!;
const CL = seed.find((r) => r.format === 'cl')!;

const PROPOSAL_ID = '6f1c1d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';
const SAMPLE = 'https://cdn.example.com/sample.jpg';

const post = (path: string, body: unknown) =>
  new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer jwt',
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.7',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const get = (path: string) => new Request(`https://example.test${path}`);

const proposalBody = (over: Record<string, unknown> = {}) => ({
  recipeSlug: PP.slug,
  title: 'Warmer evening',
  sampleImageUrl: SAMPLE,
  settings: PP.settings,
  whiteBalance: PP.whiteBalance,
  ...over,
});

const callsTo = (table: string, op?: Op) =>
  db.calls.filter((c) => c.table === table && (!op || c.op === op));

beforeEach(() => {
  db.calls = [];
  db.answer = () => undefined;
  env.control = true;
  env.content = true;
  vi.mocked(requireUser).mockReset().mockResolvedValue(USER);
  vi.mocked(publishedRecipeExists).mockReset().mockResolvedValue(true);
  vi.mocked(publishedRecipeFormat).mockReset().mockResolvedValue('pp');
});

describe('POST /api/proposals', () => {
  it('stores a valid Picture Profile proposal with its sample photo', async () => {
    const res = await proposals.POST(post('/api/proposals', proposalBody()));
    expect(res.status).toBe(200);

    const [insert] = callsTo('recipe_proposals', 'insert');
    expect(insert.payload).toMatchObject({
      recipe_slug: PP.slug,
      settings: PP.settings,
      white_balance: PP.whiteBalance,
      sample_image_url: SAMPLE,
    });
    expect(insert.columns).toContain('sample_image_url');
    expect((await res.json()).proposal.sampleImageUrl).toBe(SAMPLE);
  });

  it('never writes the author address into the anon-readable gallery', async () => {
    await proposals.POST(post('/api/proposals', proposalBody()));
    const [photo] = callsTo('community_photos', 'insert');
    expect(photo.payload!.submitted_by).toBe('203.0.113.7');
    expect(JSON.stringify(photo.payload)).not.toContain('@');
  });

  it('credits the gallery photo to a name that fits the column', async () => {
    /* `${name} (${title})` reached 253 characters against a CHECK of 100, so
       the insert failed with 23514 and only the log knew. */
    vi.mocked(requireUser).mockResolvedValue({ ...USER, name: 'N'.repeat(100) });
    await proposals.POST(post('/api/proposals', proposalBody({ title: 'T'.repeat(150) })));
    const [photo] = callsTo('community_photos', 'insert');
    expect((photo.payload!.author_name as string).length).toBeLessThanOrEqual(100);
    expect(photo.payload!.author_name).toBe('N'.repeat(100));
  });

  it('does not push the gallery past its cap', async () => {
    db.answer = (call) =>
      call.table === 'community_photos' && call.options?.head
        ? { data: null, error: null, count: MAX_PHOTOS_PER_RECIPE }
        : undefined;
    const res = await proposals.POST(post('/api/proposals', proposalBody()));
    expect(res.status).toBe(200);
    expect(callsTo('community_photos', 'insert')).toHaveLength(0);
  });

  it('rejects settings outside the camera range and writes nothing', async () => {
    const settings = { ...PP.settings, saturation: PP_RANGES.saturation.max + 1 };
    const res = await proposals.POST(post('/api/proposals', proposalBody({ settings })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'invalidSettings' });
    expect(db.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('rejects Picture Profile settings on a Creative Look recipe (Rule 2)', async () => {
    vi.mocked(publishedRecipeFormat).mockResolvedValue('cl');
    const res = await proposals.POST(post('/api/proposals', proposalBody({ recipeSlug: CL.slug })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalidSettings');
    expect(db.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('accepts Creative Look settings on a Creative Look recipe', async () => {
    vi.mocked(publishedRecipeFormat).mockResolvedValue('cl');
    const res = await proposals.POST(
      post(
        '/api/proposals',
        proposalBody({ recipeSlug: CL.slug, settings: CL.settings, whiteBalance: CL.whiteBalance }),
      ),
    );
    expect(res.status).toBe(200);
  });

  it('rejects a white balance the schema does not know', async () => {
    const res = await proposals.POST(
      post('/api/proposals', proposalBody({ whiteBalance: { mode: 'nonsense', kelvin: -1 } })),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalidSettings');
  });

  it('refuses an oversized body before parsing it', async () => {
    const res = await proposals.POST(
      post('/api/proposals', proposalBody({ title: 'x', padding: 'x'.repeat(64 * 1024) })),
    );
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('payloadTooLarge');
    expect(db.calls).toHaveLength(0);
  });

  it('answers 400 invalidImageUrl to a non-https sample, rather than dropping it', async () => {
    const res = await proposals.POST(
      post('/api/proposals', proposalBody({ sampleImageUrl: 'http://cdn.example.com/a.jpg' })),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalidImageUrl');
    expect(db.calls).toHaveLength(0);
  });

  it('asks for the sample only when the sample is what is missing', async () => {
    const noSample = await proposals.POST(
      post('/api/proposals', proposalBody({ sampleImageUrl: undefined })),
    );
    expect((await noSample.json()).error).toBe('sampleUrlRequired');

    const noTitle = await proposals.POST(post('/api/proposals', proposalBody({ title: '' })));
    expect(noTitle.status).toBe(400);
    expect((await noTitle.json()).error).toBe('missingFields');
  });

  it('answers 404 for a recipe the content plane does not have', async () => {
    vi.mocked(publishedRecipeFormat).mockResolvedValue(null);
    const res = await proposals.POST(post('/api/proposals', proposalBody()));
    expect(res.status).toBe(404);
    expect(db.calls).toHaveLength(0);
  });
});

describe('GET /api/proposals', () => {
  const row = {
    id: PROPOSAL_ID,
    recipe_slug: PP.slug,
    title: 'Warmer evening',
    author_name: 'Reader',
    author_avatar: null,
    sample_image_url: SAMPLE,
    settings: PP.settings,
    white_balance: PP.whiteBalance,
    vote_count: 3,
    created_at: '2026-10-08T00:00:00.000Z',
  };

  it('returns the stored sample photo, so the thumbnail survives a reload', async () => {
    db.answer = (call) =>
      call.table === 'recipe_proposals' ? { data: [row], error: null } : undefined;
    const res = await proposals.GET(get(`/api/proposals?slug=${PP.slug}`));
    const body = await res.json();
    expect(body.proposals[0].sampleImageUrl).toBe(SAMPLE);
    const [read] = callsTo('recipe_proposals', 'select');
    expect(read.columns).toContain('sample_image_url');
    expect(read.columns).not.toContain('author_email');
    expect(read.limit).toBeGreaterThan(0);
  });

  it('does not report a vote state it failed to read as fact', async () => {
    db.answer = (call) => {
      if (call.table === 'recipe_proposals') return { data: [row], error: null };
      if (call.table === 'proposal_votes') return { data: null, error: { message: 'x' } };
      return undefined;
    };
    const res = await proposals.GET(get(`/api/proposals?slug=${PP.slug}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voteStateUnknown).toBe(true);
    expect(body.proposals).toHaveLength(1);
  });

  it('reports a known vote state as known', async () => {
    db.answer = (call) => {
      if (call.table === 'recipe_proposals') return { data: [row], error: null };
      if (call.table === 'proposal_votes') return { data: [{ proposal_id: PROPOSAL_ID }], error: null };
      return undefined;
    };
    const body = await (await proposals.GET(get(`/api/proposals?slug=${PP.slug}`))).json();
    expect(body.voteStateUnknown).toBe(false);
    expect(body.proposals[0].hasVoted).toBe(true);
  });

  it('answers a control read failure with 503 and no invented proposals', async () => {
    db.answer = (call) =>
      call.table === 'recipe_proposals' ? { data: null, error: { message: 'boom' } } : undefined;
    // The seeded examples are attached to a real recipe.
    const res = await proposals.GET(get('/api/proposals?slug=daylight-cinema'));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: 'controlUnavailable', proposals: [] });
  });
});

describe('/api/comments', () => {
  it('answers a control read failure with 503 and no invented comments', async () => {
    db.answer = () => ({ data: null, error: { message: 'boom' } });
    const res = await comments.GET(get('/api/comments?slug=daylight-cinema'));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: 'controlUnavailable', comments: [] });
  });

  it('keeps the offline examples for a deployment with no control project', async () => {
    env.control = false;
    const body = await (await comments.GET(get('/api/comments?slug=daylight-cinema'))).json();
    expect(body.source).toBe('memory');
    expect(body.comments.length).toBeGreaterThan(0);
  });

  it('bounds the public read', async () => {
    await comments.GET(get(`/api/comments?slug=${PP.slug}`));
    expect(callsTo('recipe_comments', 'select')[0].limit).toBeGreaterThan(0);
  });
});

describe.each([
  ['comments', () => comments.POST],
  ['proposals', () => proposals.POST],
  ['vote', () => vote.POST],
  ['photos', () => photos.POST],
] as const)('%s POST with a malformed body', (_name, handler) => {
  it.each(['not json', 'null', '[]'])('answers %s with 400 missingFields', async (raw) => {
    const res = await handler()(post('/api/x', raw));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'missingFields' });
    expect(db.calls.filter((c) => c.op !== 'select')).toHaveLength(0);
  });
});

describe('POST /api/community-photos', () => {
  it('answers 503 when the session cannot be checked', async () => {
    vi.mocked(requireUser).mockRejectedValue(new ControlUnavailableError());
    const res = await photos.POST(
      post('/api/community-photos', { slug: PP.slug, imageUrl: SAMPLE }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: 'controlUnavailable' });
  });

  it('blames the field that is actually wrong', async () => {
    const badSocial = await photos.POST(
      post('/api/community-photos', { slug: PP.slug, imageUrl: SAMPLE, authorSocial: 'https://' }),
    );
    expect(badSocial.status).toBe(400);
    expect((await badSocial.json()).error).toBe('missingFields');

    const badImage = await photos.POST(
      post('/api/community-photos', { slug: PP.slug, imageUrl: 'http://cdn.example.com/a.jpg' }),
    );
    expect((await badImage.json()).error).toBe('invalidImageUrl');
  });

  it('stores a valid photo with an origin marker, not an address', async () => {
    const res = await photos.POST(post('/api/community-photos', { slug: PP.slug, imageUrl: SAMPLE }));
    expect(res.status).toBe(200);
    const [insert] = callsTo('community_photos', 'insert');
    expect(insert.payload).toMatchObject({ image_url: SAMPLE, submitted_by: '203.0.113.7' });
  });
});

describe('POST /api/proposals/vote', () => {
  const tally = (n: number) => (call: Call) =>
    call.table === 'proposal_votes' && call.options?.head
      ? { data: null, error: null, count: n }
      : undefined;

  it('removes an existing vote and writes the recounted tally', async () => {
    db.answer = (call, terminal) => {
      if (call.table === 'proposal_votes' && call.op === 'select' && terminal === 'maybe') {
        return { data: { id: 'vote-1' }, error: null };
      }
      return tally(7)(call);
    };
    const res = await vote.POST(post('/api/proposals/vote', { proposalId: PROPOSAL_ID }));
    expect(await res.json()).toMatchObject({ ok: true, voted: false, voteCount: 7 });

    expect(db.calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      'proposal_votes:select',
      'proposal_votes:delete',
      'proposal_votes:select',
      'recipe_proposals:update',
    ]);
    expect(db.calls[0].filters).toContainEqual(['user_email', USER.email]);
    expect(db.calls[1].filters).toEqual([['id', 'vote-1']]);
    expect(db.calls[2].options).toMatchObject({ count: 'exact', head: true });
    expect(db.calls[3].payload).toEqual({ vote_count: 7 });
    expect(db.calls[3].filters).toEqual([['id', PROPOSAL_ID]]);
  });

  it('adds a vote for the verified address when there is none', async () => {
    db.answer = tally(1);
    const res = await vote.POST(post('/api/proposals/vote', { proposalId: PROPOSAL_ID }));
    expect(await res.json()).toMatchObject({ ok: true, voted: true, voteCount: 1 });
    const [insert] = callsTo('proposal_votes', 'insert');
    expect(insert.payload).toEqual({ proposal_id: PROPOSAL_ID, user_email: USER.email });
  });

  it('refuses an id that is not a proposal id before touching the table', async () => {
    const res = await vote.POST(post('/api/proposals/vote', { proposalId: 'seed-prop-1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('missingFields');
    expect(db.calls).toHaveLength(0);
  });

  it('answers 404 for a proposal that does not exist, and writes nothing more', async () => {
    /* 23503 is foreign_key_violation: proposal_votes.proposal_id references a
       recipe_proposals row that is not there — deleted, or never was. That is
       the caller's stale id, not a server failure. */
    db.answer = (call) =>
      call.table === 'proposal_votes' && call.op === 'insert'
        ? { data: null, error: { code: '23503', message: 'fk' } }
        : undefined;
    const res = await vote.POST(post('/api/proposals/vote', { proposalId: PROPOSAL_ID }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'proposalNotFound' });
    expect(callsTo('recipe_proposals', 'update')).toHaveLength(0);
  });

  it('treats a concurrent duplicate insert as already voted, and recounts', async () => {
    /* Two requests both read "no vote", both insert; the second hits
       unique(proposal_id, user_email) with 23505. The vote the reader asked
       for exists, so the answer is voted: true with the real tally. */
    db.answer = (call) => {
      if (call.table === 'proposal_votes' && call.op === 'insert') {
        return { data: null, error: { code: '23505', message: 'dup' } };
      }
      return tally(4)(call);
    };
    const res = await vote.POST(post('/api/proposals/vote', { proposalId: PROPOSAL_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, voted: true, voteCount: 4 });
    expect(callsTo('recipe_proposals', 'update')[0].payload).toEqual({ vote_count: 4 });
  });

  it('fails the request rather than guessing when the vote read fails', async () => {
    db.answer = (call, terminal) =>
      terminal === 'maybe' ? { data: null, error: { message: 'x' } } : undefined;
    const res = await vote.POST(post('/api/proposals/vote', { proposalId: PROPOSAL_ID }));
    expect(res.status).toBe(500);
    expect(db.calls.filter((c) => c.op !== 'select')).toHaveLength(0);
  });
});

describe('the write handlers', () => {
  it.each([
    'src/app/api/comments/route.ts',
    'src/app/api/community-photos/route.ts',
    'src/app/api/proposals/route.ts',
    'src/app/api/proposals/vote/route.ts',
  ])('%s has no offline branch after requireUser, which returns null offline', (path) => {
    /* `requireUser` answers null without control config, so every POST 401s
       before an offline branch could run. Those branches were dead code that
       read as a supported mode. */
    const source = readFileSync(path, 'utf8');
    const post = source.slice(source.indexOf('export async function POST'));
    expect(post).not.toContain('hasControlConfig');
  });
});
