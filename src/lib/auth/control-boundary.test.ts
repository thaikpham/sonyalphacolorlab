import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adminGate } from './admin-gate';
import { requireAdmin } from './require-admin';
import { requireUser } from './require-user';
import { ControlUnavailableError } from '@/lib/supabase/errors';

/**
 * Identity belongs to the control plane, and only to the control plane.
 *
 * After the split there are two projects and four clients, and the expensive
 * mistake is subtle: authorising against the *content* project. It has no
 * `admin_emails` and no Auth, so `getUser` there returns nothing and every
 * administrator is locked out — or, if a table of that name is ever created in
 * it, a project with different RLS decides who may edit the catalogue. Neither
 * failure is visible in a type.
 *
 * The second thing pinned here is the difference between "not allowed" and
 * "cannot tell". The old guard collapsed them: any thrown error fell through to
 * a hard-coded list of four addresses, so a restricted project — the exact
 * state this project was in on 2026-09-11 — silently promoted a bypass into the
 * live authorisation path. A 402 must fail closed and say 503, not fail open.
 */

const USER = {
  id: 'user-1',
  email: 'Editor@Example.com',
  user_metadata: { full_name: 'An Editor', avatar_url: 'https://cdn.example.com/a.png' },
};

type Result<T> = { data: T; error: unknown };

const state = {
  online: true,
  getUser: async (): Promise<Result<{ user: typeof USER | null }>> => ({
    data: { user: USER },
    error: null,
  }),
  adminRow: async (): Promise<Result<{ email: string; role: string } | null>> => ({
    data: { email: 'editor@example.com', role: 'di' },
    error: null,
  }),
  /* No enrolled factor by default, which is where every account starts. The
     tests that care about the ratchet set one. */
  factors: async (): Promise<Result<{ factors: { status: string }[] }>> => ({
    data: { factors: [] },
    error: null,
  }),
};

function refuse(): never {
  throw new Error('the content plane must never take part in authorization');
}

vi.mock('@/lib/supabase/server', () => ({
  hasControlConfig: () => state.online,
  hasContentConfig: () => state.online,
  controlAdmin: () => ({
    auth: {
      getUser: () => state.getUser(),
      admin: { mfa: { listFactors: () => state.factors() } },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => state.adminRow() }) }),
    }),
  }),
  controlRead: () => {
    throw new Error('admin_emails is revoked from anon; controlRead cannot read it');
  },
  contentRead: refuse,
  contentAdmin: refuse,
}));

const bearer = (token = 'jwt') =>
  new Request('https://example.test/api/admin/products', {
    headers: { authorization: `Bearer ${token}` },
  });

