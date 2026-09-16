import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * What every admin client does with `/api/admin/session`.
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
 * Source assertions rather than a mounted render: these are 700-1200 line
 * client components behind next-intl and an auth context, and the property
 * that matters is a property of the code — that the status is consulted before
 * the body decides what the screen says.
 *
 * When the three admin surfaces move behind one shared session hook, this list
 * becomes that one file and these assertions move with it.
 */

const ADMIN_CLIENTS = [
  'src/components/admin/admin-editor.tsx',
  'src/components/lab/admin/article-admin.tsx',
];

describe.each(ADMIN_CLIENTS)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('reads the session status before the session body', () => {
    const probe = source.indexOf("fetch('/api/admin/session'");
    expect(probe, 'the client no longer probes /api/admin/session').toBeGreaterThan(-1);

    const status = source.indexOf('res.status === 503', probe);
    const body = source.indexOf('data.isAdmin', probe);

    expect(status, 'a 503 from the session route is not handled').toBeGreaterThan(-1);
    expect(body, 'the client no longer reads isAdmin').toBeGreaterThan(-1);
    expect(status, 'isAdmin is read before the 503 check').toBeLessThan(body);
  });

  it('treats an unreachable gate as unverifiable, not as a refusal', () => {
    /* The `catch` is the same case as the 503: a fetch that never resolves
       tells us nothing about the caller's rights. Falling to `false` there was
       the second half of the same bug. */
    expect(source).not.toMatch(/catch\s*{\s*if\s*\(live\)\s*setIsAdmin\(false\)/);
    expect(source).toMatch(/catch\s*{\s*if\s*\(live\)\s*setGate\('unavailable'\)/);
  });

  it('keeps a screen of its own for the unverifiable case', () => {
    /* Distinct copy, not the not-an-admin panel reworded: the two states have
       different causes and different things for the reader to do. */
    expect(source).toMatch(/gate === 'unavailable'/);
    expect(source).toMatch(/gate === 'denied'/);
    expect(source).toMatch(/gateDownTitle/);
  });
});
