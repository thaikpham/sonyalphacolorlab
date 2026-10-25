import { beforeEach, describe, expect, it, vi } from 'vitest';
import recipesSeed from '../../../../../data/recipes.seed.json';

/**
 * What the recipe create, save and unpublish routes do with a request —
 * executed against a spied store, the way `recipe-images-route.test.ts` runs
 * the photograph routes.
 *
 * The store is the real `normaliseRecipe` (it is pure, and it is the seam the
 * routes are supposed to validate through) with every backend call replaced
 * by a spy, so each test can say which write was made, with what, or that no
 * write was made at all.
 */

type Rec = { recipe: Record<string, unknown>; legacyId: string | null; updatedAt: string };

const seed = recipesSeed as unknown as Record<string, unknown>[];
const PP = seed.find((r) => r.format === 'pp')!;
const ID = PP.id as string;
const SLUG = PP.slug as string;
const V1 = '2026-10-01T09:00:00.123456+00:00';
const V2 = '2026-10-02T10:30:00.654321+00:00';

const stored = (over: Partial<Rec> = {}): Rec => ({
  recipe: { ...PP },
  legacyId: null,
  updatedAt: V1,
  ...over,
});

const calls = {
  get: vi.fn(async (_id: string): Promise<Rec | null> => stored()),
  update: vi.fn(async (..._args: unknown[]): Promise<string | null> => V2),
  insert: vi.fn(async (..._args: unknown[]): Promise<'inserted' | 'taken'> => 'inserted'),
  unpublish: vi.fn(async (_id: string): Promise<string | null> => V2),
  nextId: vi.fn(async (_format: string) => 'PP-900'),
  slug: vi.fn(async (_name: string) => 'mojave-sun-2'),
};

