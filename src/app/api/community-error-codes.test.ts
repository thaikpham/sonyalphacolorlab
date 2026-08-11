import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMMUNITY_ERRORS } from '@/lib/community/errors';

/**
 * The community routes answer with a **code**, never a sentence.
 *
 * Every one of these used to be a Vietnamese literal written straight into the
 * route — `'Bạn đang gửi quá nhanh. Thử lại sau ít phút.'` and friends — with a
 * few English ones mixed in. That breaks Rule 3: a user-visible string belongs
 * in `messages/*.json`, because a literal in code renders untranslated to half
 * the readers and nothing errors when it does. `recipe-gallery.tsx` put those
 * bodies straight on screen, so an English visitor who hit the rate limit got a
 * sentence in a language they may not read.
 *
 * `errors.ts` and the `community.errors.*` catalogue keys were both added to fix
 * that, and then never wired to the routes — the module sat unreferenced until
 * something tried to delete it as dead code. These assertions are what make the
 * wiring load-bearing, so it cannot quietly come apart again.
 *
 * Source assertions rather than request tests: the routes need a live Supabase
 * to run, and what has to hold is a property of the code.
 */

const ROUTES = [
  'src/app/api/comments/route.ts',
  'src/app/api/community-photos/route.ts',
  'src/app/api/proposals/route.ts',
  'src/app/api/proposals/vote/route.ts',
];

/** `error:` values that are a quoted string rather than a code helper call. */
function proseErrorBodies(source: string): string[] {
  return [...source.matchAll(/\berror:\s*(['"`])(.*?)\1/g)].map((m) => m[2]);
}

describe.each(ROUTES)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('builds every error body from communityErrorBody()', () => {
    expect(source).toContain("from '@/lib/community/errors'");
    expect(source).toMatch(/communityErrorBody\('/);
  });

  it('never writes a prose error message into a response', () => {
    // Catches both spellings of the regression: a Vietnamese sentence, and an
    // English one that only looks harmless because the reviewer reads English.
    expect(proseErrorBodies(source)).toEqual([]);
  });

  it('names only codes the catalogue defines', () => {
    const used = [...source.matchAll(/communityErrorBody\('([^']+)'\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const code of used) {
      expect(Object.keys(COMMUNITY_ERRORS), `${path} returns an unknown code "${code}"`).toContain(
        code,
      );
    }
  });

  it('answers each code with the status the catalogue assigns it', () => {
    /* The status stays a literal at the call site — `identity-not-from-body`
       greps for `status: 401` and `status: 429` — so this is what stops the two
       from drifting apart. Same defence-in-depth shape as sql-drift.test.ts. */
    for (const [, code, status] of source.matchAll(
      /communityErrorBody\('([^']+)'\),\s*(?:\{[^}]*?)?status:\s*(\d{3})/g,
    )) {
      expect(Number(status), `${path}: ${code} should answer ${COMMUNITY_ERRORS[code as never]}`).toBe(
        COMMUNITY_ERRORS[code as never],
      );
    }
  });
});

describe('the shared 401 body', () => {
  const source = readFileSync('src/lib/auth/require-user.ts', 'utf8');

  it('is a code, not the Vietnamese sentence it used to be', () => {
    expect(source).toContain("communityErrorBody('unauthenticated')");
    expect(proseErrorBodies(source)).toEqual([]);
  });
});

describe('the client that renders these bodies', () => {
  const source = readFileSync('src/components/recipe-gallery.tsx', 'utf8');

  it('looks the code up instead of printing it', () => {
    // `setErrorMsg(data?.error ?? …)` is the exact line that shipped untranslated
    // prose to the screen. It must not come back.
    expect(source).not.toMatch(/setErrorMsg\(\s*data\??\.?\.?error/);
    expect(source).toContain('isCommunityErrorCode(');
    expect(source).toContain('errors.${code}');
  });

  it('asks for a namespace the layout can actually ship', () => {
    /* messages.test.ts requires `<ns>: messages.<ns>` in the layout for every
       namespace a client asks for. `useTranslations('community.errors')` would
       demand an entry that cannot exist, and fails there instead of here. */
    expect(source).not.toContain("useTranslations('community.errors')");
    expect(source).toContain("useTranslations('community')");
  });
});

describe('the catalogue', () => {
  const en = JSON.parse(readFileSync('messages/en.json', 'utf8')) as {
    community: { errors: Record<string, string> };
  };

  it('defines a message for every code, plus the unknown fallback', () => {
    /* These keys are nested one level below the namespace, which is deeper than
       messages.test.ts looks — its orphan check walks top-level names only. So
       an unread `community.errors` block is invisible there, and this is what
       ties each key to a code that a route can actually return. */
    for (const code of Object.keys(COMMUNITY_ERRORS)) {
      expect(en.community.errors, `no message for code "${code}"`).toHaveProperty(code);
    }
    expect(en.community.errors).toHaveProperty('unknown');
  });

  it('defines no message for a code nothing can return', () => {
    const codes = new Set([...Object.keys(COMMUNITY_ERRORS), 'unknown']);
    for (const key of Object.keys(en.community.errors)) {
      expect(codes.has(key), `messages define "errors.${key}" but no code matches it`).toBe(true);
    }
  });
});
