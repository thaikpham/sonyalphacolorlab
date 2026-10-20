import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_COLUMNS, type ProductRow } from '@/lib/cameras/row';
import type { CameraSpecs, ProductSpecs } from '@/lib/cameras/types';

/**
 * What an editor's Save actually does to the row — executed, not pattern-matched.
 *
 * The defects this pins all ended the same way, with "Đã lưu" on screen and the
 * edit nowhere to be seen afterwards:
 *
 * - the save wrote the gallery, and nothing ever read the column back;
 * - the editor kept its pre-save `features` and `specs`, so reopening the
 *   product showed the old ones and a second save wrote them back;
 * - a row whose database copy had no spec block refused the whole save;
 * - category, sub-categories, SKU, price and URL were not in the body the route
 *   accepted, so editing them saved nothing — and a placement change could
 *   leave a spec block of the wrong kind behind.
 *
 * The rules themselves are `productPatch()` / `productCreate()`, executed in
 * `src/lib/cameras/product-write.test.ts`; this file pins that both routes go
 * through them and turn their answers into the right writes and status codes.
 *
 * The content client is a recording fake. It holds one `sony_cameras` row and
 * answers the calls the route makes the way PostgREST would — including the
 * case that matters most, an update that matched nothing returning no error.
 */

type Call = {
  op: 'select' | 'update' | 'insert';
  payload?: Record<string, unknown>;
  columns?: string;
  /** Every filter the call carried, in order, as `column op value`. */
  filters?: string[];
};

/** A row's version as PostgREST serialises a timestamptz. */
const V1 = '2026-10-01T09:00:00.123456+00:00';
const V2 = '2026-10-02T10:30:00.654321+00:00';

type Row = ProductRow & { updated_at?: string | null };

const db = {
  row: null as Row | null,
  /** The verified admin's role, as `admin_emails` would answer it. */
  role: 'super' as 'super' | 'di' | 'pe',
  calls: [] as Call[],
  failWith: null as { code: string; message: string } | null,
  /** `failWith` applies to reads too, not only writes. */
  failReads: false,
  /** Deleted between the route's read and its write. */
  vanishOnWrite: false,
  /** Saved by somebody else between the route's read and its write. */
  bumpOnWrite: null as string | null,
};

function cameraSpecs(over: Partial<CameraSpecs> = {}): CameraSpecs {
  return {
    kind: 'camera',
    specsSource: 'https://www.sony.com.vn/example',
    specsMissing: [],
    sensor: 'Full-Frame Exmor R CMOS BSI',
    effectivePixels: '33,0 MP',
    isoRange: '100–51200',
    autofocus: '759 điểm',
    video: '4K 60p',
    stabilization: '5-axis',
    viewfinder: '3,69 triệu điểm ảnh',
    lcd: '3,0"',
    mediaSlots: 'CFexpress A / SD',
    battery: '580 ảnh',
    weight: '659 g',
    dimensions: '131 x 96 x 80 mm',
    ...over,
  };
}

function storedRow(over: Partial<Row> = {}): Row {
  return {
    id: 'sony-ilce-7m4-bq-ap2',
    sku: 'ILCE-7M4/BQ AP2',
    name: 'A7 IV',
    full_name: 'Máy ảnh Sony Alpha 7 IV',
    category: 'camera',
    sub_category_1: 'Mirrorless Full-Frame',
    sub_category_2: 'Alpha 7 Series',
    price_vnd: 52990000,
    price_formatted: '52.990.000 ₫',
    url: 'https://www.sony.com.vn/a7m4',
    image_url: 'https://static.bhphoto.com/images/fb/1667800.jpg',
    gallery_urls: ['https://static.bhphoto.com/images/fb/1667800.jpg'],
    features: { en: ['33MP sensor'], vi: ['Cảm biến 33MP'] },
    specs: cameraSpecs(),
    highlights: null,
    updated_at: V1,
    ...over,
  };
}

const pick = (row: Row, columns: string) =>
  Object.fromEntries(
    columns.split(',').map((c) => c.trim()).map((c) => [c, (row as Record<string, unknown>)[c]]),
  ) as ProductRow;

