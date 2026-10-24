import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MfaRequiredError, requireAdmin, type AdminUser } from '@/lib/auth/require-admin';
import { MODERATION_PHOTO_COLUMNS } from '@/lib/community/columns';
import { MODERATION_LIST_LIMIT } from '@/lib/community/moderation';
import { ControlUnavailableError } from '@/lib/supabase/errors';
import { routeHandlers } from '../route-handlers';

/**
 * Hiding a community photo, executed against a recording fake.
 *
 * The real `adminGate` runs over a stubbed `requireAdmin`, so each refusal is
 * the gate's own answer — the same 403 for a stranger and for a signed-in
 * non-admin, 503 for an allowlist that cannot be read — and not a status this
 * file assumed. The fake answers the way PostgREST would and records every
 * call, so a test can say which client was used, which columns were named, and
 * that a refused request reached no table at all.
 */

type Call = {
  client: 'controlAdmin';
  table: string;
  op: 'select' | 'update';
  columns?: string;
  payload?: Record<string, unknown>;
  filters: [string, unknown][];
  order?: [string, unknown];
  limit?: number;
};
type Result = { data: unknown; error: unknown };

const db = {
  calls: [] as Call[],
  answer: (_call: Call): Result | undefined => undefined,
};
const env = { control: true };

const SLUG = 'pp-048-soft-clean-portrait';
const ID = '6f1c1d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

/* What the service role can read: every column, the address-shaped ones too.
   The route must send back none of them. */
const ROWS = [
  {
    id: ID,
    image_url: 'https://cdn.example.com/new.jpg',
    author_name: 'Nguyễn Văn An',
    approved: false,
    created_at: '2026-10-20T09:00:00.000Z',
    submitted_by: 'reader@gmail.com',
    author_email: 'reader@gmail.com',
    author_social: 'https://example.com/me',
  },
  {
    id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    image_url: 'https://cdn.example.com/old.jpg',
    author_name: null,
    approved: true,
    created_at: '2026-10-01T09:00:00.000Z',
    submitted_by: '203.0.113.7',
  },
];

function client() {
  return {
    from(table: string) {
      let call: Call | null = null;
      const start = (op: Call['op'], extra: Partial<Call> = {}) => {
        call = { client: 'controlAdmin', table, op, filters: [], ...extra };
        db.calls.push(call);
      };
      const settle = (terminal: 'many' | 'maybe'): Promise<Result> => {
        const answered = db.answer(call!);
        if (answered) return Promise.resolve(answered);
        if (call!.op === 'update') {
          const row = ROWS.find((r) => call!.filters.some(([c, v]) => c === 'id' && v === r.id));
          return Promise.resolve({ data: row ? { ...row, ...call!.payload } : null, error: null });
        }
        return Promise.resolve({ data: terminal === 'many' ? ROWS : null, error: null });
      };
      const builder = {
        select(columns: string) {
          if (call) call.columns = columns;
          else start('select', { columns });
          return builder;
        },
        update(payload: Record<string, unknown>) {
          start('update', { payload });
          return builder;
        },
        eq(column: string, value: unknown) {
          call!.filters.push([column, value]);
          return builder;
        },
        in(column: string, values: unknown) {
          call!.filters.push([column, values]);
          return builder;
        },
        order(column: string, options: unknown) {
          call!.order = [column, options];
          return builder;
        },
        limit(n: number) {
          call!.limit = n;
          return builder;
        },
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
  hasContentConfig: () => true,
  controlAdmin: () => client(),
  controlRead: () => {
    throw new Error('the anon client cannot see a hidden photo, so it cannot moderate one');
  },
  contentRead: () => {
    throw new Error('community photos live on the control plane');
  },
  contentAdmin: () => {
    throw new Error('community photos live on the control plane');
  },
}));

vi.mock('@/lib/auth/require-admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/require-admin')>()),
  requireAdmin: vi.fn(),
}));

const route = await import('./route');

