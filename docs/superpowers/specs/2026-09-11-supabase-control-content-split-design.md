# Supabase Control Plane / Content Plane Split

**Date:** 2026-09-11
**Status:** Approved in chat; awaiting written-spec review
**Scope:** Alpha ColorLab, Sony Wiki, Alpha Tech Blogs, and their shared admin surfaces

## Summary

Split the current single Supabase dependency into two independently configured
projects:

- The existing project, `nqeedlgzaewccqztqvik`, remains the **control plane**.
  It owns end-user identity, administrator authorization, and community/operational
  data.
- A project in the separate content organization becomes the **content plane**.
  It owns the recipe catalogue, Sony product catalogue, articles, and article
  media. The current candidate is `touiyczjvnuaxfzulgeq`; because it was reported
  empty and in Mumbai, region and emptiness must be re-verified before use. If
  both are confirmed, replace it with a Singapore project before importing data.

The browser authenticates only with the control plane. All administrator writes
continue to enter through this Next.js application's route handlers. A route
verifies the control-plane session and administrator role, validates the request,
then writes to the content plane with a server-only credential. A control-plane
JWT is never sent to or trusted by the content project.

This split is not a substitute for egress control. It creates separate quota and
failure domains because the projects are in separate organizations, while the
media and caching changes below keep either domain from exhausting its allowance.

## Goals

1. Keep the existing Google Auth users and administrator roles in the current
   project without forcing account migration or reauthentication.
2. Make Supabase the single production source of truth for recipes, Sony Wiki
   products, audio products, and Alpha Tech Blogs articles.
3. Make every successful administrator save durable in the correct content table
   before the UI reports success, and make published changes visible immediately.
4. Isolate a content/storage quota incident from Auth and community operations.
5. Preserve the repository's credential-free local/test mode and explicit seed
   snapshots without letting a runtime fallback resurrect deleted content.
6. Provide a measured, reversible migration with no ambiguous target project and
   no destructive cleanup during cutover.

## Non-goals

- Moving or duplicating Supabase Auth into the content project.
- Sharing JWT secrets between projects.
- Using `postgres_fdw`, cross-database triggers, or distributed transactions.
- Restoring Supabase Storage as the runtime origin for recipe photography.
- Permanently upgrading either organization as part of the architecture.
- Adding a web editor for recipes; only existing and in-progress admin surfaces
  are included.
- Deleting content tables or storage objects from the old project during the
  initial rollout.

## Current-state findings that constrain the design

