import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as COLUMN_LISTS from '@/lib/community/columns';

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

  /* Both routes name their columns once, in `community/columns.ts`, and pass
     the constant to both `.select()` calls — so the literal-list check above
     sees only an identifier and would pass with `author_email` added to the
     constant. Resolve every identifier handed to `.select()` back to the
     string it is bound to, and check that instead. */
  it('does not expose the email column through a column constant', () => {
    const idents = [...source.matchAll(/\.select\(\s*([A-Z_][A-Z0-9_]*)\s*[,)]/g)].map((m) => m[1]);
    expect(idents.length).toBeGreaterThan(0);
    for (const ident of new Set(idents)) {
      expect(source, `${ident} is not imported from community/columns`).toMatch(
        new RegExp(`import \\{[^}]*\\b${ident}\\b[^}]*\\} from '@/lib/community/columns'`),
      );
      // An identifier this test cannot resolve is a list it cannot vouch for.
      const bound = (COLUMN_LISTS as Record<string, unknown>)[ident];
      expect(typeof bound, `${ident} is not a string constant`).toBe('string');
      expect(bound).not.toContain('author_email');
      expect(bound).not.toContain('*');
    }
  });
});

describe('the proposals column list', () => {
  const source = readFileSync('src/app/api/proposals/route.ts', 'utf8');

  it('is the list both selects read, and it leaves author_email out', () => {
    const columns = COLUMN_LISTS.PROPOSAL_COLUMNS.split(',').map((c) => c.trim());
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