vi.mock('@/lib/supabase/server', () => ({
  contentAdmin: () => ({
    from: (table: string) => {
      expect(table).toBe('sony_cameras');
      let pending: Call | null = null;
      const filters: { column: string; value: string | null }[] = [];
      const matches = (row: Row | null) =>
        row !== null &&
        filters.every((f) => (f.column === 'id' ? row.id === f.value : (row.updated_at ?? null) === f.value));
      const builder = {
        select(columns: string) {
          if (pending) pending.columns = columns;
          else {
            pending = { op: 'select', columns, filters: [] };
            db.calls.push(pending);
          }
          return builder;
        },
        update(payload: Record<string, unknown>) {
          pending = { op: 'update', payload, filters: [] };
          db.calls.push(pending);
          return builder;
        },
        insert(payload: Record<string, unknown>) {
          pending = { op: 'insert', payload };
          db.calls.push(pending);
          return builder;
        },
        eq(column: string, value: string) {
          expect(['id', 'updated_at']).toContain(column);
          /* PostgREST's `eq.null` compares with `=`, which is never true for
             NULL — a never-edited row must be matched with `.is()`. */
          expect(value, `.eq('${column}', null) matches nothing`).not.toBeNull();
          filters.push({ column, value });
          pending?.filters?.push(`${column} eq ${value}`);
          return builder;
        },
        is(column: string, value: null) {
          expect(column).toBe('updated_at');
          expect(value).toBeNull();
          filters.push({ column, value });
          pending?.filters?.push(`${column} is null`);
          return builder;
        },
        async maybeSingle() {
          if (db.failWith && (pending?.op !== 'select' || db.failReads)) {
            return { data: null, error: db.failWith };
          }
          if (pending?.op === 'update') {
            if (db.vanishOnWrite) db.row = null;
            if (db.bumpOnWrite && db.row) db.row = { ...db.row, updated_at: db.bumpOnWrite };
          }
          const match = matches(db.row) ? db.row : null;
          if (pending?.op === 'update' && match) {
            db.row = { ...match, ...(pending.payload as Partial<Row>) };
          }
          const current = pending?.op === 'update' ? (match ? db.row : null) : match;
          return { data: current ? pick(current, pending?.columns ?? PRODUCT_COLUMNS) : null, error: null };
        },
        async single() {
          if (db.failWith) return { data: null, error: db.failWith };
          db.row = { ...(pending?.payload as unknown as Row) };
          return { data: pick(db.row, pending?.columns ?? PRODUCT_COLUMNS), error: null };
        },
      };
      return builder;
    },
  }),
  hasContentConfig: () => true,
}));

vi.mock('@/lib/auth/admin-gate', () => ({
  adminGate: async () => ({
    ok: true,
    admin: { id: 'u1', email: 'editor@example.com', name: 'Editor', avatarUrl: null, assuranceLevel: 'aal2', role: db.role },
  }),
}));

const { PATCH, GET } = await import('./[id]/route');
const { POST } = await import('./route');
const { ADMIN_PRODUCT_COLUMNS } = await import('@/lib/admin/product-row');

/**
 * A save from an editor that opened the row as it is now. `expectedUpdatedAt`
 * defaults to the stored version, so the tests that are not about concurrency
 * read as an ordinary save; the ones that are pass their own.
 */