vi.mock('@/lib/supabase/server', () => ({
  hasContentConfig: () => true,
  hasControlConfig: () => true,
}));
vi.mock('@/lib/recipes/dev-store', () => ({ isRecipeDevStore: () => false }));
vi.mock('@/lib/admin/content-freeze', () => ({
  CONTENT_ADMIN_FROZEN: { error: 'contentAdminFrozen' },
  contentAdminWritesFrozen: () => false,
}));
vi.mock('@/lib/auth/admin-gate', () => ({
  adminGate: async () => ({ ok: true, admin: { email: 'editor@example.com', role: 'super' } }),
}));
vi.mock('@/lib/recipes/admin-store', async () => {
  const { recipeSchema } = await import('@/lib/camera/schema');
  return {
    normaliseRecipe: (id: string, body: Record<string, unknown>) => {
      const parsed = recipeSchema.safeParse({ ...body, id });
      return parsed.success
        ? { ok: true, recipe: parsed.data }
        : { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
    },
    getRecipeRecord: (id: string) => calls.get(id),
    updateRecipeRecord: (...args: unknown[]) => calls.update(...args),
    insertRecipeRecord: (...args: unknown[]) => calls.insert(...args),
    unpublishRecipe: (id: string) => calls.unpublish(id),
    nextRecipeId: (format: string) => calls.nextId(format),
    uniqueRecipeSlug: (name: string) => calls.slug(name),
    listRecipeRecords: async () => [],
    listRecipeRows: async () => ({
      records: [],
      unreadable: [{ id: 'PP-998', published: true, error: 'settings: Required' }],
    }),
  };
});

const list = await import('./route');
const one = await import('./[id]/route');

const json = (method: string, body: unknown) =>
  new Request('http://localhost/api', {
    method,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  for (const spy of Object.values(calls)) spy.mockClear();
  calls.get.mockImplementation(async () => stored());
  calls.update.mockImplementation(async () => V2);
  calls.unpublish.mockImplementation(async () => V2);
  calls.insert.mockImplementation(async () => 'inserted');
});

describe('GET /api/admin/recipes', () => {
  it('lists the rows the schema refuses beside the rest, so they can be unpublished', async () => {
    const res = await list.GET(new Request('http://localhost/api'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      recipes: [],
      unreadable: [{ id: 'PP-998', published: true, error: 'settings: Required' }],
    });
  });
});

describe('POST /api/admin/recipes', () => {
  it('creates a draft with a server-assigned id and slug, whatever the body says', async () => {
    const res = await list.POST(
      json('POST', { ...PP, id: 'PP-001', slug: 'evil', published: true }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: 'PP-900', slug: 'mojave-sun-2' });
    const [written] = calls.insert.mock.calls[0] as [Record<string, unknown>];
    expect(written).toMatchObject({ id: 'PP-900', slug: 'mojave-sun-2', published: false });
  });

  it('stores the name it validated: trimmed and capped', async () => {
    /* The route checked `body.name.trim().slice(0, 200)` and then wrote the
       raw `body.name`, so a 5,000-character name was stored in full. */
    await list.POST(json('POST', { ...PP, name: `  ${'M'.repeat(300)}  ` }));
    const [written] = calls.insert.mock.calls[0] as [Record<string, unknown>];
    expect(written.name).toBe('M'.repeat(200));
  });

  it('answers 409 idSpaceExhausted when the format has no ids left', async () => {
    calls.nextId.mockRejectedValueOnce(new Error('idSpaceExhausted'));
    const res = await list.POST(json('POST', PP));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'idSpaceExhausted' });
    expect(calls.insert).not.toHaveBeenCalled();
  });

  it('allocates again when a concurrent create took the id or slug first', async () => {
    /* Two tabs creating at once read the same max+1. The second insert hit
       23505 and the editor got "Could not save" with nothing to retry. */
    calls.insert.mockResolvedValueOnce('taken');
    calls.nextId.mockResolvedValueOnce('PP-900').mockResolvedValueOnce('PP-901');
    const res = await list.POST(json('POST', PP));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: 'PP-901', slug: 'mojave-sun-2' });
    expect(calls.insert).toHaveBeenCalledTimes(2);
    const [written] = calls.insert.mock.calls[1] as [Record<string, unknown>];
    expect(written.id).toBe('PP-901');
  });

  it('stops allocating after a bounded number of collisions', async () => {
    calls.insert.mockResolvedValue('taken');
    const res = await list.POST(json('POST', PP));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'saveFailed' });
    expect(calls.insert.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it('answers 400 for a JSON body that is not an object', async () => {
    /* `null` parses, then `body.format` threw: an unhandled 500. */
    for (const body of ['null', '[]', '7']) {
      const res = await list.POST(json('POST', body));
      expect(res.status, body).toBe(400);
      expect(await res.json()).toEqual({ error: 'badRequest' });
    }
    expect(calls.insert).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/admin/recipes/[id]', () => {
  it('keeps the stored slug, whatever the body says', async () => {
    const res = await one.PATCH(
      json('PATCH', { ...PP, slug: 'evil', expectedUpdatedAt: V1 }),
      params(ID),
    );
    expect(res.status).toBe(200);
    const [written] = calls.update.mock.calls[0] as [Record<string, unknown>];
    expect(written.slug).toBe(SLUG);
  });

  it('trims the name, and refuses one that trims to nothing', async () => {
    /* The schema's `min(1)` and the table's `length(name) > 0` both accept a
       single space, which saved a recipe card with a blank title. */
    await one.PATCH(json('PATCH', { ...PP, name: '  Mojave Sun  ', expectedUpdatedAt: V1 }), params(ID));
    const [written] = calls.update.mock.calls[0] as [Record<string, unknown>];
    expect(written.name).toBe('Mojave Sun');

    calls.update.mockClear();
    const blank = await one.PATCH(json('PATCH', { ...PP, name: '   ', expectedUpdatedAt: V1 }), params(ID));
    expect(blank.status).toBe(400);
    expect((await blank.json()).error).toBe('invalidRecipe');
    expect(calls.update).not.toHaveBeenCalled();
  });

  it('answers 400 for a JSON body that is not an object', async () => {
    for (const body of ['null', '[]']) {
      const res = await one.PATCH(json('PATCH', body), params(ID));
      expect(res.status, body).toBe(400);
    }
    expect(calls.update).not.toHaveBeenCalled();
  });
});

describe('a save made against an old version', () => {
  /* A tab that opened PP-010 while it was published, and saved a typo
     fix after another tab had unpublished it, put it back on the site — and
     both tabs said "Saved". The product route closed this hole first. */

  it('needs the version it was opened at', async () => {
    const res = await one.PATCH(json('PATCH', PP), params(ID));
    expect(res.status).toBe(400);
    expect(calls.update).not.toHaveBeenCalled();
  });

  it('is refused with 409 staleEdit before anything is written', async () => {
    const res = await one.PATCH(json('PATCH', { ...PP, expectedUpdatedAt: 'older' }), params(ID));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'staleEdit' });
    expect(calls.update).not.toHaveBeenCalled();
  });

  it('names the version on the write itself, which closes the read-to-write window', async () => {
    await one.PATCH(json('PATCH', { ...PP, expectedUpdatedAt: V1 }), params(ID));
    const [written, expected] = calls.update.mock.calls[0] as [Record<string, unknown>, string];
    expect(expected).toBe(V1);
    expect(written).not.toHaveProperty('expectedUpdatedAt');
  });

  it('asks again when the write matched nothing: 409 if the row moved on, 404 if it went', async () => {
    calls.update.mockResolvedValue(null);
    calls.get.mockResolvedValueOnce(stored()).mockResolvedValueOnce(stored({ updatedAt: V2 }));
    const moved = await one.PATCH(json('PATCH', { ...PP, expectedUpdatedAt: V1 }), params(ID));
    expect(moved.status).toBe(409);
    expect(await moved.json()).toEqual({ error: 'staleEdit' });

    calls.get.mockResolvedValueOnce(stored()).mockResolvedValueOnce(null);
    const gone = await one.PATCH(json('PATCH', { ...PP, expectedUpdatedAt: V1 }), params(ID));
    expect(gone.status).toBe(404);
  });

  it('answers with the stored row and its new version, even when the re-read fails', async () => {
    calls.get.mockResolvedValueOnce(stored()).mockResolvedValueOnce(stored({ updatedAt: V2 }));
    const ok = await one.PATCH(json('PATCH', { ...PP, expectedUpdatedAt: V1 }), params(ID));
    expect((await ok.json()).recipe.updatedAt).toBe(V2);

    calls.get.mockResolvedValueOnce(stored()).mockRejectedValueOnce(new Error('timeout'));
    const blind = await one.PATCH(json('PATCH', { ...PP, expectedUpdatedAt: V1 }), params(ID));
    const body = await blind.json();
    expect(body.ok).toBe(true);
    expect(body.recipe.updatedAt).toBe(V2);
    expect(body.recipe.recipe.id).toBe(ID);
  });
});

describe('DELETE /api/admin/recipes/[id]', () => {
  it('unpublishes rather than deletes, and says so', async () => {
    const res = await one.DELETE(json('DELETE', ''), params(ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, unpublished: true, updatedAt: V2 });
    expect(calls.unpublish).toHaveBeenCalledWith(ID);
  });

  it('answers 404 only when the store found no row', async () => {
    calls.unpublish.mockResolvedValueOnce(null);
    const res = await one.DELETE(json('DELETE', ''), params(ID));
    expect(res.status).toBe(404);
  });
});
