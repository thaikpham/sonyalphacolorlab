# Edit in place Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An administrator sees **Sửa** on every article and knowledge page; it opens `/blog/<id>/edit` (or `/learn/<id>/edit`), where the page renders as the reader sees it and each block opens for editing in place. `/admin/blog` redirects to `/blog`.

**Architecture:** Admin-ness is decided in the browser, so the public pages stay prerendered. A client `EditLink` reuses `AdminSessionProvider` (told not to probe signed-out readers). The article editor's data layer moves out of `article-admin.tsx` into a hook; a new page-shaped editor (`article-editor.tsx`) consumes it with per-block view/edit components and a rail. The edit routes are `force-dynamic`, `noindex`, paper room, with their own `NextIntlClientProvider`.

**Tech Stack:** Next 16.3 App Router, React 19.2, next-intl 4.13, Tailwind 4.3, vitest 4 (node environment, source-assertion tests — there is no DOM in the suite).

Spec: `docs/superpowers/specs/2026-10-22-edit-in-place-design.md`.

## Global Constraints

- Every write still goes through the existing `/api/admin/articles*` routes; **no new API route**.
- No admin namespace (`labAdmin`, `adminUi`) may be added to `src/app/[locale]/layout.tsx`'s `clientMessages`.
- A nested `NextIntlClientProvider` **replaces** its parent's messages (use-intl `IntlProvider`: `messages === undefined ? prevContext?.messages : messages`), so the edit routes' provider must list every namespace its subtree reads.
- `PROVIDER_BLOCK` in `messages.test.ts` matches `const clientMessages = {` … a line that is exactly two spaces then `}` — keep that shape.
- Only `src/components/admin-ui/session.tsx` (and the shell) may contain `fetch('/api/admin/session'`; no file may write `` Authorization: `Bearer ${ `` (`session.test.ts`).
- Every user-visible string in `messages/en.json` **and** `messages/vi.json` (parity test).
- Design rules: 13px floor (`text-meta`), no `border`/`ring`/`outline` except `:focus-visible`, 44px targets (`min-h-[var(--layout-touch-target)]`), `text-ink` on tinted paper fields, `.surface*` classes are whole (no `bg-*`/`rounded-*`/`shadow-*` on the same element), nothing `position: fixed` inside `.animate-fade-in`.
- No helper microcopy: labels, counts and controls only.
- No autosave (spec D5).
- Commit after every task; `npm test` must pass before each commit. Run `npm run typecheck` and `npm run lint` before the last commit of each task.

## File structure

| File | Responsibility |
|---|---|
| `src/components/admin-ui/session.tsx` (modify) | `probeSignedOut` option: a signed-out reader on a public page causes no request |
| `src/components/admin-ui/gate.tsx` (create) | The gate's screens (checking, sign-in, not-an-admin, step-up, outage), moved out of `shell.tsx` |
| `src/components/admin-ui/shell.tsx` (modify) | Admin header + `<AdminGate>` |
| `src/components/lab/edit-link.tsx` (create) | The **Sửa** link, rendered only for an admin |
| `src/components/lab/feed-admin-row.tsx` (create) | **Bài mới** + **Bản nháp · n** on `/blog` and `/learn`, admin only |
| `src/components/lab/admin/article-draft.ts` (modify) | `insertBlock(d, type, at)` |
| `src/components/lab/admin/use-article-editor.ts` (create) | Load, save, delete, upload, refs, leave guard, block operations — lifted from `article-admin.tsx` |
| `src/components/lab/editor/block-preview.tsx` (create) | A block as the reader sees it, drafts' images from signed previews |
| `src/components/lab/editor/editable-block.tsx` (create) | One block: preview ⇄ `BlockFields` |
| `src/components/lab/editor/block-inserter.tsx` (create) | **+ Thêm khối** seam between blocks |
| `src/components/lab/editor/editor-rail.tsx` (create) | Status, save line, checklist, classification, actions; bottom bar below `lg` |
| `src/components/lab/editor/article-editor.tsx` (create) | The page as editor |
| `src/app/[locale]/blog/[id]/edit/page.tsx`, `learn/[id]/edit/page.tsx`, `blog/new/page.tsx`, `learn/new/page.tsx` (create) | The four edit routes |
| `src/app/[locale]/_edit/edit-route.tsx` (create) | Shared server body of the four routes, with their message provider (under `src/app` so `messages.test.ts` reads it; `_edit` is a private folder, never a route) |
| `src/components/lab/editor/edit-gate.tsx` (create) | Client: session provider + gate + editor |
| `src/app/admin/blog/page.tsx` (modify) | `redirect('/blog')` |
| `src/components/lab/admin/article-admin.tsx` (delete) | Replaced |

---
### Task 1: The session probe can skip signed-out readers

A public page mounts the probe for every visitor. Today `AdminSessionProvider` fetches `/api/admin/session` even with no session (identity `''`), which would be one Function call per reader per page. Offline development has no auth client at all (`authBrowser()` is `null`) and must still probe, because that is how the local dev admin is found.

**Files:**
- Modify: `src/components/admin-ui/session.tsx`
- Test: `src/components/admin-ui/session.test.ts`

**Interfaces:**
- Produces: `AdminSessionProvider({ children, probeSignedOut?: boolean })` — default `true` (the admin app keeps today's behaviour). With `false`, when an auth client exists and nobody is signed in, the gate settles to `'denied'` with no request.

- [ ] **Step 1: Write the failing test** — append to the `describe(SESSION, …)` block in `session.test.ts`:

```ts
  it('can leave a signed-out reader unprobed, and still probes offline', () => {
    /* A public page mounts the probe for every reader. A request per page view
       for somebody with no session would be a Function call that can only
       answer "no". Offline there is no auth client and the dev admin is found
       by probing, so the skip needs an auth client to exist. */
    expect(source).toMatch(/probeSignedOut = true/);
    expect(source).toMatch(/!probeSignedOut && !identity && authBrowser\(\) !== null/);
    const skip = source.indexOf('if (skipProbe())');
    const probe = source.indexOf("fetch('/api/admin/session'");
    expect(skip, 'no skip before the probe').toBeGreaterThan(-1);
    expect(skip).toBeLessThan(probe);
  });
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/components/admin-ui/session.test.ts`
Expected: FAIL on `probeSignedOut = true`.

- [ ] **Step 3: Implement** — in `session.tsx`:

Add the import:

```ts
import { authBrowser } from '@/lib/supabase/browser';
```

Change the signature and add the effect event next to `headersNow`:

```ts
export function AdminSessionProvider({
  children,
  probeSignedOut = true,
}: {
  children: React.ReactNode;
  /** False on public pages: a reader with no session is not asked about. */
  probeSignedOut?: boolean;
}) {
```

```ts
  /* Read through an effect event so the dependency list stays
     `[identity, nonce]` — the probe is about who, not about how it was told. */
  const skipProbe = useEffectEvent(
    () => !probeSignedOut && !identity && authBrowser() !== null,
  );
```

In the effect, first statement inside the async IIFE, before `try`:

```ts
      if (skipProbe()) {
        settle('denied');
        return;
      }
```

The dependency array stays exactly `}, [identity, nonce]);`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/admin-ui/session.test.ts`
Expected: PASS (all, including the existing `[identity, nonce]` pin).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin-ui/session.tsx src/components/admin-ui/session.test.ts
git commit -m "Admin session probe: optionally leave signed-out readers unprobed"
```

### Task 2: The gate's screens move out of the shell

The edit routes need the same five outcomes the admin shell renders (checking, sign in, not an admin, step-up code, outage) without the admin header. Move them into one component both use.

**Files:**
- Create: `src/components/admin-ui/gate.tsx`
- Modify: `src/components/admin-ui/shell.tsx`
- Modify: `src/components/admin-ui/session.test.ts` (the `describe(SHELL, …)` block reads the gate file)

**Interfaces:**
- Consumes: `useAdminSession()` (`gate`, `refresh`), `useAuth()` (`user`, `isReady`), `AdminSignIn`, `authFailureKey`.
- Produces: `export function AdminGate({ children }: { children: React.ReactNode })` — renders `children` only when `gate === 'admin'`; every other outcome renders its own screen inside a `<main>`. Must be inside `AdminSessionProvider`. `StepUp` and `Panel` move with it (not exported).

- [ ] **Step 1: Retarget the test** — in `session.test.ts` add `const GATE = 'src/components/admin-ui/gate.tsx';` beside `SHELL`, rename `describe(SHELL, () => {` to `describe(GATE, () => {`, change its `const source = readFileSync(SHELL, 'utf8');` to read `GATE`, and add one test to it:

```ts
  it('is what the shell renders its sections inside', () => {
    expect(readFileSync(SHELL, 'utf8')).toMatch(/<AdminGate>/);
  });
```

Add `GATE` to the inventory test's expected list (`for (const p of [ … SHELL, GATE ])`).

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/components/admin-ui/session.test.ts`
Expected: FAIL — `gate.tsx` does not exist.

- [ ] **Step 3: Create `gate.tsx`** — move `Panel`, `Frame`'s role and `StepUp` verbatim from `shell.tsx`, and the branching out of `Chrome`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminSession } from './session';
import { AdminSignIn } from './sign-in';
import { authFailureKey } from './auth-failure';
import { authBrowser } from '@/lib/supabase/browser';
import { useAuth } from '@/components/auth-context';

/**
 * The gate's five answers, as screens, for any surface that needs an admin:
 * the admin department under its header, and the edit routes under the
 * site's. Moved out of `shell.tsx` so the two cannot drift apart.
 */

function Panel({ title, body }: { title: string; body: string }) {
  /* moved verbatim from shell.tsx */
}

function StepUp({ onDone }: { onDone: () => void }) {
  /* moved verbatim from shell.tsx */
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations('adminUi');
  const { gate, refresh } = useAdminSession();
  const { user, isReady } = useAuth();

  if (gate === 'denied') {
    if (!isReady) {
      return (
        <main className="mx-auto w-full max-w-[86rem] inset-safe py-16">
          <p className="meta">{t('checking')}</p>
        </main>
      );
    }
    return user ? (
      <Panel title={t('notAdminTitle')} body={t('notAdminBody')} />
    ) : (
      <AdminSignIn onSignedIn={refresh} />
    );
  }
  if (gate === 'mfaRequired') return <StepUp onDone={refresh} />;
  if (gate === 'checking') {
    return (
      <main className="mx-auto w-full max-w-[86rem] inset-safe py-16">
        <p className="meta">{t('checking')}</p>
      </main>
    );
  }
  if (gate === 'unavailable') return <Panel title={t('gateDownTitle')} body={t('gateDownBody')} />;
  return <>{children}</>;
}
```

Keep the explanatory comments from `shell.tsx` on each branch (the `isReady` and `user ? (` reasons) — they move with the code.

- [ ] **Step 4: Slim `shell.tsx`** — `Chrome` keeps only the header (wordmark, `SECTIONS` nav, address, security link, back to site) and renders `<AdminGate>{children}</AdminGate>` below the seam. The header shows only when `gate` is `admin`, `checking` or `unavailable` (today's behaviour: the sign-in and step-up screens replace the whole body), so:

```tsx
  const bare = gate === 'denied' || gate === 'mfaRequired';
  return (
    <div className="flex min-h-screen-dynamic flex-col bg-void font-sans text-ink">
      {bare ? null : (
        <>
          <header className="…unchanged…">…unchanged…</header>
          <div className="seam" />
        </>
      )}
      <AdminGate>{children}</AdminGate>
    </div>
  );
```

Delete `Panel`, `Frame`, `StepUp` and the now-unused imports (`useState`, `AdminSignIn`, `authFailureKey`, `authBrowser`, `useAuth`) from `shell.tsx`.

- [ ] **Step 5: Run the tests and the type check**

Run: `npx vitest run src/components/admin-ui && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Check in the browser** — `preview_start` `alpha-colorlab`, open `/admin`, `/admin/blog`, `/admin/security`: offline the dev admin is signed in, so each shows the header and its editor exactly as before.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin-ui
git commit -m "Admin gate: one component for the gate's screens, shared by the shell"
```

### Task 3: Sửa on the article and knowledge pages

**Files:**
- Create: `src/components/lab/edit-link.tsx`
- Create: `src/components/lab/edit-link.test.ts`
- Modify: `src/components/lab/article-view.tsx` (the context line above the title)
- Modify: `messages/en.json`, `messages/vi.json` (`lab.edit`)

**Interfaces:**
- Consumes: `AdminSessionProvider({ probeSignedOut: false })`, `useAdminSession().gate` (Task 1).
- Produces: `export function EditLink({ href, label }: { href: string; label: string })` — `href` is a locale-free path (`/blog/<id>/edit`), rendered through `@/i18n/navigation`'s `Link`. Renders `null` unless `gate === 'admin'`.

The label arrives as a prop from the server component, so the public layout ships no new namespace.

- [ ] **Step 1: Write the failing test** — `src/components/lab/edit-link.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The public page's one admin affordance, pinned at the source: it must never
 * make the page dynamic, never ship an admin namespace, never probe a reader
 * who is not signed in, and render nothing but for an admin.
 */
const link = readFileSync('src/components/lab/edit-link.tsx', 'utf8')
const view = readFileSync('src/components/lab/article-view.tsx', 'utf8')

describe('EditLink', () => {
  it('asks the shared probe, told to leave signed-out readers alone', () => {
    expect(link).toMatch(/<AdminSessionProvider probeSignedOut=\{false\}>/)
    expect(link).not.toContain("fetch('/api/admin/session'")
  })

  it('renders for an admin and for nobody else', () => {
    expect(link).toMatch(/if \(gate !== 'admin'\) return null/)
  })

  it('takes its word from the server, not from a namespace', () => {
    expect(link).not.toMatch(/useTranslations\(/)
  })
})

describe('ArticleView', () => {
  it('puts Sửa on both kinds, at that kind’s edit path', () => {
    expect(view).toMatch(/<EditLink\s+href=\{`\/\$\{knowledge \? 'learn' : 'blog'\}\/\$\{article\.id\}\/edit`\}\s+label=\{t\('edit'\)\}/)
  })

  it('reads no request state, so the page stays prerendered', () => {
    expect(view).not.toMatch(/cookies\(\)|headers\(\)/)
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/components/lab/edit-link.test.ts`
Expected: FAIL — `edit-link.tsx` not found.

- [ ] **Step 3: Create `edit-link.tsx`**

```tsx
'use client'

import { Link } from '@/i18n/navigation'
import { AdminSessionProvider, useAdminSession } from '@/components/admin-ui/session'

/**
 * "Sửa" on a public page, for an administrator only.
 *
 * Decided in the browser, after hydration, so the page is one prerendered copy
 * for everybody — the FeestFinder pattern (`kd/web/blog/edit-link.tsx`). A
 * reader with no session causes no request (`probeSignedOut={false}`). This is
 * a convenience, never the check: every write re-asks `adminGate()`.
 */
export function EditLink({ href, label }: { href: string; label: string }) {
  return (
    <AdminSessionProvider probeSignedOut={false}>
      <Shown href={href} label={label} />
    </AdminSessionProvider>
  )
}

function Shown({ href, label }: { href: string; label: string }) {
  const { gate } = useAdminSession()
  if (gate !== 'admin') return null
  return (
    <Link
      href={href}
      className="ml-3 inline-flex min-h-[var(--layout-touch-target)] items-center font-semibold text-accent-400 transition-colors hover:text-ink"
    >
      {label}
    </Link>
  )
}
```

- [ ] **Step 4: Add the word** — `messages/vi.json` → `"lab"` object: `"edit": "Sửa"`; `messages/en.json` → `"lab"`: `"edit": "Edit"`.

- [ ] **Step 5: Mount it** — in `article-view.tsx`, import `{ EditLink } from './edit-link'`, and inside the context line `<p className="mb-3 text-label font-semibold text-ink-faint">`, after the closing `</span>` of the `text-ink-faint` span:

```tsx
          <EditLink
            href={`/${knowledge ? 'learn' : 'blog'}/${article.id}/edit`}
            label={t('edit')}
          />
```

The `<p>` is a line of text; the link inside it keeps the 44px height through `inline-flex min-h-…`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/components/lab src/app/messages.test.ts src/components/admin-ui`
Expected: PASS. (`session.test.ts` now discovers `edit-link.tsx` as an admin client, because it imports the session module; it contains no probe and no bearer header, so its two checks pass.)

- [ ] **Step 7: Check in the browser** — dev server, open a published article (`/vi/blog/<id>`, ids from `/vi/blog`) and a knowledge page (`/vi/learn/<id>`): offline, the dev admin sees **Sửa** at the end of the topic line; it links to `/vi/blog/<id>/edit` (404 until Task 7). Read the network log: one `GET /api/admin/session`.

- [ ] **Step 8: Commit**

```bash
git add src/components/lab/edit-link.tsx src/components/lab/edit-link.test.ts src/components/lab/article-view.tsx messages/en.json messages/vi.json
git commit -m "Articles: Sửa on the page for administrators"
```

### Task 4: The editor's data layer becomes a hook

Everything `ArticleAdmin` does to one article — open it, save, publish, delete, upload, the link picker's ids, the leave guard, the block operations — moves into `useArticleEditor()`, so the page-shaped editor (Task 6) and the old list screen (until Task 9) share one implementation. Plus one new pure operation: insert a block at a position.

**Files:**
- Modify: `src/components/lab/admin/article-draft.ts` (export `nextKey`, add `insertBlock`)
- Modify: `src/components/lab/admin/article-draft.test.ts`
- Create: `src/components/lab/admin/use-article-editor.ts`
- Create: `src/components/lab/admin/use-article-editor.test.ts`
- Modify: `src/components/lab/admin/article-admin.tsx` (consumes the hook)
- Modify: `src/components/lab/admin/article-admin.test.ts` (keeps only the list's assertions)

**Interfaces:**
- Produces, in `article-draft.ts`:
  - `export const nextKey: () => number` (the existing private `next`, exported)
  - `export function insertBlock(d: Draft, type: Block['t'], at: number, key: number): Draft` — `at` is clamped to `0…d.blocks.length`; the new block is `emptyBlock(type)` under `key`; `rev` moves on.
- Produces, in `use-article-editor.ts`:

```ts
export type EditorBusy = '' | 'loading' | 'saving' | 'deleting'
export type EditorStatus = { kind: 'ok' | 'err'; msg: string } | null
export type ArticleEditor = {
  draft: Draft | null
  dirty: boolean
  busy: EditorBusy
  status: EditorStatus
  /** When the last successful save answered, for the save line. */
  savedAt: Date | null
  previews: Readonly<Record<string, string>>
  refs: RefOptions | null
  refsFailed: boolean
  unknownRefs: readonly ContentRef[]
  problems: string[]
  codeMessage: (code: string) => string
  edit: (patch: Partial<DraftFields>) => void
  loadArticle: (id: string) => Promise<void>
  startNew: (kind?: ArticleKind) => void
  save: (nextStatus: ArticleStatus) => Promise<StoredArticle | null>
  remove: () => Promise<boolean>
  upload: UploadFn
  setBlock: (key: number, block: Block) => void
  setAsset: (session: number, key: number, field: AssetField, assetId: string | undefined) => void
  insertBlock: (type: Block['t'], at: number) => number
  removeBlock: (key: number) => void
  moveBlock: (key: number, by: -1 | 1) => void
}
export function useArticleEditor(options?: {
  /** After a save that stored a row: the list refreshes, the route moves to the id. */
  onStored?: (stored: StoredArticle, created: boolean) => void
  /** After a delete, successful or not — the caller re-reads whatever it lists. */
  onRemoved?: (deleted: boolean) => void
}): ArticleEditor
```

- [ ] **Step 1: Write the failing draft test** — append to `article-draft.test.ts` (it already imports from `./article-draft`; add `insertBlock` and `nextKey` to that import):

```ts
describe('inserting a block where the editor points', () => {
  const base = () => {
    let d = blankDraft()
    d = addBlock(d, 'p')
    d = addBlock(d, 'h')
    return d
  }

  it('puts the new block at the position asked for, under the key it was given', () => {
    const key = nextKey()
    const d = insertBlock(base(), 'callout', 1, key)
    expect(d.blocks.map((b) => b.block.t)).toEqual(['p', 'callout', 'h'])
    expect(d.blocks[1].key).toBe(key)
  })

  it('clamps a position past either end', () => {
    expect(insertBlock(base(), 'tldr', -3, nextKey()).blocks[0].block.t).toBe('tldr')
    expect(insertBlock(base(), 'figure', 99, nextKey()).blocks[2].block.t).toBe('figure')
  })

  it('is an edit: the draft becomes dirty', () => {
    const d = base()
    expect(insertBlock(d, 'p', 0, nextKey()).rev).toBe(d.rev + 1)
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/components/lab/admin/article-draft.test.ts`
Expected: FAIL — `insertBlock` is not exported.

- [ ] **Step 3: Implement in `article-draft.ts`** — rename nothing; after `const next = () => (counter += 1)` add `export const nextKey = next`, and after `addBlock`:

```ts
/** A new block at `at`, under a key the caller chose so it can open it. */
export function insertBlock(d: Draft, type: Block['t'], at: number, key: number): Draft {
  const i = Math.max(0, Math.min(at, d.blocks.length))
  const blocks = [...d.blocks]
  blocks.splice(i, 0, keyed(emptyBlock(type), key))
  return edited(d, { blocks })
}
```

- [ ] **Step 4: Run it** — `npx vitest run src/components/lab/admin/article-draft.test.ts` → PASS.

- [ ] **Step 5: Move the wiring assertions** — create `use-article-editor.test.ts` with the same header helpers as `article-admin.test.ts` (`strip`, `fn`), reading `src/components/lab/admin/use-article-editor.ts`, and **move** into it, unchanged except for the file they read, these tests from `article-admin.test.ts`:
  - `saving` → the first test (`applies the answer to the draft as it is now…`) and the second (`never reloads through the path…`, with its regex changed to `/loadArticle\(|window\.confirm/`).
  - `opening` → the second and third tests (`drops an answer…`, `reports a failed read…`).
  - `what the editor reports` → `computes the publish checklist from the draft on screen`.
  - `blocks` → only the `withAsset(d, session, key, field, assetId)` assertion of the upload test.
  - `leaving` → the whole block.
  - `design` → add `'use-article-editor.ts'` to its file list (keep it in `article-admin.test.ts` too until Task 9).

  Add one new test:

```ts
describe('inserting', () => {
  it('chooses the key before the update, so the caller can open the new block', () => {
    const insert = fn('insertAt')
    expect(insert).toMatch(/const key = nextKey\(\)/)
    expect(insert).toMatch(/insertBlock\(d, type, at, key\)/)
    expect(insert).toMatch(/return key/)
  })
})
```

  What stays in `article-admin.test.ts`: `holds the list and the new-article button still…`, `will not publish an article with a blank title`, `asks about unsaved changes on the click…`, the status-line and list-empty tests, the `<section key={key}` and `onAsset=` render assertions, `design`, `copy`, `one list of archetypes…`.

- [ ] **Step 6: Run it and see it fail** — `npx vitest run src/components/lab/admin/use-article-editor.test.ts` → FAIL, file not found.

- [ ] **Step 7: Create `use-article-editor.ts`** — `'use client'` first line (so `messages.test.ts` counts its `labAdmin` read). Shape:

```ts
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAdminSession } from '@/components/admin-ui/session'
import { MAX_UPLOAD_BYTES } from '@/lib/recipes/upload-limits'
import type { Article, ArticleKind, ArticleRecord, ArticleStatus, Block, ContentRef } from '@/lib/lab/types'
import type { AssetField, UploadFn } from './block-editor'
import type { RefOptions } from './meta-editor'
import {
  afterSave, asDraft, blankDraft, edited, insertBlock, isDirty, leavesInPlace, nextKey,
  publishProblems, savePayload, withAsset,
  type Draft, type DraftFields, type StoredArticle,
} from './article-draft'

/**
 * One article in the editor: reading it, saving it, publishing it, deleting
 * it, its pictures and its link picker. Lifted out of `article-admin.tsx` so
 * the page-shaped editor at /blog/<id>/edit and the list screen run the same
 * code. What lands on the draft is still `article-draft.ts`.
 */
export function useArticleEditor(options: { … } = {}): ArticleEditor {
  const t = useTranslations('labAdmin')
  const { authed, bearer } = useAdminSession()
  const { onStored, onRemoved } = options
  …
}
```

  Move into the hook body **verbatim** from `article-admin.tsx`: the `draft`, `busy`, `status`, `previews`, `refs`, `refsFailed`, `unknownRefs` state; `opening`; `dirty`; `codeMessage`; the content-refs effect; the leave-guard effect; `edit`; `articleId`; `upload`; `refreshPreviews`; `loadArticle`; `save`; `remove`; `setBlock`; `setAsset`; `removeBlock`; `moveBlock`; `problems`. Then these changes, and only these:
  1. Add `const [savedAt, setSavedAt] = useState<Date | null>(null)`; in `save`, after `setStatus({ kind: 'ok', … })`, call `setSavedAt(new Date())`; make `save` return `stored` on success and `null` on every failure path.
  2. In `save`, replace `await loadList()` with `onStored?.(stored, creating)`.
  3. In `remove`, delete the `window.confirm(t('deleteConfirm', …))` line (each caller asks before calling), replace both `await loadList()` with `onRemoved?.(true)` (success) and `onRemoved?.(false)` (catch), and return `true` on success and `false` otherwise.
  4. `startNew(kind: ArticleKind = 'article')` — no confirm (the caller asks):

```ts
  function startNew(kind: ArticleKind = 'article') {
    opening.current = null
    /* Spread, not `edited()`: a blank knowledge page is not an unsaved change. */
    setDraft({ ...blankDraft(), kind })
    setPreviews({})
    setUnknownRefs([])
    setStatus(null)
  }
```
  5. Replace `addBlock` with:

```ts
  function insertAt(type: Block['t'], at: number): number {
    const key = nextKey()
    setDraft((d) => (d ? insertBlock(d, type, at, key) : d))
    return key
  }
```

  Return every member of `ArticleEditor`, with `insertBlock: insertAt`.

- [ ] **Step 8: Make `ArticleAdmin` consume it** — in `article-admin.tsx` delete everything moved, call

```ts
  const editor = useArticleEditor({
    onStored: () => void loadList(),
    onRemoved: () => void loadList(),
  })
  const { draft, dirty, busy, status, previews, refs, refsFailed, unknownRefs, problems, codeMessage,
    edit, loadArticle, save, remove, upload, setBlock, setAsset, removeBlock, moveBlock } = editor
```

  and keep, in the component: the list state and `fetchList`/`applyList`/`loadList`/list effect, `query`/`visible`, and

```ts
  function openArticle(id: string) {
    if (dirty && !window.confirm(t('discardConfirm'))) return
    void loadArticle(id)
  }

  function startNew() {
    if (dirty && !window.confirm(t('discardConfirm'))) return
    editor.startNew()
  }

  const addBlock = (type: Block['t']) => editor.insertBlock(type, draft?.blocks.length ?? 0)

  async function removeArticle() {
    if (!draft?.id || !window.confirm(t('deleteConfirm', { title: draft.title }))) return
    await remove()
  }
```

  `articleId` for `canUpload` becomes `draft?.id ?? null`. In the JSX, the delete button's `onClick={() => void remove()}` becomes `onClick={() => void removeArticle()}`; nothing else changes.

- [ ] **Step 9: Run everything touched**

Run: `npx vitest run src/components/lab src/app/messages.test.ts src/components/admin-ui && npm run typecheck && npm run lint`
Expected: PASS, lint exit code 0 (`echo $?`).

- [ ] **Step 10: Check in the browser** — `/admin/blog` offline: open an article, edit the title, Lưu nháp, add a block, move it, delete a test article you created. Every action behaves as before.

- [ ] **Step 11: Commit**

```bash
git add src/components/lab/admin
git commit -m "Article editor: data layer as useArticleEditor(), insertBlock at a position"
```

### Task 5: A block that opens where it sits

Three client components under `src/components/lab/editor/`: the reader's rendering of a block (with draft pictures from the signed previews), one block that swaps between that rendering and its fields, and the seam that inserts a block between two others.

**Files:**
- Create: `src/components/lab/editor/block-preview.tsx`
- Create: `src/components/lab/editor/editable-block.tsx`
- Create: `src/components/lab/editor/block-inserter.tsx`
- Create: `src/components/lab/editor/editor.test.ts`
- Modify: `messages/en.json`, `messages/vi.json` (`labAdmin.editBlock`, `labAdmin.doneBlock`)

**Interfaces:**
- Consumes: from `../blocks` — `TldrCard`, `Heading`, `Paragraph`, `MenuPair`, `ComparisonTable`, `Callout`, `ArticleEmbed`, `BLOCK_GAP`; from `../admin/block-editor` — `BlockFields`, `BLOCK_TYPES`, `type UploadFn`, `type AssetField`.
- Produces:
  - `BlockPreview({ block, index, previews }: { block: Block; index: number; previews: Readonly<Record<string, string>> })`
  - `EditableBlock(props: { block: Block; index: number; open: boolean; onOpen: () => void; onClose: () => void; onChange: (b: Block) => void; onAsset: (field: AssetField, assetId: string | undefined) => void; onMove: (by: -1 | 1) => void; onRemove: () => void; first: boolean; last: boolean; upload: UploadFn; previews: Readonly<Record<string, string>>; canUpload: boolean })`
  - `BlockInserter({ onInsert }: { onInsert: (type: Block['t']) => void })`

- [ ] **Step 1: Write the failing test** — `src/components/lab/editor/editor.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** The page-shaped editor's wiring, from its source (the suite has no DOM). */
const read = (f: string) => readFileSync(`src/components/lab/editor/${f}`, 'utf8')

describe('BlockPreview', () => {
  const src = read('block-preview.tsx')

  it('draws a block with the reader’s own renderers', () => {
    for (const c of ['TldrCard', 'Heading', 'Paragraph', 'MenuPair', 'ComparisonTable', 'Callout', 'ArticleEmbed']) {
      expect(src).toMatch(new RegExp(`<${c}[\\s/>]`))
    }
  })

  it('shows a draft’s pictures from the signed previews, never the public URL', () => {
    /* A draft's assets are in the private bucket; the public URL is a 404. */
    expect(src).toMatch(/previews\[/)
    expect(src).not.toMatch(/assetUrl\(/)
  })

  it('has a case for every block type', () => {
    expect(src).toMatch(/const unreachable: never = block/)
  })
})

describe('EditableBlock', () => {
  const src = read('editable-block.tsx')

  it('is the reader’s block when closed and its fields when open', () => {
    expect(src).toMatch(/open \? \(/)
    expect(src).toMatch(/<BlockFields/)
    expect(src).toMatch(/<BlockPreview/)
  })

  it('opens from a real button as well as from a click on the block', () => {
    expect(src).toMatch(/<button[\s\S]{0,200}onClick=\{onOpen\}/)
    expect(src).toMatch(/aria-expanded=\{open\}/)
  })

  it('closes on Escape', () => {
    expect(src).toMatch(/e\.key === 'Escape'/)
  })

  it('draws no stroke', () => {
    expect(src).not.toMatch(/\b(border|ring|outline)-/)
  })
})

describe('BlockInserter', () => {
  const src = read('block-inserter.tsx')

  it('offers every block type, in the editor’s order', () => {
    expect(src).toMatch(/BLOCK_TYPES\.map/)
  })

  it('stays visible on touch, where there is no hover', () => {
    expect(src).toMatch(/pointer-fine:opacity-0/)
    expect(src).toMatch(/focus-within:opacity-100/)
  })
})
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/components/lab/editor` → FAIL, files not found.

- [ ] **Step 3: Add the two words** — `labAdmin.editBlock`: vi `"Sửa khối"`, en `"Edit block"`; `labAdmin.doneBlock`: vi `"Xong"`, en `"Done"`.

- [ ] **Step 4: Create `block-preview.tsx`**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import type { Block } from '@/lib/lab/types'
import {
  ArticleEmbed, BLOCK_GAP, Callout, ComparisonTable, Heading, MenuPair, Paragraph, TldrCard,
} from '../blocks'

/**
 * A block as the reader will see it, inside the editor.
 *
 * The reader's renderers wherever they can be used as they are. Three cannot:
 * a figure and a comparison in a draft live in the private bucket, so they are
 * drawn from the editor's signed previews (plain `<img>`: the URLs expire and
 * must not reach the image loader); a checklist here must not write ticks into
 * the reader's storage. A block with nothing in it yet shows its type.
 */
export function BlockPreview({
  block,
  index,
  previews,
}: {
  block: Block
  index: number
  previews: Readonly<Record<string, string>>
}) {
  const t = useTranslations('labAdmin')
  const empty = (
    <p className={`${BLOCK_GAP} surface-sunken px-5 py-4 meta`}>{t(`blocks.${block.t}` as never)}</p>
  )

  switch (block.t) {
    case 'tldr':
      return block.items.some((s) => s.trim()) ? <TldrCard block={block} label={t('tldrLines')} /> : empty
    case 'h':
      return block.text.trim() ? <Heading block={block} index={index} /> : empty
    case 'p':
      return block.text.trim() ? <Paragraph block={block} /> : empty
    case 'menu':
      return <MenuPair block={block} labels={{ old: t('menuOld'), new: t('menuNew') }} />
    case 'table':
      return <ComparisonTable block={block} />
    case 'callout':
      return block.text.trim() ? <Callout block={block} /> : empty
    case 'embed':
      return block.id ? <ArticleEmbed block={block} /> : empty
    case 'figure': {
      const src = block.assetId ? previews[block.assetId] : undefined
      if (!src) return empty
      return (
        <figure className={BLOCK_GAP}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={block.alt ?? ''} className="surface-sunken aspect-video w-full rounded-lg object-cover" />
          <figcaption className="meta mt-2">{block.caption}</figcaption>
        </figure>
      )
    }
    case 'compare': {
      const before = block.beforeAssetId ? previews[block.beforeAssetId] : undefined
      const after = block.afterAssetId ? previews[block.afterAssetId] : undefined
      if (!before || !after) return empty
      return (
        <figure className={BLOCK_GAP}>
          <div className="grid grid-cols-2 gap-2">
            {[{ src: before, label: block.beforeLabel }, { src: after, label: block.afterLabel }].map((half) => (
              <div key={half.label} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={half.src} alt="" className="surface-sunken aspect-3/2 w-full rounded-lg object-cover" />
                <span className="meta tabular-nums">{half.label}</span>
              </div>
            ))}
          </div>
          <figcaption className="meta mt-2">{block.caption}</figcaption>
        </figure>
      )
    }
    case 'checklist':
      return (
        <section className={`${BLOCK_GAP} surface px-5 pt-2 pb-4`}>
          <p className="py-3.5 pb-1.5 text-body-sm font-semibold text-ink-muted">{block.label}</p>
          <ul className="flex flex-col gap-2">
            {block.items.map((item, i) => (
              <li key={i} className="text-body text-ink">{item}</li>
            ))}
          </ul>
        </section>
      )
    default: {
      const unreachable: never = block
      return unreachable
    }
  }
}
```

- [ ] **Step 5: Create `editable-block.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { Block } from '@/lib/lab/types'
import { BlockFields, type AssetField, type UploadFn } from '../admin/block-editor'
import { BlockPreview } from './block-preview'

/**
 * One block of the page being edited. Closed, it is the reader's block; a
 * click on it, or its Sửa khối button, swaps it for its fields in the same
 * slot. The draft keeps every change whether the block is closed with Xong,
 * with Escape, or by opening another one.
 */
export function EditableBlock(props: {
  block: Block
  index: number
  open: boolean
  onOpen: () => void
  onClose: () => void
  onChange: (b: Block) => void
  onAsset: (field: AssetField, assetId: string | undefined) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
  first: boolean
  last: boolean
  upload: UploadFn
  previews: Readonly<Record<string, string>>
  canUpload: boolean
}) {
  const { block, index, open, onOpen, onClose } = props
  const t = useTranslations('labAdmin')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return open ? (
    <section className="surface mb-7 flex flex-col gap-4 px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-accent-900 font-semibold uppercase tracking-[0.08em] text-ink">
          {t(`blocks.${block.t}` as never)}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={() => props.onMove(-1)} disabled={props.first} className="chip chip-action disabled:opacity-30" aria-label={t('moveUp')}>↑</button>
        <button type="button" onClick={() => props.onMove(1)} disabled={props.last} className="chip chip-action disabled:opacity-30" aria-label={t('moveDown')}>↓</button>
        <button type="button" onClick={props.onRemove} className="chip chip-action text-danger">{t('removeBlock')}</button>
        <button type="button" onClick={onClose} className="btn-glass">{t('doneBlock')}</button>
      </div>
      <BlockFields
        block={block}
        onChange={props.onChange}
        onAsset={props.onAsset}
        upload={props.upload}
        previews={props.previews}
        canUpload={props.canUpload}
      />
    </section>
  ) : (
    <div className="group relative -mx-3 cursor-pointer rounded-md px-3 pt-1 transition-colors pointer-fine:hover:bg-glass" onClick={onOpen}>
      <BlockPreview block={block} index={index} previews={props.previews} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        aria-expanded={open}
        className="chip chip-action absolute right-2 top-2 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
      >
        {t('editBlock')}
      </button>
    </div>
  )
}
```

`aria-expanded={open}` is always `false` on the closed button; it tells a screen reader the button opens a region. The open panel has no `position`, so nothing here is fixed or absolute inside an animated parent.

- [ ] **Step 6: Create `block-inserter.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Block } from '@/lib/lab/types'
import { BLOCK_TYPES } from '../admin/block-editor'

/**
 * The seam between two blocks, and the way to put a new one there. Hidden
 * until hover or focus on a fine pointer; always there on touch, where there
 * is no hover to reveal it.
 */
export function BlockInserter({ onInsert }: { onInsert: (type: Block['t']) => void }) {
  const t = useTranslations('labAdmin')
  const [choosing, setChoosing] = useState(false)

  return (
    <div
      className={
        'my-1 flex flex-col items-center gap-2 transition-opacity ' +
        /* Once choosing, the button that held focus is gone, so focus-within
           would no longer keep the row visible: it stays shown instead. */
        (choosing ? '' : 'pointer-fine:opacity-0 pointer-fine:hover:opacity-100 focus-within:opacity-100')
      }
    >
      {choosing ? (
        <ul className="flex flex-wrap justify-center gap-2">
          {BLOCK_TYPES.map((type) => (
            <li key={type}>
              <button
                type="button"
                className="chip chip-action"
                onClick={() => {
                  setChoosing(false)
                  onInsert(type)
                }}
              >
                {t(`blocks.${type}` as never)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="flex w-full min-h-[var(--layout-touch-target)] items-center gap-3 text-body-sm font-semibold text-accent-400"
        >
          <hr className="seam flex-1" />
          <span>+ {t('addBlock')}</span>
          <hr className="seam flex-1" />
        </button>
      )}
    </div>
  )
}
```


- [ ] **Step 7: Run the tests** — `npx vitest run src/components/lab src/app/messages.test.ts && npm run typecheck && npm run lint` → PASS. The components are not mounted yet, so there is nothing to see in the browser.

- [ ] **Step 8: Commit**

```bash
git add src/components/lab/editor messages/en.json messages/vi.json
git commit -m "Editor: a block that opens in place, and a seam to insert one"
```

### Task 6: The page as its own editor

`ArticleEditor` lays the draft out the way `ArticleView` lays out a published page — the same `flex-wrap-reverse` pair of a 46rem article column and a rail — with the title and dek as fields in the h1 and dek type, every block an `EditableBlock` with a `BlockInserter` before each and after the last, the footer's links and sources behind one button, and a rail holding the status, the save line, the publish checklist, the classification and the actions. Below `lg` the rail sits above the body (as the reading page's does) and the actions are a bar on the bottom edge.

**Files:**
- Create: `src/components/lab/editor/editor-rail.tsx`
- Create: `src/components/lab/editor/article-editor.tsx`
- Modify: `src/components/lab/editor/editor.test.ts`
- Modify: `messages/en.json`, `messages/vi.json` (`labAdmin.unsaved`, `labAdmin.savedAt`)

**Interfaces:**
- Consumes: `useArticleEditor()` and `ArticleEditor` (Task 4); `EditableBlock`, `BlockInserter` (Task 5); `MetaEditor` (`../admin/meta-editor`); `FIELD`, `AREA`, `SELECT` (`@/components/admin-ui/controls`); `TOPICS`, `LEVELS` (`@/lib/lab/articles`); `ARCHETYPES` (`@/lib/lab/parse`); `Link`, `useRouter` (`@/i18n/navigation`).
- Produces:
  - `export function ArticleEditor({ id, kind }: { id: string | null; kind: ArticleKind })` — `id: null` starts a new page of that kind.
  - `export const pathFor = (kind: ArticleKind, id: string) => kind === 'knowledge' ? `/learn/${id}` : `/blog/${id}`` (in `editor-rail.tsx`).
  - `EditorRail({ editor }: { editor: ArticleEditor })` and `EditorActions({ editor, onDeleted }: { editor: ArticleEditor; onDeleted: () => void })`.

- [ ] **Step 1: Write the failing tests** — append to `editor.test.ts`:

```ts
describe('ArticleEditor', () => {
  const src = read('article-editor.tsx')

  it('opens the record it was given, or starts a page of the route’s kind', () => {
    expect(src).toMatch(/if \(id\) void editor\.loadArticle\(id\)/)
    expect(src).toMatch(/else editor\.startNew\(kind\)/)
  })

  it('moves to the page’s own edit URL once it has an id, or changes kind', () => {
    expect(src).toMatch(/router\.replace\(`\$\{pathFor\(stored\.kind, stored\.id\)\}\/edit`\)/)
  })

  it('keeps one block open at a time, and opens a block as it is inserted', () => {
    expect(src).toMatch(/const \[openKey, setOpenKey\] = useState<number \| null>\(null\)/)
    expect(src).toMatch(/setOpenKey\(editor\.insertBlock\(type, 0\)\)/)
    expect(src).toMatch(/setOpenKey\(editor\.insertBlock\(type, i \+ 1\)\)/)
  })

  it('keys blocks by identity', () => {
    expect(src).toMatch(/key=\{key\}/)
    expect(src).not.toMatch(/key=\{i\}/)
  })

  it('merges an upload into the block as it is now', () => {
    expect(src).toMatch(/editor\.setAsset\(draft\.session, key, field, assetId\)/)
  })

  it('reads the same column measure as the published page', () => {
    expect(src).toMatch(/max-w-\[46rem\] flex-1 basis-\[32\.5rem\]/)
  })
})

describe('EditorRail', () => {
  const src = read('editor-rail.tsx')

  it('says what saving is doing, politely, as a status', () => {
    expect(src).toMatch(/aria-live="polite"/)
    expect(src).toMatch(/t\('savedAt'/)
    expect(src).toMatch(/t\('unsaved'\)/)
  })

  it('shows the publish rules the whole time', () => {
    expect(src).toMatch(/editor\.problems\.length === 0 \? t\('specClear'\)/)
  })

  it('will not save or publish a page with a blank title', () => {
    expect(src.match(/disabled=\{busy !== '' \|\| !draft\.title\.trim\(\)\}/g)?.length).toBe(2)
  })

  it('keeps the bottom bar out of any animated parent and pays back the safe area', () => {
    expect(src).toMatch(/fixed inset-x-0 bottom-0 z-30 pb-safe lg:hidden/)
    expect(src).not.toMatch(/animate-fade-in/)
  })

  it('locks the kind of a published page, as the route does', () => {
    expect(src).toMatch(/disabled=\{draft\.status === 'published'\}/)
  })
})
```

- [ ] **Step 2: Run them and see them fail** — `npx vitest run src/components/lab/editor` → FAIL.

- [ ] **Step 3: Add the two strings** — `labAdmin.unsaved`: vi `"Chưa lưu"`, en `"Not saved"`; `labAdmin.savedAt`: vi `"Đã lưu lúc {time}"`, en `"Saved at {time}"`.

- [ ] **Step 4: Create `editor-rail.tsx`**

```tsx
'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { FIELD, SELECT } from '@/components/admin-ui/controls'
import { LEVELS, TOPICS } from '@/lib/lab/articles'
import { ARCHETYPES } from '@/lib/lab/parse'
import type { Archetype, ArticleKind } from '@/lib/lab/types'
import type { Draft } from '../admin/article-draft'
import type { ArticleEditor } from '../admin/use-article-editor'

/** Where a saved page lives. */
export const pathFor = (kind: ArticleKind, id: string) =>
  kind === 'knowledge' ? `/learn/${id}` : `/blog/${id}`

const KINDS: readonly ArticleKind[] = ['article', 'knowledge']

/** The status, the save line, the publish rules and the classification. */
export function EditorRail({ editor, onDeleted }: { editor: ArticleEditor; onDeleted: () => void }) {
  const t = useTranslations('labAdmin')
  const format = useFormatter()
  const { draft, busy, status, savedAt, dirty } = editor
  if (!draft) return null

  const line =
    busy === 'saving'
      ? t('saving')
      : status?.kind === 'err'
        ? status.msg
        : dirty
          ? t('unsaved')
          : savedAt
            ? t('savedAt', { time: format.dateTime(savedAt, { hour: '2-digit', minute: '2-digit' }) })
            : null

  return (
    <aside className="flex grow basis-[clamp(15rem,19vw,20rem)] flex-col gap-4 self-end lg:sticky lg:top-6 lg:grow-0">
      <div className="surface flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={'chip font-semibold uppercase tracking-[0.08em] ' + (draft.status === 'published' ? 'bg-accent-500 text-white' : 'bg-glass-raised text-ink-muted')}>
            {draft.status === 'published' ? t('statusPublished') : t('statusDraft')}
          </span>
          <p role="status" aria-live="polite" className={'meta ' + (status?.kind === 'err' ? 'text-danger' : '')}>
            {line}
          </p>
        </div>
        <EditorActions editor={editor} className="hidden lg:flex" onDeleted={onDeleted} />
      </div>

      <div className="surface px-5 py-4">
        <p className="label text-accent-400">
          {editor.problems.length === 0 ? t('specClear') : t('specRemaining', { n: editor.problems.length })}
        </p>
        {editor.problems.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {editor.problems.map((code) => (
              <li key={code} className="text-body-sm text-ink-muted">
                {editor.codeMessage(code)}
                {code === 'relatedUnknown' && editor.unknownRefs.length > 0 ? (
                  <> {t('unknownRefs')} <span className="font-semibold text-ink">{editor.unknownRefs.map((r) => r.id).join(', ')}</span></>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <Classification draft={draft} edit={editor.edit} />
    </aside>
  )
}

function Classification({ draft, edit }: { draft: Draft; edit: ArticleEditor['edit'] }) {
  const t = useTranslations('labAdmin')
  return (
    <div className="surface flex flex-col gap-3 px-5 py-4">
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('kind')}</span>
        <select value={draft.kind} onChange={(e) => edit({ kind: e.target.value as ArticleKind })} disabled={draft.status === 'published'} title={draft.status === 'published' ? t('kindLockedHint') : undefined} className={`${SELECT} disabled:opacity-60`}>
          {KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}` as never)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('topic')}</span>
        <select value={draft.topic} onChange={(e) => edit({ topic: e.target.value as Draft['topic'] })} className={SELECT}>
          {TOPICS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('level')}</span>
        <select value={draft.level} onChange={(e) => edit({ level: e.target.value as Draft['level'] })} className={SELECT}>
          {LEVELS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('archetype')}</span>
        <select value={draft.archetype} onChange={(e) => edit({ archetype: e.target.value as Archetype })} className={SELECT}>
          {ARCHETYPES.map((a) => <option key={a} value={a}>{t(`archetypes.${a}` as never)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">{t('readTime')}</span>
        <input type="text" value={draft.read} onChange={(e) => edit({ read: e.target.value })} placeholder={t('readTimePlaceholder')} className={FIELD} />
      </label>
    </div>
  )
}

/** Lưu, Đăng / Đưa về bản nháp, Xem trang, Xoá. */
export function EditorActions({
  editor,
  className = 'flex',
  onDeleted,
}: {
  editor: ArticleEditor
  className?: string
  onDeleted?: () => void
}) {
  const t = useTranslations('labAdmin')
  const { draft, busy } = editor
  if (!draft) return null
  return (
    /* `display` comes from the caller alone: `flex` beside `hidden` on one
       element is decided by stylesheet order, not by intent. */
    <div className={`flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={() => void editor.save(draft.status)} disabled={busy !== '' || !draft.title.trim()} className="btn-glass cursor-pointer disabled:opacity-40">
        {busy === 'saving' ? t('saving') : draft.status === 'published' ? t('saveChanges') : t('saveDraft')}
      </button>
      {draft.id ? (
        <button type="button" onClick={() => void editor.save(draft.status === 'published' ? 'draft' : 'published')} disabled={busy !== '' || !draft.title.trim()} className="btn-accent cursor-pointer disabled:opacity-40">
          {draft.status === 'published' ? t('unpublish') : t('publish')}
        </button>
      ) : null}
      {draft.id && draft.status === 'published' ? (
        <Link href={pathFor(draft.kind, draft.id)} className="chip chip-action">{t('viewLive')}</Link>
      ) : null}
      {draft.id && onDeleted ? (
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(t('deleteConfirm', { title: draft.title }))) return
            if (await editor.remove()) onDeleted()
          }}
          disabled={busy !== ''}
          className="chip chip-action text-danger disabled:opacity-40"
        >
          {busy === 'deleting' ? t('deleting') : t('delete')}
        </button>
      ) : null}
    </div>
  )
}

/** The actions on the bottom edge, below `lg`. A sibling of the page, never inside a moving one. */
export function EditorBottomBar({ editor, onDeleted }: { editor: ArticleEditor; onDeleted: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 pb-safe lg:hidden">
      <div className="surface-raised mx-3 mb-3 px-4 py-3">
        <EditorActions editor={editor} onDeleted={onDeleted} />
      </div>
    </div>
  )
}
```

The confirm is on the button; `remove()` in the hook does not ask (Task 4, change 3).

- [ ] **Step 5: Create `article-editor.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { AREA } from '@/components/admin-ui/controls'
import type { ArticleKind } from '@/lib/lab/types'
import { MetaEditor } from '../admin/meta-editor'
import { useArticleEditor } from '../admin/use-article-editor'
import { BlockInserter } from './block-inserter'
import { EditableBlock } from './editable-block'
import { EditorBottomBar, EditorRail, pathFor } from './editor-rail'

/**
 * The page, as its own editor (spec: docs/superpowers/specs/2026-10-22-edit-in-place-design.md).
 * The same column and rail as `ArticleView`; the blocks are the reader's until
 * one is opened. Nothing autosaves.
 */
export function ArticleEditor({ id, kind }: { id: string | null; kind: ArticleKind }) {
  const t = useTranslations('labAdmin')
  const router = useRouter()
  const editor = useArticleEditor({
    onStored: (stored, created) => {
      if (created || stored.kind !== kind) router.replace(`${pathFor(stored.kind, stored.id)}/edit`)
      else router.refresh()
    },
  })
  const [openKey, setOpenKey] = useState<number | null>(null)
  const [metaOpen, setMetaOpen] = useState(false)

  useEffect(() => {
    if (id) void editor.loadArticle(id)
    else editor.startNew(kind)
    // Once per route: the route is the article.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind])

  const { draft } = editor
  if (!draft) {
    return editor.status ? <p role="status" className="meta text-danger">{editor.status.msg}</p> : null
  }
  const onDeleted = () => router.push(kind === 'knowledge' ? '/learn' : '/blog')

  return (
    <>
      <div className="flex flex-wrap-reverse items-end gap-y-8 gap-x-[clamp(2rem,3.5vw,4rem)] pb-28 lg:pb-0">
        <article className="lab-article min-w-0 max-w-[46rem] flex-1 basis-[32.5rem]" lang="vi">
          <label className="sr-only" htmlFor="ed-title">{t('title')}</label>
          <textarea
            id="ed-title"
            value={draft.title}
            onChange={(e) => editor.edit({ title: e.target.value.replace(/\n/g, ' ') })}
            rows={2}
            className={`${AREA} text-display font-semibold tracking-[-0.02em] leading-[1.15]`}
          />
          <label className="sr-only" htmlFor="ed-dek">{t('dek')}</label>
          <textarea
            id="ed-dek"
            value={draft.dek}
            onChange={(e) => editor.edit({ dek: e.target.value })}
            rows={2}
            className={`${AREA} mt-4 text-title-3 leading-[1.5]`}
          />
          <p className={`meta mt-1 text-right tabular-nums ${draft.dek.length > 220 ? 'text-danger' : ''}`}>{draft.dek.length}/220</p>
          <hr className="seam mt-6 mb-6" />

          <BlockInserter onInsert={(type) => setOpenKey(editor.insertBlock(type, 0))} />
          {draft.blocks.map(({ key, block }, i) => (
            <div key={key}>
              <EditableBlock
                block={block}
                index={i}
                open={openKey === key}
                onOpen={() => setOpenKey(key)}
                onClose={() => setOpenKey(null)}
                onChange={(next) => editor.setBlock(key, next)}
                onAsset={(field, assetId) => editor.setAsset(draft.session, key, field, assetId)}
                onMove={(by) => editor.moveBlock(key, by)}
                onRemove={() => {
                  editor.removeBlock(key)
                  setOpenKey(null)
                }}
                first={i === 0}
                last={i === draft.blocks.length - 1}
                upload={editor.upload}
                previews={editor.previews}
                canUpload={draft.id !== null}
              />
              <BlockInserter onInsert={(type) => setOpenKey(editor.insertBlock(type, i + 1))} />
            </div>
          ))}

          <footer className="mt-6 flex flex-col gap-4">
            <hr className="seam" />
            <button type="button" onClick={() => setMetaOpen((o) => !o)} aria-expanded={metaOpen} className="btn-glass self-start">
              {t('metaHeading')}
            </button>
            {metaOpen ? (
              <MetaEditor
                kind={draft.kind}
                meta={draft.meta}
                onChange={(meta) => editor.edit({ meta })}
                refs={editor.refs}
                refsFailed={editor.refsFailed}
                unknownRefs={editor.unknownRefs}
              />
            ) : null}
          </footer>
        </article>

        <EditorRail editor={editor} onDeleted={onDeleted} />
      </div>
      <EditorBottomBar editor={editor} onDeleted={onDeleted} />
    </>
  )
}
```

The title is a two-row textarea rather than an `<input>` so a long Vietnamese title wraps the way the h1 does; newlines are stripped because a title is one line.

- [ ] **Step 6: Run the tests** — `npx vitest run src/components/lab src/app/messages.test.ts && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/lab/editor messages/en.json messages/vi.json src/components/lab/admin/use-article-editor.ts
git commit -m "Editor: the article page as its own editor, with a rail and a bottom bar"
```

### Task 7: The four edit routes

`/blog/<id>/edit`, `/learn/<id>/edit`, `/blog/new`, `/learn/new`, in both locales. Dynamic, never indexed, the paper room, the site header, and a provider that carries exactly what the editor and the gate read.

**Files:**
- Create: `src/components/lab/editor/edit-gate.tsx`
- Create: `src/app/[locale]/_edit/edit-route.tsx`
- Create: `src/app/[locale]/blog/[id]/edit/page.tsx`
- Create: `src/app/[locale]/learn/[id]/edit/page.tsx`
- Create: `src/app/[locale]/blog/new/page.tsx`
- Create: `src/app/[locale]/learn/new/page.tsx`
- Create: `src/app/edit-routes.test.ts`

**Interfaces:**
- Consumes: `AdminSessionProvider` (Task 1), `AdminGate` (Task 2), `ArticleEditor` (Task 6), `SiteHeader`.
- Produces: `EditGate({ kind, id }: { kind: ArticleKind; id: string | null })` (client) and `EditRoute({ kind, id })` (server).

- [ ] **Step 1: Write the failing test** — `src/app/edit-routes.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The edit routes, pinned at the source: request-time, never indexed, never in
 * the sitemap, the paper room, and their own message provider so no admin
 * string rides on a reader's page.
 */
const read = (p: string) => readFileSync(p, 'utf8')
const ROUTES = [
  ['src/app/[locale]/blog/[id]/edit/page.tsx', "kind=\"article\" id={id}"],
  ['src/app/[locale]/learn/[id]/edit/page.tsx', "kind=\"knowledge\" id={id}"],
  ['src/app/[locale]/blog/new/page.tsx', 'kind="article" id={null}'],
  ['src/app/[locale]/learn/new/page.tsx', 'kind="knowledge" id={null}'],
] as const

describe.each(ROUTES)('%s', (path, call) => {
  const src = read(path)

  it('renders per request and is never indexed', () => {
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/)
    expect(src).toMatch(/robots: \{ index: false, follow: false \}/)
  })

  it('is the paper room for the browser chrome', () => {
    expect(src).toMatch(/themeColor: '#F9F8F5', colorScheme: 'light'/)
  })

  it('opens the editor on the right kind', () => {
    expect(src).toContain(`<EditRoute ${call} />`)
  })
})

describe('EditRoute', () => {
  const src = read('src/app/[locale]/_edit/edit-route.tsx')

  it('paints the paper room under the site header', () => {
    expect(src).toMatch(/className="theme-paper contents"/)
    expect(src).toMatch(/<Suspense>\s*<SiteHeader \/>\s*<\/Suspense>/)
  })

  it('sends the gate’s and the editor’s namespaces, and nothing a reader page needs', () => {
    expect(src).toMatch(/const clientMessages = \{\n\s+adminUi: messages\.adminUi,\n\s+labAdmin: messages\.labAdmin,\n {2}\}/)
  })

  it('keeps the header outside the provider, which replaces the layout’s messages', () => {
    expect(src.indexOf('<SiteHeader')).toBeLessThan(src.indexOf('<NextIntlClientProvider'))
  })
})

describe('the public tree', () => {
  it('never lists an edit route in the sitemap', () => {
    expect(read('src/app/sitemap.ts')).not.toMatch(/\/edit|\/new/)
  })

  it('ships no admin namespace from the public layout', () => {
    const layout = read('src/app/[locale]/layout.tsx')
    expect(layout).not.toMatch(/adminUi:|labAdmin:/)
  })
})
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/app/edit-routes.test.ts` → FAIL.

- [ ] **Step 3: Create `edit-gate.tsx`**

```tsx
'use client'

import { AdminGate } from '@/components/admin-ui/gate'
import { AdminSessionProvider } from '@/components/admin-ui/session'
import type { ArticleKind } from '@/lib/lab/types'
import { ArticleEditor } from './article-editor'

/** The editor, behind the same gate the admin department uses. */
export function EditGate({ kind, id }: { kind: ArticleKind; id: string | null }) {
  return (
    <AdminSessionProvider>
      <AdminGate>
        <ArticleEditor id={id} kind={kind} />
      </AdminGate>
    </AdminSessionProvider>
  )
}
```

- [ ] **Step 4: Create `src/app/[locale]/_edit/edit-route.tsx`**

```tsx
import { Suspense } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { SiteHeader } from '@/components/site-header'
import { EditGate } from '@/components/lab/editor/edit-gate'
import type { ArticleKind } from '@/lib/lab/types'

/**
 * The body of the four edit routes.
 *
 * Its provider REPLACES the layout's messages for everything inside it
 * (use-intl's IntlProvider takes `messages` whole when given), so it lists
 * every namespace the gate and the editor read, and the header stays outside
 * it. These two namespaces reach the browser on these routes only.
 */
export async function EditRoute({ kind, id }: { kind: ArticleKind; id: string | null }) {
  const messages = await getMessages()
  const clientMessages = {
    adminUi: messages.adminUi,
    labAdmin: messages.labAdmin,
  }
  return (
    <div className="theme-paper contents">
      <Suspense>
        <SiteHeader />
      </Suspense>
      <main className="mx-auto min-h-screen-dynamic w-full max-w-[86rem] inset-safe pt-8 pb-24">
        <NextIntlClientProvider messages={clientMessages}>
          <EditGate kind={kind} id={id} />
        </NextIntlClientProvider>
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Create the four pages** — `src/app/[locale]/blog/[id]/edit/page.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'
import { EditRoute } from '../../../_edit/edit-route'

/* The paper room's ground for the browser chrome, as on `/blog/[id]`. */
export const viewport: Viewport = { themeColor: '#F9F8F5', colorScheme: 'light' }

/* An administrator's screen: nothing here may be prerendered or cached. */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'adminUi' })
  return { title: t('metaArticles'), robots: { index: false, follow: false } }
}

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  return <EditRoute kind="article" id={id} />
}
```

`learn/[id]/edit/page.tsx` is the same with `kind="knowledge"` and the component named `EditKnowledgePage`. `blog/new/page.tsx` and `learn/new/page.tsx` are the same with `params: Promise<{ locale: Locale }>`, import path `'../../_edit/edit-route'`, and `<EditRoute kind="article" id={null} />` / `<EditRoute kind="knowledge" id={null} />` (components `NewArticlePage`, `NewKnowledgePage`). Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` once if `robots` typing complains.

- [ ] **Step 6: Run the tests** — `npx vitest run src/app && npm run typecheck && npm run lint` → PASS, including `messages.test.ts` (it now also reads this provider), `next-boundaries.test.ts` (no `loading.tsx` added) and `learn-routes.test.ts`.

- [ ] **Step 7: Walk the whole flow in the browser** — dev server (offline: the dev admin is signed in, the dev store holds the articles):
  1. `/vi/blog/<a published id>` → Sửa → `/vi/blog/<id>/edit`. The header is the site header; the title and dek are fields; the blocks look like the article.
  2. Click a paragraph: its field opens in place. Change a word, press Escape, click Lưu thay đổi. The save line reads **Đã lưu lúc …**.
  3. Xem trên web → the public page shows the new word (dev store + `revalidateTag`).
  4. Hover between two blocks → **+ Thêm khối** → Khối lưu ý: it appears there, open. Fill it, move it up, Lưu.
  5. Click a header link with an unsaved change: the browser asks first.
  6. `/vi/blog/new`: type a title, Lưu nháp → the URL becomes `/vi/blog/<new id>/edit`; Đăng bài is refused with the rule list; Xoá → back on `/vi/blog`.
  7. `/vi/learn/<id>/edit` for a knowledge page: the kind select is disabled while published.
  8. `resize_window` mobile (375×812): the rail sits above the body, the actions are a bar on the bottom edge above the safe area, the inserter row is visible without hover, nothing scrolls sideways (`document.documentElement.scrollWidth === innerWidth` via `javascript_tool`).
  9. `read_console_messages` with `onlyErrors`: none. Reset with `resize_window` preset `desktop`.

- [ ] **Step 8: Commit**

```bash
git add src/app/[locale]/_edit src/app/[locale]/blog/[id]/edit src/app/[locale]/learn/[id]/edit src/app/[locale]/blog/new src/app/[locale]/learn/new src/app/edit-routes.test.ts src/components/lab/editor/edit-gate.tsx
git commit -m "Edit routes: /blog/<id>/edit, /learn/<id>/edit and /new, behind the admin gate"
```

### Task 8: Bài mới and the drafts on the feed

With `/admin/blog` gone (Task 9), a new page and the unpublished drafts need a way in. On `/blog` and `/learn`, an administrator sees one row above the content: **Bài mới**, and **Bản nháp · n** that opens a list of that kind's drafts, each linking to its editor. A reader sees nothing and causes no request.

**Files:**
- Create: `src/components/lab/feed-admin-row.tsx`
- Modify: `src/components/lab/edit-link.test.ts` (one more `describe`)
- Modify: `src/app/[locale]/blog/page.tsx`, `src/app/[locale]/learn/page.tsx`
- Modify: `messages/en.json`, `messages/vi.json` (`lab.adminNew`, `lab.adminDrafts`)

**Interfaces:**
- Consumes: `AdminSessionProvider({ probeSignedOut: false })`, `useAdminSession().authed`, `GET /api/admin/articles` → `{ articles: ArticleRecord[] }`.
- Produces: `FeedAdminRow({ kind, create, drafts }: { kind: ArticleKind; create: string; drafts: string })`.

- [ ] **Step 1: Write the failing test** — append to `src/components/lab/edit-link.test.ts`:

```ts
describe('FeedAdminRow', () => {
  const row = readFileSync('src/components/lab/feed-admin-row.tsx', 'utf8')
  const blog = readFileSync('src/app/[locale]/blog/page.tsx', 'utf8')
  const learn = readFileSync('src/app/[locale]/learn/page.tsx', 'utf8')

  it('is for an admin only and leaves a signed-out reader unprobed', () => {
    expect(row).toMatch(/<AdminSessionProvider probeSignedOut=\{false\}>/)
    expect(row).toMatch(/if \(gate !== 'admin'\) return null/)
  })

  it('reads the drafts with the session’s own headers, only once the gate is open', () => {
    expect(row).toMatch(/fetch\('\/api\/admin\/articles', \{ headers: authed\(\) \}\)/)
    expect(row).toMatch(/if \(gate !== 'admin'\) return\b/)
  })

  it('lists the drafts of its own kind, each at its edit path', () => {
    expect(row).toMatch(/a\.status === 'draft' && a\.kind === kind/)
    expect(row).toMatch(/href=\{`\$\{base\}\/\$\{a\.id\}\/edit`\}/)
  })

  it('sits on both hubs, with its words from the server', () => {
    expect(blog).toMatch(/<FeedAdminRow\s+kind="article"/)
    expect(learn).toMatch(/<FeedAdminRow\s+kind="knowledge"/)
    expect(row).not.toMatch(/useTranslations\(/)
  })
})
```

- [ ] **Step 2: Run it and see it fail** — `npx vitest run src/components/lab/edit-link.test.ts` → FAIL.

- [ ] **Step 3: Add the words** — `lab.adminNew`: vi `"Bài mới"`, en `"New article"`; `lab.adminDrafts`: vi `"Bản nháp"`, en `"Drafts"`.

- [ ] **Step 4: Create `feed-admin-row.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { AdminSessionProvider, useAdminSession } from '@/components/admin-ui/session'
import type { ArticleKind, ArticleRecord } from '@/lib/lab/types'

/**
 * Where an administrator starts a page or finds a draft, now that there is no
 * list screen: one row above the hub, for them alone. The hub itself stays
 * prerendered; this asks in the browser, like `EditLink`.
 */
export function FeedAdminRow(props: { kind: ArticleKind; create: string; drafts: string }) {
  return (
    <AdminSessionProvider probeSignedOut={false}>
      <Row {...props} />
    </AdminSessionProvider>
  )
}

function Row({ kind, create, drafts }: { kind: ArticleKind; create: string; drafts: string }) {
  const { gate, authed } = useAdminSession()
  const [rows, setRows] = useState<ArticleRecord[] | null>(null)
  const base = kind === 'knowledge' ? '/learn' : '/blog'

  useEffect(() => {
    if (gate !== 'admin') return
    let live = true
    ;(async () => {
      try {
        const res = await fetch('/api/admin/articles', { headers: authed() })
        const data = (await res.json()) as { articles?: ArticleRecord[] }
        if (live && res.ok && data.articles) {
          setRows(data.articles.filter((a) => a.status === 'draft' && a.kind === kind))
        }
      } catch {
        /* The row still offers a new page; the count is what is missing. */
      }
    })()
    return () => {
      live = false
    }
  }, [gate, authed, kind])

  if (gate !== 'admin') return null
  return (
    <div className="mx-auto w-full max-w-[160rem] inset-safe pt-6">
      <div className="flex flex-wrap items-start gap-3">
        <Link href={`${base}/new`} className="btn-glass">
          {create}
        </Link>
        {rows && rows.length > 0 ? (
          <details className="min-w-0 flex-1">
            <summary className="chip chip-action list-none">
              {drafts} · <span className="tabular-nums">{rows.length}</span>
            </summary>
            <ul className="mt-2 flex flex-col" lang="vi">
              {rows.map((a) => (
                <li key={a.id}>
                  <hr className="seam" />
                  <Link
                    href={`${base}/${a.id}/edit`}
                    className="flex min-h-[var(--layout-touch-target)] items-center px-2 text-body-sm font-semibold text-ink hover:text-accent-400"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Mount it** — in `src/app/[locale]/blog/page.tsx`, add `getTranslations` to the existing `next-intl/server` import if missing, `import { FeedAdminRow } from '@/components/lab/feed-admin-row'`, read `const t = await getTranslations('lab')` beside `getPublishedArticles()`, and put the row first inside `<main>`:

```tsx
        <FeedAdminRow kind="article" create={t('adminNew')} drafts={t('adminDrafts')} />
```

In `learn/page.tsx`, it already loads `getTranslations('learn')` as `t`; add `const tl = await getTranslations('lab')` and put, first inside `<main>`:

```tsx
        <FeedAdminRow kind="knowledge" create={tl('adminNew')} drafts={tl('adminDrafts')} />
```

`/blog` reads `searchParams` and is dynamic already; `/learn` stays ISR — the row adds no request-time read to either.

- [ ] **Step 6: Run the tests** — `npx vitest run src/components src/app && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 7: Check in the browser** — `/vi/blog` and `/vi/learn` as the dev admin show the row; Bài mới opens the empty editor of that kind; Bản nháp lists the pilot drafts (`pilot-drafts.ts` seeds them into the dev store as drafts) and each opens its editor.

- [ ] **Step 8: Commit**

```bash
git add src/components/lab/feed-admin-row.tsx src/components/lab/edit-link.test.ts src/app/[locale]/blog/page.tsx src/app/[locale]/learn/page.tsx messages/en.json messages/vi.json
git commit -m "Hubs: Bài mới and the drafts, for administrators"
```

### Task 9: /admin/blog becomes /blog

The list screen is retired (spec D2). Its URL redirects to the feed, the admin header and home card point at the feed, the old component and its test go, and the documents that send an editor to `/admin/blog` are corrected.

**Files:**
- Modify: `src/app/admin/blog/page.tsx`
- Modify: `src/components/admin-ui/shell.tsx` (`SECTIONS`), `src/app/admin/page.tsx` (card href)
- Modify: `src/app/admin/layout.tsx` (drop `labAdmin` from its `clientMessages`)
- Delete: `src/components/lab/admin/article-admin.tsx`, `src/components/lab/admin/article-admin.test.ts`
- Modify: `src/components/lab/admin/use-article-editor.test.ts`, `src/components/admin-ui/session.test.ts`
- Modify: `messages/en.json`, `messages/vi.json` (remove list-only `labAdmin` keys)
- Modify: `docs/guides/editor-knowledge-and-links.md`, `AGENTS.md` (one line), `src/lib/lab/pilot-drafts.ts` and `pilot-drafts.test.ts` (comments), `docs/superpowers/specs/2026-10-22-edit-in-place-design.md` (two corrections)

- [ ] **Step 1: Retarget the tests first**
  - `session.test.ts`: in the inventory test's expected list replace `'src/components/lab/admin/article-admin.tsx'` with `'src/components/lab/admin/use-article-editor.ts'`.
  - `use-article-editor.test.ts`: add the `copy` block and the `one list of archetypes and link kinds` block from `article-admin.test.ts`; in the latter, read `src/components/lab/editor/editor-rail.tsx` instead of `code` for the `ARCHETYPES` import assertions. In `design`, replace `'article-admin.tsx'` with `'use-article-editor.ts'` and add the editor files: read them from `src/components/lab/editor/` (`article-editor.tsx`, `editable-block.tsx`, `editor-rail.tsx`, `block-preview.tsx`).
  - Add to `src/app/edit-routes.test.ts`:

```ts
describe('/admin/blog', () => {
  it('sends the editor to the feed, where the pages and the drafts are', () => {
    const src = read('src/app/admin/blog/page.tsx')
    expect(src).toMatch(/redirect\('\/blog'\)/)
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/)
  })
})
```

- [ ] **Step 2: Run them and see them fail** — `npx vitest run src/app/edit-routes.test.ts src/components` → FAIL on the redirect.

- [ ] **Step 3: Redirect** — replace `src/app/admin/blog/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'

/**
 * Moved to the pages themselves (2026-10-22): an article is edited at
 * /blog/<id>/edit from its own Sửa link, and a new page or a draft is reached
 * from the row an administrator sees on /blog and /learn.
 *
 * Dynamic, so this is a real 307 rather than a static meta refresh — the
 * reasoning on `[locale]/blog/admin/page.tsx`.
 */
export const dynamic = 'force-dynamic'

export default function AdminBlogPage() {
  redirect('/blog')
}
```

  `src/app/[locale]/blog/admin/page.tsx` redirects to `/admin/blog`, which now redirects on — change its target to `/blog` so there is one hop.

- [ ] **Step 4: Point the admin at the feed** — in `shell.tsx` `SECTIONS`, the blog entry's `href` becomes `'/blog'`; in `src/app/admin/page.tsx` the third card's `href` becomes `'/blog'`. Both use `next/link` with a plain path, which lands on the English feed; that is the default locale.

- [ ] **Step 5: Delete the old screen** — `git rm src/components/lab/admin/article-admin.tsx src/components/lab/admin/article-admin.test.ts`; remove `labAdmin: messages.labAdmin,` from `src/app/admin/layout.tsx`'s `clientMessages` and its mention in the comment above it. `proxy.test.ts` keeps `'/admin/blog'` — the path still exists, as a redirect, and must still be excluded from the locale rewrite.

- [ ] **Step 6: Remove copy nothing reads** — for each of `newArticle`, `searchPlaceholder`, `listEmpty`, `blockCount`, `pickTitle`, `pickBody`, `created`, `deleted`, run `rg -n "'<key>'" src` and delete the key from `labAdmin` in **both** `messages/en.json` and `messages/vi.json` only when there is no hit.

- [ ] **Step 7: Correct the documents**
  - `docs/guides/editor-knowledge-and-links.md`: first line → "Dành cho người biên tập nội dung, ngay trên trang: nút **Sửa** trên mỗi bài và trang kiến thức mở `/blog/<mã>/edit` hoặc `/learn/<mã>/edit`; **Bài mới** và **Bản nháp** ở đầu `/blog` và `/learn`." In §2, step 1 becomes "**Bài mới** (đầu trang `/blog` hoặc `/learn`) → nhập tiêu đề → **Lưu nháp**", and add a step: "Bấm vào một khối để sửa ngay tại chỗ; **Xong** hoặc Esc để đóng. **+ Thêm khối** giữa hai khối để chèn."
  - `AGENTS.md` line 461: "editor in `/admin/blog`" → "editor, from the page's own Sửa link (`/blog/<id>/edit`)".
  - `pilot-drafts.ts:22` and `pilot-drafts.test.ts:96`: `/admin/blog` → `the page's editor (/blog/<id>/edit)`.
  - The spec, two corrections to match what was built: under "The experience" step 6, "Below `lg` the rail collapses: the checklist sits above the footer" → "Below `lg` the rail sits above the body, as the reading page's does"; under "Data flow", replace "Cache the answer in module scope keyed by the address, so a session makes one request however many pages it reads." with "A signed-in administrator makes one request per page view; a reader with no session makes none (`probeSignedOut={false}`)."

- [ ] **Step 8: Run everything** — `npx vitest run && npm run typecheck && npm run lint` → PASS; `echo $?` after lint is `0`.

- [ ] **Step 9: Check in the browser** — `/admin/blog` lands on `/blog`; the admin header's Bài viết link lands on `/blog`; `/admin/colorlab` and `/admin/wiki` are unchanged.

- [ ] **Step 10: Commit**

```bash
git add -A src/app src/components messages docs AGENTS.md src/lib/lab
git commit -m "Retire /admin/blog: articles are edited on their own pages"
```

### Task 10: The gate, the design audit, and the hand-off

- [ ] **Step 1: The full gate** — `npm run verify` (lint, typecheck, tests, build). The build runs offline in seed mode. Expected: green. In the build's route table, `/[locale]/blog/[id]` and `/[locale]/learn/[id]` are still `●` (SSG) and the four edit routes are `ƒ`.

- [ ] **Step 2: The design audit** — run the seven greps from CLAUDE.md "Before committing UI" over `src/`. Every hit in a file this plan touched is fixed, not excepted.

- [ ] **Step 3: Restart and re-check on `next start`** — per AGENTS.md, a server older than the build serves a ghost. Stop any `next start`, run `npx next start --port 3100` in the background, and open `/vi/blog/<id>` signed out: the HTML contains no `Sửa`, the network log has no `/api/admin/session` request. Stop the server.

- [ ] **Step 4: What could not be checked here** — offline there is no content project, so `next start` cannot write (`requireAdmin()` answers no admin in production mode). Whether `revalidateTag(LAB_TAG, IMMEDIATE)` refreshes the prerendered `/blog/<id>` HTML after a save, and not only the cached read, needs a preview deployment with the real projects: save a word, reload the public page, see the word. Write that down in the PR description as the one manual check.

- [ ] **Step 5: Push and open the pull request** — only when the owner says so (deploy = merge to `main`). Body: what changed, the owner decisions with their date, the manual check from Step 4, screenshots at 390 and 1440 of the edit page with one block open.