const admin = (role: AdminUser['role']): AdminUser => ({
  id: 'admin-1',
  email: 'editor@example.com',
  name: 'An Editor',
  avatarUrl: null,
  assuranceLevel: 'aal2',
  role,
});

const list = (slug: string | null = SLUG) =>
  new Request(`https://example.test/api/admin/community-photos${slug === null ? '' : `?slug=${slug}`}`, {
    headers: { authorization: 'Bearer jwt' },
  });

const patch = (body: unknown) =>
  new Request('https://example.test/api/admin/community-photos', {
    method: 'PATCH',
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  db.calls = [];
  db.answer = () => undefined;
  env.control = true;
  vi.mocked(requireAdmin).mockReset().mockResolvedValue(admin('super'));
});

describe('who may moderate', () => {
  it.each([
    ['GET', () => route.GET(list())],
    ['PATCH', () => route.PATCH(patch({ id: ID, approved: false }))],
  ] as const)('%s refuses a caller who is not an admin with 403, and touches no table', async (_verb, call) => {
    /* An unauthenticated request, a signed-in reader, and an admin_emails row
       whose role the code does not know all come back from `requireAdmin` as
       null — and must read identically on the wire. 403, never 401: telling
       "not signed in" from "not an admin" says whether a token is still good. */
    vi.mocked(requireAdmin).mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'notAdmin' });
    expect(db.calls).toEqual([]);
  });

  it('asks for the second factor instead of calling the account removed', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new MfaRequiredError('aal1'));
    const res = await route.PATCH(patch({ id: ID, approved: false }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'mfaRequired' });
    expect(db.calls).toEqual([]);
  });

  it('answers 503 when the allowlist cannot be read, not 403', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new ControlUnavailableError('admin_emails: 402'));
    const res = await route.GET(list());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'controlUnavailable' });
    expect(db.calls).toEqual([]);
  });

  it.each(['super', 'di', 'pe'] as const)('lets a %s editor moderate, as any role may edit a recipe', async (role) => {
    vi.mocked(requireAdmin).mockResolvedValue(admin(role));
    expect((await route.GET(list())).status).toBe(200);
    expect((await route.PATCH(patch({ id: ID, approved: false }))).status).toBe(200);
  });

  it('answers 503 notConfigured with no control project, after the gate', async () => {
    env.control = false;
    for (const res of [await route.GET(list()), await route.PATCH(patch({ id: ID, approved: true }))]) {
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'notConfigured' });
    }
    expect(db.calls).toEqual([]);
  });
});

describe('GET /api/admin/community-photos', () => {
  it('lists one recipe on the service role, hidden photos included, newest first', async () => {
    const res = await route.GET(list());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { photos: { id: string; approved: boolean }[] };
    expect(body.photos.map((p) => p.approved)).toEqual([false, true]);

    const [call] = db.calls;
    expect(db.calls).toHaveLength(1);
    expect(call).toMatchObject({ client: 'controlAdmin', table: 'community_photos', op: 'select' });
    expect(call.columns).toBe(MODERATION_PHOTO_COLUMNS);
    /* The slug and nothing else — an `approved` filter here would hide the
       rows this screen exists to show. Both its spellings: a photo sent while
       the planes disagreed on slugs is stored under the former one (S9). */
    expect(call.filters).toEqual([['recipe_slug', [SLUG, 'hue-silk']]]);
    expect(call.order).toEqual(['created_at', { ascending: false }]);
    expect(call.limit).toBe(MODERATION_LIST_LIMIT);
  });

  it('sends a credit name and never an address', async () => {
    const res = await route.GET(list());
    const text = await res.text();
    expect(text).not.toContain('@');
    expect(text).not.toMatch(/submitted_?by|author_?email|203\.0\.113/i);
    expect(JSON.parse(text).photos[0]).toEqual({
      id: ID,
      imageUrl: 'https://cdn.example.com/new.jpg',
      authorName: 'Nguyễn Văn An',
      approved: false,
      createdAt: '2026-10-20T09:00:00.000Z',
    });
  });

  it.each([null, '', 'Not A Slug', '../etc'])('answers 400 for the slug %j and reads nothing', async (slug) => {
    const res = await route.GET(list(slug === null ? null : encodeURIComponent(slug)));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'badRequest' });
    expect(db.calls).toEqual([]);
  });

  it('answers a failed read with 502 loadFailed, not an empty list', async () => {
    db.answer = () => ({ data: null, error: { message: 'boom' } });
    const res = await route.GET(list());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'loadFailed' });
  });
});

