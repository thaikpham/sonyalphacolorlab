# Camera highlights (public page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A camera page with `highlights` shows 4–6 explained key features and a short Core specs block, with the full 12-row table collapsed; without `highlights` it renders exactly as today.

**Architecture:** One new jsonb column, `sony_cameras.highlights`, validated by a Zod schema in `src/lib/cameras/highlights.ts` on every read and every admin write. Two Server Components render it; the camera page chooses between them and today's layout. `/admin/wiki` edits it through the existing product PATCH.

**Tech Stack:** Next.js 16 App Router (Server Components), next-intl, Zod 4, Supabase/PostgREST, PGlite (migration tests), Vitest.

Spec: `docs/superpowers/specs/2026-10-07-camera-highlights-sales-talk-design.md` (sections "The page", "Data", "Admin", "Errors"). The sales talk and the content for the 31 cameras are separate plans.

## Global Constraints

- Every user-visible string goes in `messages/en.json` and `messages/vi.json`, same keys in both (`messages.test.ts`).
- Design rules (CLAUDE.md): Noto Sans only; type scale only (`text-title-3`, `text-body`, `text-body-sm`, `.label`, `.meta`); no `border`/`ring`/`outline`; `.surface` for panels, `.row-tint` for rows; touch targets ≥ 44px; no motion other than `.animate-fade-in`.
- A column the catalogue selects must be granted to `anon` in BOTH migration roots (`migration-roots.test.ts`).
- Content migrations are named with a 14-digit timestamp and applied by hand **before** the code that reads them is merged (AGENTS.md). Control migrations are applied by the merge to `main`.
- Never `select('*')`; `PRODUCT_COLUMNS` names every column.
- `npm run verify` must pass before every commit that reaches a PR.

---

## File Structure

| File | Responsibility |
|---|---|
| Create `src/lib/cameras/highlights.ts` | Schema, types, `parseHighlights`, `highlightsFor`, editor draft conversion |
| Create `src/lib/cameras/highlights.test.ts` | Unit tests for the above |
| Create `supabase/content/migrations/20261007000001_camera_highlights.sql` | Column, object check, anon grant (content) |
| Create `supabase/migrations/0018_sony_camera_highlights_rollback_compat.sql` | Same column on the control rollback copy |
| Modify `src/lib/supabase/migration-roots.test.ts` | Pin the check constraint in both roots |
| Modify `src/lib/cameras/types.ts` | `SonyCamera.highlights`; `CameraCard` drops it |
| Modify `src/lib/cameras/row.ts` (+ `row.test.ts`) | Select and map the column |
| Modify `scripts/pull-supabase.ts`, `scripts/supabase/tables.ts` | Carry the column to seeds and exports |
| Create `src/components/camera-highlights.tsx` | `CameraHighlights`, `CoreSpecs` (Server Components) |
| Modify `src/components/product-spec-table.tsx` | `embedded` mode for use inside `<details>` |
| Modify `src/app/[locale]/cameras/[id]/page.tsx` | Choose highlights layout or today's |
| Create `src/app/[locale]/cameras/camera-page.test.ts` | Pin the page wiring |
| Modify `src/app/api/admin/products/[id]/route.ts` (+ `product-save.test.ts`) | Accept and validate `highlights` |
| Modify `src/components/admin/admin-editor.tsx` | Highlights editor for cameras |
| Modify `messages/en.json`, `messages/vi.json` | New labels |
| Modify `AGENTS.md`, the spec | Rule + migration numbering |

---

### Task 1: The highlights module

**Files:**
- Create: `src/lib/cameras/highlights.ts`
- Test: `src/lib/cameras/highlights.test.ts`

**Interfaces:**
- Produces:
  - `CORE_SPEC_KEYS: readonly ['sensor','autofocus','burst','video','stabilization','screen','battery','weight']`, `type CoreSpecKey`
  - `highlightsSchema` (Zod), `type Highlights = { en: HighlightsSide; vi: HighlightsSide }`, `type HighlightsSide = { points: { title: string; body: string }[]; keySpecs: { key: CoreSpecKey; value: string }[] }`
  - `parseHighlights(value: unknown): Highlights | null`
  - `highlightsFor(h: Highlights | null | undefined, locale: string): HighlightsSide | null`
  - `type HighlightsDraft = Record<'en' | 'vi', { points: string; specs: Record<CoreSpecKey, string> }>`
  - `highlightsToDraft(h: Highlights | null): HighlightsDraft`
  - `draftToHighlights(d: HighlightsDraft): unknown | null` (null when every field is empty; otherwise the object to send, validated by the server)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/cameras/highlights.test.ts
import { describe, expect, it } from 'vitest';
import {
  CORE_SPEC_KEYS,
  draftToHighlights,
  highlightsFor,
  highlightsSchema,
  highlightsToDraft,
  parseHighlights,
  type Highlights,
} from './highlights';

