import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ASSET_PATH = join(process.cwd(), 'src/assets/launcher-oasis.webp');

describe('launcher background asset', () => {
  it('ships a browser-ready WebP within the landing-page payload budget', () => {
    expect(existsSync(ASSET_PATH), 'launcher background asset is missing').toBe(true);

    const bytes = readFileSync(ASSET_PATH);
    const riffHeader = bytes.subarray(0, 12).toString('ascii');

    expect(riffHeader.startsWith('RIFF')).toBe(true);
    expect(riffHeader.endsWith('WEBP')).toBe(true);
    expect(bytes.byteLength).toBeLessThanOrEqual(350 * 1024);
  });
});
