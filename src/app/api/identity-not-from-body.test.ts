import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every community write path must take the author from a verified session.
 *
 * They used to destructure `authorName` / `authorEmail` / `userEmail` out of
 * the JSON body and insert them as-is. Nothing checked them, so an unauthenticated
 * `curl` could post a comment under any name — verified by doing exactly that —
 * and the `unique (proposal_id, user_email)` constraint on votes meant nothing,
 * because a fresh invented address bought a fresh vote.
 *
 * These are source assertions rather than request tests: the routes need a live
 * Supabase to run, and what has to hold is a property of the code — that the
 * identity fields are simply not read from the payload any more.
 */

const WRITE_ROUTES = [
  'src/app/api/comments/route.ts',
  'src/app/api/community-photos/route.ts',
  'src/app/api/proposals/route.ts',
  'src/app/api/proposals/vote/route.ts',
];

describe.each(WRITE_ROUTES)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('rejects unauthenticated callers', () => {
    // Either parameter name — community-photos calls its argument `req`.
    expect(source).toMatch(/requireUser\(\s*req(uest)?\s*\)/);
    expect(source).toMatch(/status:\s*401/);
  });

  it('never destructures an identity field out of the request body', () => {
    // Catches the exact regression: `const { …, authorEmail, … } = body`.
    const destructured = source.match(/const\s*\{[^}]*\}\s*=\s*body\s*;/g) ?? [];
    for (const d of destructured) {
      expect(d).not.toMatch(/\bauthorName\b/);
      expect(d).not.toMatch(/\bauthorEmail\b/);
      expect(d).not.toMatch(/\buserEmail\b/);
    }
  });

  it('writes the author columns from the verified user', () => {
    if (!source.includes('author_email:')) return; // vote route stores no author
    expect(source).toContain('author_email: user.email');
    expect(source).toContain('author_name: user.name');
  });

  it('rate limits the endpoint', () => {
    expect(source).toContain('checkRateLimit');
    expect(source).toMatch(/status:\s*429/);
  });
});

describe('community photos POST', () => {
  const source = readFileSync('src/app/api/community-photos/route.ts', 'utf8');

  it('does not accept a contributor name in the payload', () => {
    /* This route had no session check at all: anyone could POST a photo URL
       onto any recipe and credit it to any name, and the rate limit keyed on
       `x-forwarded-for`, which the caller sets. The credit is the session's
       name now, so the schema must not offer a field to override it. */
    expect(source).not.toMatch(/authorName:\s*z\./);
    expect(source).not.toContain('body.authorName');
    expect(source).toContain('author_name: user.name');
  });

  it('rate limits per verified address, not per client-supplied header', () => {
    expect(source).toMatch(/checkRateLimit\(`photos:\$\{user\.email\}`\)/);
  });

  it('keeps an email out of the ungranted submitted_by column', () => {
    /* community_photos has no column-level grant — unlike recipe_comments and
       recipe_proposals in 0004 — so RLS alone leaves every column readable by
       anon. An email here would be a fresh leak, not a stored secret. */
    expect(source).not.toMatch(/submitted_by:\s*user\.email/);
    expect(source).toContain('submitted_by: clientKey(req)');
  });
});

describe('proposals GET', () => {
  const source = readFileSync('src/app/api/proposals/route.ts', 'utf8');

  it('resolves the viewer from the session, not a query parameter', () => {
    // An address in a query string is copied into every access log, and could
    // be set to somebody else's to learn how they voted.
    expect(source).not.toMatch(/searchParams\.get\(\s*['"`]viewer['"`]\s*\)/);
    expect(source).toContain('await requireUser(request))?.email');
  });
});

describe('auth context', () => {
  const source = readFileSync('src/components/auth-context.tsx', 'utf8');

  it('uses real Google OAuth rather than a typed-in address', () => {
    expect(source).toContain("signInWithOAuth");
    expect(source).toContain("provider: 'google'");
  });

  it('keeps no self-asserted identity in local storage', () => {
    // The stub persisted a hand-typed profile and treated it as proof of who
    // you were. The session is now the only source. Matched on real calls, not
    // the word — the file's own history comment mentions it.
    expect(source).not.toMatch(/localStorage\.(get|set|remove)Item/);
  });
});