describe('PATCH /api/admin/community-photos', () => {
  it('sets approved on that one row and answers with the row as stored', async () => {
    const res = await route.PATCH(patch({ id: ID, approved: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      photo: {
        id: ID,
        imageUrl: 'https://cdn.example.com/new.jpg',
        authorName: 'Nguyễn Văn An',
        approved: true,
        createdAt: '2026-10-20T09:00:00.000Z',
      },
    });
    expect(JSON.stringify(body)).not.toContain('@');

    const [call] = db.calls;
    expect(db.calls).toHaveLength(1);
    expect(call).toMatchObject({ client: 'controlAdmin', table: 'community_photos', op: 'update' });
    expect(call.payload).toEqual({ approved: true });
    expect(call.filters).toEqual([['id', ID]]);
    expect(call.columns).toBe(MODERATION_PHOTO_COLUMNS);
  });

  it.each([
    ['not JSON', '{'],
    ['null', 'null'],
    ['an array', '[]'],
    ['no id', { approved: false }],
    ['no approved', { id: ID }],
    ['an id that is not a uuid', { id: 'photo-1', approved: false }],
    ['approved as a string', { id: ID, approved: 'false' }],
    ['approved as a number', { id: ID, approved: 0 }],
    ['a third key', { id: ID, approved: false, recipe_slug: SLUG }],
    ['a credit to rewrite', { id: ID, approved: true, author_name: 'Someone Else' }],
  ])('answers 400 for %s and writes nothing', async (_case, body) => {
    const res = await route.PATCH(patch(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'badRequest' });
    expect(db.calls).toEqual([]);
  });

  it('answers 404 for a photo that is not there', async () => {
    const res = await route.PATCH(patch({ id: '11111111-2222-4333-8444-555555555555', approved: false }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'notFound' });
  });

  it('answers a failed write with 502 saveFailed', async () => {
    db.answer = () => ({ data: null, error: { message: 'boom' } });
    const res = await route.PATCH(patch({ id: ID, approved: false }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'saveFailed' });
  });
});

describe('the route source', () => {
  const source = readFileSync('src/app/api/admin/community-photos/route.ts', 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('reaches community_photos only through the control service client', () => {
    expect(code).toMatch(/controlAdmin\(\)\s*\.from\('community_photos'\)/);
    expect(code).not.toMatch(/controlRead\(\)|contentAdmin\(\)|contentRead\(\)/);
  });

  it('names its columns, in both handlers, from the shared list', () => {
    expect(code).not.toMatch(/\.select\(\s*['"`]\s*\*/);
    for (const { verb, body } of routeHandlers(code)) {
      expect(body, verb).toMatch(/\.select\(MODERATION_PHOTO_COLUMNS\)/);
    }
    expect(MODERATION_PHOTO_COLUMNS.split(',').map((c) => c.trim())).toEqual([
      'id',
      'image_url',
      'author_name',
      'approved',
      'created_at',
    ]);
  });

  it('answers through the mapper, so an extra column cannot ride along', () => {
    expect(code).toMatch(/rows\.map\(toModeratedPhoto\)/);
    expect(code).toMatch(/photo: toModeratedPhoto\(/);
  });

  it('stays up during a content freeze, as community writes do', () => {
    /* The freeze holds still the content rows a cutover copies. A photo that
       must come down cannot wait for one to finish. */
    expect(code).not.toMatch(/contentAdminWritesFrozen/);
  });
});