beforeEach(() => {
  state.online = true;
  state.getUser = async () => ({ data: { user: USER }, error: null });
  state.adminRow = async () => ({ data: { email: 'editor@example.com', role: 'di' }, error: null });
  state.factors = async () => ({ data: { factors: [] }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('requireUser', () => {
  it('resolves the caller from the verified token', async () => {
    await expect(requireUser(bearer())).resolves.toMatchObject({
      email: 'Editor@Example.com',
      name: 'An Editor',
    });
  });

  it('returns null without a bearer header, which is an anonymous request', async () => {
    await expect(requireUser(new Request('https://example.test/x'))).resolves.toBeNull();
  });

  it.each([400, 401, 403])('returns null on %i, which means the credential is bad', async (status) => {
    state.getUser = async () => ({ data: { user: null }, error: { status, message: 'bad jwt' } });
    await expect(requireUser(bearer())).resolves.toBeNull();
  });

  it.each([402, 429, 500, 503])(
    'throws ControlUnavailableError on %i, which says nothing about the credential',
    async (status) => {
      state.getUser = async () => ({
        data: { user: null },
        error: { status, message: 'exceed_cached_egress_quota' },
      });
      await expect(requireUser(bearer())).rejects.toBeInstanceOf(ControlUnavailableError);
    },
  );

  it('throws ControlUnavailableError when the transport itself fails', async () => {
    state.getUser = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(requireUser(bearer())).rejects.toBeInstanceOf(ControlUnavailableError);
  });

  it('throws ControlUnavailableError on a malformed gateway answer', async () => {
    /* A restricted project answers `402` with an HTML or JSON error document.
       If a proxy turns that into a 200 with no user and no error, treating it
       as "signed out" would sign every reader out mid-session. */
    state.getUser = async () => ({ data: { user: null }, error: null });
    await expect(requireUser(bearer())).rejects.toBeInstanceOf(ControlUnavailableError);
  });

  it('returns null offline, because seed mode has no sessions to verify', async () => {
    state.online = false;
    await expect(requireUser(bearer())).resolves.toBeNull();
  });
});

/** A token whose payload carries the given assurance level. */
const aalToken = (aal: 'aal1' | 'aal2') => {
  const seg = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${seg({ alg: 'HS256' })}.${seg({ aal, sub: 'user-1' })}.sig`;
};

describe('the second factor, once one exists', () => {
  it('is not demanded from an account that has not enrolled one', async () => {
    /* The ratchet must not bite before there is anything to bite with. This is
       the state every account starts in, and the state the operator is in while
       they are on the screen that enrols the factor — requiring aal2 here would
       lock the only administrator out of the only way back in. */
    state.factors = async () => ({ data: { factors: [] }, error: null });
    await expect(requireAdmin(bearer(aalToken('aal1')))).resolves.toMatchObject({ role: 'di' });
  });

  it('is not demanded while the enrolment is still half-finished', async () => {
    /* `mfa.enroll()` creates an `unverified` factor and it stays that way until
       a code is accepted. Counting it would strand an operator who closed the
       tab midway. */
    state.factors = async () => ({ data: { factors: [{ status: 'unverified' }] }, error: null });
    await expect(requireAdmin(bearer(aalToken('aal1')))).resolves.toMatchObject({ role: 'di' });
  });

  it('is demanded as soon as a verified factor exists', async () => {
    state.factors = async () => ({ data: { factors: [{ status: 'verified' }] }, error: null });
    await expect(requireAdmin(bearer(aalToken('aal1')))).rejects.toMatchObject({
      code: 'mfaRequired',
    });
  });

  it('lets a stepped-up session straight through', async () => {
    state.factors = async () => ({ data: { factors: [{ status: 'verified' }] }, error: null });
    await expect(requireAdmin(bearer(aalToken('aal2')))).resolves.toMatchObject({ role: 'di' });
  });

  it('does not ask about factors at all when the session is already aal2', async () => {
    /* The common path after enrolment. One fewer control round trip per admin
       request, and the assertion is here so an edit that reorders the `&&`
       shows up as a test failure rather than as latency. */
    let asked = false;
    state.factors = async () => {
      asked = true;
      return { data: { factors: [] }, error: null };
    };
    await requireAdmin(bearer(aalToken('aal2')));
    expect(asked).toBe(false);
  });

  it('refuses rather than waving through when the factor list cannot be read', async () => {
    /* Answering "no factor" on an error would silently disable the second
       factor for the length of an outage — the exact shape of the 2026-09-11
       bypass, where an unreachable allowlist became a hard-coded one. */
    state.factors = async () => ({ data: { factors: [] }, error: { message: 'boom' } });
    await expect(requireAdmin(bearer(aalToken('aal1')))).rejects.toMatchObject({
      name: 'ControlUnavailableError',
    });
  });

  it('never treats an unreadable assurance claim as elevated', async () => {
    /* A token whose payload will not decode has not proved a second factor. */
    state.factors = async () => ({ data: { factors: [{ status: 'verified' }] }, error: null });
    await expect(requireAdmin(bearer('not-a-jwt'))).rejects.toMatchObject({
      code: 'mfaRequired',
    });
  });
});

describe('requireAdmin', () => {
  it('returns the role from admin_emails', async () => {
    await expect(requireAdmin(bearer())).resolves.toMatchObject({
      email: 'Editor@Example.com',
      role: 'di',
    });
  });

  it('returns null for a valid user who is not on the list', async () => {
    state.adminRow = async () => ({ data: null, error: null });
    await expect(requireAdmin(bearer())).resolves.toBeNull();
  });

  it('throws ControlUnavailableError when the allowlist query fails', async () => {
    /* This is the case the deleted hard-coded fallback used to swallow. An
       unreachable allowlist is not evidence that anybody is an administrator. */
    state.adminRow = async () => ({ data: null, error: { status: 402, message: 'restricted' } });
    await expect(requireAdmin(bearer())).rejects.toBeInstanceOf(ControlUnavailableError);
  });

  it('propagates a control outage raised while verifying the token', async () => {
    state.getUser = async () => ({ data: { user: null }, error: { status: 500, message: 'x' } });
    await expect(requireAdmin(bearer())).rejects.toBeInstanceOf(ControlUnavailableError);
  });

  it('grants the explicit local super-admin only when offline and in development', async () => {
    state.online = false;
    vi.stubEnv('NODE_ENV', 'development');
    await expect(requireAdmin(bearer())).resolves.toMatchObject({ role: 'super' });
  });

  it('grants nobody when offline outside development', async () => {
    state.online = false;
    vi.stubEnv('NODE_ENV', 'production');
    await expect(requireAdmin(bearer())).resolves.toBeNull();
  });
});

describe('adminGate', () => {
  it('passes the admin through', async () => {
    const gate = await adminGate(bearer());
    expect(gate).toMatchObject({ ok: true, admin: { role: 'di' } });
  });

  it('answers 403 notAdmin for a signed-in non-admin', async () => {
    state.adminRow = async () => ({ data: null, error: null });
    expect(await adminGate(bearer())).toEqual({ ok: false, status: 403, error: 'notAdmin' });
  });

  it('answers the same 403 for an anonymous request, so the two are indistinguishable', async () => {
    /* "You are not signed in" and "you are signed in but not an admin" must
       read identically on the wire. The difference tells an attacker whether a
       stolen token is valid. */
    expect(await adminGate(new Request('https://example.test/x'))).toEqual({
      ok: false,
      status: 403,
      error: 'notAdmin',
    });
  });

  it('answers 503 controlUnavailable on an outage, without the upstream message', async () => {
    state.adminRow = async () => ({
      data: null,
      error: { status: 402, message: 'exceed_cached_egress_quota' },
    });
    const gate = await adminGate(bearer());
    expect(gate).toEqual({ ok: false, status: 503, error: 'controlUnavailable' });
    expect(JSON.stringify(gate)).not.toContain('egress');
  });
});

describe('source of the guards', () => {
  const requireUserSource = readFileSync('src/lib/auth/require-user.ts', 'utf8');
  const requireAdminSource = readFileSync('src/lib/auth/require-admin.ts', 'utf8');

  it('verifies tokens with the control plane secret client', () => {
    expect(requireUserSource).toContain('controlAdmin().auth.getUser');
  });

  it('reads the allowlist with the control plane secret client', () => {
    expect(requireAdminSource).toMatch(/controlAdmin\(\)[\s\S]{0,40}\.from\('admin_emails'\)/);
  });

  it.each([
    ['require-user.ts', () => requireUserSource],
    ['require-admin.ts', () => requireAdminSource],
  ])('%s never touches the content plane', (_label, read) => {
    expect(read()).not.toContain('contentAdmin');
    expect(read()).not.toContain('contentRead');
  });

  it('has no hard-coded administrator list left', () => {
    /* Four production addresses compiled into the bundle, reachable whenever a
       query threw. It outlived the outage it was added for. */
    expect(requireAdminSource).not.toContain('HARDCODED_ADMINS');
    expect(requireAdminSource).not.toMatch(/@gmail\.com/);
  });
});
