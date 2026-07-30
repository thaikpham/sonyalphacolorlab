import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `/api/comments` and `/api/proposals` are public and unauthenticated: anyone
 * can fetch them for any slug, with no session.
 *
 * Both once selected `*` and mapped `author_email` straight into the response,
 * and the proposals route additionally returned `votedBy` — the full list of
 * every voter's address. So a plain GET enumerated the Google email address of
 * everyone who had ever commented or voted on a recipe.
 *
 * Emails are still stored (a comment has to be attributable) and still sent
 * inbound on POST. They must simply never come back out.
 */

const ROUTES = ['src/app/api/comments/route.ts', 'src/app/api/proposals/route.ts'];

describe.each(ROUTES)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('selects named columns rather than *', () => {
    // `select('*')` is how author_email got into the payload in the first place:
    // the leak needed no line mentioning email at all.
    expect(source).not.toMatch(/\.select\(\s*['"`]\*['"`]\s*\)/);
  });

  it('never returns an email column to the client', () => {
    const mapped = source.match(/authorEmail:\s*(row|data)\.author_email/g);
    expect(mapped).toBeNull();
  });

  it('does not expose the email column in any select list', () => {
    const selects = source.match(/\.select\([\s\S]{0,300}?\)/g) ?? [];
    for (const s of selects) expect(s).not.toContain('author_email');
  });
});

describe('proposals vote state', () => {
  const source = readFileSync('src/app/api/proposals/route.ts', 'utf8');

  it('reports only the requesting viewer’s vote, never the voter list', () => {
    expect(source).toContain('hasVoted');
    expect(source).not.toMatch(/votedBy:/);
    // Scoping the vote query to one address is what keeps it from being a dump.
    expect(source).toMatch(/\.eq\(\s*['"`]user_email['"`]\s*,\s*viewer\s*\)/);
  });
});
