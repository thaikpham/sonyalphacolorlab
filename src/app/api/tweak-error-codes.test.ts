import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TWEAK_ERRORS } from '@/lib/ai/errors';

/**
 * `/api/tweak` answers with a **code**, never a sentence.
 *
 * Same rule as the community routes, caught later because it fails the other
 * way round: these literals were English — `'Too many requests. Try again
 * shortly.'` — on a site whose readers are substantially Vietnamese, and
 * `tweak-panel.tsx` put `data.error` straight on screen.
 *
 * One of them leaked more than language. The 422 interpolated the Zod failure
 * text into the body, so a validation message naming internal fields and legal
 * ranges reached the browser — the same class of mistake as the PostgREST error
 * text that `proposals/vote` stopped returning.
 *
 * Source assertions rather than request tests: the route needs an API key and a
 * live model to run, and what has to hold is a property of the code.
 */

const SOURCES = ['src/app/api/tweak/route.ts', 'src/lib/ai/tweak.ts'];

/** `error:` values that are a quoted sentence rather than a code. */
function proseErrorBodies(source: string): string[] {
  return [...source.matchAll(/\berror:\s*(['"`])(.*?)\1/g)]
    .map((m) => m[2])
    .filter((v) => !(v in TWEAK_ERRORS));
}

describe.each(SOURCES)('%s', (path) => {
  const source = readFileSync(path, 'utf8');

  it('never writes a prose error message into a response', () => {
    expect(proseErrorBodies(source)).toEqual([]);
  });

  it('never interpolates internal detail into an error value', () => {
    // `error: \`Could not produce a valid recipe — ${lastError}.\`` is the exact
    // regression: a template literal in an error position carries whatever the
    // validator said straight to the client.
    expect(source).not.toMatch(/\berror:\s*`[^`]*\$\{/);
  });
});

describe('src/app/api/tweak/route.ts', () => {
  const source = readFileSync('src/app/api/tweak/route.ts', 'utf8');

  it('builds every error body from tweakErrorBody()', () => {
    expect(source).toContain("from '@/lib/ai/errors'");
    expect(source).toMatch(/tweakErrorBody\(/);
  });

  it('names only codes the catalogue defines', () => {
    const used = [...source.matchAll(/tweakErrorBody\('([^']+)'\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const code of used) {
      expect(Object.keys(TWEAK_ERRORS), `route returns an unknown code "${code}"`).toContain(code);
    }
  });

  it('answers each code with the status the catalogue assigns it', () => {
    for (const [, code, status] of source.matchAll(
      /tweakErrorBody\('([^']+)'\),\s*(?:\{[^}]*?)?status:\s*(\d{3})/g,
    )) {
      expect(Number(status), `${code} should answer ${TWEAK_ERRORS[code as never]}`).toBe(
        TWEAK_ERRORS[code as never],
      );
    }
  });

  it('passes the library outcome through as a code', () => {
    // The 422 forwards whatever tweakRecipe returned; that value is typed as a
    // TweakErrorCode, so this is what keeps the two vocabularies the same one.
    expect(source).toContain('tweakErrorBody(result.error)');
  });
});

describe('the client that renders these bodies', () => {
  const source = readFileSync('src/components/tweak-panel.tsx', 'utf8');

  it('looks the code up instead of printing it', () => {
    expect(source).not.toMatch(/setError\(\s*data\??\.?\.?error/);
    expect(source).toContain('isTweakErrorCode(');
    expect(source).toContain('errors.${');
  });
});

describe('the catalogue', () => {
  const en = JSON.parse(readFileSync('messages/en.json', 'utf8')) as {
    tweak: { errors: Record<string, string> };
  };

  it('defines a message for every code, plus the unknown fallback', () => {
    /* Nested one level below the namespace, which is deeper than
       messages.test.ts looks — its orphan check walks top-level names only. */
    for (const code of Object.keys(TWEAK_ERRORS)) {
      expect(en.tweak.errors, `no message for code "${code}"`).toHaveProperty(code);
    }
    expect(en.tweak.errors).toHaveProperty('unknown');
  });

  it('defines no message for a code nothing can return', () => {
    const codes = new Set([...Object.keys(TWEAK_ERRORS), 'unknown']);
    for (const key of Object.keys(en.tweak.errors)) {
      expect(codes.has(key), `messages define "tweak.errors.${key}" but no code matches it`).toBe(
        true,
      );
    }
  });
});