### One project is currently responsible for everything

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` currently select one project for browser Auth,
anonymous reads, privileged writes, and Storage. Changing those values to the
content project would also move Auth and administrator lookup accidentally.

### The quota incident is still active, but its largest source is removed

The existing Auth endpoint returned HTTP 402 with
`exceed_cached_egress_quota` during the 2026-09-11 audit. Previously, recipe
photographs accounted for approximately 1.27 GB of cached egress per day. Commit
`4464fcc` vendors those photographs into `public/recipes` at three WebP widths;
the current recipe runtime no longer reads them from Supabase Storage.

Past egress cannot be undone. The old organization must reach its next billing
reset or be upgraded temporarily before its Auth service can support an admin
cutover. Moving only the content tables cannot restore an Auth endpoint that is
still returning 402.

### Blog writes and blog reads currently disagree

The in-progress article admin writes `lab_articles`, but the production reader
returns the compiled `ARTICLES` array. A save can therefore succeed without
changing the public feed, article route, sitemap, or static params. The split may
not ship until all production blog reads use the content project as their single
source.

### The relational boundary is favorable

`recipe_translations` and `recipe_images` have cascading foreign keys to
`recipes` and must move with it. Community photos, comments, and proposals use a
stable `recipe_slug` string rather than a foreign key. `proposal_votes` references
only `recipe_proposals`. No content table has a foreign key to `auth.users`.

This permits the content and control tables to live in different databases. The
application must validate recipe slugs against the content plane before accepting
new community rows, and recipe slugs become immutable identifiers.

## Ownership map

### Control plane: existing project

The existing `nqeedlgzaewccqztqvik` project owns:

- Supabase Auth and OAuth provider configuration
- `auth.users` and all Auth-managed schemas
- `admin_emails`, including `super`, `di`, and `pe` roles
- `recipe_comments`
- `recipe_proposals`
- `proposal_votes`
- `community_photos`
- future operational/audit data that is about users or workflow rather than
  published content

The control plane must not contain public hot-path media after the migration.
Existing content tables remain temporarily as rollback copies but are not written
after cutover.

### Content plane: new project

The content project owns:

- recipe enums and validation constraints
- `recipes`
- `recipe_translations`
- `recipe_images` metadata, retained for schema/script compatibility even though
  runtime recipe images stay local
- `sony_cameras`, including camera, lens, accessory, and audio categories
- `lab_articles`
- `lab_assets`, introduced by this work to relate uploaded media to an article
- a private `lab-drafts` bucket, a public `lab` bucket, and their narrowly
  scoped policies
- content-only functions, triggers, indexes, grants, and RLS policies

The content project does not configure Google OAuth, store application users, or
contain `admin_emails`.

## Configuration contract

Configuration names must describe their trust boundary. The implementation
replaces the ambiguous legacy names in the same release; all call sites use the
explicit names:

```text
NEXT_PUBLIC_AUTH_SUPABASE_URL
NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY
AUTH_SUPABASE_SECRET_KEY

