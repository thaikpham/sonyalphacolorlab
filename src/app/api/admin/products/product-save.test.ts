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
 * - a row whose database copy had no spec block refused the whole save.
 *
 * The content client is a recording fake. It holds one `sony_cameras` row and
 * answers the calls the route makes the way PostgREST would — including the
 * case that matters most, an update that matched nothing returning no error.
 */

type Call = { op: 'select' | 'update' | 'insert'; payload?: Record<string, unknown>; columns?: string };

const db = {
  row: null as ProductRow | null,
  calls: [] as Call[],
  failWith: null as { code: string; message: string } | null,
  /** Deleted between the route's read and its write. */
  vanishOnWrite: false,
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

function storedRow(over: Partial<ProductRow> = {}): ProductRow {
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
    ...over,
  };
}

const pick = (row: ProductRow, columns: string) =>
  Object.fromEntries(
    columns.split(',').map((c) => c.trim()).map((c) => [c, (row as Record<string, unknown>)[c]]),
  ) as ProductRow;

vi.mock('@/lib/supabase/server', () => ({
  contentAdmin: () => ({
    from: (table: string) => {
      expect(table).toBe('sony_cameras');
      let pending: Call | null = null;
      let filterId: string | null = null;
      const builder = {
        select(columns: string) {
          if (pending) pending.columns = columns;
          else {
            pending = { op: 'select', columns };
            db.calls.push(pending);
          }
          return builder;
        },
        update(payload: Record<string, unknown>) {
          pending = { op: 'update', payload };
          db.calls.push(pending);
          return builder;
        },
        insert(payload: Record<string, unknown>) {
          pending = { op: 'insert', payload };
          db.calls.push(pending);
          return builder;
        },
        eq(column: string, value: string) {
          expect(column).toBe('id');
          filterId = value;
          return builder;
        },
        async maybeSingle() {
          if (db.failWith && pending?.op !== 'select') return { data: null, error: db.failWith };
          const match = db.row && (filterId === null || db.row.id === filterId) ? db.row : null;
          if (pending?.op === 'update' && db.vanishOnWrite) return { data: null, error: null };
          if (pending?.op === 'update' && match) {
            db.row = { ...match, ...(pending.payload as Partial<ProductRow>) };
          }
          const current = pending?.op === 'update' ? (match ? db.row : null) : match;
          return { data: current ? pick(current, pending?.columns ?? PRODUCT_COLUMNS) : null, error: null };
        },
        async single() {
          if (db.failWith) return { data: null, error: db.failWith };
          db.row = { ...(pending?.payload as unknown as ProductRow) };
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
    admin: { id: 'u1', email: 'editor@example.com', name: 'Editor', avatarUrl: null, assuranceLevel: 'aal2', role: 'super' },
  }),
}));

const { PATCH, blankSpecs } = await import('./[id]/route');
const { POST } = await import('./route');

const patch = (body: unknown, id = 'sony-ilce-7m4-bq-ap2') =>
  PATCH(
    new Request(`http://local/api/admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  db.row = storedRow();
  db.calls = [];
  db.failWith = null;
  db.vanishOnWrite = false;
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
    expect(write?.columns).toBe(PRODUCT_COLUMNS);
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

  it('still refuses a spec kind the category cannot have', async () => {
    db.row = storedRow({ specs: null });
    const res = await patch({ specs: { kind: 'speaker', power: '100W' } });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('noSpecBlock');
  });

  it('keeps the stored kind even if the body names another', async () => {
    await patch({ specs: { kind: 'lens', sensor: 'APS-C' } });
    const specs = db.row?.specs as ProductSpecs;
    expect(specs.kind).toBe('camera');
    expect((specs as CameraSpecs).sensor).toBe('APS-C');
  });
});

describe('blankSpecs', () => {
  it('accepts only kinds the category allows', () => {
    expect(blankSpecs('audio', 'headphone')?.kind).toBe('headphone');
    expect(blankSpecs('audio', 'speaker')?.kind).toBe('speaker');
    expect(blankSpecs('audio', 'camera')).toBeNull();
    expect(blankSpecs('lens', 'lens')?.kind).toBe('lens');
    expect(blankSpecs('camera', undefined)).toBeNull();
  });

  it('gives an accessory the keySpecs list its type requires', () => {
    expect(blankSpecs('accessory', 'accessory')).toMatchObject({ keySpecs: [] });
  });
});

describe('POST /api/admin/products', () => {
  const create = (body: unknown) =>
    POST(new Request('http://local/api/admin/products', { method: 'POST', body: JSON.stringify(body) }));

  it('returns the row the database stored', async () => {
    db.row = null;
    const res = await create({
      sku: 'SEL-TEST',
      name: 'FE Test',
      category: 'lens',
      subCategory1: 'FE-mount (Full-Frame)',
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
    await create({ sku: 'ECM-TEST', name: 'Mic', category: 'accessory', subCategory1: 'Audio' });
    /* Read through a widened type: `db.row = null` above narrows it for TS,
       but the route reassigned it. */
    const stored = db.row as ProductRow | null;
    expect(stored?.specs).toMatchObject({ kind: 'accessory', keySpecs: [] });
  });

  it('names a duplicate instead of "could not save"', async () => {
    db.failWith = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const res = await create({ sku: 'ILCE-7M4/BQ AP2', name: 'A7 IV', category: 'camera', subCategory1: 'x' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('duplicateProduct');
  });
});
