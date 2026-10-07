import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_REQUEST_BYTES, declaresOversizedBody } from './upload-limits';

/**
 * The one upload ceiling, and the platform ceiling above it.
 *
 * Vercel refuses a function request body over 4.5 MB before the handler runs,
 * with a plain-text 413. A limit above that is a limit nobody can reach: a
 * 6 MB photograph passed the editor's check, died at the platform, and the
 * editor read "upload failed" — not "too large" — because the 413 was not JSON.
 */

const VERCEL_BODY_CAP = 4.5 * 1000 * 1000;

describe('upload limits', () => {
  it('sit below the platform’s request cap, multipart overhead included', () => {
    expect(MAX_UPLOAD_BYTES).toBeLessThan(MAX_UPLOAD_REQUEST_BYTES);
    expect(MAX_UPLOAD_REQUEST_BYTES).toBeLessThan(VERCEL_BODY_CAP);
  });

  it('is declared once — neither upload route keeps its own number', () => {
    for (const route of [
      'src/app/api/admin/articles/upload/route.ts',
      'src/app/api/admin/recipes/[id]/images/route.ts',
    ]) {
      const source = readFileSync(route, 'utf8');
      expect(source, route).not.toMatch(/\d+\s*\*\s*1024/);
      expect(source, route).toMatch(/declaresOversizedBody\(request\)/);
    }
  });

  it('reads the declared length, so an overrun is refused before buffering', () => {
    const req = (length?: string) =>
      new Request('http://localhost/', {
        method: 'POST',
        body: 'x',
        headers: length === undefined ? {} : { 'content-length': length },
      });
    expect(declaresOversizedBody(req(String(MAX_UPLOAD_REQUEST_BYTES + 1)))).toBe(true);
    expect(declaresOversizedBody(req(String(MAX_UPLOAD_REQUEST_BYTES)))).toBe(false);
    /* No usable header is not evidence of anything; the size of the file
       itself is still checked after parsing. */
    expect(declaresOversizedBody(req('nonsense'))).toBe(false);
  });
});
