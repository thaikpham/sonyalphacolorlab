import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * What the admin department does with `/api/admin/session`.
 *
 * `adminGate()` was written so that "cannot verify" is 503 and never 403, and
 * `session/route.ts` carries that distinction over the wire: an outage answers
 * 503, a stranger answers 200 with `isAdmin: false`. Both admin clients then
 * threw the distinction away — each read `data.isAdmin` straight off the body
 * without looking at `res.status`, and a 503 body carries `isAdmin: false`
 * too. So a restricted control project rendered "you are not an admin" to an
 * administrator whose access had not changed, which is the exact conflation
 * `src/lib/auth/admin-gate.ts` exists to prevent — undone one layer up.
 *
 * This file used to assert the same shape against both editors. It asserts it
 * against one module now, which is the point of the move: the probe is written
 * once, above the screens, so there is one place for it to be wrong and one
 * place to fix it. The second half of the test is what keeps it that way.
 *
 * Source assertions rather than a mounted render: the property that matters is
 * that the status is consulted before the body decides what the screen says.
 */

const SESSION = 'src/components/admin-ui/session.tsx';
const SHELL = 'src/components/admin-ui/shell.tsx';

/** Every client component that may render an admin screen. */
const ADMIN_CLIENTS = [
  'src/components/admin/admin-editor.tsx',
  'src/components/lab/admin/article-admin.tsx',
  SHELL,
];

describe(SESSION, () => {
  const source = readFileSync(SESSION, 'utf8');

  it('reads the session status before the session body', () => {
    const probe = source.indexOf("fetch('/api/admin/session'");
    expect(probe, 'the provider no longer probes /api/admin/session').toBeGreaterThan(-1);

    const status = source.indexOf('res.status === 503', probe);
    const body = source.indexOf('data.isAdmin', probe);

    expect(status, 'a 503 from the session route is not handled').toBeGreaterThan(-1);
    expect(body, 'the provider no longer reads isAdmin').toBeGreaterThan(-1);
    expect(status, 'isAdmin is read before the 503 check').toBeLessThan(body);
  });

  it('treats an unreachable gate as unverifiable, not as a refusal', () => {
    /* The `catch` is the same case as the 503: a fetch that never resolves
       tells us nothing about the caller's rights. Falling to a denial there
       was the second half of the same bug. */
    expect(source).toMatch(/catch\s*{\s*if\s*\(live\)\s*setGate\('unavailable'\)/);
    expect(source).not.toMatch(/catch\s*{\s*if\s*\(live\)\s*setGate\('denied'\)/);
  });

  it('carries three outcomes, not a boolean', () => {
    expect(source).toMatch(/'checking'\s*\|\s*'admin'\s*\|\s*'denied'\s*\|\s*'unavailable'/);
  });

  it('refuses to answer outside its provider', () => {
    /* A default here would be `checking` forever, or worse `admin` — a screen
       that renders its controls to nobody in particular. */
    expect(source).toMatch(/if \(!ctx\) throw new Error/);
  });
});

describe(SHELL, () => {
  const source = readFileSync(SHELL, 'utf8');

  it('keeps a screen of its own for each of the gate’s four answers', () => {
    /* Distinct copy per state, not one panel reworded: "we cannot check", "you
       are not an admin" and "enter your code" have different causes and
       different things for the reader to do. */
    expect(source).toMatch(/gate === 'checking'/);
    expect(source).toMatch(/gate === 'unavailable'/);
    expect(source).toMatch(/gate === 'denied'/);
    expect(source).toMatch(/gate === 'mfaRequired'/);
    expect(source).toMatch(/gateDownTitle/);
    expect(source).toMatch(/notAdminTitle/);
    expect(source).toMatch(/<StepUp/);
  });

  it('splits a refusal into "sign in" and "not on the list" using its own session', () => {
    /* The server answers one 403 for both, on purpose. The client holds its own
       session and discloses nothing by reading it — and without the split, a
       reader who signed in to leave a comment and then typed /admin is handed a
       login form they have already used, forever. */
    expect(source).toMatch(/useAuth\(\)/);
    expect(source).toMatch(/user \? \(/);
    expect(source).toMatch(/<AdminSignIn/);
    /* And the restore window is its own state, or a signed-in admin's screen
       flickers through a login prompt on every load. */
    expect(source).toMatch(/!isReady/);
  });
});

describe.each(ADMIN_CLIENTS)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('does not grow a second session probe', () => {
    /* The duplication this module removed, asserted gone. Two copies of a
       security-shaped probe is two chances to get it wrong, and they did. */
    if (path === SHELL) return;
    expect(source).not.toContain("fetch('/api/admin/session'");
  });

  it('does not hand-build a bearer header', () => {
    /* Eleven scattered `Authorization: Bearer ${accessToken()}` call sites are
       eleven places an auth-transport change has to find. The session owns the
       header; screens ask it for one. */
    expect(source).not.toMatch(/Authorization: `Bearer \$\{/);
  });
});
