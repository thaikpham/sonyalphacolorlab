import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What the recipe photograph routes refuse before they reach a store.
 *
 * The stores are spies here: the point is which requests never get as far as
 * a query, a buffer or a decoder — a malformed image id that Postgres would
 * answer with 22P02 and the route with a misleading 502, and a body the
 * platform would have cut off anyway.
 */

const calls = {
  alt: vi.fn(async (..._args: unknown[]) => true),
  remove: vi.fn(async (..._args: unknown[]) => true),
  process: vi.fn(async (..._args: unknown[]) => ({ ok: false, error: 'unsupportedType' })),
  list: vi.fn(async (..._args: unknown[]): Promise<unknown[]> => []),
  sign: vi.fn(async (path: string) => `signed:${path}`),
  reorder: vi.fn(async (..._args: unknown[]) => true),
};
const env = { devStore: false };

vi.mock('@/lib/supabase/server', () => ({
  hasContentConfig: () => !env.devStore,
  hasControlConfig: () => true,
}));
vi.mock('@/lib/recipes/dev-store', () => ({ isRecipeDevStore: () => env.devStore }));
vi.mock('@/lib/auth/admin-gate', () => ({
  adminGate: async () => ({ ok: true, admin: { email: 'editor@example.com', role: 'super' } }),
}));
vi.mock('@/lib/recipes/image-store', () => ({
  setRecipeImageAlt: (...args: unknown[]) => calls.alt(...args),
  deleteRecipeImage: (...args: unknown[]) => calls.remove(...args),
  listRecipeImages: (...args: unknown[]) => calls.list(...args),
  reorderRecipeImages: (...args: unknown[]) => calls.reorder(...args),
  signPreview: (path: string) => calls.sign(path),
  uploadRecipeImage: async () => ({ ok: false, error: 'uploadFailed' }),
}));
vi.mock('@/lib/recipes/admin-store', () => ({
  getRecipeRecord: async () => ({ recipe: { id: 'SCL-PP-001' }, legacyId: null, updatedAt: '' }),
}));
vi.mock('@/lib/lab/image-process', async () => {
  const limits = await import('@/lib/recipes/upload-limits');
  return { ...limits, processLabImage: (...args: unknown[]) => calls.process(...args) };
});

const one = await import('./[id]/images/[imageId]/route');
const UUID = '0b0f6f1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

const params = (id: string, imageId: string) => ({ params: Promise.resolve({ id, imageId }) });
const patch = (body: unknown) =>
  new Request('http://localhost/api', { method: 'PATCH', body: JSON.stringify(body) });
const del = () => new Request('http://localhost/api', { method: 'DELETE' });

beforeEach(() => {
  env.devStore = false;
  calls.alt.mockClear();
  calls.remove.mockClear();
  calls.process.mockClear();
  calls.reorder.mockClear();
  calls.list.mockReset().mockResolvedValue([]);
  calls.sign.mockReset().mockImplementation(async (path: string) => `signed:${path}`);
});

describe('one photograph', () => {
  it('answers 404 for an image id that cannot be a row, without querying', async () => {
    const a = await one.PATCH(patch({ alt: 'x' }), params('SCL-PP-001', 'foo'));
    const d = await one.DELETE(del(), params('SCL-PP-001', 'foo'));
    expect([a.status, d.status]).toEqual([404, 404]);
    expect(calls.alt).not.toHaveBeenCalled();
    expect(calls.remove).not.toHaveBeenCalled();
  });

  it('hands the store the recipe from the URL as well as the image', async () => {
    await one.PATCH(patch({ alt: 'Dunes' }), params('SCL-PP-001', UUID));
    await one.DELETE(del(), params('SCL-PP-001', UUID));
    expect(calls.alt).toHaveBeenCalledWith('SCL-PP-001', UUID, 'Dunes');
    expect(calls.remove).toHaveBeenCalledWith('SCL-PP-001', UUID);
  });

  it('accepts the dev store’s own ids, which are not UUIDs', async () => {
    env.devStore = true;
    const d = await one.DELETE(del(), params('SCL-PP-001', 'dev-SCL-PP-001-3'));
    expect(d.status).toBe(200);
    expect(calls.remove).toHaveBeenCalledWith('SCL-PP-001', 'dev-SCL-PP-001-3');
  });
});