const side = (n = 4) => ({
  points: Array.from({ length: n }, (_, i) => ({ title: `Title ${i + 1}`, body: `Body ${i + 1}.` })),
  keySpecs: [{ key: 'sensor' as const, value: '33MP Full-Frame' }],
});
const valid: Highlights = { en: side(), vi: side() };

describe('highlightsSchema', () => {
  it('accepts 4 to 6 points in each language', () => {
    expect(highlightsSchema.safeParse(valid).success).toBe(true);
    expect(highlightsSchema.safeParse({ en: side(6), vi: side(6) }).success).toBe(true);
  });

  it('refuses fewer than 4 or more than 6 points', () => {
    expect(highlightsSchema.safeParse({ en: side(3), vi: side() }).success).toBe(false);
    expect(highlightsSchema.safeParse({ en: side(), vi: side(7) }).success).toBe(false);
  });

  it('refuses a missing language, an unknown core spec, a repeated one, and stray keys', () => {
    expect(highlightsSchema.safeParse({ en: side() }).success).toBe(false);
    expect(highlightsSchema.safeParse({ en: { ...side(), keySpecs: [{ key: 'iso', value: 'x' }] }, vi: side() }).success).toBe(false);
    const twice = [{ key: 'sensor', value: 'a' }, { key: 'sensor', value: 'b' }];
    expect(highlightsSchema.safeParse({ en: { ...side(), keySpecs: twice }, vi: side() }).success).toBe(false);
    expect(highlightsSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});

describe('parseHighlights', () => {
  it('returns the value when valid and null otherwise, never throwing', () => {
    expect(parseHighlights(valid)).toEqual(valid);
    expect(parseHighlights(null)).toBeNull();
    expect(parseHighlights(undefined)).toBeNull();
    expect(parseHighlights({ en: side(1), vi: side(1) })).toBeNull();
    expect(parseHighlights('nope')).toBeNull();
  });
});

describe('highlightsFor', () => {
  it('picks the locale, English for anything but vi', () => {
    const h = { en: side(4), vi: side(5) };
    expect(highlightsFor(h, 'vi')?.points).toHaveLength(5);
    expect(highlightsFor(h, 'en')?.points).toHaveLength(4);
    expect(highlightsFor(null, 'vi')).toBeNull();
  });
});

describe('the editor draft', () => {
  it('round-trips through the "Title :: body" text form', () => {
    const draft = highlightsToDraft(valid);
    expect(draft.en.points.split('\n')[0]).toBe('Title 1 :: Body 1.');
    expect(draft.en.specs.sensor).toBe('33MP Full-Frame');
    expect(draft.en.specs.weight).toBe('');
    expect(highlightsSchema.parse(draftToHighlights(draft))).toEqual(valid);
  });

  it('is null when nothing is filled in, so a save clears the column', () => {
    expect(draftToHighlights(highlightsToDraft(null))).toBeNull();
  });

  it('keeps core specs in CORE_SPEC_KEYS order and drops empty ones', () => {
    const draft = highlightsToDraft(null);
    draft.en.points = draft.vi.points = 'A :: a\nB :: b\nC :: c\nD :: d';
    draft.en.specs.weight = '658 g';
    draft.en.specs.sensor = '33MP';
    const out = draftToHighlights(draft) as Highlights;
    expect(out.en.keySpecs.map((r) => r.key)).toEqual(['sensor', 'weight']);
    expect(out.vi.keySpecs).toEqual([]);
    expect(CORE_SPEC_KEYS).toHaveLength(8);
  });

  it('leaves a line without " :: " as an empty body, which the schema then refuses', () => {
    const draft = highlightsToDraft(null);
    draft.en.points = draft.vi.points = 'A\nB :: b\nC :: c\nD :: d';
    expect(highlightsSchema.safeParse(draftToHighlights(draft)).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cameras/highlights.test.ts`
Expected: FAIL — `Failed to resolve import "./highlights"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/cameras/highlights.ts
import { z } from 'zod';

/**
 * What a camera page shows a buyer instead of the raw feature bullets and the
 * 12-row table: 4–6 explained points and up to eight plain core specs, in both
 * languages. Stored in `sony_cameras.highlights`; validated on every read and
 * every admin write, so a malformed row renders the old page instead of a
 * broken one. See docs/superpowers/specs/2026-10-07-camera-highlights-sales-talk-design.md.
 */

export const CORE_SPEC_KEYS = [
  'sensor', 'autofocus', 'burst', 'video', 'stabilization', 'screen', 'battery', 'weight',
] as const;
export type CoreSpecKey = (typeof CORE_SPEC_KEYS)[number];

const text = (max: number) => z.string().trim().min(1).max(max);

const sideSchema = z.strictObject({
  points: z.array(z.strictObject({ title: text(80), body: text(320) })).min(4).max(6),
  keySpecs: z
    .array(z.strictObject({ key: z.enum(CORE_SPEC_KEYS), value: text(160) }))
    .max(CORE_SPEC_KEYS.length)
    .refine((rows) => new Set(rows.map((r) => r.key)).size === rows.length, 'a core spec appears twice'),
});

export const highlightsSchema = z.strictObject({ en: sideSchema, vi: sideSchema });
export type Highlights = z.infer<typeof highlightsSchema>;
export type HighlightsSide = Highlights['en'];

export function parseHighlights(value: unknown): Highlights | null {
  if (value === null || value === undefined) return null;
  const parsed = highlightsSchema.safeParse(value);
  if (!parsed.success) {
    console.warn('[highlights] stored value failed validation; rendering the fallback page');
    return null;
  }
  return parsed.data;
}

export function highlightsFor(h: Highlights | null | undefined, locale: string): HighlightsSide | null {
  if (!h) return null;
  return locale === 'vi' ? h.vi : h.en;
}

/** The editor's text form: one point per line, `Title :: body`. */
const SEPARATOR = ' :: ';

export type HighlightsDraft = Record<'en' | 'vi', { points: string; specs: Record<CoreSpecKey, string> }>;

const emptySpecs = (): Record<CoreSpecKey, string> =>
  Object.fromEntries(CORE_SPEC_KEYS.map((k) => [k, ''])) as Record<CoreSpecKey, string>;

export function highlightsToDraft(h: Highlights | null): HighlightsDraft {
  const side = (s: HighlightsSide | undefined) => {
    const specs = emptySpecs();
    for (const row of s?.keySpecs ?? []) specs[row.key] = row.value;
    return { points: (s?.points ?? []).map((p) => `${p.title}${SEPARATOR}${p.body}`).join('\n'), specs };
  };
  return { en: side(h?.en), vi: side(h?.vi) };
}

export function draftToHighlights(d: HighlightsDraft): unknown | null {
  const side = (s: HighlightsDraft['en']) => ({
    points: s.points
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const at = line.indexOf(SEPARATOR.trim());
        return at === -1
          ? { title: line, body: '' }
          : { title: line.slice(0, at).trim(), body: line.slice(at + SEPARATOR.trim().length).trim() };
      }),
    keySpecs: CORE_SPEC_KEYS.filter((k) => s.specs[k].trim()).map((k) => ({ key: k, value: s.specs[k].trim() })),
  });
  const out = { en: side(d.en), vi: side(d.vi) };
  const empty = (s: ReturnType<typeof side>) => s.points.length === 0 && s.keySpecs.length === 0;
  return empty(out.en) && empty(out.vi) ? null : out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/cameras/highlights.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cameras/highlights.ts src/lib/cameras/highlights.test.ts
git commit -m "feat(cameras): highlights schema, parser and editor draft form"
```

---

### Task 2: Migrations in both roots

**Files:**
- Create: `supabase/content/migrations/20261007000001_camera_highlights.sql`
- Create: `supabase/migrations/0018_sony_camera_highlights_rollback_compat.sql`
- Modify: `src/lib/supabase/migration-roots.test.ts` (add one `it` inside `describe('what a browser may read', …)`)

**Interfaces:**
- Produces: column `sony_cameras.highlights jsonb` (nullable, object-or-null check `sony_cameras_highlights_is_object`), `grant select (highlights)` to anon and authenticated, in both roots.

- [ ] **Step 1: Write the failing test** — add inside `describe('what a browser may read', () => {` in `src/lib/supabase/migration-roots.test.ts`:

```ts
  it('stores highlights as an object or nothing, in both roots', async () => {
    for (const [name, db] of ROOTS()) {
      await expect(
        db.exec(`update sony_cameras set highlights = '[]'::jsonb where false`),
        `${name}: the column exists`,
      ).resolves.toBeDefined();
      await db.exec(`
        insert into sony_cameras (id, sku, name, full_name, category, price_vnd, price_formatted, url, image_url)
        values ('hl-probe', 'HL-1', 'Probe', 'Probe', 'camera', 1, '1 ₫', '', '')
        on conflict (id) do nothing;
      `);
      await expect(db.exec(`update sony_cameras set highlights = '[]'::jsonb where id = 'hl-probe'`), name).rejects.toThrow();
      await db.exec(`update sony_cameras set highlights = '{"en":{},"vi":{}}'::jsonb where id = 'hl-probe'`);
      await db.exec(`update sony_cameras set highlights = null where id = 'hl-probe'`);
    }
  });
```

(`PRODUCT_COLUMNS` gains `highlights` in Task 3; the existing test `'%s can read every column the catalogue selects, on both projects'` then pins the grant in both roots.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/supabase/migration-roots.test.ts -t "highlights"`
Expected: FAIL — `column "highlights" of relation "sony_cameras" does not exist`.

- [ ] **Step 3: Write the migrations**

```sql
-- supabase/content/migrations/20261007000001_camera_highlights.sql
-- ---------------------------------------------------------------------------
-- 20261007000001 — highlights for the camera page
-- ---------------------------------------------------------------------------
--
-- 4–6 explained key features and up to eight plain core specs, EN and VI, for
-- a buyer. The shape is validated by `highlightsSchema` (src/lib/cameras/
-- highlights.ts) on every read and write; the database only insists it is an
-- object or nothing, so a malformed write is refused rather than stored.
-- Public, like every other catalogue column the page reads.

alter table sony_cameras add column if not exists highlights jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sony_cameras_highlights_is_object') then
    alter table sony_cameras
      add constraint sony_cameras_highlights_is_object
      check (highlights is null or jsonb_typeof(highlights) = 'object');
  end if;
end $$;

grant select (highlights) on table sony_cameras to anon, authenticated;
```

```sql
-- supabase/migrations/0018_sony_camera_highlights_rollback_compat.sql
-- 0018: `highlights` on the control project's dormant sony_cameras copy, so a
-- rollback import keeps one column list (scripts/supabase/tables.ts). Same
-- statements as content 20261007000001.

alter table sony_cameras add column if not exists highlights jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sony_cameras_highlights_is_object') then
    alter table sony_cameras
      add constraint sony_cameras_highlights_is_object
      check (highlights is null or jsonb_typeof(highlights) = 'object');
  end if;
end $$;

grant select (highlights) on table sony_cameras to anon, authenticated;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/supabase/migration-roots.test.ts src/lib/recipes/migration.test.ts`
Expected: PASS. (The reconcile block uses only files before its own version, so a later content file does not affect it.)

- [ ] **Step 5: Commit**

```bash
git add supabase/content/migrations/20261007000001_camera_highlights.sql supabase/migrations/0018_sony_camera_highlights_rollback_compat.sql src/lib/supabase/migration-roots.test.ts
git commit -m "feat(supabase): sony_cameras.highlights in both roots"
```

---

### Task 3: Read the column everywhere the catalogue is read

**Files:**
- Modify: `src/lib/cameras/types.ts` (`SonyCamera`, `CameraCard`, `toCameraCard`)
- Modify: `src/lib/cameras/row.ts` (`PRODUCT_COLUMNS`, `ProductRow`, `productFromRow`)
- Modify: `src/lib/cameras/row.test.ts`
- Modify: `scripts/pull-supabase.ts` (`PULLED`, the select string)
- Modify: `scripts/supabase/tables.ts` (`sony_cameras.columns`)

**Interfaces:**
- Consumes: `parseHighlights`, `type Highlights` (Task 1).
- Produces: `SonyCamera.highlights?: Highlights | null`; `PRODUCT_COLUMNS` ends `…, features, specs, highlights`.

- [ ] **Step 1: Write the failing test** — append to `src/lib/cameras/row.test.ts` (it already builds rows with a helper; if the helper is named differently, build the row inline as shown):

```ts
import { PRODUCT_COLUMNS, productFromRow, type ProductRow } from './row';
import { toCameraCard } from './types';

const hlSide = {
  points: [1, 2, 3, 4].map((i) => ({ title: `T${i}`, body: `B${i}.` })),
  keySpecs: [{ key: 'sensor' as const, value: '33MP' }],
};
const baseRow: ProductRow = {
  id: 'sony-x', sku: 'X', name: 'X', full_name: 'X', category: 'camera',
  sub_category_1: null, sub_category_2: null, price_vnd: 1, price_formatted: '1 ₫',
  url: '', image_url: '', gallery_urls: null, features: { en: [], vi: [] }, specs: null,
};

describe('highlights', () => {
  it('is selected by name', () => {
    expect(PRODUCT_COLUMNS.split(',').map((c) => c.trim())).toContain('highlights');
  });

  it('maps a valid column and drops an invalid one to null', () => {
    expect(productFromRow({ ...baseRow, highlights: { en: hlSide, vi: hlSide } }).highlights?.vi.points).toHaveLength(4);
    expect(productFromRow({ ...baseRow, highlights: { en: hlSide } }).highlights).toBeNull();
    expect(productFromRow(baseRow).highlights).toBeNull();
  });

  it('never reaches a catalogue card', () => {
    const card = toCameraCard(productFromRow({ ...baseRow, highlights: { en: hlSide, vi: hlSide } }));
    expect('highlights' in card).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cameras/row.test.ts -t highlights`
Expected: FAIL — `PRODUCT_COLUMNS` does not contain `highlights`.

- [ ] **Step 3: Implement**

In `src/lib/cameras/row.ts`:

```ts
import { parseHighlights } from './highlights';
// …
export const PRODUCT_COLUMNS =
  'id, sku, name, full_name, category, sub_category_1, sub_category_2, price_vnd, price_formatted, url, image_url, gallery_urls, features, specs, highlights';
// in ProductRow, after `specs: unknown;`:
  highlights?: unknown;
// in productFromRow's returned object, after `specs: …,`:
    /* No seed fallback: a null column is "no highlights", and the page then
       renders the feature bullets, which is the fallback. */
    highlights: parseHighlights(row.highlights),
```

In `src/lib/cameras/types.ts`, add the import at the top and the field in `SonyCamera` after `specs`:

```ts
import type { Highlights } from './highlights';
// in interface SonyCamera, after the specs field:
  /** Buyer-facing explained features and core specs (camera pages). */
  highlights?: Highlights | null;
```

and keep it off the listing payload:

```ts
export type CameraCard = Omit<SonyCamera, 'specs' | 'galleryUrls' | 'highlights'> & {
// …
export function toCameraCard(c: SonyCamera): CameraCard {
  const { specs, galleryUrls: _galleryUrls, highlights: _highlights, ...card } = c;
  return { ...card, specChips: chipsFor(specs) };
}
```

In `scripts/pull-supabase.ts`, add `['highlights', 'highlights'],` to `PULLED` after `['specs', 'specs'],`, and add `highlights` to the select string after `specs`. A null column is skipped there already, so seeds only gain the key for cameras that have highlights.

In `scripts/supabase/tables.ts`, add `'highlights',` to the `sony_cameras` columns after `'specs',`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/cameras src/lib/supabase/migration-roots.test.ts scripts/supabase`
Expected: PASS, including `'%s can read every column the catalogue selects, on both projects'`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cameras/types.ts src/lib/cameras/row.ts src/lib/cameras/row.test.ts scripts/pull-supabase.ts scripts/supabase/tables.ts
git commit -m "feat(cameras): read highlights with the catalogue, keep it off cards"
```

---

### Task 4: The camera page

**Files:**
- Create: `src/components/camera-highlights.tsx`
- Modify: `src/components/product-spec-table.tsx` (add `embedded?: boolean`)
- Modify: `src/app/[locale]/cameras/[id]/page.tsx`
- Modify: `messages/en.json`, `messages/vi.json` (namespace `cameras`)
- Create: `src/app/[locale]/cameras/camera-page.test.ts`

**Interfaces:**
- Consumes: `highlightsFor`, `parseHighlights`, `CORE_SPEC_KEYS`, `type CoreSpecKey` (Task 1); `SonyCamera.highlights` (Task 3).
- Produces: `CameraHighlights({ points })`, `CoreSpecs({ rows })`; `ProductSpecTable({ specs, locale, embedded })`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/[locale]/cameras/camera-page.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import vi from '../../../../messages/vi.json';
import { CORE_SPEC_KEYS } from '@/lib/cameras/highlights';

const page = readFileSync('src/app/[locale]/cameras/[id]/page.tsx', 'utf8');

describe('the camera page', () => {
  it('shows highlights and core specs when a camera has them', () => {
    expect(page).toContain('<CameraHighlights points={highlights.points} />');
    expect(page).toContain('<CoreSpecs rows={highlights.keySpecs} />');
  });

  it('collapses the full table under its own heading', () => {
    expect(page).toMatch(/<details[\s\S]*fullSpecsHeading[\s\S]*<ProductSpecTable[^>]*embedded[\s\S]*<\/details>/);
  });

  it('keeps today\'s feature list as the fallback', () => {
    expect(page).toMatch(/highlights \?[\s\S]*:\s*\([\s\S]*featureList\(product\.features, locale\)/);
  });

  it('labels every core spec in both languages', () => {
    for (const key of CORE_SPEC_KEYS) {
      expect(en.cameras.coreSpecs[key], key).toBeTruthy();
      expect(vi.cameras.coreSpecs[key], key).toBeTruthy();
    }
    expect(vi.cameras.specs.fullSpecsHeading).toBe('Thông số kỹ thuật đầy đủ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/[locale]/cameras/camera-page.test.ts"`
Expected: FAIL — page does not contain `<CameraHighlights`.

- [ ] **Step 3: Implement**

Messages — `messages/en.json`, inside `"cameras"` add (and `fullSpecsHeading` inside `"cameras" → "specs"`):

```json
"coreSpecsTitle": "Key specs",
"coreSpecs": {
  "sensor": "Sensor",
  "autofocus": "Autofocus",
  "burst": "Burst shooting",
  "video": "Video",
  "stabilization": "Stabilization",
  "screen": "Screen & viewfinder",
  "battery": "Battery",
  "weight": "Weight"
},
```
```json
"fullSpecsHeading": "Full technical specifications"
```

`messages/vi.json`, same places:

```json
"coreSpecsTitle": "Thông số chính",
"coreSpecs": {
  "sensor": "Cảm biến",
  "autofocus": "Lấy nét",
  "burst": "Chụp liên tục",
  "video": "Quay video",
  "stabilization": "Chống rung",
  "screen": "Màn hình & kính ngắm",
  "battery": "Pin",
  "weight": "Trọng lượng"
},
```
```json
"fullSpecsHeading": "Thông số kỹ thuật đầy đủ"
```

Component:

```tsx
// src/components/camera-highlights.tsx
import { getTranslations } from 'next-intl/server';
import { CORE_SPEC_KEYS, type HighlightsSide } from '@/lib/cameras/highlights';

/**
 * What a buyer reads first on a camera page: the features that matter,
 * explained, and the handful of specs that decide a purchase. Rendered only
 * for a camera with valid `highlights`; the page falls back to the feature
 * bullets otherwise. Server Components — nothing here reaches the browser.
 */

export async function CameraHighlights({ points }: { points: HighlightsSide['points'] }) {
  const t = await getTranslations('cameras');
  return (
    <section aria-labelledby="h-highlights" className="surface flex flex-col gap-3 p-5">
      <h2 id="h-highlights" className="text-title-3 font-semibold tracking-[-0.02em] text-ink">
        {t('featuresLabel')}
      </h2>
      <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {points.map((p) => (
          <li key={p.title} className="row-tint flex flex-col gap-1 rounded-sm p-4">
            <h3 className="text-body font-semibold text-ink">{p.title}</h3>
            <p className="text-body-sm leading-relaxed text-ink-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function CoreSpecs({ rows }: { rows: HighlightsSide['keySpecs'] }) {
  const t = await getTranslations('cameras');
  const ordered = [...rows].sort((a, b) => CORE_SPEC_KEYS.indexOf(a.key) - CORE_SPEC_KEYS.indexOf(b.key));
  return (
    <section aria-labelledby="h-core-specs" className="surface flex flex-col gap-3 p-5">
      <h2 id="h-core-specs" className="text-title-3 font-semibold tracking-[-0.02em] text-ink">
        {t('coreSpecsTitle')}
      </h2>
      <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {ordered.map((r) => (
          <div key={r.key} className="row-tint flex flex-col gap-0.5 rounded-sm px-4 py-3">
            <dt className="meta">{t(`coreSpecs.${r.key}`)}</dt>
            <dd className="text-body-sm font-semibold text-ink tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
```

`src/components/product-spec-table.tsx` — add the prop and use it:

```tsx
export async function ProductSpecTable({
  specs,
  locale,
  embedded = false,
}: {
  specs: ProductSpecs;
  locale: string;
  /** Inside a `<details>` whose summary is the heading: no panel, no h3. */
  embedded?: boolean;
}) {
```

and replace the outer wrapper and heading:

```tsx
  return (
    <div className={embedded ? 'flex flex-col gap-3' : 'surface p-5 flex flex-col gap-3'}>
      {embedded ? null : <h3 className="label">{t('specs.specsHeading')}</h3>}
```

Page — `src/app/[locale]/cameras/[id]/page.tsx`. Imports:

```tsx
import { CameraHighlights, CoreSpecs } from '@/components/camera-highlights';
import { highlightsFor, parseHighlights } from '@/lib/cameras/highlights';
```

After `const t = await getTranslations('cameras');` add:

```tsx
  /* Parsed here as well as in `productFromRow`: offline, the seed reaches the
     page without passing through the row mapper. */
  const highlights = highlightsFor(parseHighlights(product.highlights), locale);
```

Replace the whole `<div className="flex flex-col gap-5">…</div>` that holds "Key Features Section" and the spec table with:

```tsx
        <div className="flex flex-col gap-5">
          {highlights ? (
            <>
              <CameraHighlights points={highlights.points} />
              {highlights.keySpecs.length > 0 && <CoreSpecs rows={highlights.keySpecs} />}
              {product.specs && (
                <details className="surface p-5">
                  <summary className="flex min-h-11 cursor-pointer items-center text-title-3 font-semibold tracking-[-0.02em] text-ink">
                    {t('specs.fullSpecsHeading')}
                  </summary>
                  <div className="mt-3">
                    <ProductSpecTable specs={product.specs} locale={locale} embedded />
                  </div>
                </details>
              )}
            </>
          ) : (
            <>
              {/* Key Features Section */}
              <div className="surface p-5 flex flex-col gap-3">
                {/* h2, not h3: the only heading above this one is the product
                    name in the hero, and h1 → h3 is a level skip. */}
                <h2 className="text-title-3 font-semibold text-ink tracking-[-0.02em]">
                  {t('featuresLabel')}
                </h2>

                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-body-sm text-ink-muted leading-relaxed">
                  {featureList(product.features, locale).map((feat: string, idx: number) => (
                    <li key={idx} className="row-tint flex items-start gap-2.5 p-3">
                      <span className="text-accent-400 shrink-0 leading-none">•</span>
                      <span className="flex-1">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Scientific Specs Table */}
              {product.specs && <ProductSpecTable specs={product.specs} locale={locale} />}
            </>
          )}
        </div>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run "src/app/[locale]/cameras/camera-page.test.ts" src/app/messages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/camera-highlights.tsx src/components/product-spec-table.tsx "src/app/[locale]/cameras/[id]/page.tsx" "src/app/[locale]/cameras/camera-page.test.ts" messages/en.json messages/vi.json
git commit -m "feat(cameras): explained highlights, core specs and a collapsed full table"
```

---

### Task 5: The admin save accepts highlights

**Files:**
- Modify: `src/app/api/admin/products/[id]/route.ts` (body type, validation, `update.highlights`)
- Modify: `src/app/api/admin/products/product-save.test.ts`
- Modify: `messages/en.json`, `messages/vi.json` (`admin.errors.invalidHighlights`)

**Interfaces:**
- Consumes: `highlightsSchema` (Task 1); `PRODUCT_COLUMNS` with `highlights` (Task 3).
- Produces: `PATCH /api/admin/products/[id]` body field `highlights?: unknown` — `null` clears; an object must pass `highlightsSchema` and the product must be a camera, else `400 { error: 'invalidHighlights' }`.

- [ ] **Step 1: Write the failing test** — append inside `describe('PATCH /api/admin/products/[id]', () => {`:

```ts
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
    await patch({ highlights: null });
    expect(db.row?.highlights).toBeNull();
  });

  it('refuses highlights on a product that is not a camera', async () => {
    db.row = storedRow({ category: 'lens' });
    const res = await patch({ highlights: { en: hlSide, vi: hlSide } });
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/admin/products/product-save.test.ts -t highlights`
Expected: FAIL — status 200 for the invalid body / `highlights` undefined on the row.

- [ ] **Step 3: Implement** — in `src/app/api/admin/products/[id]/route.ts`:

Import: `import { highlightsSchema } from '@/lib/cameras/highlights';`

In the PATCH body type (beside `features?: …`): `highlights?: unknown;`

Before `const update: Record<string, unknown> = {` (after `product` is known), validate first so a refusal writes nothing:

```ts
  let highlights: unknown | undefined;
  if (body.highlights !== undefined) {
    if (body.highlights === null) highlights = null;
    else {
      const parsed = highlightsSchema.safeParse(body.highlights);
      if (!parsed.success || product.category !== 'camera') {
        return NextResponse.json({ error: 'invalidHighlights' }, { status: 400 });
      }
      highlights = parsed.data;
    }
  }
```

After the `features` block:

```ts
  if (highlights !== undefined) update.highlights = highlights;
```

Messages — inside `"admin" → "errors"`:
- en: `"invalidHighlights": "Highlights need 4–6 lines of Title :: explanation in both languages, on a camera."`
- vi: `"invalidHighlights": "Điểm nổi bật cần 4–6 dòng dạng Tiêu đề :: giải thích ở cả hai ngôn ngữ, và chỉ dành cho máy ảnh."`

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/app/api/admin src/app/messages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/products/[id]/route.ts" src/app/api/admin/products/product-save.test.ts messages/en.json messages/vi.json
git commit -m "feat(admin): validate and save camera highlights"
```

---

### Task 6: The highlights editor in /admin/wiki

**Files:**
- Modify: `src/components/admin/admin-editor.tsx` (`Draft`, `asDraft`, save body, a new panel after the features panel)
- Modify: `messages/en.json`, `messages/vi.json` (namespace `admin`)

**Interfaces:**
- Consumes: `highlightsToDraft`, `draftToHighlights`, `parseHighlights`, `CORE_SPEC_KEYS`, `type HighlightsDraft` (Task 1); PATCH `highlights` (Task 5).

- [ ] **Step 1: Write the failing test** — extend `src/app/[locale]/cameras/camera-page.test.ts`:

```ts
const editor = readFileSync('src/components/admin/admin-editor.tsx', 'utf8');

describe('the highlights editor', () => {
  it('edits highlights for cameras only and sends them with the save', () => {
    expect(editor).toContain("selected.category === 'camera'");
    expect(editor).toContain('draftToHighlights(draft.hl)');
    expect(editor).toContain('highlightsToDraft(parseHighlights(p.highlights))');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/[locale]/cameras/camera-page.test.ts" -t editor`
Expected: FAIL.

- [ ] **Step 3: Implement** — in `src/components/admin/admin-editor.tsx`:

Imports:

```tsx
import {
  CORE_SPEC_KEYS,
  draftToHighlights,
  highlightsToDraft,
  parseHighlights,
  type HighlightsDraft,
} from '@/lib/cameras/highlights';
```

`Draft` gains `hl: HighlightsDraft;` and `asDraft` returns `hl: highlightsToDraft(parseHighlights(p.highlights)),`.

Inside `AdminEditor`, beside `const tSpec = useTranslations('cameras.specs');`:

```tsx
  const tCore = useTranslations('cameras.coreSpecs');
```

In the save request body, beside `features: { en: lines(draft.en), vi: lines(draft.vi) },`:

```tsx
          ...(selected.category === 'camera' ? { highlights: draftToHighlights(draft.hl) } : {}),
```

A setter beside the other handlers:

```tsx
  const setHl = (side: 'en' | 'vi', patch: Partial<HighlightsDraft['en']>) =>
    setDraft((d) => (d ? { ...d, hl: { ...d.hl, [side]: { ...d.hl[side], ...patch } } } : d));
```

The panel, directly after the closing `</div>` of the "Features section" panel:

```tsx
              {selected.category === 'camera' && (
                <div className="surface p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="label text-proposal">{tSafe('highlightsHeading', 'Điểm nổi bật cho người mua')}</h2>
                    <span className="meta">
                      {tSafe('highlightsHint', 'Mỗi dòng một điểm: Tiêu đề :: giải thích. 4–6 điểm, cả hai ngôn ngữ.')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['en', 'vi'] as const).map((side) => (
                      <div key={side} className="flex flex-col gap-3">
                        <label htmlFor={`hl-${side}`} className="label">
                          {tSafe(side === 'en' ? 'featuresEn' : 'featuresVi', side === 'en' ? 'Tiếng Anh' : 'Tiếng Việt')}
                        </label>
                        <textarea
                          id={`hl-${side}`}
                          value={draft.hl[side].points}
                          onChange={(e) => setHl(side, { points: e.target.value })}
                          rows={8}
                          className={AREA}
                        />
                        <span className="label">{tSafe('coreSpecsHeading', 'Thông số chính')}</span>
                        {CORE_SPEC_KEYS.map((key) => (
                          <label key={key} className="flex flex-col gap-1">
                            <span className="meta">{tCore(key)}</span>
                            <input
                              value={draft.hl[side].specs[key]}
                              onChange={(e) => setHl(side, { specs: { ...draft.hl[side].specs, [key]: e.target.value } })}
                              className={FIELD_SM}
                            />
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
```

Messages — inside `"admin"`:
- en: `"highlightsHeading": "Buyer highlights"`, `"highlightsHint": "One point per line: Title :: explanation. 4–6 points, in both languages."`, `"coreSpecsHeading": "Key specs"`
- vi: `"highlightsHeading": "Điểm nổi bật cho người mua"`, `"highlightsHint": "Mỗi dòng một điểm: Tiêu đề :: giải thích. 4–6 điểm, cả hai ngôn ngữ."`, `"coreSpecsHeading": "Thông số chính"`

If `messages.test.ts` reports that `cameras.coreSpecs` is read by a client component but not shipped, add `cameras` to the namespaces the admin layout passes to `NextIntlClientProvider` (it already ships `cameras.specs`, so `cameras` is expected to be there).

- [ ] **Step 4: Run tests**

Run: `npx vitest run "src/app/[locale]/cameras/camera-page.test.ts" src/app/messages.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin-editor.tsx messages/en.json messages/vi.json "src/app/[locale]/cameras/camera-page.test.ts"
git commit -m "feat(admin): edit camera highlights in /admin/wiki"
```

---

### Task 7: Docs, full verification, browser check, PR

**Files:**
- Modify: `AGENTS.md` (one short section)
- Modify: `docs/superpowers/specs/2026-10-07-camera-highlights-sales-talk-design.md` (migration numbering)

- [ ] **Step 1: AGENTS.md** — add before `## AI ("Tweak with AI")`:

```markdown
## Camera pages

A camera with `highlights` (`sony_cameras.highlights`, validated by
`highlightsSchema` in `src/lib/cameras/highlights.ts`) shows 4–6 explained
features and up to eight core specs; the full spec table sits collapsed below.
Without valid highlights the page renders the feature bullets and the open
table — never an empty section. Highlights are content: every number in them
must come from that camera's own sources.
```

- [ ] **Step 2: Spec numbering** — in the spec's "Migrations" list, the rollback-compat file is `0018_sony_camera_highlights_rollback_compat.sql` (this plan) and the sales staff table becomes `0019_sales_staff.sql` (next plan). Edit both lines.

- [ ] **Step 3: Full gate**

Run: `npm run verify`
Expected: lint, typecheck, all tests, build all pass.

- [ ] **Step 4: Browser check** (dev server via `preview_start alpha-colorlab`, a background tab)
  - `/vi/cameras/sony-ilce-7m4-bq-ap2` with `highlights` still null: the page is unchanged (feature bullets, open table).
  - Temporarily give one seed camera a valid `highlights` object in `data/sony-cameras.seed.json` **only in a scratch copy** — or, online, rely on Task 1–4 tests — and confirm: two new sections, `<details>` closed, both locales, no console errors. Do not commit a fabricated highlights object.

- [ ] **Step 5: Commit and open the PR**

```bash
git add AGENTS.md docs/superpowers/specs/2026-10-07-camera-highlights-sales-talk-design.md
git commit -m "docs: camera highlights rule; migration numbering"
git push -u origin claude/camera-highlights
```

The PR body must say, first: **apply `supabase/content/migrations/20261007000001_camera_highlights.sql` to the content project before merging** — `PRODUCT_COLUMNS` selects `highlights`, and without the column every catalogue read (and the Vercel build) fails. The control file 0018 is applied by the merge.

---

## Self-review notes

- Spec coverage: page order (Task 4), fallback (Task 4 + test), `highlights` column and grant (Tasks 2–3), schema validation on read and write (Tasks 1, 3, 5), admin tab (Task 6), migrations and their order (Tasks 2, 7), errors table rows for highlights (Tasks 1, 4, 5). Sales talk, staff role and content are the next plans.
- Names are consistent across tasks: `CORE_SPEC_KEYS`, `highlightsSchema`, `parseHighlights`, `highlightsFor`, `highlightsToDraft`, `draftToHighlights`, `HighlightsDraft`, `CameraHighlights`, `CoreSpecs`, `embedded`, `invalidHighlights`, `fullSpecsHeading`, `coreSpecsTitle`, `cameras.coreSpecs.*`.
