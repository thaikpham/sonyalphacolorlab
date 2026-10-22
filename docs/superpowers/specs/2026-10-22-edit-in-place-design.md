# Edit in place: a "Sửa" link on every page, the article as its own editor — design

Status: approved in conversation, 2026-10-22 (owner chose the recommended
option on D1–D4; D5 stays as today) · Owner: thaikpham

## Goal

An administrator reading any content page sees a **Sửa** link. Pressing it opens
that page as its own editor: the same column, the same type, every block
editable where it sits, a save and a publish button, and nothing else. No list
of every article to pick from first, no form that looks nothing like the page.

The model is FeestFinder's blog (`festfinder-web/src/kd/web/blog/`): a client-only
`EditLink` on the public post (`edit-link.tsx`), a per-post editor at
`/blog/<slug>/edit` in the site's own chrome (`editor.tsx`), the console used
only to approve what other people wrote. To be exact about what FeestFinder
ships: it does **not** edit article text in place on the public page; its
editor is a form of text areas on its own route, and the "Sửa" link is what
makes it feel per-page. ColorLab has one operator and typed blocks instead of
Markdown, so the editor here can go one step further than that form: the
blocks render as the reader sees them and open for editing on a click.

Phase 1 is articles and knowledge pages (`/blog/<id>`, `/learn/<id>`), because
they share one editor already. Recipes and products follow with the same link
and the same route shape (see "Later phases").

## Decisions for the owner