const patch = (body: unknown, id = 'sony-ilce-7m4-bq-ap2') =>
  PATCH(
    new Request(`http://local/api/admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(
        body && typeof body === 'object' && !Array.isArray(body)
          ? { expectedUpdatedAt: db.row?.updated_at ?? null, ...body }
          : body,
      ),
    }),
    { params: Promise.resolve({ id }) },
  );

const get = (id = 'sony-ilce-7m4-bq-ap2') =>
  GET(new Request(`http://local/api/admin/products/${id}`), { params: Promise.resolve({ id }) });

const create = (body: unknown) =>
  POST(new Request('http://local/api/admin/products', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  db.row = storedRow();
  db.role = 'super';
  db.calls = [];
  db.failWith = null;
  db.failReads = false;
  db.vanishOnWrite = false;
  db.bumpOnWrite = null;
  vi.stubEnv('NEXT_PUBLIC_AUTH_SUPABASE_URL', 'https://nqeedlgzaewccqztqvik.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY', 'a');
  vi.stubEnv('AUTH_SUPABASE_SECRET_KEY', 'b');
  vi.stubEnv('NEXT_PUBLIC_CONTENT_SUPABASE_URL', 'https://alpehrfvkryearajlfnx.supabase.co');
  vi.stubEnv('CONTENT_SUPABASE_ANON_KEY', 'c');
  vi.stubEnv('CONTENT_SUPABASE_SECRET_KEY', 'd');
});

describe('PATCH /api/admin/products/[id]', () => {
  it('writes the gallery and hands back the row as stored', async () => {
    const gallery = [
      'https://static.bhphoto.com/images/fb/1667800.jpg',
      'https://static.bhphoto.com/images/multiple_images/images1000x1000/1.jpg',
    ];
    const res = await patch({ galleryUrls: gallery, features: { en: ['New'], vi: ['Mới'] } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(db.row?.gallery_urls).toEqual(gallery);
    expect(data.product.galleryUrls).toEqual(gallery);
    expect(data.product.features).toEqual({ en: ['New'], vi: ['Mới'] });
  });

  it('says which project the row went to', async () => {
    /* Two Supabase projects, two organisations. The catalogue is in the
       CONTENT one; looking for a save in the control project's leftover copy
       is how "it never reached the database" gets concluded. */
    const data = await (await patch({ name: 'A7 IV' })).json();
    expect(data.project).toBe('alpehrfvkryearajlfnx');
  });

  it('sends only the columns it changes, never a whole-row upsert', async () => {
    await patch({ name: 'α7 IV' });
    const write = db.calls.find((c) => c.op === 'update');
    expect(write?.payload).toBeDefined();
    expect(Object.keys(write!.payload!).sort()).toEqual(['name', 'updated_at', 'updated_by']);
    expect(write?.columns).toBe(ADMIN_PRODUCT_COLUMNS);
  });

  it('takes updated_by from the verified admin, not the body', async () => {
    await patch({ name: 'x', updated_by: 'someone@else.test' });
    const write = db.calls.find((c) => c.op === 'update');
    expect(write?.payload?.updated_by).toBe('editor@example.com');
  });

  it('is a 404, not a success, when the update matched no row', async () => {
    /* PostgREST answers an update that matched nothing with no error and zero
       rows. Deleted between the read and the write, the row must not read as
       saved. */
    db.vanishOnWrite = true;
    const res = await patch({ name: 'gone' });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('notFound');
  });

  it('answers saveFailed when the database refuses the write', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.failWith = { code: '23514', message: 'check violation' };
    const res = await patch({ name: 'x' });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('saveFailed');
  });

  it('starts a spec block for a row whose database copy has none', async () => {
    /* The readers fill a null `specs` column from the seed, so the editor shows
       and sends a full sheet. Answering 409 here refused the name and features
       in the same request. */
    db.row = storedRow({ specs: null });
    const res = await patch({
      name: 'A7 IV',
      specs: { kind: 'camera', sensor: 'Full-Frame', weight: '', specsSource: 'https://www.sony.com.vn/x' },
    });
    expect(res.status).toBe(200);
    const specs = db.row?.specs as CameraSpecs;
    expect(specs.kind).toBe('camera');
    expect(specs.sensor).toBe('Full-Frame');
    expect(specs.weight).toBeNull();
    expect(specs.specsMissing).toContain('weight');
    expect(specs.specsMissing).not.toContain('sensor');
    expect(specs.specsSource).toBe('https://www.sony.com.vn/x');
  });

  it('builds the block the placement names, whatever kind the body claims', async () => {
    /* A camera cannot be turned into a speaker by a request: the kind comes
       from the taxonomy. A row with no block used to answer 409 `noSpecBlock`
       here instead of taking one. */
    db.row = storedRow({ specs: null });
    const res = await patch({ specs: { kind: 'speaker', power: '100W', weight: '1 kg' } });
    expect(res.status).toBe(200);
    const specs = db.row?.specs as CameraSpecs;
    expect(specs.kind).toBe('camera');
    expect(specs).not.toHaveProperty('power');
    expect(specs.weight).toBe('1 kg');
  });

  it('gives a blockless accessory row the keySpecs list its type requires', async () => {
    db.row = storedRow({ category: 'accessory', sub_category_1: 'Power', sub_category_2: 'Battery', specs: null });
    const res = await patch({ specs: { weight: '83 g' } });
    expect(res.status).toBe(200);
    expect(db.row?.specs).toMatchObject({ kind: 'accessory', keySpecs: [], weight: '83 g' });
  });

  it('keeps the stored kind even if the body names another', async () => {
    await patch({ specs: { kind: 'lens', sensor: 'APS-C' } });
    const specs = db.row?.specs as ProductSpecs;
    expect(specs.kind).toBe('camera');
    expect((specs as CameraSpecs).sensor).toBe('APS-C');
  });

  const hlSide = {
    points: [1, 2, 3, 4].map((i) => ({ title: `T${i}`, body: `B${i}.` })),
    keySpecs: [{ key: 'sensor', value: '33MP' }],
  };

  it('saves valid highlights and hands them back', async () => {
    const res = await patch({ highlights: { en: hlSide, vi: hlSide } });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(db.row?.highlights).toEqual({ en: hlSide, vi: hlSide });
    expect(data.product.highlights.vi.points).toHaveLength(4);
  });

  it('refuses highlights that fail the schema, writing nothing', async () => {
    const res = await patch({ highlights: { en: hlSide } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalidHighlights' });
    expect(db.calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('clears highlights with null', async () => {
    db.row = storedRow({ highlights: { en: hlSide, vi: hlSide } });
    const res = await patch({ highlights: null });
    expect(res.status).toBe(200);
    expect(db.row?.highlights).toBeNull();
  });

  it('refuses highlights on a product that is not a camera', async () => {
    db.row = storedRow({ category: 'lens' });
    const res = await patch({ highlights: { en: hlSide, vi: hlSide } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalidHighlights' });
    expect(db.calls.some((c) => c.op === 'update')).toBe(false);
  });
});

describe('PATCH — the fields that used to be read-only', () => {
  /* The owner's report: "I edit the product and press Save, and nothing
     updates." Category, sub-categories, SKU, price and URL were not in the
     body the route accepted, so the editor had no way to send them. */

  it('saves SKU, price, URL and placement as the columns they are', async () => {
    const res = await patch({
      sku: 'ILCE-7M4/BQ AP3',
      priceVnd: 49_990_000,
      priceFormatted: '1 ₫',
      url: 'https://www.sony.com.vn/a7m4-new',
      category: 'camera',
      subCategory1: 'Full Frame',
      subCategory2: 'Máy ảnh Alpha',
    });
    expect(res.status).toBe(200);
    const write = db.calls.find((c) => c.op === 'update');
    expect(Object.keys(write!.payload!).sort()).toEqual([
      'price_formatted',
      'price_vnd',
      'sku',
      'sub_category_1',
      'sub_category_2',
      'updated_at',
      'updated_by',
      'url',
    ]);
    /* Derived on the server, in the catalogue's own spelling — never the body's. */
    expect(db.row?.price_formatted).toBe('49.990.000 đ');
    const data = await res.json();
    expect(data.product).toMatchObject({
      sku: 'ILCE-7M4/BQ AP3',
      priceVnd: 49_990_000,
      priceFormatted: '49.990.000 đ',
      subCategory1: 'Full Frame',
      subCategory2: 'Máy ảnh Alpha',
    });
  });

  it('re-shapes the spec block when a move changes its kind', async () => {
    const res = await patch({ category: 'lens', subCategory1: 'Full Frame', subCategory2: 'GM' });
    expect(res.status).toBe(200);
    const specs = db.row?.specs as ProductSpecs & Record<string, unknown>;
    expect(specs.kind).toBe('lens');
    expect(specs.weight).toBe('659 g');
    expect(specs).not.toHaveProperty('sensor');
    expect(specs.specsMissing).toContain('focalLength');
  });

  it('answers 409 skuTaken when another product holds the SKU', async () => {
    db.failWith = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "sony_cameras_nonempty_sku_key"',
    };
    const res = await patch({ sku: 'ILCE-7CM2' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'skuTaken' });
  });

  it('refuses a placement outside the taxonomy, writing nothing', async () => {
    const res = await patch({ subCategory1: 'Mirrorless APS-C' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalidPlacement' });
    expect(db.calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('refuses a move into a category the role does not cover, writing nothing', async () => {
    db.role = 'di';
    const res = await patch({ category: 'audio', subCategory1: 'Tai nghe', subCategory2: 'Nhét tai' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'notAllowedForCategory' });
    expect(db.calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('accepts the legacy values a row already stores while another field changes', async () => {
    /* The fixture row is filed under "Mirrorless Full-Frame" with a ₫ price —
       spellings from before the taxonomy. Resending them unchanged is not a
       move, so the name still saves and the price text is left alone. */
    const res = await patch({ name: 'α7 IV', subCategory1: 'Mirrorless Full-Frame', subCategory2: 'Alpha 7 Series' });
    expect(res.status).toBe(200);
    expect(db.row?.name).toBe('α7 IV');
    expect(db.row?.price_formatted).toBe('52.990.000 ₫');
  });
});

describe('POST /api/admin/products', () => {
  it('returns the row the database stored', async () => {
    db.row = null;
    const res = await create({
      sku: 'SEL-TEST',
      name: 'FE Test',
      category: 'lens',
      subCategory1: 'Full Frame',
      subCategory2: 'GM',
      galleryUrls: ['https://static.bhphoto.com/images/fb/1.jpg'],
      features: { en: ['One'], vi: ['Một'] },
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.product.id).toBe('sony-sel-test');
    expect(data.product.galleryUrls).toEqual(['https://static.bhphoto.com/images/fb/1.jpg']);
    expect(data.project).toBe('alpehrfvkryearajlfnx');
  });

  it('writes an accessory spec block with keySpecs', async () => {
    db.row = null;
    await create({ sku: 'ECM-TEST', name: 'Mic', category: 'accessory', subCategory1: 'Audio', subCategory2: 'Microphone' });
    /* Read through a widened type: `db.row = null` above narrows it for TS,
       but the route reassigned it. */
    const stored = db.row as Row | null;
    expect(stored?.specs).toMatchObject({ kind: 'accessory', keySpecs: [] });
  });

  it('names a duplicate instead of "could not save"', async () => {
    db.failWith = { code: '23505', message: 'duplicate key value violates unique constraint "sony_cameras_pkey"' };
    const res = await create({ sku: 'ILCE-7M4/BQ AP2', name: 'A7 IV', category: 'camera', subCategory1: 'Full Frame' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('duplicateProduct');
  });

  it('names a taken SKU', async () => {
    db.failWith = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "sony_cameras_nonempty_sku_key"',
    };
    const res = await create({ sku: 'ILCE-7M4', name: 'A7 IV', category: 'camera', subCategory1: 'Full Frame' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('skuTaken');
  });

  it("writes the price the way every catalogue row does, never the body's spelling", async () => {
    db.row = null;
    await create({
      sku: 'SEL-P',
      name: 'FE P',
      category: 'lens',
      subCategory1: 'Full Frame',
      priceVnd: 12_490_000,
      priceFormatted: '12.490.000 ₫',
    });
    const stored = db.row as Row | null;
    expect(stored?.price_formatted).toBe('12.490.000 đ');
    expect(stored?.price_vnd).toBe(12_490_000);
  });

  it('files a speaker as a speaker by the taxonomy, not by finding "loa" in the label', async () => {
    db.row = null;
    const res = await create({ name: 'SRS-X', category: 'audio', subCategory1: 'Loa', subCategory2: 'Di động' });
    expect(res.status).toBe(200);
    expect((db.row as Row | null)?.specs).toMatchObject({ kind: 'speaker' });
  });

  it('refuses a sub-category the catalogue never filters by, writing nothing', async () => {
    db.row = null;
    const res = await create({ sku: 'SEL-Q', name: 'FE Q', category: 'lens', subCategory1: 'FE-mount (Full-Frame)' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalidPlacement' });
    expect(db.calls.some((c) => c.op === 'insert')).toBe(false);
  });
});

describe('malformed bodies', () => {
  /* Valid JSON that is not an object, or fields that are not strings, used to
     throw a TypeError inside the handler — an uncaught 500 the editor could only
     report as a generic failure. Nothing was written either way; this is about
     the answer naming the cause. */
  it('answers a null body with 400 on POST and PATCH', async () => {
    db.row = null;
    expect((await create(null)).status).toBe(400);
    db.row = storedRow();
    const res = await patch(null);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'badRequest' });
    expect(db.calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('answers non-string create fields with 400, not a crash', async () => {
    db.row = null;
    const res = await create({ sku: 1, name: 'x', category: 'lens', subCategory1: 'y' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'badRequest' });
    expect(db.calls.some((c) => c.op === 'insert')).toBe(false);
  });
});

describe('product ids', () => {
  it('folds Vietnamese diacritics instead of dropping the letters', async () => {
    /* Audio items may have no SKU, so the name becomes the public
       /cameras/<id> URL. `[^a-z0-9]` alone turned "chống ồn" into "ch-ng-n". */
    db.row = null;
    const res = await create({ sku: '', name: 'Tai nghe chống ồn', category: 'audio', subCategory1: 'Tai nghe' });
    expect(res.status).toBe(200);
    expect((await res.json()).product.id).toBe('sony-tai-nghe-chong-on');
  });
});

describe('category roles', () => {
  /* `canManageCategory()` behind the routes, executed as each role. The row's
     category is what is checked on PATCH — never the body's — and the
     source-order assertion in content-write-boundaries.test.ts cannot tell an
     inverted check from a correct one. */
  it('refuses a PE admin a camera row, before any write', async () => {
    db.role = 'pe';
    const res = await patch({ name: 'x' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'notAllowedForCategory' });
    expect(db.calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('refuses a PE admin a lens create', async () => {
    db.role = 'pe';
    db.row = null;
    const res = await create({ sku: 'SEL-X', name: 'FE X', category: 'lens', subCategory1: 'FE-mount (Full-Frame)' });
    expect(res.status).toBe(403);
    expect(db.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('refuses a DI admin an audio create', async () => {
    db.role = 'di';
    db.row = null;
    const res = await create({ sku: '', name: 'WH-X', category: 'audio', subCategory1: 'Tai nghe' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'notAllowedForCategory' });
  });

  it('lets a DI admin save a lens', async () => {
    db.role = 'di';
    db.row = storedRow({ category: 'lens', specs: null });
    const res = await patch({ name: 'FE 50mm' });
    expect(res.status).toBe(200);
    expect(db.row?.name).toBe('FE 50mm');
  });

  it('refuses a DI admin an audio row', async () => {
    db.role = 'di';
    db.row = storedRow({ category: 'audio', specs: null });
    expect((await patch({ name: 'x' })).status).toBe(403);
  });

  it('lets a PE admin refile a headphone as a speaker, re-shaping its block', async () => {
    db.role = 'pe';
    db.row = storedRow({
      category: 'audio',
      sku: '',
      sub_category_1: 'Tai nghe',
      sub_category_2: 'Choàng đầu',
      specs: {
        kind: 'headphone',
        specsSource: 'https://www.sony.com.vn/wh',
        specsMissing: [],
        battery: '30 giờ',
        designType: 'Choàng đầu',
      },
    });
    const res = await patch({ subCategory1: 'Loa', subCategory2: 'Di động' });
    expect(res.status).toBe(200);
    expect(db.row?.sub_category_1).toBe('Loa');
    const specs = db.row?.specs as ProductSpecs & Record<string, unknown>;
    expect(specs.kind).toBe('speaker');
    expect(specs.battery).toBe('30 giờ');
    expect(specs).not.toHaveProperty('designType');
  });
});

describe('optimistic concurrency', () => {
  /* The editor used to resend every column on each save, and nothing checked
     what it had been looking at. Two admins on one product — or one admin with
     two tabs — and the second save silently reverted the first, both screens
     saying "Đã lưu". `updated_at` is the version: the save names the one it
     was opened against, and a row that has moved on since refuses it. */

  it('keeps the version out of the columns public readers share', () => {
    /* `updated_at` is provenance and is not granted to anon. */
    expect(PRODUCT_COLUMNS).not.toMatch(/updated_at|updated_by/);
    expect(ADMIN_PRODUCT_COLUMNS).toMatch(/\bupdated_at\b/);
    expect(ADMIN_PRODUCT_COLUMNS).not.toMatch(/updated_by/);
  });

  it('refuses a stale version with 409 staleEdit, writing nothing', async () => {
    db.row = storedRow({ updated_at: V2 });
    const res = await patch({ name: 'stale', expectedUpdatedAt: V1 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'staleEdit' });
    expect(db.calls.some((c) => c.op === 'update')).toBe(false);
    expect(db.row?.name).toBe('A7 IV');
  });

  it('refuses when another save lands between the read and the write', async () => {
    db.bumpOnWrite = V2;
    const res = await patch({ name: 'late', expectedUpdatedAt: V1 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'staleEdit' });
    expect(db.row?.name).toBe('A7 IV');
    const write = db.calls.find((c) => c.op === 'update');
    expect(write?.filters).toEqual(['id eq sony-ilce-7m4-bq-ap2', `updated_at eq ${V1}`]);
  });

  it('is still a 404 when the row was deleted rather than changed', async () => {
    db.vanishOnWrite = true;
    const res = await patch({ name: 'gone', expectedUpdatedAt: V1 });
    expect(res.status).toBe(404);
  });

  it('matches a never-edited row with IS NULL', async () => {
    db.row = storedRow({ updated_at: null });
    const res = await patch({ name: 'first edit', expectedUpdatedAt: null });
    expect(res.status).toBe(200);
    const write = db.calls.find((c) => c.op === 'update');
    expect(write?.filters).toEqual(['id eq sony-ilce-7m4-bq-ap2', 'updated_at is null']);
  });

  it('sets the new version itself and hands it back', async () => {
    const res = await patch({ name: 'α7 IV', expectedUpdatedAt: V1, updated_at: '1999-01-01' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(db.row?.updated_at).not.toBe(V1);
    expect(db.row?.updated_at).not.toBe('1999-01-01');
    expect(data.updatedAt).toBe(db.row?.updated_at);
  });

  it('refuses a save that names no version at all', async () => {
    /* Optional would mean any caller that forgets it gets the old
       last-writer-wins behaviour back, silently. */
    const res = await PATCH(
      new Request('http://local/api/admin/products/sony-ilce-7m4-bq-ap2', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'x' }),
      }),
      { params: Promise.resolve({ id: 'sony-ilce-7m4-bq-ap2' }) },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'badRequest' });
    expect(db.calls.some((c) => c.op === 'update')).toBe(false);
  });
});

describe('GET /api/admin/products/[id]', () => {
  it('hands the editor the stored row and its version', async () => {
    const res = await get();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.product.name).toBe('A7 IV');
    expect(data.updatedAt).toBe(V1);
    expect(db.calls[0]).toMatchObject({ op: 'select', columns: ADMIN_PRODUCT_COLUMNS });
  });

  it('answers 404 for a row that is not there', async () => {
    db.row = null;
    expect((await get()).status).toBe(404);
  });

  it('answers contentUnavailable rather than a seed copy when the read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.failWith = { code: 'PGRST000', message: 'down' };
    db.failReads = true;
    const res = await get();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'contentUnavailable' });
  });
});

describe('POST version', () => {
  it('hands back the new row\'s version, so its first save has one to name', async () => {
    db.row = null;
    const res = await create({ sku: 'SEL-V', name: 'FE V', category: 'lens', subCategory1: 'Full Frame' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.updatedAt).toBe('string');
    expect(data.updatedAt).toBe((db.row as Row | null)?.updated_at);
  });
});
