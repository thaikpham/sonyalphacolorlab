import { readFileSync } from 'node:fs';
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

const ADMIN_ROUTES = [
  'src/app/api/admin/session/route.ts',
  'src/app/api/admin/products/route.ts',
  'src/app/api/admin/products/[id]/route.ts',
  'src/app/api/admin/translate/route.ts',
];

const WRITE_ROUTES = ADMIN_ROUTES.filter((p) => !p.endsWith('session/route.ts'));

describe.each(ADMIN_ROUTES)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('calls requireAdmin on the request', () => {
    expect(source).toMatch(/requireAdmin\(\s*request\s*\)/);
  });
});

describe.each(WRITE_ROUTES)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('refuses a non-admin before doing any work', () => {
    expect(source).toMatch(/if\s*\(\s*!admin\s*\)\s*return/);
    expect(source).toMatch(/status:\s*403/);
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
      expect(source).toMatch(/updated_by:\s*admin\.email/);
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

  it('is only ever read with the service-role client', () => {
    const guard = readFileSync('src/lib/auth/require-admin.ts', 'utf8');
    expect(guard).toMatch(/supabaseAdmin\(\)[\s\S]{0,80}admin_emails/);
    expect(guard).not.toMatch(/supabaseRead\(\)/);
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
