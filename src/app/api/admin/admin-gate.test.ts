import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The admin routes are the only paths in the app that let a request rewrite
 * published catalogue data, so what they check is worth pinning in a test
 * rather than trusting to review.
 *
 * Source assertions, for the same reason `identity-not-from-body.test.ts` uses
 * them: the routes need a live Supabase to execute, and the properties that
 * matter are properties of the code — that the gate is called at all, that the
 * editor's address comes from the token, and that the allowlist is never
 * reachable with a key the browser holds.
 */

/**
 * Every route under /api/admin. The list is the test: a new admin route that
 * nobody adds here is a route nobody checks, and the article routes spent their
 * whole first draft outside this file.
 */
const ADMIN_ROUTES = [
  'src/app/api/admin/session/route.ts',
  'src/app/api/admin/products/route.ts',
  'src/app/api/admin/products/[id]/route.ts',
  'src/app/api/admin/translate/route.ts',
  'src/app/api/admin/articles/route.ts',
  'src/app/api/admin/articles/[id]/route.ts',
  'src/app/api/admin/articles/upload/route.ts',
  'src/app/api/admin/recipes/route.ts',
  'src/app/api/admin/recipes/[id]/route.ts',
  'src/app/api/admin/recipes/[id]/images/route.ts',
  'src/app/api/admin/recipes/[id]/images/[imageId]/route.ts',
];

const WRITE_ROUTES = ADMIN_ROUTES.filter((p) => !p.endsWith('session/route.ts'));

/**
 * The list above is hand-maintained, and this is what stops it going stale.
 *
 * "A new admin route that nobody adds here is a route nobody checks" was
 * already the rule, enforced by remembering — and the article routes spent
 * their whole first draft outside the list. The recipe routes were the second
 * set to be added by hand. Discovery makes the third set impossible to forget:
 * a route file under /api/admin that is not listed fails here, naming itself.
 */
function discoverAdminRoutes(dir = 'src/app/api/admin'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return discoverAdminRoutes(p);
    return e.name === 'route.ts' ? [p] : [];
  });
}

describe('the admin route inventory', () => {
  it('lists every route file under /api/admin', () => {
    const found = discoverAdminRoutes().sort();
    const listed = [...ADMIN_ROUTES].sort();
    expect(
      found.filter((p) => !listed.includes(p)),
      'these admin routes exist but are not in ADMIN_ROUTES, so nothing checks their gate',
    ).toEqual([]);
    expect(
      listed.filter((p) => !found.includes(p)),
      'these are listed in ADMIN_ROUTES but no longer exist',
    ).toEqual([]);
  });
});

/**
 * The work a request must not reach before it has been authorised.
 *
 * Body parsing is the cheap one to get wrong and the expensive one to leave
 * open: `request.formData()` on the upload route buffers megabytes from an
 * anonymous caller, and the Anthropic call on the translate route spends money.
 * Opening a content client before the gate is worse than wasteful — it puts a
 * service credential in the call stack of an unauthenticated request.
 */
const GUARDED_WORK = [
  /request\.json\(\)/,
  /request\.formData\(\)/,
  /contentAdmin\(\)/,
  /callAnthropic|translateFeatures\(/,
  /\.storage\b/,
];

describe.each(ADMIN_ROUTES)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('authorises through the one shared gate', () => {
    expect(source).toMatch(/adminGate\(\s*request\s*\)/);
    /* Not `requireAdmin` directly: that call has three outcomes now, and a
       route that writes `if (!admin)` around it turns a thrown control outage
       into an uncaught 500. */
    expect(source).not.toMatch(/requireAdmin\(\s*request\s*\)/);
  });

  it('maps a control outage to 503 rather than a 403 or an uncaught 500', () => {
    /* Either the route forwards the gate's own status, or — the session route —
       it names 503 explicitly. What it may not do is answer "not an admin" when
       the truth is "we could not ask". */
    expect(source).toMatch(/status:\s*gate\.status|status:\s*503/);
  });
});

