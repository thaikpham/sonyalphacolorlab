import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Which project each community route is allowed to touch.
 *
 * Community rows — comments, proposals, votes, photographs — stay on the
 * control plane, because they are about people: they carry author and voter
 * email addresses, and they are meaningless without the Auth users they belong
 * to. Recipes moved to the content plane. So a single POST now spans both
 * projects, and it does so in a fixed order: ask content whether the recipe
 * exists, then write to control.
 *
 * Getting the order wrong is not a style question. Writing first and checking
 * afterwards leaves an orphan row that no page renders and no foreign key will
 * ever catch, because after the split there *is* no foreign key — the two
 * tables are in different databases. Postgres cannot help here, so this test
 * does.
 *
 * Source assertions rather than request tests, for the same reason the sibling
 * files use them: these handlers need two live projects to execute, and what
 * has to hold is a property of the code.
 */

const ROUTES = {
  comments: 'src/app/api/comments/route.ts',
  photos: 'src/app/api/community-photos/route.ts',
  proposals: 'src/app/api/proposals/route.ts',
  vote: 'src/app/api/proposals/vote/route.ts',
} as const;

const sources = Object.fromEntries(
  Object.entries(ROUTES).map(([name, path]) => [name, readFileSync(path, 'utf8')]),
) as Record<keyof typeof ROUTES, string>;

/** The three routes whose row references a recipe by slug. */
const SLUG_ROUTES = ['comments', 'photos', 'proposals'] as const;

describe.each(Object.entries(ROUTES))('%s', (name, path) => {
  const source = sources[name as keyof typeof ROUTES];

  it('never writes community data with a content credential', () => {
    /* `contentAdmin()` bypasses RLS on the *other* project. A community write
       reaching it would either fail on a table that does not exist there or,
       worse, succeed against a stray one. */
    expect(source).not.toContain('contentAdmin');
  });

  it('never reads operational rows through the content anon client', () => {
    expect(source).not.toMatch(/contentRead\(\)/);
  });

  it('keeps its writes on the control plane', () => {
    if (name === 'photos' || name === 'vote' || source.includes('.insert(')) {
      expect(source).toContain('controlAdmin()');
    }
  });

  it(`answers 503 rather than 500 when a plane is unreachable (${path})`, () => {
    expect(source).toContain('outageErrorCode');
    expect(source).toMatch(/COMMUNITY_ERRORS\[outage\]/);
  });
});

describe.each(SLUG_ROUTES)('%s', (name) => {
  const source = sources[name];

  it('confirms the recipe against the content plane', () => {
    expect(source).toContain('publishedRecipeExists');
  });

  it('confirms it before the control write, not after', () => {
    const check = source.indexOf('publishedRecipeExists');
    const insert = source.search(/\.insert\(/);
    expect(check).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(check).toBeLessThan(insert);
  });

  it('distinguishes an unknown slug from an unreachable content project', () => {
    /* 404 says the recipe is gone; 503 says we could not ask. Collapsing them
       would tell every reader that every recipe had been deleted for as long as
       the content project was restricted. */
    expect(source).toMatch(/communityErrorBody\('recipeNotFound'\)/);
    expect(source).toMatch(/communityErrorBody\(outage\)/);
  });
});

describe('the vote route', () => {
  const source = sources.vote;

  it('does not consult the content plane at all', () => {
    /* `proposal_votes` references `recipe_proposals` with a real foreign key,
       and both are on the control plane. A content lookup here would make every
       heart depend on the other project being up, for a constraint Postgres is
       already enforcing. */
    expect(source).not.toContain('publishedRecipeExists');
  });

  it('resolves vote state with the secret client, because the table is all emails', () => {
    expect(source).toMatch(/controlAdmin\(\)[\s\S]{0,900}proposal_votes/);
  });

  it('checks the result of every write, not just the last one', () => {
    /* All four calls here once discarded their `error`, so the route answered
       `{ ok: true, voted: true }` whether or not a vote had been stored — a
       heart that filled in, came back empty after a refresh, and left nothing
       in any log. The read was the subtlest: a failed `select` gave `null`,
       which reads as "has not voted" and sent the handler into the insert
       branch, straight at the unique constraint it was meant to respect. */
    const destructuredWrites = [...source.matchAll(/await db\s*\n?\s*\.from\(/g)];
    expect(destructuredWrites.length).toBeGreaterThan(0);
    for (const name of ['existing.error', 'write.error', 'tally.error', 'counter.error']) {
      expect(source).toContain(name);
    }
  });

  it('never discards a Supabase result on the write path', () => {
    /* `await db.from(...)...;` as a statement is a discarded result. Every call
       in this route has to be bound and checked. */
    expect(source).not.toMatch(/^\s+await db\.from\(/m);
  });
});

describe('the proposals read', () => {
  const source = sources.proposals;

  it('reads the public list through the control anon client', () => {
    expect(source).toMatch(/controlRead\(\)[\s\S]{0,200}recipe_proposals/);
  });

  it('survives a control outage while resolving the viewer', () => {
    /* `requireUser` throws on an outage now. Before the try/catch, that escaped
       a public GET as an uncaught 500 — a signed-out reader could not see the
       proposal list because somebody else's session could not be checked. */
    expect(source).toMatch(/try\s*\{\s*\n\s*viewer = \(await requireUser\(request\)\)/);
  });
});

describe('the existence helper', () => {
  const source = readFileSync('src/lib/recipes/existence.ts', 'utf8');

  it('asks the content plane with the anon client, not a service credential', () => {
    expect(source).toContain('contentRead()');
    expect(source).not.toContain('contentAdmin');
  });
});