| # | Question | Options (consequence) | Decided (owner, 2026-10-22) |
|---|---|---|---|
| D1 | Where does Sửa open? | **(a)** `/blog/<id>/edit` and `/learn/<id>/edit`, inside the site header, like FeestFinder. Needs a gate on that route and its own message namespaces. **(b)** `/admin/blog/<id>` in the admin app. Cheaper: the gate, the paper theme and `labAdmin` are already there; the URL leaves the article. **(c)** A toggle on `/blog/<id>` itself with no navigation. Works only for a published page; drafts and new pages still need (a) or (b), so it is two editors. | (a) |
| D2 | What happens to `/admin/blog`? | **(a)** It redirects to `/blog`; drafts and "Bài mới" appear on the feed for an administrator only. One place to write from. **(b)** It stays as today, sharing the new editor component. Two places. | (a) |
| D3 | How does a block open? | **(a)** Click a block to edit it; one open at a time; the others stay rendered as the reader sees them. The page reads as the page while editing. **(b)** Every block is a form at once, today's editor restyled into the article column. Faster for a long rewrite, never reads as the page. | (a) |
| D4 | Scope order | **(a)** Articles + knowledge now; recipes next; products last. Each phase one PR. **(b)** All three at once. One large PR, three editors refactored together. | (a) |
| D5 | Autosave | **(a)** None, as today: Lưu is explicit, the browser warns on leaving. **(b)** Drafts only, quietly, 1.5 s after the last change (FeestFinder's Studio editor); a published page still needs Lưu. Reverses the decision recorded in `article-admin.tsx`. | (a) |

Everything below follows those answers. After this sub-project the owner chose
the browser gates and the PR checklist as the next one (roadmap in
`docs/plans/2026-10-22-feestfinder-design-kit-adoption.md`).

## The experience

**A reader** sees exactly today's page. The link is a client component that
renders nothing until the browser has asked `/api/admin/session` and been told
yes; the prerendered HTML is the same for everyone, so the page stays one
cached copy (`generateStaticParams` + `revalidate = 3600` + `revalidateTag(LAB_TAG)`
on every write, unchanged). A signed-out visitor makes no request at all.

**The administrator**, signed in (the admin's Supabase session is the same
`authBrowser()` client the public site restores, so signing in at `/admin`
signs them in everywhere):

1. On `/blog/<id>`, the line above the title reads `Setup · Cơ bản · 6 phút đọc · Sửa`.
   On `/learn/<id>` the link sits at the end of the breadcrumb row.
2. Sửa opens `/blog/<id>/edit`. The site header is the same. The article column
   is the same 46rem measure. The title and the dek are now text fields set in
   the h1 and dek type. Each block is drawn by its reader renderer.
3. Pointing at a block tints it (`bg-glass`, no stroke); clicking it swaps the
   block for its fields (today's `BlockFields`), in a `.surface` panel in the
   same slot, with the type chip, ↑ ↓, Xoá and Xong. Clicking another block,
   pressing Esc or Xong closes it; the draft keeps every change either way.
4. Between blocks a thin seam shows **+ Thêm khối** on hover or focus (always
   visible on a coarse pointer, 44px tall). Choosing a type inserts the block
   there and opens it.
5. The footer still shows the sources, the author and the review date. A
   **Sửa liên kết và nguồn** control opens today's `MetaEditor` in place.
6. The right rail (where the contents list is on the reading page) holds the
   status chip, the spec checklist (**Sẵn sàng đăng** / **Còn n quy tắc**, with
   the rules listed), and the actions: **Lưu**, **Đăng bài** / **Đưa về bản
   nháp**, **Xem trang**, **Xoá**. Below `lg` the rail collapses: the checklist
   sits above the footer and the actions become a bar fixed to the bottom of
   the viewport with `pb-safe`. The bar is a sibling of the article, never
   inside `.animate-fade-in` (CLAUDE.md, fixed-inside-transform trap).
7. Lưu writes with `expectedUpdatedAt`; a 409 says the page was saved elsewhere
   and offers to reload. Publishing is refused with the rule list, as today.
   After a save of a published page, Xem trang shows the new text at once
   (`revalidateTag(LAB_TAG, IMMEDIATE)` already runs in the route).
8. On `/blog` and `/learn`, the same administrator sees one extra row at the top
   of the feed: **Bài mới** and **Bản nháp · n**. Bài mới opens `/blog/new`
   (the editor with no id; the first Lưu creates the row and navigates to
   `/blog/<id>/edit`). Bản nháp expands to the draft titles, each a link to its
   editor. Nobody else sees the row.

No autosave, as today, and for the same reason (`article-admin.tsx` header):
an autosave that publishes half a sentence is worse than losing a paragraph.
`beforeunload` warns while the draft is dirty.

## Routes

| Route | Rendering | Who |
|---|---|---|
| `/[locale]/blog/[id]` · `/[locale]/learn/[id]` | unchanged: prerendered, ISR 1h, tag `LAB_TAG` | everyone; `EditLink` is the only addition |
| `/[locale]/blog/[id]/edit` · `/[locale]/learn/[id]/edit` | `dynamic = 'force-dynamic'`, `robots: noindex`, not in the sitemap | gate: `admin` renders the editor; `denied` with no session renders `AdminSignIn`; `denied` with a session renders "not an editor"; `mfaRequired` renders `StepUp`; `unavailable` renders the outage panel |
| `/[locale]/blog/new` · `/[locale]/learn/new` | as above, no id | same gate |
| `/admin/blog` | D2(a): `redirect('/blog')` | — |

`edit` is a child segment of `[id]`, so it does not need reserving. `new` is
already in `RESERVED_IDS` (`parse.ts`).

The edit routes render in the paper room (`.theme-paper`, the same wrapper and
`viewport` as `/blog/[id]`), so the admin controls (`FIELD`, `AREA`, `SELECT`
from `admin-ui/controls.ts`, all `surface-sunken`) look exactly as they do in
`/admin`, and rule 5 holds: `text-ink` on tinted fields, never `text-white`.

The edit routes carry their own `NextIntlClientProvider` with `labAdmin` and
`adminUi`, the way `/blog/setup` carries `lab`. The public layout's narrow
`clientMessages` is untouched, so no admin string rides on a recipe page.
`messages.test.ts` scans every route-level provider, so the both-ways rule
still holds.

## Components

```
src/components/lab/
  edit-link.tsx            client; null unless the probe says admin; one probe per identity per session
  feed-admin-row.tsx       client; "Bài mới" + "Bản nháp · n" for the feed and the learn hub
  editor/
    article-editor.tsx     client; the page-as-editor: title, dek, classification, blocks, footer, rail
    editable-block.tsx     client; view ⇄ edit for one block; wraps the reader renderer and BlockFields
    block-inserter.tsx     client; the "+ Thêm khối" seam
    editor-rail.tsx        client; status, checklist, actions; bottom bar below lg
    use-article-draft.ts   client hook; load / save / delete / upload / refs — lifted out of article-admin.tsx
src/components/admin-ui/
  gate.tsx                 the state machine from shell.tsx's Chrome, without the admin header; StepUp exported
```

- `article-admin.tsx` (871 lines) is split: the data layer becomes
  `use-article-draft.ts`; the list stays only if D2(b). `article-draft.ts`
  (pure, tested) is reused unchanged: `Draft`, `edited`, `addBlock`,
  `withAsset`, `savePayload`, `afterSave`, `publishProblems`, `isDirty`.
- `BlockFields` and `MetaEditor` are reused unchanged.
- The reader renderers in `blocks.tsx`, `checklist.tsx` and
  `compare-slider.tsx` are imported into the editor for the view state. They
  are client-safe already: `media.ts` reads `NEXT_PUBLIC_*` literally for that
  reason. Figures in a draft render from the signed `previews` the admin GET
  returns, as the editor does today.
- `TldrCard` and `MenuPair` take their labels from the parent; the editor
  passes `labAdmin.menuOld` / `menuNew` and a `labAdmin.summary` key (added).
- `EditLink` takes its one word as a **prop** from the server page
  (`getTranslations('lab')` / `('learn')` already run there), so no admin
  namespace is added to the public layout and `messages.test.ts` sees nothing
  new to ship. The two keys (`lab.edit`, `learn.edit`) are added in EN and VI.
- The rail shows a status line, `aria-live="polite"`, in `.meta`: **Đang lưu…**,
  **Đã lưu lúc 14:32**, **Chưa lưu** (FeestFinder's Studio editor). It is a
  status, not helper copy.
- The in-app leave guard already exists (`leavesInPlace` plus `beforeunload` in
  `article-admin.tsx`); it moves into the hook with the rest of the data layer.

## Data flow

Unchanged contracts, all behind `adminGate()`:

| Action | Call |
|---|---|
| open | `GET /api/admin/articles/[id]` → `{ article, problems, unknownRefs, previews }` |
| create | `POST /api/admin/articles` `{ title, … }` → `{ id, updatedAt }` |
| save / publish / unpublish | `PATCH /api/admin/articles/[id]` with `expectedUpdatedAt` and `status` |
| delete | `DELETE /api/admin/articles/[id]` |
| upload | `POST /api/admin/articles/upload` (multipart, `bearer()` only) |
| refs for the picker | `GET /api/admin/content-refs` |
| who am I | `GET /api/admin/session` |

The probe in `edit-link.tsx`: when `useAuth().isReady` and a user exists (or
no auth is configured at all, which is the offline development case where
`requireAdmin()` answers the local dev admin), fetch `/api/admin/session` with
the bearer token. Cache the answer in module scope keyed by the address, so a
session makes one request however many pages it reads. A 503 or a thrown fetch
is "no link", never an error on a reader's page. The probe logic is the one in
`admin-ui/session.tsx`, exported as a hook rather than copied
(`session.test.ts` pins "one probe per identity" and "unreachable is not a
refusal"; a second copy is what that file was written to remove).

Roles: every admin role may edit articles and knowledge pages (the article
routes have no category to ask `canManageCategory()` about). Products, later,
show the link only when the session's role covers the product's category.

After a successful save the editor calls `router.refresh()` and re-reads the
record. Before shipping, one check against `next build && next start`: that
`revalidateTag(LAB_TAG, IMMEDIATE)` refreshes the prerendered HTML of
`/blog/<id>` and not only the `unstable_cache` entry. The code assumes it
(`blog/[id]/page.tsx`, `content-write-boundaries.test.ts`); no test has run a
build to prove it.

## Auth

Nothing new is trusted. The edit routes are convenience: every write still
calls `adminGate()` for itself (`identity-not-from-body.test.ts`,
`admin-gate.test.ts`). The gate component is the one from `shell.tsx`, moved
so both the admin app and the edit routes read it; its five outcomes and the
`isReady` split that keeps a signed-in admin from seeing a login prompt flicker
are kept as they are.

## Error handling

Same codes, same `labAdmin.errors.*` strings: `staleEdit` offers reload;
`specViolation` lists the rules; `kindLocked` explains the URL; `assetSyncFailed`
and `referenceCheckFailed` are shown and the draft is kept; a 503
`contentAdminWritesFrozen` shows the freeze message. A block that fails to parse
on load (`parseBlocks` drops it) is reported as today's `savedWithDropped`.

## Mobile

Everything above holds at 390px: blocks open in place, the inserter is a 44px
row, the actions bar sits on the bottom edge above the safe area, the checklist
is inline. Selects use the `SELECT` treatment; nothing opens a second sheet.

## What is borrowed, and what is not

Borrowed from FeestFinder: the client-only edit link so the page stays cached
(`edit-link.tsx`); the per-page editor route in the site's own chrome with
`robots: noindex` (`app/(kd)/blog/[slug]/edit/page.tsx`); a status bar that
lists exactly what is missing to publish (`editor.tsx` `StatusBar`); the
public page re-rendering at once after a save (`fresh.ts`, which ColorLab's
`revalidateTag` already does server-side).

Not borrowed: FeestFinder's body is one Markdown textarea per language.
ColorLab keeps its ten typed blocks (`types.ts`), which is what makes
block-by-block editing in place possible and keeps the rail's derived précis,
the checklist persistence and the compare labels. FeestFinder's review queue
(`console/blog`) has no equivalent here: one operator, no submissions.

## Later phases

- **Recipes**: `EditLink` on `/recipe/[slug]`; `/recipe/[slug]/edit` renders the
  recipe page with `recipe-admin`'s `settings-fields`, `wb-fields` and
  `image-panel` in place of the tables and the gallery. Same gate, same rail.
- **Products**: `EditLink` on `/cameras/[id]` and `/audio/[id]`;
  `/cameras/[id]/edit` reuses `admin-editor.tsx`'s sections, which is the
  largest refactor (1,477 lines) and the reason it goes last.
- `/admin` keeps `/admin/security` and whatever editors have not moved yet.

## Testing

- `edit-link.test.ts`: renders nothing signed out; one probe per identity;
  503 renders nothing.
- `article-editor` logic stays in `article-draft.ts` (tested); new pure helpers
  (which block is open, inserter position) get their own tests.
- A structural test, in the style of `next-boundaries.test.ts`, pins the edit
  routes to `force-dynamic` + `noindex` and the public routes to no new client
  boundary around the article.
- `messages.test.ts`, `admin-pages.test.ts`, `content-write-boundaries.test.ts`
  keep passing; the parity test forces the EN strings for the new VI copy.
- In the browser: sign in as the local dev admin, open a published article,
  see Sửa, edit a paragraph, save, see it on the public page; open a draft from
  the feed; publish; unpublish; the 390px pass.

## Open questions

- Should the feed's admin row also list published pages for quick access, or
  is the Sửa link on each page enough? (Default: drafts only.)
- Knowledge pages: should `section` and `order` be editable in the breadcrumb
  line, or only in the rail? (Default: the rail, beside the classification.)