describe.each(WRITE_ROUTES)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('refuses a non-admin before doing any work', () => {
    expect(source).toMatch(/if\s*\(\s*!gate\.ok\s*\)\s*return/);
    expect(source).toMatch(/status:\s*gate\.status/);
  });

  it('authorises before parsing a body, spending a model call, or opening a client', () => {
    /* Measured inside the handlers only. A module-level helper that opens a
       content client sits above every handler in the file and would make this
       read false while being true of every actual request. */
    const first = source.search(/export async function (GET|POST|PATCH|DELETE)\(/);
    const body = source.slice(first);
    const gateAt = body.search(/adminGate\(\s*request\s*\)/);
    expect(gateAt).toBeGreaterThan(-1);
    for (const work of GUARDED_WORK) {
      const at = body.search(work);
      if (at === -1) continue;
      expect(at).toBeGreaterThan(gateAt);
    }
  });

  it('never takes the editor identity from the body', () => {
    const destructured = source.match(/const\s*\{[^}]*\}\s*=\s*body\s*;/g) ?? [];
    for (const d of destructured) {
      expect(d).not.toMatch(/\bemail\b/);
      expect(d).not.toMatch(/\bupdatedBy\b/);
    }
    /* The stored editor must be the verified one. `updated_by: body.…` is the
       regression this catches. */
    if (source.includes('updated_by')) {
      expect(source).toMatch(/updated_by:\s*(gate\.)?admin\.email/);
    }
  });
});

describe('the product write route', () => {
  const source = readFileSync('src/app/api/admin/products/[id]/route.ts', 'utf8');

  it('takes the product id from the route, not the body', () => {
    expect(source).toMatch(/const\s*\{\s*id\s*\}\s*=\s*await\s+params/);
    expect(source).not.toMatch(/body\.id\b/);
  });

  /* `specsMissing` describes which values are absent. Accepting it from the
     client lets a stale editor mark a filled row as unpublished — the row then
     renders "not published" over a real value, which is the exact failure the
     null-versus-placeholder rule exists to prevent. */
  it('derives specsMissing instead of trusting the payload', () => {
    expect(source).toMatch(/out\.specsMissing\s*=/);
    expect(source).not.toMatch(/input\.specsMissing/);
  });

  it('strips the prose qualifiers the spec suite rejects', () => {
    expect(source).toMatch(/Xấp xỉ/);
  });
});

describe('admin_emails', () => {
  const sql = readFileSync('supabase/migrations/0009_admin_emails.sql', 'utf8');

  /* RLS is row-level and cannot hide a column: once a role may select from the
     table, it may read every address in it. The anon key ships in the browser
     bundle, so a grant here would publish the admin list. Same lesson as
     `no-email-leak.test.ts`. */
  it('is never granted to anon or authenticated', () => {
    expect(sql).toMatch(/revoke\s+all\s+on\s+table\s+admin_emails\s+from\s+anon,\s*authenticated/i);
    expect(sql).not.toMatch(/grant\s+[a-z ,()]*\s+on\s+table\s+admin_emails\s+to\s+(anon|authenticated)/i);
  });

  it('has row level security on', () => {
    expect(sql).toMatch(/alter\s+table\s+admin_emails\s+enable\s+row\s+level\s+security/i);
  });

  it('is only ever read with the control plane secret client', () => {
    /* Two properties in one place, because they fail together. The allowlist
       must be read with a credential the browser does not hold — an anon read
       would need a public grant on a table of administrator addresses. And it
       must be read from the CONTROL project: after the split, the content
       project has no `admin_emails` at all, so a content client here would
       authorise nobody, or worse, authorise everybody if a table of that name
       were ever created there. */
    const guard = readFileSync('src/lib/auth/require-admin.ts', 'utf8');
    expect(guard).toMatch(/controlAdmin\(\)[\s\S]{0,80}admin_emails/);
    expect(guard).not.toMatch(/controlRead\(\)/);
    expect(guard).not.toMatch(/content(Read|Admin)\(\)/);
  });

  it('folds case before comparing, so A@x.com is not a different admin', () => {
    const guard = readFileSync('src/lib/auth/require-admin.ts', 'utf8');
    expect(guard).toMatch(/user\.email\.toLowerCase\(\)/);
  });
});

describe('the catalogue read path', () => {
  const source = readFileSync('src/lib/cameras/data.ts', 'utf8');

  /* `updated_by` is an editor's email address and this query runs under the
     anon key. Naming the columns is what keeps it out of the response. */
  it('never selects * from sony_cameras', () => {
    expect(source).not.toMatch(/\.select\(\s*['"`]\s*\*/);
  });

  it('does not ask for updated_by in the column list', () => {
    /* Scoped to the argument of `.select(...)`, not the whole file — the
       comment above that call names the column precisely because it must stay
       out of it, and a file-wide match would fail on the explanation. */
    const selects = source.match(/\.select\(\s*[\s\S]*?\)/g) ?? [];
    expect(selects.length).toBeGreaterThan(0);
    for (const call of selects) expect(call).not.toMatch(/updated_by/);
  });
});
