import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as COLUMN_LISTS from '@/lib/community/columns';
import { toModeratedPhoto } from '@/lib/community/moderation';

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

/**
 * Photo moderation is behind `adminGate()`, not public — but it reads on the
 * service role, which RLS and the column grant do not bind. Every column of
 * `community_photos` is readable there, `submitted_by` included, so the column
 * list and the mapper are the whole boundary between an address and the
 * browser.
 */
describe('the photo moderation route', () => {
  const source = readFileSync('src/app/api/admin/community-photos/route.ts', 'utf8');
  /* Comments out, so a sentence that mentions `.select()` is not a call. */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  /* Two shared lists: the rows it lists and answers with, and the two
     columns the PATCH reads before showing a hidden photo (whose recipe, and
     whether it is hidden) to check the cap. Both from `community/columns`. */
  const LISTS = ['MODERATION_PHOTO_COLUMNS', 'MODERATION_TARGET_COLUMNS'] as const;

  it('selects only the shared moderation lists', () => {
    expect(code).not.toMatch(/\.select\(\s*['"`]\*['"`]\s*\)/);
    const selects = [...code.matchAll(/\.select\(\s*([^)]*)\)/g)].map((m) => m[1].trim());
    expect(selects.length).toBeGreaterThan(0);
    for (const s of selects) expect(LISTS as readonly string[]).toContain(s);
    for (const list of LISTS) {
      expect(source).toMatch(new RegExp(`import \\{[^}]*\\b${list}\\b[^}]*\\} from '@/lib/community/columns'`));
    }
  });

  it.each(LISTS)('names no address and no wildcard in %s', (list) => {
    const columns = COLUMN_LISTS[list].split(',').map((c) => c.trim());
    expect(columns).not.toContain('*');
    for (const column of columns) expect(column).not.toMatch(/email|submitted_by|updated_by/);
  });

  it('sends five named fields, whatever the row held', () => {
    const row = {
      id: '6f1c1d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f',
      image_url: 'https://cdn.example.com/a.jpg',
      author_name: 'Reader',
      approved: false,
      created_at: '2026-10-20T09:00:00.000Z',
      submitted_by: 'reader@gmail.com',
      author_email: 'reader@gmail.com',
    };
    const sent = toModeratedPhoto(row);
    expect(Object.keys(sent).sort()).toEqual(['approved', 'authorName', 'createdAt', 'id', 'imageUrl']);
    expect(JSON.stringify(sent)).not.toContain('@');
    expect(source).toMatch(/rows\.map\(toModeratedPhoto\)/);
  });
});
