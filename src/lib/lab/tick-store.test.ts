import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { toggleStoredTick } from './tick-store';

/**
 * The in-memory mirror has to win whenever a write did not reach storage.
 *
 * Storage that reads but will not write is the quota case: `getItem` keeps
 * answering the old value while `setItem` throws. The mirror held the new
 * value, but the read preferred storage, so the next toggle merged into the
 * stale map — the first tick sprang back the moment the second was made.
 */

const attempts: string[] = [];
let failWrites = true;
let stored: string | null = '{}';

const g = globalThis as { window?: unknown };

beforeEach(() => {
  attempts.length = 0;
  failWrites = true;
  stored = '{}';
  g.window = {
    localStorage: {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        attempts.push(value);
        if (failWrites) throw new DOMException('quota', 'QuotaExceededError');
        stored = value;
      },
    },
  };
});

afterEach(() => {
  delete g.window;
});

describe('toggleStoredTick', () => {
  it('builds on its own last write when storage reads but will not write', () => {
    toggleStoredTick('quota-full', 'a');
    toggleStoredTick('quota-full', 'b');
    expect(JSON.parse(attempts.at(-1) ?? '{}')).toEqual({ a: true, b: true });
  });

  it('reads storage again once a write lands, so another tab’s writes are seen', () => {
    failWrites = false;
    toggleStoredTick('writable', 'a');
    // Another tab replaces the stored map; the next toggle must start from it.
    stored = '{"x":true}';
    toggleStoredTick('writable', 'b');
    expect(JSON.parse(stored)).toEqual({ x: true, b: true });
  });
});