describe('alt text', () => {
  it('has one limit, which the editor enforces as the box fills', async () => {
    /* The route cut alt text at 300 characters and the input had no
       maxLength, so an editor kept seeing the sentence whose tail was never
       saved. One constant, read by both. */
    const { MAX_ALT_CHARS } = await import('@/lib/recipes/upload-limits');
    await one.PATCH(patch({ alt: 'x'.repeat(MAX_ALT_CHARS + 1) }), params('SCL-PP-001', UUID));
    expect(calls.alt).toHaveBeenCalledWith('SCL-PP-001', UUID, 'x'.repeat(MAX_ALT_CHARS));

    const route = readFileSync('src/app/api/admin/recipes/[id]/images/[imageId]/route.ts', 'utf8');
    expect(route).toMatch(/\.slice\(0, MAX_ALT_CHARS\)/);
    const panel = readFileSync('src/components/colorlab/admin/image-panel.tsx', 'utf8');
    expect(panel).toMatch(/maxLength=\{MAX_ALT_CHARS\}/);
  });

  it('refuses a body with no alt rather than erasing the stored one', async () => {
    /* `{}` and `{ alt: 5 }` read as '' and then null, which cleared the
       description already saved. */
    for (const body of [{}, { alt: 5 }, { text: 'Dunes' }]) {
      const res = await one.PATCH(patch(body), params('SCL-PP-001', UUID));
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ error: 'badRequest' });
    }
    expect(calls.alt).not.toHaveBeenCalled();
  });

  it('still clears it on an explicit null or an empty string', async () => {
    await one.PATCH(patch({ alt: null }), params('SCL-PP-001', UUID));
    await one.PATCH(patch({ alt: '   ' }), params('SCL-PP-001', UUID));
    expect(calls.alt.mock.calls).toEqual([
      ['SCL-PP-001', UUID, null],
      ['SCL-PP-001', UUID, null],
    ]);
  });
});

describe('a body that is not an object', () => {
  it('is a 400 at both PATCH handlers, never a TypeError', async () => {
    /* `null` is valid JSON; reading `body.alt` or `body.order` off it threw,
       and the editor got an unhandled 500. */
    const many = await import('./[id]/images/route');
    for (const raw of ['null', '[]']) {
      const req = () => new Request('http://localhost/api', { method: 'PATCH', body: raw });
      const a = await one.PATCH(req(), params('SCL-PP-001', UUID));
      const o = await many.PATCH(req(), { params: Promise.resolve({ id: 'SCL-PP-001' }) });
      expect([a.status, o.status], raw).toEqual([400, 400]);
    }
    expect(calls.alt).not.toHaveBeenCalled();
    expect(calls.reorder).not.toHaveBeenCalled();
  });
});

describe('reordering photographs', () => {
  it('refuses an order that names one photograph twice, before the store', async () => {
    /* [a, a, b] passed the store's length-and-membership check, parked the
       rows, then collided on (recipe_id, sort) half way through — leaving the
       sorts scrambled and the editor reading "could not save". */
    const many = await import('./[id]/images/route');
    const a = `${UUID.slice(0, -1)}a`;
    const b = `${UUID.slice(0, -1)}b`;
    const res = await many.PATCH(patch({ order: [a, a, b] }), {
      params: Promise.resolve({ id: 'SCL-PP-001' }),
    });
    expect(res.status).toBe(400);
    expect(calls.reorder).not.toHaveBeenCalled();
  });
});

describe('uploading a photograph', () => {
  it('refuses a body the platform would cut off, from its declared length alone', async () => {
    const { MAX_UPLOAD_REQUEST_BYTES } = await import('@/lib/recipes/upload-limits');
    const many = await import('./[id]/images/route');
    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'content-length': String(MAX_UPLOAD_REQUEST_BYTES + 1) },
      body: 'not really that long',
    });

    const res = await many.POST(request, { params: Promise.resolve({ id: 'SCL-PP-001' }) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'tooLarge' });
    expect(calls.process).not.toHaveBeenCalled();
  });
});

describe('listing photographs', () => {
  it('still answers when one pending object cannot be signed', async () => {
    /* An object removed by hand in Storage leaves its row behind. Failing the
       whole list on it hid every photograph, including the row the editor
       needed to delete. */
    const row = (n: number) => ({
      id: `${UUID.slice(0, -1)}${n}`,
      recipeId: 'SCL-PP-001',
      storagePath: `uploads/SCL-PP-001/${n}.webp`,
      alt: null,
      sort: n,
      width: null,
      height: null,
    });
    calls.list.mockResolvedValue([row(1), row(2)]);
    calls.sign.mockImplementation(async (path: string) => {
      if (path.endsWith('/2.webp')) throw new Error('Object not found');
      return `signed:${path}`;
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const many = await import('./[id]/images/route');
    const res = await many.GET(new Request('http://localhost/api'), {
      params: Promise.resolve({ id: 'SCL-PP-001' }),
    });
    spy.mockRestore();

    expect(res.status).toBe(200);
    const { images } = (await res.json()) as { images: { previewUrl: string | null }[] };
    expect(images.map((i) => i.previewUrl)).toEqual(['signed:uploads/SCL-PP-001/1.webp', null]);
  });
});
