import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The Security page's reading of the factor list.
 *
 * `listFactors()` reports a failure in `error`, not by throwing, and the panel
 * read only `data` — so a failure became `[]`, and an operator with a verified
 * authenticator was shown "no factor" and offered to enrol a second one. That
 * is the client-side copy of the conflation `requireAdmin()` refuses
 * server-side: an unreadable factor list is not an empty one.
 *
 * Source assertions, like `session.test.ts`: the suite has no DOM.
 */

const source = readFileSync('src/components/admin-ui/security-panel.tsx', 'utf8');

describe('the factor list', () => {
  it('reads the error, and answers null for it rather than an empty list', () => {
    expect(source).toMatch(/const \{ data, error \} = await supabase\.auth\.mfa\.listFactors\(\)/);
    expect(source).toMatch(/if \(error\) return null;/);
  });

  it('starts unknown, not empty', () => {
    expect(source).toMatch(/useState<Factor\[\] \| null>\(null\)/);
  });

  it('offers enrolment only once the list has actually been read', () => {
    const unknown = source.indexOf('factors === null ?');
    const enrol = source.indexOf("t('enrolBtn')");
    expect(unknown).toBeGreaterThan(-1);
    expect(enrol).toBeGreaterThan(unknown);
    expect(source).toMatch(/factorsUnavailable/);
  });
});
