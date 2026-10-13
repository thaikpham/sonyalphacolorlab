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

  /* The proposals route names its columns once, in `PROPOSAL_COLUMNS`, and
     passes the constant to both `.select()` calls — so the literal-list check
     above sees only an identifier and would pass with `author_email` added to
     the constant. Resolve every identifier handed to `.select()` back to the
     string it is bound to, and check that instead. */
  it('does not expose the email column through a column constant', () => {
    const idents = [...source.matchAll(/\.select\(\s*([A-Z_][A-Z0-9_]*)\s*[,)]/g)].map((m) => m[1]);
    for (const ident of new Set(idents)) {
      const bound = new RegExp(`const ${ident}\\s*=\\s*(['"\`])([\\s\\S]*?)\\1`).exec(source);
      // An identifier this test cannot resolve is a list it cannot vouch for.
      expect(bound, `${ident} is not a string constant in ${path}`).not.toBeNull();
      expect(bound![2]).not.toContain('author_email');
      expect(bound![2]).not.toContain('*');
    }
  });
});

describe('the proposals column list', () => {
  const source = readFileSync('src/app/api/proposals/route.ts', 'utf8');

  it('is the list both selects read, and it leaves author_email out', () => {
    const list = /const PROPOSAL_COLUMNS\s*=\s*(['"`])([\s\S]*?)\1/.exec(source)?.[2];
    expect(list).toBeDefined();
    const columns = list!.split(',').map((c) => c.trim());
    expect(columns).not.toContain('author_email');
    expect(columns).toContain('author_name');
    expect(source.match(/\.select\(PROPOSAL_COLUMNS\)/g)).toHaveLength(2);
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
