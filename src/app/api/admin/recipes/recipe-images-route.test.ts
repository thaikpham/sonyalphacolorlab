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
  listRecipeImages: async () => [],
  reorderRecipeImages: async () => true,
  signPreview: async () => '',
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
