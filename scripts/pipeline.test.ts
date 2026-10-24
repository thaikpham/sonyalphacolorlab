import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The data scripts, pinned where they cannot be run: they download, or they
 * connect to a project. Each case is a failure that already shipped or nearly
 * did, and none of them errors anywhere when it happens.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('emit-seed.ts', () => {
  const src = read('scripts/emit-seed.ts');

  /* A throw between files left recipes.seed.json holding a recipe whose
     translation was never written. */
  it('writes every file after the last check', () => {
    const lastCheck = src.lastIndexOf('throw new Error');
    const writes = [...src.matchAll(/writeFileSync\(/g)].map((m) => m.index);
    expect(writes).toHaveLength(3);
    for (const at of writes) expect(at).toBeGreaterThan(lastCheck);
  });
});

describe('package.json', () => {
  /* JSON.parse keeps the last of two equal keys, so the first `//build`
     comment disappeared the moment any tool rewrote the file. */
  it('has no repeated key in scripts', () => {
    const body = read('package.json').match(/"scripts":\s*\{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
    const keys = [...body.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });
});
