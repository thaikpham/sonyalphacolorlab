import { readdirSync, readFileSync } from 'node:fs';
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
const GATE = 'src/components/admin-ui/gate.tsx';

/**
 * Every client component that may render an admin screen — discovered, not
 * listed. The hand-kept list held four files and missed both recipe screens
 * of the time, which call `useAdminSession()` and fetch `/api/admin/recipes`;
 * `admin-gate.test.ts` discovers its routes for the same reason. A screen is
 * admin when it reads the session module or calls an admin route.
 */
function clientFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return clientFiles(p);
    if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) return [];
    return readFileSync(p, 'utf8').includes("'use client'") ? [p] : [];
  });
}

const ADMIN_CLIENTS = [
  ...new Set([
    ...clientFiles('src/components').filter((p) => {
      if (p === SESSION) return false;
      const src = readFileSync(p, 'utf8');
      return /from '(@\/components\/admin-ui|\.)\/session'/.test(src) || src.includes("'/api/admin");
    }),
    /* Not an admin screen any more, and listed so it cannot become one again
       behind the gate's back: it carried its own tokenless session probe and
       two bearer-less PATCH modals, so every edit it offered could only fail.
       /admin/wiki is the product editor. */
    'src/components/camera-compare-view.tsx',
  ]),
].sort();

describe('the admin client inventory', () => {
  it('finds every admin screen, the recipe editor included', () => {
    for (const p of [
      'src/components/admin/admin-editor.tsx',
      'src/components/lab/admin/use-article-editor.ts',
      'src/components/colorlab/admin/recipe-admin.tsx',
      SHELL,
      GATE,
    ]) {
      expect(ADMIN_CLIENTS).toContain(p);
    }
  });
});

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
    expect(source).toMatch(/catch\s*{\s*settle\('unavailable'\)/);
    expect(source).not.toMatch(/catch\s*{\s*settle\('denied'\)/);
  });

  it('probes once per identity, not once per token', () => {
    /* The session object changes on every hourly TOKEN_REFRESHED. Keyed on
       it, each refresh re-probed, and one failed re-probe swapped an open
       editor — and its unsaved draft — for the outage panel. */
    expect(source).toMatch(/\}, \[identity, nonce\]\);/);
    expect(source).not.toMatch(/\}, \[authed, nonce\]\);/);
  });

  it('shows an answer only to the identity it was given for', () => {
    /* A password sign-in fires SIGNED_IN before the new probe answers; the
       tokenless probe's `denied` then read as "not an admin" to the admin who
       had just typed the right password. */
    expect(source).toMatch(/probe\.for === identity \? probe\.gate : 'checking'/);
  });

  it('carries three outcomes, not a boolean', () => {
    expect(source).toMatch(/'checking'\s*\|\s*'admin'\s*\|\s*'denied'\s*\|\s*'unavailable'/);
  });

  it('refuses to answer outside its provider', () => {
    /* A default here would be `checking` forever, or worse `admin` — a screen
       that renders its controls to nobody in particular. */
    expect(source).toMatch(/if \(!ctx\) throw new Error/);
  });

  it('can leave a signed-out reader unprobed: always in production, and in development once there is an auth client', () => {
    /* A public page mounts the probe for every reader. A request per page view
       for somebody with no session would be a Function call that can only
       answer "no". Offline in development there is no auth client and the dev
       admin is found by probing, so there the skip needs an auth client to
       exist; in production the dev admin does not exist, so a `next start` in
       seed mode must skip too rather than probe every reader. */
    expect(source).toMatch(/probeSignedOut = true/);
    expect(source).toMatch(
      /!probeSignedOut &&\s+!identity &&\s+\(authBrowser\(\) !== null \|\| process\.env\.NODE_ENV === 'production'\)/,
    );
    const skip = source.indexOf('if (skipProbe())');
    const probe = source.indexOf("fetch('/api/admin/session'");
    expect(skip, 'no skip before the probe').toBeGreaterThan(-1);
    expect(skip).toBeLessThan(probe);
  });
});

describe(GATE, () => {
  const source = readFileSync(GATE, 'utf8');

  it('is what the shell renders its sections inside', () => {
    expect(readFileSync(SHELL, 'utf8')).toMatch(/<AdminGate>/);
  });

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

describe('src/components/admin-ui/sign-in.tsx', () => {
  const source = readFileSync('src/components/admin-ui/sign-in.tsx', 'utf8');

  it('leaves the code to StepUp instead of a second form of its own', () => {
    /* Its code stage could never render: SIGNED_IN re-probes the gate and the
       gate unmounts this form before `setStage('code')` runs, leaving an
       orphaned challenge behind. `AdminGate`'s StepUp (gate.tsx) is what asks
       for it — under the admin shell and on the edit routes alike. */
    expect(source).not.toMatch(/setStage\('code'\)/);
    expect(source).not.toMatch(/mfa\.challenge\(/);
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
