import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Source assertions on the trust boundary itself.
 *
 * A secret key that reaches the browser bundle is not a bug you find in review
 * six months later — it is a published credential with RLS bypass on a whole
 * project. The two ways it gets there are both mechanical: someone imports
 * `server.ts` from a module that a `'use client'` file also imports, or someone
 * reaches for `process.env.*_SECRET_KEY` inside `browser.ts` while debugging.
 * Neither shows up as a type error and neither fails at runtime in development,
 * where `process.env` is fully populated on the server that renders the page.
 *
 * So they are pinned here, at the level the property actually lives: the text
 * of the file. Task 13 widens this to the built bundle; this is the fast check
 * that runs on every commit.
 */

const SECRET_VARS = ['AUTH_SUPABASE_SECRET_KEY', 'CONTENT_SUPABASE_SECRET_KEY'];

describe('src/lib/supabase/browser.ts', () => {
  const source = readFileSync('src/lib/supabase/browser.ts', 'utf8');

  it.each(SECRET_VARS)('never names %s', (name) => {
    expect(source).not.toContain(name);
  });

  it('reads only the control plane, so a content outage cannot break sign-in', () => {
    expect(source).toContain('NEXT_PUBLIC_AUTH_SUPABASE_URL');
    expect(source).not.toContain('NEXT_PUBLIC_CONTENT_SUPABASE_URL');
  });

  it('does not import the server module, which would drag a secret into the bundle', () => {
    expect(source).not.toMatch(/from\s+['"].*supabase\/server['"]/);
  });

  it('has dropped the ambiguous single-project names entirely', () => {
    /* An alias is how the accident comes back: with `NEXT_PUBLIC_SUPABASE_URL`
       still readable, a merge that restores one call site silently repoints
       Auth at whichever project that variable happens to hold. */
    expect(source).not.toMatch(/NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)\b/);
  });
});

describe('src/lib/supabase/config.ts', () => {
  const source = readFileSync('src/lib/supabase/config.ts', 'utf8');

  it('stays importable from the browser, so it carries no server-only marker', () => {
    expect(source).not.toContain("'server-only'");
  });

  it('inspects presence rather than value, so no key can be logged from here', () => {
    expect(source).not.toMatch(/console\.(log|info|warn|error)/);
  });
});

describe('src/lib/supabase/server.ts', () => {
  const source = readFileSync('src/lib/supabase/server.ts', 'utf8');

  it('keeps the server-only marker that makes a client import a build error', () => {
    expect(source).toMatch(/^import 'server-only';/m);
  });

  it('exposes exactly the four plane-scoped factories', () => {
    for (const factory of ['controlRead', 'controlAdmin', 'contentRead', 'contentAdmin']) {
      expect(source).toMatch(new RegExp(`export function ${factory}\\(`));
    }
  });

  it('no longer exposes a factory that does not say which project it means', () => {
    expect(source).not.toMatch(/export function supabase(Read|Admin)\(/);
  });
});
