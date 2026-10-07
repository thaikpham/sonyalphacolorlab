# Camera pages: highlights for buyers, sales talk for staff — design

Status: approved in conversation, 2026-10-07 · Owner: thaikpham

## Goal

A camera page in the Sony Wiki should sell the camera to someone new to
photography: show only the specifications that help them decide, explain each
headline feature in plain, persuasive language, and give the shop staff a
script they can use at the counter or on a livestream — without that script
being public.

Scope is the 31 products with `category = 'camera'`. Lenses, accessories and
audio keep today's page.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Who reads the page, and who is the sales talk for? | Both, kept apart: the public page is for buyers; the sales talk is for staff only |
| Who may read the sales talk? | A new **sales staff** role, granted by email. Administrators may too |
| Where does the content come from? | Drafted from Sony Vietnam's product pages plus the data already held; reviewed by the owner before it reaches the database |
| Technical specifications | A short **Core specs** block, plus the full table collapsed under "Full technical specifications" |
| Sales talk language | Bilingual, like every other piece of content |
| Colour settings section | Removed everywhere (PR #11, done) |

## The page, top to bottom

1. **Hero** — unchanged (name, price, gallery).
2. **Key features, explained** — 4–6 points. Each is a benefit headline and one
   or two plain sentences that say what it means for the buyer:
   > **Chụp người, thú cưng luôn nét** — Real-time Eye AF tự tìm và bám theo
   > mắt người, chó mèo, chim; bạn chỉ cần bấm máy, kể cả khi đối tượng đang chạy.
3. **Core specs** — up to eight rows from a fixed list, each value written
   plainly: `sensor`, `autofocus`, `burst`, `video`, `stabilization`,
   `screen` (screen and viewfinder), `battery`, `weight`. A row with no value
   is left out, not shown as "—".
4. **Full technical specifications** — today's 12-row `ProductSpecTable`,
   inside a closed `<details>`. Its heading today is "Thông số chính" / "Core
   specifications" (`cameras.specs.specsHeading`); on a camera page with
   highlights it becomes "Thông số kỹ thuật đầy đủ" / "Full technical
   specifications", so the two blocks never share a name.
5. **Sales talk** — only for a signed-in staff member; nothing at all for
   anyone else (no teaser, no lock icon).

**Fallback.** A camera without `highlights` renders exactly as today: the
feature bullets, and the full table open. A partly written camera can never
produce an empty page.

The raw feature bullets (`features`) stay in the data. Cards, search, the
compare view and page metadata keep reading them; only the camera page shows
the explained points instead.

## Data

### Content project

**`sony_cameras.highlights jsonb`** — public, readable by anon:

```ts
type Highlights = Record<'en' | 'vi', {
  points: { title: string; body: string }[];        // 4–6
  keySpecs: { key: CoreSpecKey; value: string }[];  // CoreSpecKey: the eight above
}>;
```

Labels for `keySpecs` come from `messages/*.json` (`cameras.coreSpecs.*`); the
values are content and are written per language. Validated by a Zod schema on
read and on every admin write; a row that fails validation renders the
fallback and logs, it never throws a page.

**`camera_sales_talks`** — a separate table, so no grant on `sony_cameras` can
ever expose it:

```sql
camera_id  text primary key references sony_cameras(id) on delete cascade
content    jsonb not null check (jsonb_typeof(content) = 'object')
updated_at timestamptz not null default now()
updated_by text
```

RLS on, no policies, `revoke all … from anon, authenticated`. Only
`contentAdmin()` reads or writes it, and only from a route that has checked
the caller.

```ts
type SalesTalk = Record<'en' | 'vi', {
  opener: string;                                  // the first thing to say
  idealFor: string[];                              // 2–3 buyer profiles
  talkingPoints: { title: string; body: string }[];// exactly 3
  objections: { q: string; a: string }[];          // price, vs. a rival, kit lens…
  pairWith: { productId: string; why: string }[];  // real catalogue ids only
  close: string;
}>;
```

`pairWith.productId` must name a product in the catalogue; the panel links it
by its current title, and drops one that no longer exists.

### Control project

**`sales_staff`** — `email text primary key, note text, created_at`. RLS on,
no grants to anon or authenticated, read only by `controlAdmin()`.
`isSalesStaff(email)` is true for a row here **or** any row in `admin_emails`.

### Migrations

- Content: `20261007000001_camera_highlights.sql` (column + `grant select
  (highlights)`), `20261007000002_camera_sales_talks.sql` (table, RLS, revokes).
  Timestamp versions, applied by hand **before** the code that reads them is
  merged (AGENTS.md).
- Control: `0018_sales_staff.sql`, applied by the merge to `main`.
- Control: `0019_sony_camera_highlights_rollback_compat.sql` adds the same
  nullable column to the dormant rollback copy, so export/import/verify keep
  one column list. Sales talk is not mirrored: it is internal and an admin can
  re-enter it after a rollback.

## Reading the sales talk

The camera page is static HTML shared by everyone, so the sales talk can never
be in it. `SalesTalkPanel` is a Client Component:

1. No session in `auth-context` → render nothing.
2. Session → `GET /api/sales-talk/[id]` with `Authorization: Bearer <token>`.
3. The route: `requireUser(request)` (401 without it) → `isSalesStaff`
   (403 otherwise) → `contentAdmin()` read (404 if none, 503 on a content
   outage) → JSON with `Cache-Control: private, no-store`.
4. 200 → a collapsible panel, in the page's locale; any other status → nothing.

Staff sign in with Google like any reader. One factor is proportionate: the
content is a sales script, read-only, and nothing in this path writes.

## Admin

- `/admin/wiki`, camera products: a **Highlights** tab (points + core specs,
  EN/VI side by side) saved through the existing product PATCH, and a **Sales
  talk** tab saved through `PUT /api/admin/products/[id]/sales-talk`. Both
  validated by the same Zod schemas as the readers.
- A **Sales staff** screen for super administrators: list, add, remove
  emails. Writes go through a route that requires a super admin.
- All new labels go in `messages/*.json`; field guidance is allowed in
  `/admin` (CLAUDE.md).

## Content for the 31 cameras

1. A workflow fetches each camera's Sony Vietnam product page, reads it with
   the product's current `features`, `specs` and price, and drafts
   `highlights` and `SalesTalk` in Vietnamese and English.
2. **Grounding is checked by machine**: every number in a draft must occur in
   that camera's own sources; a draft that adds one is rejected. Rival models
   named in `objections` must be catalogue products, compared only on facts
   both pages state.
3. Reviewers check tone (friendly to a newcomer, persuasive, no hype words the
   facts do not support), terminology (the translation glossary of
   2026-10-07), and EN/VI parity.
4. A before/after preview page goes to the owner. Nothing is written until the
   owner approves; the write is guarded per row by `updated_at`, as the
   translation was.

## Errors

| Case | Behaviour |
|---|---|
| `highlights` null or invalid | Fallback page (features + open table); invalid logs once |
| Sales talk route: no session / not staff | 401 / 403; panel renders nothing |
| Content outage | Page follows today's rule (throw, no seed fallback); sales talk route 503, panel renders nothing |
| `pairWith` names a removed product | That entry is dropped |

## Tests

- Migrations (PGlite): anon and authenticated can read `highlights`, cannot
  read anything in `camera_sales_talks` or `sales_staff`; the content root
  still never grows `admin_emails`.
- `isSalesStaff`: staff row, admin row, neither, and an unreadable control
  project (503, never "not staff").
- Sales talk route: 401 without a token, 403 for a reader, 200 for staff,
  never takes identity from the body (`identity-not-from-body.test.ts`).
- Schemas: a valid and an invalid `Highlights` / `SalesTalk`; `pairWith`
  pruning.
- Camera page: highlights render; fallback renders; the full table is inside
  `<details>`; the page HTML never contains sales talk text.
- `messages.test.ts`: EN/VI parity for every new key.

## Delivery

1. PR #11 — Colour settings removed (open).
2. PR — highlights + core specs + collapsed table + admin tab + migrations.
3. PR — sales staff role + sales talk table, route, panel, admin tab + staff
   screen.
4. Content — 31 cameras drafted, previewed, approved, written.

## Not in scope

Lenses, accessories and audio pages; a public "for staff" teaser; per-store
sales targets or analytics; editing the raw `features` bullets.