CONTENT_SUPABASE_URL
CONTENT_SUPABASE_ANON_KEY
CONTENT_SUPABASE_SECRET_KEY
NEXT_PUBLIC_CONTENT_SUPABASE_URL
```

`NEXT_PUBLIC_CONTENT_SUPABASE_URL` is permitted because public Storage URLs expose
the host already. No privileged key receives a `NEXT_PUBLIC_` prefix.

The application exposes four focused client factories:

- `authBrowser()` authenticates users against the control plane.
- `controlAdmin()` verifies a bearer token and reads `admin_emails` or writes
  operational tables.
- `contentRead()` performs published, RLS-constrained content reads.
- `contentAdmin()` performs validated administrator content writes.

Production startup/configuration checks reject half-configured boundaries. An Auth
URL without its anon key, or a content URL without both read and write credentials,
is a deployment error rather than an implicit seed fallback.

Local development and tests omit both boundaries only in the explicit offline
configuration. That absence enables the repository's file-backed/seed behavior;
production verification rejects it.

## Request and data flows

### Sign-in and session

1. The browser signs in through Google using `authBrowser()`.
2. The control plane issues and refreshes the session.
3. Client components attach that access token to application API requests.
4. `requireUser()` validates the token only against the control plane.

The hard-coded production administrator fallback is removed. Development uses an
explicit local-admin mode only when neither Supabase boundary is configured and
`NODE_ENV=development`.

### Administrator content write

1. The route calls `requireAdmin()` before parsing a large request body.
2. `requireAdmin()` verifies the control-plane user and reads the control-plane
   `admin_emails` row.
3. The route validates and normalizes the request using the existing domain
   validators.
4. The route writes exactly once with `contentAdmin()` and asks Supabase not to
   return unused row data.
5. Only after a successful commit, it invalidates the domain's cache tag and the
   affected path where necessary.
6. The response reports success; the admin client refetches the saved record.

There is no dual write to the old content tables. A short admin freeze protects
the final migration delta.

### Public content read

- Recipes and translations read from `contentRead()`.
- Camera/lens/accessory/audio Wiki records read from `contentRead()`.
- Published articles read from `contentRead()` and never from the compiled array
  when production content credentials exist.
- Public reads name columns explicitly and rely on RLS plus column privileges.
- Next.js Data Cache protects hot paths. Recipe/Wiki saves invalidate
  `CATALOGUE_TAG`; article saves invalidate `LAB_TAG`; both use immediate expiry
  after a successful write.

When content configuration is intentionally absent, local/tests use seeds. When
it is present but the remote read fails, the application must surface or log a
content outage and rely on the last successful framework cache entry. It must not
silently switch to a compiled seed, because that can resurrect deleted or
unpublished content.

### Community write referencing a recipe

Comments, proposals, and community photographs remain control-plane writes. Before
creating one, the server confirms that the referenced published slug exists via
`contentRead()`. A content lookup failure returns a service-unavailable response;
an unknown slug returns not-found. It never creates an orphan optimistically.

Recipe slugs are immutable. A recipe may be unpublished, but hard deletion is
blocked while operational rows reference its slug.

## Article media and egress policy

The public `lab` bucket is used only for processed variants of published article
media. Raw and draft uploads never enter it.

### Storage model

`lab_assets` contains:

- asset UUID
- owning article ID with a foreign key to `lab_articles(id) ON DELETE RESTRICT`
- immutable storage path
- MIME type
- width and height when applicable
- byte size
- animation flag
- lifecycle state (`draft`, `published`, `orphaned`, or `cleanup_failed`)
- created/updated timestamps and the verified editor email

Uploads require an existing draft article. Raw bytes and processed draft variants
go into the private `lab-drafts` bucket. The generated path includes the article
ID and asset UUID. Admin preview uses a short-lived signed URL. An uploaded figure
block stores the asset UUID rather than a project-specific Storage URL.

Publishing copies only the processed variants referenced by the article into the
public `lab` bucket and changes their lifecycle to `published`. Unpublishing removes
the public copies while retaining private draft variants for a later republish.
Article deletion first removes objects from both buckets, then deletes the asset
rows, and only then deletes the article. The restrictive foreign key prevents an
article row from disappearing before cleanup completes.

### Image processing

- JPEG, PNG, and WebP uploads are decoded server-side and written as 320, 640, and
  1024 pixel-wide WebP variants, without enlargement, at a fixed project quality.
  Metadata and original filenames are not retained in the public path.
- Pixel dimensions and decoded size are bounded in addition to compressed byte
  size, preventing decompression bombs.
- SVG remains forbidden.
- Animated GIF is disabled for the initial cutover. Reintroducing animation
  requires a separate measured format/size policy; the current 12 MB direct path
  is not retained.
- Every public object uses a unique immutable name and a one-year cache lifetime.
- The custom loader selects one of the three existing variants directly. Readers
  never download the original upload and do not consume a Supabase or Vercel image
  transformation.

Recipe photography stays in `public/recipes`, and Wiki photography continues to
use the explicitly allowed Sony/B&H origins. Neither moves into the new bucket.

## Database security

- RLS is enabled on every exposed content and control table.
- Published content is readable to `anon` and `authenticated`; drafts are not.
- `updated_by`, author email, voter email, and administrator email never have
  public column grants.
- Every restrictive column grant is preceded by a table-level `REVOKE SELECT`.
- No browser role receives insert, update, or delete rights on administrator-owned
  content.
- Server credentials remain server-only and are scoped by client factory; a
  control-plane module cannot import the content credential accidentally without
  crossing an explicit module boundary.
- The project URL allowlist accepts only the content project's public Storage path.
  The current hard-coded old hostname is removed from layout preconnects.

The article migration's privilege tests must cover `lab_articles.updated_by`, and
the admin-gate tests must include every article route.

## Error behavior

- Invalid or absent user token: `401` for user actions.
- Valid user without an administrator row/role: `403` for admin actions.
- Control-plane Auth or ACL unavailable: `503` with a generic service-unavailable
  code; internal logs preserve the Supabase error without revealing membership.
- Content read unavailable on a cold miss: API routes return `503` with
  `contentUnavailable`; server-rendered pages throw a typed content-unavailable
  error handled by the locale route's error boundary. An existing framework cache
  continues serving its last successful value when Next.js has one.
- Content write failure: `502`; no success UI and no cache invalidation.
- Partial boundary configuration: fail deployment verification rather than serve a
  mixed topology.
- If an object upload succeeds but its database write fails, the route attempts an
  immediate compensating delete. A failed compensation creates or updates a
  `cleanup_failed` asset record and returns `502`. If the database record exists but
  an object write fails, it becomes `orphaned` and the route returns `502`. Both
  states are surfaced in the admin cleanup view and logs.

Logs identify `control` or `content`, operation, table/bucket, and request
correlation ID. They do not log tokens, keys, request bodies, or personal email in
public responses.

## Migration organization

Do not rewrite the old project's applied migration history. Introduce a separate
content migration root and keep the existing root as the historical/control root:

```text
supabase/
  migrations/              # existing applied history; old/control project
  content/
    migrations/            # new content baseline and future content changes
