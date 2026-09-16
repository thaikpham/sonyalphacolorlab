# Supabase Control/Content Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Refactor ColorLab 2.0 so Auth and community operations remain on the existing Supabase control project, published content and every content-admin write use the separate content project, article media has a bounded lifecycle, and a successful save is visible immediately.

**Architecture:** The browser trusts only the control project for OAuth. Server routes validate that control-plane session and role before calling one explicit content-plane service client. Public control and content reads each use their own anon/RLS client. Production has one content source, while credential-free local development remains deliberately offline. Article blocks persist asset UUIDs; only processed immutable WebP variants become public.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Supabase JS 2, Postgres/RLS, Supabase Storage, Sharp, Vitest, PGlite, next-intl.

**Spec:** docs/superpowers/specs/2026-09-11-supabase-control-content-split-design.md

> **Status (2026-09-15):** every implementation step below is done and the full
> gate is green — `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
> The steps left unchecked are the per-task `git commit` steps only: the work is
> in the working tree, uncommitted, awaiting review. Nothing in a live Supabase
> project has been changed; that is the companion cutover plan, which is blocked
> on the control project's egress quota.


## Global Constraints

- Preserve every pre-existing dirty change. Before each commit, inspect git status --short and git diff --cached; never use git add -A, git reset, git checkout, or a blanket restore.
- The current Lab admin work is uncommitted and is part of the implementation base. Patch it in place; do not replace it from HEAD.
- If work is delegated, first use superpowers:using-git-worktrees. A delegated worktree must contain an explicit checkpoint of the current Lab admin base; a worktree created from HEAD alone is missing that work.
- Use superpowers:test-driven-development for every behavior change and superpowers:systematic-debugging for any unexpected failure.
- Before editing App Router, cache, error, or Image code, read these installed docs in full:
  - node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md
  - node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md
  - node_modules/next/dist/docs/01-app/01-getting-started/12-images.md
  - node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
  - node_modules/next/dist/docs/01-app/02-guides/environment-variables.md
  - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md
  - node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/images.md
- Keep all UI strings in both messages/en.json and messages/vi.json. Run the message parity test after adding a key.
- Never print, commit, echo, interpolate into a URL, or include in a process argument either secret key, a database password, or an access token.
- The names ending in SECRET_KEY are server-only. No module imported by a file with use client may import src/lib/supabase/server.ts.
- Keep recipe photography under public/recipes. Do not add any recipe Storage runtime path.
- Do not mutate a live Supabase project in this plan. Live provisioning and cutover are in the companion plan.
- Each task finishes with its focused tests green. Use narrow staging for overlapping dirty files.

---

### Task 1: Lock the two-boundary configuration contract

**Files:**

- Create: src/lib/supabase/config.ts
- Create: src/lib/supabase/config.test.ts
- Create: scripts/check-supabase-env.ts
- Modify: src/lib/supabase/server.ts
- Modify: src/lib/supabase/browser.ts
- Modify: src/lib/supabase/auth-outage.test.ts
- Modify: src/components/auth-context.tsx
- Modify: .env.example
- Modify: package.json

**Interfaces:**

- Consumes: six runtime variables named in the approved spec.
- Produces: configurationMode(), hasControlConfig(), hasContentConfig(), authBrowser(), controlRead(), controlAdmin(), contentRead(), and contentAdmin().
- Invariant: an absent boundary is allowed only when both boundaries are absent; any partial topology throws SupabaseConfigurationError; equal project origins require the explicit server-only rollback override.

- [x] **Step 1: Write failing configuration matrix tests.**

Cover all of these cases in src/lib/supabase/config.test.ts:

~~~ts
it.each([
  ['all six absent', {}, 'offline'],
  ['both complete', COMPLETE, 'online'],
])('%s', (_label, env, expected) => {
  expect(configurationMode(env)).toBe(expected)
})

it.each([
  ['auth URL only', { NEXT_PUBLIC_AUTH_SUPABASE_URL: AUTH_URL }],
  ['auth pair without secret', AUTH_PUBLIC],
  ['content URL only', { NEXT_PUBLIC_CONTENT_SUPABASE_URL: CONTENT_URL }],
  ['content read pair without secret', CONTENT_PUBLIC],
  ['auth complete but content absent', AUTH_COMPLETE],
  ['content complete but auth absent', CONTENT_COMPLETE],
])('rejects %s', (_label, env) => {
  expect(() => configurationMode(env)).toThrow(SupabaseConfigurationError)
})
~~~

Also assert the two URLs must be distinct and valid HTTPS Supabase origins unless SUPABASE_ROLLBACK_MODE is exactly true. This catches an accidental deployment where both logical clients point at nqeedlgzaewccqztqvik while retaining the documented emergency rollback.

it('allows one shared origin only in explicit rollback mode', () => {
  expect(configurationMode({
    ...COMPLETE_WITH_SHARED_ORIGIN,
    SUPABASE_ROLLBACK_MODE: 'true',
  })).toBe('online')
})

- [x] **Step 2: Run the focused test and confirm RED.**

Run:

~~~bash
npm test -- --run src/lib/supabase/config.test.ts
~~~

Expected: module-not-found or missing-export failures.

- [x] **Step 3: Implement the pure configuration parser.**

Use this public shape; keep process.env access behind zero-argument wrappers so tests can pass a plain object:

~~~ts
export type SupabaseMode = 'offline' | 'online'

export class SupabaseConfigurationError extends Error {
  readonly code = 'invalidSupabaseConfiguration'
}

export function configurationMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): SupabaseMode

export const hasControlConfig = (): boolean =>
  configurationMode(process.env) === 'online'

export const hasContentConfig = (): boolean =>
  configurationMode(process.env) === 'online'
~~~

The six accepted names are:

~~~text
NEXT_PUBLIC_AUTH_SUPABASE_URL
NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY
AUTH_SUPABASE_SECRET_KEY
NEXT_PUBLIC_CONTENT_SUPABASE_URL
CONTENT_SUPABASE_ANON_KEY
CONTENT_SUPABASE_SECRET_KEY
~~~

Two optional server-only switches are not boundary credentials:

~~~text
CONTENT_ADMIN_FROZEN
SUPABASE_ROLLBACK_MODE
~~~

Do not retain aliases for NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY in the final state.

- [x] **Step 4: Add five narrowly named clients.**

In src/lib/supabase/server.ts, retain import 'server-only' and lazily create four server clients:

~~~ts
export function controlRead(): SupabaseClient
export function controlAdmin(): SupabaseClient
export function contentRead(): SupabaseClient
export function contentAdmin(): SupabaseClient
~~~

controlRead uses the Auth URL and Auth anon key. controlAdmin uses the Auth URL and Auth secret. contentRead uses the content URL and content anon key. contentAdmin uses the content URL and content secret. Every client sets persistSession: false.

In src/lib/supabase/browser.ts, rename supabaseBrowser() to authBrowser() and use only NEXT_PUBLIC_AUTH_SUPABASE_URL and NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY. isAuthOutage() probes only that origin.

- [x] **Step 5: Add deployment-time validation without breaking offline builds.**

scripts/check-supabase-env.ts must call configurationMode(process.env). If VERCEL_ENV is production, offline is an error; when VERCEL_ENV is absent, an entirely offline local build is valid. It prints a prominent warning when rollback mode permits shared origins, without printing keys. Add:

~~~json
"check:supabase-env": "tsx scripts/check-supabase-env.ts"
~~~

Do not prepend this to npm run verify because the repository gate intentionally runs without credentials. The live deployment plan runs it inside vercel env run.

- [x] **Step 6: Update browser call sites and tests.**

Change AuthProvider to call authBrowser(). Update auth-outage.test.ts to stub the Auth-prefixed pair. Add a source assertion that browser.ts contains neither AUTH_SUPABASE_SECRET_KEY nor CONTENT_SUPABASE_SECRET_KEY.

- [x] **Step 7: Run focused verification.**

~~~bash
npm test -- --run src/lib/supabase/config.test.ts src/lib/supabase/auth-outage.test.ts
npm run typecheck
~~~

- [ ] **Step 8: Commit only this task.**

~~~bash
git add src/lib/supabase/config.ts src/lib/supabase/config.test.ts src/lib/supabase/server.ts src/lib/supabase/browser.ts src/lib/supabase/auth-outage.test.ts src/components/auth-context.tsx scripts/check-supabase-env.ts .env.example
git add -p package.json
git diff --cached --check
git commit -m "refactor: split Supabase client boundaries"
~~~

---

### Task 2: Keep authentication and authorization on the control plane

**Files:**

- Create: src/lib/supabase/errors.ts
- Create: src/lib/auth/control-boundary.test.ts
- Create: src/lib/auth/admin-gate.ts
- Modify: src/lib/auth/require-user.ts
- Modify: src/lib/auth/require-admin.ts
- Modify: src/app/api/admin/session/route.ts
- Modify: src/app/api/admin/translate/route.ts
- Modify: src/app/api/admin/products/route.ts
- Modify: src/app/api/admin/products/[id]/route.ts
- Modify: src/app/api/admin/articles/route.ts
- Modify: src/app/api/admin/articles/[id]/route.ts
- Modify: src/app/api/admin/articles/upload/route.ts
- Modify: src/app/api/admin/admin-gate.test.ts

**Interfaces:**

- Consumes: controlAdmin() and configurationMode().
- Produces: ControlUnavailableError, requireUser(), requireAdmin(), and adminGate() with explicit 403/503 decisions.
- Invariant: no content client validates JWTs or reads admin_emails; no production hard-coded admin bypass remains.

- [x] **Step 1: Write RED tests for client selection and failure classification.**

Tests must pin these facts:

~~~ts
expect(requireUserSource).toContain('controlAdmin().auth.getUser')
expect(requireAdminSource).toContain("controlAdmin().from('admin_emails')")
expect(requireUserSource).not.toContain('contentAdmin')
expect(requireAdminSource).not.toContain('contentAdmin')
expect(requireAdminSource).not.toContain('HARDCODED_ADMINS')
~~~

Add behavior tests with mocked Supabase results:

- a 401 Auth error returns null;
- a 402, 500, or thrown network error throws ControlUnavailableError;
- a valid user absent from admin_emails returns null;
- an admin_emails query outage throws ControlUnavailableError;
- fully offline development still returns the explicit local super-admin;
- adminGate maps a null admin to 403 notAdmin;
- adminGate maps ControlUnavailableError to 503 controlUnavailable without leaking the upstream message.

- [x] **Step 2: Run the test and confirm the hard-coded fallback and old factory fail it.**

~~~bash
npm test -- --run src/lib/auth/control-boundary.test.ts src/app/api/admin/admin-gate.test.ts
~~~

- [x] **Step 3: Implement the typed control outage.**

src/lib/supabase/errors.ts:

~~~ts
export class ControlUnavailableError extends Error {
  readonly code = 'controlUnavailable'
}

export class ContentUnavailableError extends Error {
  readonly code = 'contentUnavailable'
}
~~~

requireUser() returns null only for absent/invalid credentials. It throws ControlUnavailableError for project restriction, server status, malformed gateway response, or transport failure. requireAdmin() performs only the database allowlist lookup after requireUser() and propagates the typed outage.

- [x] **Step 4: Remove the production bypass.**

Delete HARDCODED_ADMINS. Preserve local admin only when configurationMode(process.env) is offline and NODE_ENV is development. No single missing boundary may enable it because Task 1 rejects a mixed topology.

- [x] **Step 5: Centralize the admin route response contract.**

Create src/lib/auth/admin-gate.ts with this result:

~~~text
success -> { ok: true, admin }
missing/invalid/non-admin -> { ok: false, status: 403, error: 'notAdmin' }
control outage -> { ok: false, status: 503, error: 'controlUnavailable' }
~~~

Update every admin route in this task to call adminGate() before parsing a body, calling AI, or opening either Supabase client. The session route may preserve its UI response shape, but it must map a control outage to 503. Keep unauthenticated and non-admin details indistinguishable. Do not return Supabase error text.

- [x] **Step 6: Expand the admin route inventory test.**

admin-gate.test.ts must include:

~~~text
src/app/api/admin/articles/route.ts
src/app/api/admin/articles/[id]/route.ts
src/app/api/admin/articles/upload/route.ts
src/app/api/admin/products/route.ts
src/app/api/admin/products/[id]/route.ts
src/app/api/admin/session/route.ts
src/app/api/admin/translate/route.ts
~~~

Every mutating handler must authorize before request.json(), request.formData(), Anthropic, contentAdmin(), or Storage. Every route must map a control outage to 503 rather than an uncaught 500.

- [ ] **Step 7: Run focused verification and commit.**

~~~bash
npm test -- --run src/lib/auth/control-boundary.test.ts src/app/api/admin/admin-gate.test.ts
npm run typecheck
git add src/lib/supabase/errors.ts src/lib/auth/require-user.ts src/lib/auth/require-admin.ts src/lib/auth/admin-gate.ts src/lib/auth/control-boundary.test.ts src/app/api/admin/session/route.ts src/app/api/admin/translate/route.ts src/app/api/admin/products/route.ts 'src/app/api/admin/products/[id]/route.ts' src/app/api/admin/articles/route.ts 'src/app/api/admin/articles/[id]/route.ts' src/app/api/admin/articles/upload/route.ts src/app/api/admin/admin-gate.test.ts
git diff --cached --check
git commit -m "refactor: anchor auth and admin ACL to control plane"
~~~

---

### Task 3: Route community data to control and validate content slugs

**Files:**

- Create: src/lib/recipes/existence.ts
- Create: src/lib/recipes/existence.test.ts
- Create: src/app/api/community-boundaries.test.ts
- Modify: src/app/api/comments/route.ts
- Modify: src/app/api/proposals/route.ts
- Modify: src/app/api/proposals/vote/route.ts
- Modify: src/app/api/community-photos/route.ts
- Modify: messages/en.json
- Modify: messages/vi.json

**Interfaces:**

- Consumes: controlRead(), controlAdmin(), contentRead(), requireUser().
- Produces: publishedRecipeExists(slug) and 503 error codes controlUnavailable/contentUnavailable.
- Invariant: community rows are written only to control; a recipe lookup failure never becomes an orphan write.

- [x] **Step 1: Write RED boundary tests.**

The tests inspect or mock each route and assert:

- GET comments/photos/proposals reads through controlRead();
- comment/photo/proposal/vote mutations use controlAdmin();
- POST comments, photos, and proposals call publishedRecipeExists() before controlAdmin().from(...).insert(...);
- no community route imports contentAdmin();
- vote state lookup uses controlAdmin() because proposal_votes is private;
- ContentUnavailableError maps to 503 contentUnavailable;
- ControlUnavailableError maps to 503 controlUnavailable.

- [x] **Step 2: Run the new tests and confirm old generic clients fail them.**

~~~bash
npm test -- --run src/app/api/community-boundaries.test.ts src/lib/recipes/existence.test.ts
~~~

- [x] **Step 3: Implement the slug existence helper.**

Use an explicit, one-row content query:

~~~ts
export async function publishedRecipeExists(slug: string): Promise<boolean> {
  const { data, error } = await contentRead()
    .from('recipes')
    .select('id')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  if (error) throw new ContentUnavailableError('recipes.exists')
  return data !== null
}
~~~


- [x] **Step 4: Replace all generic clients.**

Use controlRead() for public operational reads and controlAdmin() for private vote lookups and every community write. Keep explicit select lists that omit email columns.

- [x] **Step 5: Add the pre-write content check.**

For comments, proposals, and photos:

1. validate body shape;
2. call publishedRecipeExists();
3. return recipeNotFound with 404 when false;
4. return contentUnavailable with 503 when the content lookup fails;
5. write to control only after true.

Do not apply this lookup to a vote; its proposal FK and existence live entirely in control.

- [x] **Step 6: Add localized service-unavailable messages.**

Add matching keys in messages/en.json and messages/vi.json. Run:

~~~bash
npm test -- --run src/app/messages.test.ts src/app/api/community-error-codes.test.ts
~~~

- [ ] **Step 7: Run focused verification and commit.**

~~~bash
npm test -- --run src/app/api/community-boundaries.test.ts src/lib/recipes/existence.test.ts src/app/api/community-error-codes.test.ts src/app/messages.test.ts
npm run typecheck
git add src/lib/recipes/existence.ts src/lib/recipes/existence.test.ts src/app/api/comments/route.ts src/app/api/proposals/route.ts src/app/api/proposals/vote/route.ts src/app/api/community-photos/route.ts src/app/api/community-boundaries.test.ts
git add -p messages/en.json messages/vi.json
git diff --cached --check
git commit -m "refactor: keep community operations on control plane"
~~~

---

### Task 4: Make content readers strict and content-plane-only

**Files:**

- Create: src/lib/supabase/content-source.ts
- Create: src/lib/supabase/content-source.test.ts
- Modify: src/lib/recipes/source.ts
- Modify: src/lib/cameras/data.ts
- Modify: src/lib/audio/data.ts
- Modify: src/lib/recipes/ordering.test.ts
- Verify: src/app/[locale]/error.tsx

**Interfaces:**

- Consumes: contentRead(), configurationMode(), local seed readers.
- Produces: contentOrOfflineSeed(label, remote, seed) and ContentUnavailableError on online cold failures.
- Invariant: online empty results remain empty; online failures never resurrect seed rows.

- [x] **Step 1: Write the source-precedence tests.**

Pin all three branches:

~~~ts
await expect(contentOrOfflineSeed('x', remoteOk, seed)).resolves.toEqual(REMOTE)
await expect(contentOrOfflineSeed('x', remoteEmpty, seed)).resolves.toEqual([])
await expect(contentOrOfflineSeed('x', remoteFailure, seed)).rejects.toBeInstanceOf(
  ContentUnavailableError,
)
~~~

In a completely offline environment, assert remote is never called and seed is returned.

- [x] **Step 2: Confirm RED.**

~~~bash
npm test -- --run src/lib/supabase/content-source.test.ts
~~~

- [x] **Step 3: Implement the single precedence helper.**

The helper decides only by configuration state. It must not catch an online error and invoke seed():

~~~ts
export async function contentOrOfflineSeed<T>(
  label: string,
  remote: () => Promise<T>,
  seed: () => T,
): Promise<T> {
  if (configurationMode(process.env) === 'offline') return seed()
  try {
    return await remote()
  } catch (error) {
    console.error('[content] ' + label + ' unavailable', safeError(error))
    throw new ContentUnavailableError(label)
  }
}
~~~

safeError() emits status/code/message only and never request headers, URLs with query strings, keys, or response bodies.

- [x] **Step 4: Move recipe, Wiki, and audio reads to contentRead().**

Replace isSupabaseConfigured()/supabaseRead() in:

- src/lib/recipes/source.ts
- src/lib/cameras/data.ts
- src/lib/audio/data.ts

An error property from Supabase must be thrown. An empty data array is valid and must not choose the seed. Preserve local recipe image resolution from data/images.seed.json and public/recipes.

- [x] **Step 5: Verify the existing locale error boundary handles a cold content miss safely.**

The existing boundary must continue rendering only its generic translated title/body/action and optional digest. Add a source assertion to content-source.test.ts that it never renders error.message; Next production error boundaries do not preserve a reliable custom server-error class, so do not attempt client-side instanceof classification.

- [x] **Step 6: Run regression tests.**

~~~bash
npm test -- --run src/lib/supabase/content-source.test.ts src/lib/recipes/ordering.test.ts src/lib/images/catalogue-loader.test.ts
npm run typecheck
~~~

- [ ] **Step 7: Commit.**

~~~bash
git add src/lib/supabase/content-source.ts src/lib/supabase/content-source.test.ts src/lib/recipes/source.ts src/lib/cameras/data.ts src/lib/audio/data.ts src/lib/recipes/ordering.test.ts
git diff --cached --check
git commit -m "refactor: make content database the production source"
~~~

---

### Task 5: Connect every public Blog surface to lab_articles

**Files:**

- Create: src/lib/lab/data.test.ts
- Modify: src/lib/lab/data.ts
- Modify: src/lib/lab/parse.ts
- Modify: src/lib/lab/parse.test.ts
- Verify: src/app/[locale]/blog/page.tsx
- Verify: src/app/[locale]/blog/[id]/page.tsx
- Verify: src/app/sitemap.ts

**Interfaces:**

- Consumes: contentRead(), parseBlocks(), devPublished().
- Produces: getPublishedArticles() and getPublishedArticle() backed by one source per environment.
- Invariant: the online read branch never returns ARTICLES; RLS and the query both restrict rows to published. The module may import ARTICLES only for the explicit offline seed branch.

- [x] **Step 1: Write RED reader tests through an injected query function.**

Export a small testable mapper:

~~~ts
export function articleFromPublicRow(row: Record<string, unknown>): Article | null
~~~

Tests cover a valid row, a malformed row, a malformed block being dropped, and updated_by never appearing in PUBLIC_COLUMNS. A source-precedence assertion must fail if readPublished() returns ARTICLES in online mode.

- [x] **Step 2: Confirm RED.**

~~~bash
npm test -- --run src/lib/lab/data.test.ts src/lib/lab/parse.test.ts
~~~

- [x] **Step 3: Implement the published query.**

Use this exact column boundary:

~~~ts
const PUBLIC_COLUMNS =
  'id, topic, level, archetype, read, title, dek, blocks, updated_at'

const { data, error } = await contentRead()
  .from('lab_articles')
  .select(PUBLIC_COLUMNS)
  .eq('status', 'published')
  .order('updated_at', { ascending: false })
~~~

Offline development uses devPublished(). Offline non-development uses the compiled catalogue only through contentOrOfflineSeed. Online errors throw ContentUnavailableError. Keep LAB_TAG and the existing immediate-expiry profile.

- [x] **Step 4: Verify all consumers call the shared reader.**

Blog feed, detail lookup, generateStaticParams, metadata, and sitemap must call getPublishedArticles()/getPublishedArticle(). None may import ARTICLES directly.

- [ ] **Step 5: Run focused verification and commit.**

~~~bash
npm test -- --run src/lib/lab/data.test.ts src/lib/lab/parse.test.ts src/lib/lab/article-spec.test.ts
npm run typecheck
git add src/lib/lab/data.ts src/lib/lab/data.test.ts src/lib/lab/parse.ts src/lib/lab/parse.test.ts 'src/app/[locale]/blog/page.tsx' 'src/app/[locale]/blog/[id]/page.tsx' src/app/sitemap.ts
git diff --cached --check
git commit -m "feat: serve published articles from content plane"
~~~

---

### Task 6: Route content-admin writes correctly and invalidate after commit

**Files:**

- Create: src/app/api/admin/content-write-boundaries.test.ts
- Create: src/lib/admin/content-freeze.ts
- Create: src/lib/admin/content-freeze.test.ts
- Modify: src/app/api/admin/products/route.ts
- Modify: src/app/api/admin/products/[id]/route.ts
- Modify: src/lib/lab/admin-store.ts
- Modify: src/lib/lab/dev-store.ts
- Modify: src/app/api/admin/articles/route.ts
- Modify: src/app/api/admin/articles/[id]/route.ts
- Modify: src/app/api/admin/articles/upload/route.ts
- Modify: src/lib/catalogue-cache.ts
- Modify: src/test/next-cache-stub.ts
- Create: src/app/api/search/predictive/cache.test.ts
- Modify: src/app/api/search/predictive/route.ts
- Modify: messages/en.json
- Modify: messages/vi.json
- Modify: .env.example

**Interfaces:**

- Consumes: adminGate() from control, contentAdmin() for writes, contentRead() for public reads.
- Produces: immediately visible product and article saves plus a server-enforced maintenance freeze.
- Invariant: cache invalidation occurs once, after successful persistence; a failed write never invalidates.

- [x] **Step 1: Write RED call-order tests.**

Mock authorization, content client, and revalidateTag. Assert:

- authorization resolves before body parsing and before contentAdmin();
- product POST/PATCH call contentAdmin().from('sony_cameras');
- article store calls contentAdmin().from('lab_articles');
- successful product writes call revalidateTag(CATALOGUE_TAG, IMMEDIATE);
- successful article writes call revalidateTag(LAB_TAG, IMMEDIATE);
- failed writes call neither invalidation;
- no content-admin route sends the bearer token to the content project.
- with CONTENT_ADMIN_FROZEN=true, every content mutation returns 503 contentAdminFrozen before body parsing or contentAdmin();
- predictive search responses do not carry s-maxage or stale-while-revalidate after a catalogue save.
- public reads and all community/Auth routes ignore the freeze flag.

- [x] **Step 2: Confirm RED.**

~~~bash
npm test -- --run src/app/api/admin/content-write-boundaries.test.ts
~~~

- [x] **Step 3: Replace generic clients and configuration checks.**

Product routes require online content configuration after adminGate() succeeds. Lab admin uses the dev store only in fully offline development; otherwise it uses contentAdmin(). The control secret never writes sony_cameras or lab_articles.

- [x] **Step 4: Add the maintenance freeze and immediate cache invalidation.**

Add contentAdminWritesFrozen() in src/lib/admin/content-freeze.ts. It returns true only when the server-only optional variable CONTENT_ADMIN_FROZEN is exactly true. After adminGate() succeeds and before parsing the body, product/article/upload mutations return:

~~~ts
NextResponse.json({ error: 'contentAdminFrozen' }, { status: 503 })
~~~

Add translated UI feedback in both locale files and document the optional flag in .env.example. GET routes and all control/community routes remain available.

Export IMMEDIATE from one neutral cache module rather than coupling products to Lab:

~~~ts
export const IMMEDIATE = { expire: 0 } as const
~~~

After successful insert/upsert only:

~~~ts
revalidateTag(CATALOGUE_TAG, IMMEDIATE)
~~~

Keep article invalidation after successful insert/update/delete. Update next-cache-stub to record calls in tests rather than remain a no-op when call order is under test.

- [x] **Step 5: Refetch the durable record after save.**

The admin client must use the response or perform its existing GET after success. Do not optimistically declare success from local draft state before the route returns. Product PATCH should query the content row uncached for its category/role check, not depend on a stale catalogue cache.
Remove the predictive route's public response cache and return Cache-Control: no-store. Its getSonyCameras()/listRecipes() calls remain protected by the tagged Data Cache, so a keystroke may invoke the route but does not issue a new PostgREST catalogue read. The cache test must reject s-maxage and stale-while-revalidate.


- [ ] **Step 6: Run focused verification and commit.**

~~~bash
npm test -- --run src/lib/admin/content-freeze.test.ts src/app/api/admin/content-write-boundaries.test.ts src/app/api/admin/admin-gate.test.ts src/app/api/admin/sanitize-specs.test.ts src/app/api/search/predictive/cache.test.ts src/app/messages.test.ts
npm run typecheck
git add src/lib/admin/content-freeze.ts src/lib/admin/content-freeze.test.ts src/app/api/admin/content-write-boundaries.test.ts src/app/api/admin/products/route.ts 'src/app/api/admin/products/[id]/route.ts' src/lib/lab/admin-store.ts src/lib/lab/dev-store.ts src/app/api/admin/articles/route.ts 'src/app/api/admin/articles/[id]/route.ts' src/app/api/admin/articles/upload/route.ts src/app/api/search/predictive/route.ts src/app/api/search/predictive/cache.test.ts src/lib/catalogue-cache.ts src/test/next-cache-stub.ts .env.example
git add -p messages/en.json messages/vi.json
git diff --cached --check
git commit -m "feat: persist content admin saves to content plane"
~~~

---

### Task 7: Create isolated content migrations and close public grants

**Files:**

- Create: supabase/content/migrations/0001_content_baseline.sql
- Create: supabase/migrations/0014_lab_article_privileges.sql
- Create: src/lib/supabase/migration-roots.test.ts
- Create: supabase/migrations/0015_lab_asset_rollback_compat.sql
- Modify: src/lib/recipes/migration.test.ts

**Interfaces:**

- Consumes: the existing SQL definitions in migrations 0001, 0005-0008, 0010, 0012, and 0013.
- Produces: a from-zero content schema plus a dormant control-project compatibility schema capable of receiving a verified rollback snapshot.
- Invariant: content contains no admin_emails or community tables; public roles cannot see audit columns or mutate content.

- [x] **Step 1: Write RED two-root migration tests.**

Create isolated PGlite databases. The control root must still apply all historical files. The content root must apply from zero. Assert content includes:

~~~text
recipes
recipe_translations
recipe_images
sony_cameras
lab_articles
lab_assets
~~~

Assert content excludes:

~~~text
admin_emails
community_photos
recipe_comments
recipe_proposals
proposal_votes
~~~

Also assert both roots include compatible lab_articles/lab_assets definitions; anon lacks lab_articles.updated_by, all columns of lab_assets, and every INSERT/UPDATE/DELETE privilege on content tables.

- [x] **Step 2: Confirm RED because the content root is absent.**

~~~bash
npm test -- --run src/lib/supabase/migration-roots.test.ts src/lib/recipes/migration.test.ts
~~~

- [x] **Step 3: Compose the content baseline mechanically.**

Copy the relevant definitions without weakening constraints:

- recipe types, recipes, recipe_translations, recipe_images, cascade FKs, triggers, indexes, RLS and public published reads from 0001;
- WB enum/constraint evolution from 0005 and 0006;
- sony_cameras and its specs/gallery/audio changes from 0007, 0008, 0010, and 0012;
- lab_articles from 0013, but with a table-level SELECT revoke before the narrow column grant;
- the lab_assets and two-bucket schema below.

The new asset table must encode these checks:

~~~sql
create table lab_assets (
  id uuid primary key default gen_random_uuid(),
  article_id text not null references lab_articles(id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null check (mime_type = 'image/webp'),
  width integer not null check (width > 0 and width <= 12000),
  height integer not null check (height > 0 and height <= 12000),
  byte_size bigint not null check (byte_size > 0),
  animated boolean not null default false check (animated = false),
  state text not null check (
    state in ('draft', 'published', 'orphaned', 'cleanup_failed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

alter table lab_assets enable row level security;
revoke all on table lab_assets from anon, authenticated;
~~~

Create lab-drafts with public=false and lab with public=true. The only browser Storage policy is SELECT on objects whose bucket_id is lab. There are no browser write policies for either bucket.

- [x] **Step 4: Correct the historical root without rewriting 0013.**

0014 must be idempotent in effect:

~~~sql
revoke all on table lab_articles from anon, authenticated;
grant select (
  id, status, topic, level, archetype, read, title, dek, blocks,
  created_at, updated_at
) on table lab_articles to anon, authenticated;
~~~

Do not edit 0013 to pretend an already-applied migration changed.

0015 creates lab_assets and the private lab-drafts bucket idempotently in the historical/control root, using the same columns, checks, restrictive FK, and grants as the content baseline. It leaves the public lab bucket in place for emergency rollback variants. It does not copy data and does not grant browser writes.

- [x] **Step 5: Add behavior checks.**

Keep recipe child cascades. Assert lab_articles deletion is refused while lab_assets exists. Assert published article RLS and draft hiding using SET ROLE anon where PGlite supports it; otherwise assert policies and privileges through system catalogs and leave live RLS to the cutover plan.

- [ ] **Step 6: Run migration tests and commit.**

~~~bash
npm test -- --run src/lib/supabase/migration-roots.test.ts src/lib/recipes/migration.test.ts
git add supabase/content/migrations/0001_content_baseline.sql supabase/migrations/0014_lab_article_privileges.sql supabase/migrations/0015_lab_asset_rollback_compat.sql src/lib/supabase/migration-roots.test.ts src/lib/recipes/migration.test.ts
git diff --cached --check
git commit -m "feat: add isolated content database baseline"
~~~

---

### Task 8: Define UUID-backed article assets and bounded image processing

**Files:**

- Create: src/lib/lab/assets.ts
- Create: src/lib/lab/assets.test.ts
- Create: src/lib/lab/image-process.ts
- Create: src/lib/lab/image-process.test.ts
- Modify: src/lib/lab/types.ts
- Modify: src/lib/lab/parse.ts
- Modify: src/lib/lab/parse.test.ts
- Modify: package.json
- Modify: package-lock.json

**Interfaces:**

- Consumes: JPEG, PNG, or WebP bytes and an owning article ID.
- Produces: three WebP buffers at path rungs 320.webp, 640.webp, and 1024.webp plus safe metadata.
- Invariant: stored blocks contain UUIDs, never project-specific Storage URLs; GIF and SVG are rejected.

- [x] **Step 1: Write RED asset-reference tests.**

Change stored shapes to:

~~~ts
export type FigureBlock = {
  t: 'figure'
  caption: string
  alt?: string
  assetId?: string
}

export type CompareBlock = {
  t: 'compare'
  beforeLabel: string
  afterLabel: string
  caption: string
  beforeAssetId?: string
  afterAssetId?: string
}
~~~

parseBlock accepts only canonical UUIDs in these fields. It drops legacy absolute Storage URLs rather than carrying a host-coupled URL into new writes. A separate migration script in Task 12 resolves any real legacy URLs.

- [x] **Step 2: Write RED processor tests with generated fixtures.**

Generate tiny input images through Sharp inside the test. Assert:

- JPEG, PNG, and WebP each produce exactly widths 320, 640, and 1024 as named variants;
- no output enlarges source pixel dimensions;
- EXIF is absent;
- every output decodes as WebP;
- compressed input over 8 MiB returns tooLarge before decode;
- width or height over 12000, or total pixels over 40,000,000, returns dimensionsTooLarge;
- GIF and SVG return unsupportedType;
- corrupt bytes return unsupportedType rather than throwing raw Sharp text.

- [x] **Step 3: Confirm RED.**

~~~bash
npm test -- --run src/lib/lab/assets.test.ts src/lib/lab/image-process.test.ts src/lib/lab/parse.test.ts
~~~

- [x] **Step 4: Implement the immutable constants and result.**

~~~ts
export const LAB_ASSET_WIDTHS = [320, 640, 1024] as const
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const MAX_DIMENSION = 12_000
export const MAX_PIXELS = 40_000_000
export const WEBP_QUALITY = 78

export type ProcessedLabImage = {
  width: number
  height: number
  byteSize: number
  variants: readonly {
    rung: 320 | 640 | 1024
    bytes: Buffer
  }[]
}
~~~

Decode with Sharp limitInputPixels, auto-rotate, resize with fit inside and withoutEnlargement true, convert to WebP quality 78, and do not call withMetadata().

- [x] **Step 5: Move Sharp to runtime dependencies.**

The upload route executes Sharp in production, so sharp belongs under dependencies rather than devDependencies. Use npm install --save sharp@^0.35.4 to update both manifest and lockfile; inspect that no unrelated package upgrades occurred.

- [ ] **Step 6: Run focused tests and commit.**

~~~bash
npm test -- --run src/lib/lab/assets.test.ts src/lib/lab/image-process.test.ts src/lib/lab/parse.test.ts
npm run typecheck
git add src/lib/lab/assets.ts src/lib/lab/assets.test.ts src/lib/lab/image-process.ts src/lib/lab/image-process.test.ts src/lib/lab/types.ts src/lib/lab/parse.ts src/lib/lab/parse.test.ts
git add -p package.json package-lock.json
git diff --cached --check
git commit -m "feat: add bounded article image variants"
~~~

---

### Task 9: Upload draft assets with compensation and signed previews

**Files:**

- Create: src/lib/lab/asset-store.ts
- Create: src/lib/lab/asset-store.test.ts
- Create: src/app/api/admin/articles/upload/route.test.ts
- Modify: src/app/api/admin/articles/upload/route.ts
- Modify: src/components/lab/admin/article-admin.tsx
- Modify: src/components/lab/admin/block-editor.tsx
- Modify: messages/en.json
- Modify: messages/vi.json

**Interfaces:**

- Consumes: verified admin, existing draft article ID, one supported image.
- Produces: { assetId, previewUrl } where previewUrl expires in ten minutes.
- Invariant: raw bytes never enter public Storage; every remote object has a lab_assets owner row or an explicit cleanup state.

- [x] **Step 1: Write RED route tests.**

Pin order and outcomes:

- adminGate runs before request.formData();
- missing articleId returns 400;
- an unknown article or an article not owned by lab_articles returns 404;
- GIF returns 415;
- valid input inserts an orphaned lab_assets row, uploads all three private variants, changes state to draft, and returns a signed 1024 preview;
- upload failure removes already-uploaded paths and records orphaned or cleanup_failed;
- no call targets the public lab bucket;
- response contains no public URL and no editor email.

- [x] **Step 2: Confirm RED.**

~~~bash
npm test -- --run src/app/api/admin/articles/upload/route.test.ts src/lib/lab/asset-store.test.ts
~~~

- [x] **Step 3: Implement the remote draft upload transaction boundary.**

Use path root:

~~~text
article-id/asset-uuid/320.webp
article-id/asset-uuid/640.webp
article-id/asset-uuid/1024.webp
~~~

Flow:

1. verify article exists with contentAdmin();
2. generate asset UUID and insert lab_assets with state orphaned;
3. upload processed variants to lab-drafts with upsert false and cacheControl 31536000;
4. update row to draft with dimensions and total output byte size;
5. createSignedUrl for 1024.webp with 600 seconds;
6. return assetId and previewUrl.

If a step after row insertion fails, remove only the explicit paths created in this request. Set orphaned when cleanup succeeds but the operation is incomplete; set cleanup_failed when object removal fails.

- [x] **Step 4: Preserve fully offline development.**

For isDevStore(), write only processed WebP variants under:

~~~text
public/lab/article-id/asset-uuid/320.webp
public/lab/article-id/asset-uuid/640.webp
public/lab/article-id/asset-uuid/1024.webp
~~~

Return the UUID and local 1024 path. Keep these paths gitignored. Never enable this branch in a Vercel production environment.

- [x] **Step 5: Make the editor require a saved draft.**

UploadFn becomes:

~~~ts
export type UploadResult = { assetId: string; previewUrl: string }
export type UploadFn = (file: File) => Promise<UploadResult | null>
~~~

The form includes articleId from the durable draft. For a new unsaved article, disable upload and show saveBeforeUpload. Keep previewUrl in editor-only state; persist only assetId in the block.

- [x] **Step 6: Run UI/message and route tests.**

~~~bash
npm test -- --run src/app/api/admin/articles/upload/route.test.ts src/lib/lab/asset-store.test.ts src/app/messages.test.ts
npm run typecheck
~~~

- [ ] **Step 7: Commit.**

~~~bash
git add src/lib/lab/asset-store.ts src/lib/lab/asset-store.test.ts src/app/api/admin/articles/upload/route.ts src/app/api/admin/articles/upload/route.test.ts src/components/lab/admin/article-admin.tsx src/components/lab/admin/block-editor.tsx
git add -p messages/en.json messages/vi.json
git diff --cached --check
git commit -m "feat: keep article uploads private until publish"
~~~

---

### Task 10: Reconcile asset lifecycle on publish, unpublish, update, and delete

**Files:**

- Create: src/lib/lab/asset-lifecycle.ts
- Create: src/lib/lab/asset-lifecycle.test.ts
- Modify: src/lib/lab/admin-store.ts
- Modify: src/app/api/admin/articles/[id]/route.ts
- Create: src/app/api/admin/articles/content-lifecycle.test.ts

**Interfaces:**

- Consumes: previous article record, normalized next article, next status.
- Produces: reconcileArticleAssets() and deleteArticleAndAssets().
- Invariant: a published article references only its own published assets; restrictive FK prevents row deletion before object cleanup.

- [x] **Step 1: Write RED lifecycle tests.**

Cover:

- referencedAssetIds() deduplicates figure and compare UUIDs;
- a referenced asset owned by another article rejects with foreignAsset;
- draft to published copies each referenced rung from lab-drafts to lab using destinationBucket: 'lab';
- published to draft changes the article status and invalidates its cache before public cleanup;
- updating a published article publishes added assets and retires removed public assets;
- delete removes explicit objects in both buckets, deletes asset rows, then deletes article;
- failed cleanup keeps the article row and marks cleanup_failed;
- cache invalidation happens only after the database reflects the new visibility.

- [x] **Step 2: Confirm RED.**

~~~bash
npm test -- --run src/lib/lab/asset-lifecycle.test.ts src/app/api/admin/articles/content-lifecycle.test.ts
~~~

- [x] **Step 3: Implement ownership validation.**

Query lab_assets by article_id and requested IDs through contentAdmin(). If any requested ID is absent, return a 422 foreignAsset response; never publish a path inferred from an unowned UUID.

- [x] **Step 4: Implement visibility ordering.**

Use the installed Storage API cross-bucket copy:

~~~ts
contentAdmin()
  .storage
  .from('lab-drafts')
  .copy(sourcePath, destinationPath, { destinationBucket: 'lab' })
~~~

Publish ordering: copy new public variants, mark assets published, update article to published, invalidate LAB_TAG. On compensation failure, record cleanup_failed and return 502.

Unpublish ordering: update article to draft, invalidate LAB_TAG, remove public variants, mark assets draft. If cleanup fails, the article stays private and the failed asset is visible to admin cleanup.

Delete ordering: force article private if needed, invalidate, remove public and private objects, delete asset rows, then delete the article. A cleanup error stops before deleting the owning row.

- [x] **Step 5: Keep update behavior read-your-writes.**

After PATCH returns success, article-admin refetches the record and preview map. It must not keep a stale signed URL or stale status.

- [ ] **Step 6: Run focused verification and commit.**

~~~bash
npm test -- --run src/lib/lab/asset-lifecycle.test.ts src/app/api/admin/articles/content-lifecycle.test.ts src/app/api/admin/content-write-boundaries.test.ts
npm run typecheck
git add src/lib/lab/asset-lifecycle.ts src/lib/lab/asset-lifecycle.test.ts src/lib/lab/admin-store.ts 'src/app/api/admin/articles/[id]/route.ts' src/app/api/admin/articles/content-lifecycle.test.ts
git diff --cached --check
git commit -m "feat: reconcile article assets with publication state"
~~~

---

### Task 11: Render immutable variants and close the Storage host allowlist

**Files:**

- Modify: src/lib/lab/assets.ts
- Modify: src/lib/lab/media.ts
- Modify: src/components/lab/blocks.tsx
- Modify: src/components/lab/compare-slider.tsx
- Modify: src/components/lab/article-view.tsx
- Modify: src/components/lab/admin/block-editor.tsx
- Modify: src/lib/images/catalogue-loader.ts
- Modify: src/lib/images/catalogue-loader.test.ts
- Modify: next.config.ts
- Modify: src/app/[locale]/layout.tsx
- Modify: src/lib/lab/parse.test.ts

**Interfaces:**

- Consumes: article ID, asset UUID, requested Image width, content project origin.
- Produces: a public lab object URL for one of 320/640/1024, or a local offline equivalent.
- Invariant: no arbitrary host/path is accepted; no Lab image uses /_next/image or Supabase transformations.

- [x] **Step 1: Write RED URL and loader tests.**

Assert:

- labAssetUrl('article-a', UUID, 1024) creates only the content origin plus /storage/v1/object/public/lab/article-a/UUID/1024.webp;
- malformed article IDs and UUIDs throw before URL construction;
- loader snaps widths to 320, 640, and 1024 by changing the final filename directly;
- Lab output never begins /_next/image;
- old control Storage URLs pass through unchanged and are not accepted by article parsing;
- malformed content URL does not throw at next.config module evaluation;
- remotePatterns includes only the content public-object path plus the existing Sony/B&H hosts.

- [x] **Step 2: Confirm RED.**

~~~bash
npm test -- --run src/lib/images/catalogue-loader.test.ts src/lib/lab/assets.test.ts src/lib/lab/parse.test.ts
~~~

- [x] **Step 3: Build URLs from IDs at render time.**

ArticleFigure receives articleId. CompareSlider receives articleId. Both turn asset IDs into the 1024 canonical URL; the custom loader selects the smaller immutable sibling. Remove animated and bypassOptimizer handling for remote Lab images. Keep bypass only for offline local files if still required by the custom loader.

- [x] **Step 4: Update editor previews without persisting them.**

The admin GET response includes:

~~~ts
type ArticleAdminResponse = {
  article: ArticleRecord
  previews: Record<string, string>
}
~~~

previews contains signed URLs for draft assets referenced by blocks. BlockFields receives this map and displays it. Save payload serialization contains assetId fields only.

- [x] **Step 5: Change host configuration.**

next.config.ts and catalogue-loader.ts read NEXT_PUBLIC_CONTENT_SUPABASE_URL. Parse it inside a guarded function. Remove all use of NEXT_PUBLIC_SUPABASE_URL.

In the locale layout, remove the hard-coded nqeedlgzaewccqztqvik preconnect/dns-prefetch. Add a content preconnect only when the validated content origin exists; Auth is user-triggered and does not need a global preconnect on every public page.

- [ ] **Step 6: Run focused verification and commit.**

~~~bash
npm test -- --run src/lib/images/catalogue-loader.test.ts src/lib/lab/assets.test.ts src/lib/lab/parse.test.ts src/lib/lab/article-spec.test.ts
npm run typecheck
git add src/lib/lab/assets.ts src/lib/lab/media.ts src/components/lab/blocks.tsx src/components/lab/compare-slider.tsx src/components/lab/article-view.tsx src/components/lab/admin/block-editor.tsx src/lib/images/catalogue-loader.ts src/lib/images/catalogue-loader.test.ts next.config.ts 'src/app/[locale]/layout.tsx' src/lib/lab/parse.test.ts
git diff --cached --check
git commit -m "feat: serve bounded article asset variants"
~~~

---

### Task 12: Add explicit migration, export, import, and hash tooling

**Files:**

- Create: scripts/supabase/args.ts
- Create: scripts/supabase/args.test.ts
- Create: scripts/supabase/stable-hash.ts
- Create: scripts/supabase/stable-hash.test.ts
- Create: scripts/supabase/push-migrations.ts
- Create: scripts/supabase/export-content.ts
- Create: scripts/supabase/import-content.ts
- Create: scripts/supabase/verify-content.ts
- Create: scripts/supabase/health.ts
- Modify: scripts/lib/db.ts
- Modify: scripts/push-supabase.ts
- Modify: scripts/pull-supabase.ts
- Modify: scripts/push-lab-articles.ts
- Modify: package.json
- Modify: .gitignore

**Interfaces:**

- Consumes: an explicit control or content target and target-specific environment variables.
- Produces: normalized JSON manifests, SHA-256 hashes, dry-run migration output, and deterministic verification.
- Invariant: no script infers a target from generic Supabase variables or a linked-project temp file.

- [x] **Step 1: Write RED parser and stable-hash tests.**

The target parser accepts only:

~~~text
--target control
--target content
--source control
--source content
--destination content
--destination control --rollback
--label initial
--label final-delta
--label rollback
--manifest initial
--manifest final-delta
--manifest rollback
--since-manifest initial
--expect-empty
--expect-baseline
--dry-run
--apply
~~~
--rollback

It rejects absent targets, identical source/destination, unknown switches, unsupported label/manifest values, --apply combined with --dry-run, and destination control without --rollback. Stable hashing sorts object keys recursively, preserves array order, normalizes timestamp strings to their exact stored ISO form, and hashes UTF-8 JSON with SHA-256.

- [x] **Step 2: Confirm RED.**

~~~bash
npm test -- --run scripts/supabase/args.test.ts scripts/supabase/stable-hash.test.ts
~~~

- [x] **Step 3: Make script clients target-aware.**

adminClient(target) resolves:

~~~text
control -> NEXT_PUBLIC_AUTH_SUPABASE_URL + AUTH_SUPABASE_SECRET_KEY
content -> NEXT_PUBLIC_CONTENT_SUPABASE_URL + CONTENT_SUPABASE_SECRET_KEY
~~~

readClient(target) uses the corresponding anon key. The thrown message names missing variable names, never values.

- [x] **Step 4: Implement migration push with an explicit root.**

push-migrations.ts maps:

~~~text
control -> supabase/migrations
content -> supabase/content/migrations
~~~

It prints target, resolved project ref, and migration filenames, then exits unless --apply is present. It copies the selected root into a mkdtemp directory shaped as supabase/migrations, writes a minimal supabase/config.toml containing only the resolved project_id, and invokes:

~~~bash
npx --no-install supabase db push --project-ref RESOLVED_REF --workdir TEMP_DIR
~~~

RESOLVED_REF comes from CONTROL_SUPABASE_PROJECT_REF or CONTENT_SUPABASE_PROJECT_REF. Pass database credentials through the child environment or a PTY prompt, never --password or --db-password in a process argument.

- [x] **Step 5: Implement deterministic content export.**

Export only:

~~~text
recipes ordered by id
recipe_translations ordered by recipe_id, locale
recipe_images ordered by recipe_id, sort
sony_cameras ordered by id
lab_articles ordered by id
lab_assets ordered by id
~~~

Paginate until a short page, select explicit columns, and write generated artifacts under artifacts/supabase/content-export/TIMESTAMP. Include manifest.json with per-table count, stable IDs, normalized SHA-256, and an object manifest of bucket/path/size/hash. Never export auth, admin_emails, community tables, or secrets.

- [x] **Step 6: Implement ordered import and verification.**

Import order is recipes, translations, images, sony_cameras, lab_articles, lab_assets, then objects. Upsert in fixed-size batches; do not delete rows. The normal path requires destination content and proves no forbidden tables exist. Destination control is accepted only with --rollback, a source=content rollback manifest, an exact legacy-content allowlist, and a dry run before --apply. With --rollback, verify-content.ts compares only the content allowlist and tolerates expected control/community tables; otherwise it enforces the content-only inventory. Both modes recompute the same counts/IDs/hashes and exit nonzero on mismatch.

- [x] **Step 7: Migrate legacy article URLs deliberately.**

If export finds a Lab block with a public Storage URL, resolve it against the object manifest, process it through the same image processor, create a new UUID asset, and rewrite the exported block to assetId. If a URL has no matching object, stop the export with the article ID and block index; do not drop it.

- [x] **Step 8: Add commands and remove generic script configuration.**

Add:

~~~json
"supabase:health": "tsx scripts/supabase/health.ts",
"supabase:migrations": "tsx scripts/supabase/push-migrations.ts",
"content:export": "tsx scripts/supabase/export-content.ts",
"content:import": "tsx scripts/supabase/import-content.ts",
"content:verify": "tsx scripts/supabase/verify-content.ts"
~~~

Update existing seed/pull scripts to require --target content where they touch content. Ignore artifacts/supabase/ and keep supabase/.temp/ untracked.

- [ ] **Step 9: Run tests and commit.**

~~~bash
npm test -- --run scripts/supabase/args.test.ts scripts/supabase/stable-hash.test.ts
npm run typecheck
git add scripts/supabase scripts/lib/db.ts scripts/push-supabase.ts scripts/pull-supabase.ts scripts/push-lab-articles.ts
git add -p package.json .gitignore
git diff --cached --check
git commit -m "feat: add explicit Supabase migration tooling"
~~~

---

### Task 13: Remove legacy topology and verify the complete application

**Files:**

- Create: docs/runbooks/supabase-control-content.md
- Modify: AGENTS.md
- Verify: every file under src, scripts, next.config.ts, .env.example, package.json

**Interfaces:**

- Consumes: all prior tasks.
- Produces: a repository-ready, offline-testable implementation and a non-secret operator runbook.
- Invariant: no old generic Supabase variable or generic factory remains.

- [x] **Step 1: Write the runbook before the final gate.**

Document:

- ownership table for control/content;
- the six runtime variables and four operations-only project-ref/password names;
- safe dry-run and apply commands;
- health, export, import, and verification commands;
- admin freeze wording;
- 14-day rollback rule;
- egress checks at 24h, 72h, 7d, and billing reset;
- no secret values.

- [x] **Step 2: Scan for forbidden legacy names and boundaries.**

Run:

~~~bash
rg -n 'NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|supabaseRead|supabaseAdmin|supabaseBrowser' src scripts next.config.ts .env.example package.json
~~~

Expected: no matches. Also run:

~~~bash
rg -n 'nqeedlgzaewccqztqvik|touiyczjvnuaxfzulgeq' src next.config.ts messages
~~~

Expected: no runtime hard-coding. Project refs may appear only in approved docs/runbooks.

- [x] **Step 3: Run the security and migration suite.**

~~~bash
npm test -- --run src/lib/supabase/config.test.ts src/lib/auth/control-boundary.test.ts src/app/api/admin/admin-gate.test.ts src/app/api/admin/content-write-boundaries.test.ts src/app/api/community-boundaries.test.ts src/lib/supabase/migration-roots.test.ts src/lib/recipes/migration.test.ts src/lib/lab/data.test.ts src/lib/lab/asset-lifecycle.test.ts src/app/api/admin/articles/upload/route.test.ts
~~~

- [x] **Step 4: Use verification-before-completion and run the full gate.**

~~~bash
git diff --check
npm run verify
~~~

Do not claim completion from an earlier test run. Record the fresh command, exit code, and test totals in the handoff.

- [x] **Step 5: Review the staged feature as one security boundary.**

Check:

- browser bundle has only Auth URL/anon and public content URL;
- server secrets occur only in server/script modules;
- control token is never forwarded;
- public selects omit every email/audit field;
- online errors do not fall back to seeds;
- article upload has no raw/GIF/public-draft path;
- product and article invalidation follows successful writes;
- content migration inventory has no control tables.

- [ ] **Step 6: Commit documentation and any final focused fixes.**

~~~bash
git add docs/runbooks/supabase-control-content.md
git add -p AGENTS.md
git diff --cached --check
git commit -m "docs: add Supabase split operations runbook"
~~~

At this point the repository implementation is complete, but production has not been changed. Continue only with docs/superpowers/plans/2026-09-11-supabase-content-cutover.md.
