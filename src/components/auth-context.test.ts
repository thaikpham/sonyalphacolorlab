import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The sign-in sheet's own behaviour.
 *
 * This suite has no DOM, so the sheet cannot be opened and keyed at. What is
 * pinned is the shape of each handler, sliced out of the source the way
 * `site-header.test.ts` does it.
 */
const source = readFileSync('src/components/auth-context.tsx', 'utf8');
const slice = (from: string, to: string) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  expect(start, `${from} is missing`).toBeGreaterThan(-1);
  expect(end, `${to} is missing after ${from}`).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe('the sign-in sheet', () => {
  it('closes on Escape while it is open', () => {
    /* It is `aria-modal`, and the header's Escape handler knows nothing of it,
       so a keyboard reader had to tab through the page to reach the ✕. */
    const effect = slice('if (!isLoginModalOpen) return;', '}, [isLoginModalOpen]);');
    expect(effect).toMatch(/if \(e\.key === 'Escape'\) setIsLoginModalOpen\(false\);/);
    expect(effect).toContain("window.addEventListener('keydown', onKeyDown)");
    expect(effect).toContain("window.removeEventListener('keydown', onKeyDown)");
  });

  it('takes focus on open and hands it back on close', () => {
    const effect = slice('if (!isLoginModalOpen) return;', '}, [isLoginModalOpen]);');
    expect(effect).toContain('primaryRef.current?.focus()');
    expect(effect).toContain('opener?.focus()');
    expect(source).toContain('ref={primaryRef}');
  });

  it('opens without the previous attempt’s error', () => {
    /* `error` was cleared only by pressing Google again, so a sheet reopened
       after an outage showed the old alert before anything was tried. */
    const open = slice('const openLoginModal', 'const closeLoginModal');
    expect(open).toMatch(/setError\(null\);\s*setIsLoginModalOpen\(true\);/);
  });

  it('reports a thrown sign-in instead of leaving an unhandled rejection', () => {
    const login = slice('const loginWithGoogle', 'const logout');
    expect(login).toMatch(/\} catch \{(\s*\/\*[\s\S]*?\*\/)?\s*setError\('errOpenFailed'\);\s*\} finally \{/);
  });
});