```

The exact CLI wrapper must require an explicit `control` or `content` target and
print the resolved project ref before any push. Scripts must not infer a target
from a generic `.env.local` file. CI executes both migration roots against isolated
PGlite databases and validates their expected table inventories.

The content baseline is composed from the relevant existing migrations plus the
article/media corrections. It does not create Auth application tables,
`admin_emails`, or community tables. The control project's existing content tables
remain untouched through the rollback window.

If migration `0013_lab_articles.sql` has already been applied anywhere, it is not
edited retroactively; corrective changes are a subsequent migration. If it has not
been applied, the clean content baseline incorporates the corrected grants and
asset model directly.

## Data source precedence

Before export, identify the authoritative source per domain:

1. Once the old project is healthy, its rows are authoritative for recipes,
   translations, and `sony_cameras`, because admin edits may be newer than Git.
2. The compiled article catalogue is authoritative only if no deployed
   `lab_articles` data exists. If rows exist, compare timestamps/content and resolve
   conflicts explicitly before import; do not merge by last-write-wins blindly.
3. `data/images.seed.json` plus `public/recipes` is authoritative for recipe images
   served at runtime. The legacy recipe Storage bucket is not copied as a runtime
   dependency.
4. Existing `lab` objects, if any, are migrated only with an object manifest and
   references to actual article rows.

Export artifacts include row counts, stable-ID lists, and deterministic hashes of
normalized row data. Secrets and Auth schemas are excluded from the content export.

## Rollout

### Phase 0: restore and verify the current control plane

1. Verify commit `4464fcc` is deployed and production pages emit no Supabase
   recipe-image URLs.
2. Restore the old organization by waiting for billing-cycle reset or temporarily
   upgrading it when immediate admin availability is required.
3. Confirm Auth, PostgREST, and required control tables return healthy responses.
4. Record the old project's billing reset and current egress baseline.

### Phase 1: choose the content project before it holds data

1. Re-verify the candidate project's organization, region, table count, Storage
   objects, Auth users, and migration history.
2. If it is empty and in Mumbai, replace it with a Singapore project. Because the
   account already uses both active Free slots, pause or remove only the verified
   empty candidate as the explicit prerequisite to creating the replacement.
3. Record the final project ref; never continue with a stale candidate URL.

### Phase 2: implement and test dual boundaries

1. Add explicit configuration and focused client factories.
2. Route Auth/community to control and catalogue/article data to content.
3. Replace the production blog reader with the content source.
4. Add immediate catalogue invalidation after product saves.
5. Correct article grants, route coverage, media ownership, and upload processing.
6. Update project-host validation, image configuration, preconnects, scripts, and
   offline behavior.
7. Run unit, migration, integration, security, and full repository verification.

### Phase 3: provision and load content

1. Apply the content baseline to the empty content project.
2. Export authoritative old rows once the control project is healthy.
3. Import recipes, translations, image metadata, products, and articles in
   dependency order.
4. Import referenced article assets and verify object hashes.
5. Run anonymous and privileged acceptance checks against the target.

### Phase 4: shadow verification and cutover

1. For a bounded period, compare old and new read results server-side without
   displaying duplicate sources to readers.
2. Freeze administrator content writes.
3. Export/import the final delta and repeat counts/hashes.
4. Deploy the final content environment and route selection.
5. Run smoke tests for EN/VI pages, search, sitemap, every admin role, article
   publish/unpublish/delete, media, comments, proposals, and voting.
6. Reopen administrator writes only after the checks pass.

### Phase 5: rollback window and cleanup

Keep the old content tables and any old objects for at least 14 days. They are
read-only and receive no dual writes. To roll back after new writes have begun:

1. Freeze administrator content writes.
2. Export the new-project delta back to the old content tables.
3. Verify counts/hashes.
4. Switch the content route/configuration to the old project.
5. Reopen writes only after the old path passes smoke tests.

After 14 healthy days and an explicit backup, remove obsolete old content objects
in a separate, approved cleanup. Cleanup is not part of cutover.

## Verification strategy

### Unit and static tests

- Each call site resolves to the intended client factory.
- Partial configuration is rejected.
- Browser bundles cannot reference either secret key.
- `requireUser()` and `requireAdmin()` use only the control plane.
- Content admin routes use only `contentAdmin()` after authorization.
- Community writes validate slugs against `contentRead()` and persist only through
  the control plane.
- Product and article writes invalidate the correct cache tag only after success.
- Blog reads never use compiled articles when production content configuration is
  present.
- Only the explicit content Storage host and public-object path are accepted.

### Migration/security tests

- Both migration roots apply from zero in PGlite.
- Expected and forbidden table inventories are asserted per project.
- Recipe child cascades and proposal-vote cascades remain intact within their own
  project.
- Anonymous users see published content but not drafts or audit emails.
- Browser roles cannot write administrator content or enumerate admin/voter emails.
- Service credentials can execute only through server test helpers.

### Live acceptance checks

- Existing Google session and fresh Google sign-in both resolve through control.
- `super`, `di`, and `pe` roles retain their category permissions.
- A product edit, article save, publish, unpublish, and delete is reflected on the
  public surface immediately after the route returns success.
- EN/VI routes, predictive search, static params, sitemap, metadata, and article
  links all read content-plane data.
- Static article variants are served at bounded sizes; no recipe image comes from
  Supabase; no animated raw upload path exists.
- A simulated content outage does not take Auth/control endpoints down, and a
  simulated control outage does not redirect public content reads to it.

The repository gate remains `npm run verify` and must pass immediately before
cutover.

## Operational monitoring

- Review cached and uncached egress independently for each organization after
  24 hours, 72 hours, 7 days, and before each billing reset.
- Track the top Storage paths and PostgREST endpoints rather than only aggregate
  bytes.
- Alert operationally at 50%, 75%, and 90% of either Free egress allowance.
- Record article asset count and total bytes by lifecycle state; orphan growth is a
  defect, not routine cleanup.
- Keep a runbook containing final project refs, environment ownership, export and
  rollback commands, and the latest verified hashes. Never include credentials.

## Acceptance criteria

The split is complete only when all of the following are true:

1. Browser Auth and all operational tables use the old control project.
2. All production recipe, Wiki/audio, and article reads use the new content
   project.
3. Every content admin route verifies control identity and writes content exactly
   once through a server-only content client.
4. Successful saves become publicly visible immediately through correct cache
   invalidation.
5. The production blog no longer has competing code and database sources.
6. Public roles cannot read drafts, administrator emails, author emails, voter
   emails, or `updated_by`.
7. Recipe photography produces zero Supabase Storage egress, and blog media has
   bounded variants with owned lifecycle records.
8. Counts, stable IDs, normalized hashes, and referenced asset hashes match at
   cutover.
9. The old content data remains recoverable for the defined rollback window.
10. `npm run verify` and the live smoke checklist pass with the final environment.
