import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_UPLOAD_REQUEST_BYTES } from '@/lib/recipes/upload-limits';

/**
 * What the article media route refuses before it buffers, decodes or writes.
 *
 * In development every request is the local super-admin, and a multipart POST
 * is a CORS "simple" request any page can send to localhost. The article id
 * went straight into a filesystem path under `public/lab`, so `../../src/x`
 * wrote outside it.
 */

const calls = {
  upload: vi.fn(async (..._args: unknown[]) => ({
    ok: true,
    asset: { assetId: 'a', previewUrl: '/lab/x/a/1024.webp' },
  })),
  process: vi.fn(async (..._args: unknown[]) => ({
    ok: true,
    image: { width: 1, height: 1, byteSize: 1, variants: [] },
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  hasContentConfig: () => false,
  hasControlConfig: () => false,
}));
vi.mock('@/lib/lab/dev-store', () => ({ isDevStore: () => true }));
vi.mock('@/lib/auth/admin-gate', () => ({
  adminGate: async () => ({ ok: true, admin: { email: 'dev@localhost', role: 'super' } }),
}));
vi.mock('@/lib/lab/asset-store', () => ({
  uploadDraftAsset: (...args: unknown[]) => calls.upload(...args),
}));
vi.mock('@/lib/lab/image-process', () => ({
  processLabImage: (...args: unknown[]) => calls.process(...args),
}));

const { POST } = await import('./upload/route');

function request(articleId: string, headers: Record<string, string> = {}) {
  const form = new FormData();
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' }));
  form.append('articleId', articleId);
  return new Request('http://localhost/api/admin/articles/upload', {
    method: 'POST',
    body: form,
    headers,
  });
}

beforeEach(() => {
  calls.upload.mockClear();
  calls.process.mockClear();
});

describe('article media upload', () => {
  it('refuses an article id that is not an article id, before any write', async () => {
    for (const id of ['../../src/app/x', 'a/b', 'Bai Viet', '..']) {
      const res = await POST(request(id));
      expect(res.status, id).toBe(404);
      expect(await res.json()).toEqual({ error: 'articleNotFound' });
    }
    expect(calls.process).not.toHaveBeenCalled();
    expect(calls.upload).not.toHaveBeenCalled();
  });

  it('still accepts a real one', async () => {
    const res = await POST(request('cach-chinh-white-balance'));
    expect(res.status).toBe(200);
    expect(calls.upload).toHaveBeenCalledTimes(1);
  });

  it('refuses a body the platform would cut off, from its declared length alone', async () => {
    const res = await POST(
      request('cach-chinh-white-balance', {
        'content-length': String(MAX_UPLOAD_REQUEST_BYTES + 1),
      }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'tooLarge' });
    expect(calls.process).not.toHaveBeenCalled();
  });
});
