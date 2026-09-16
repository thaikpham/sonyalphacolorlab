# Supabase Content Project Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Provision the final Singapore content project, migrate authoritative ColorLab/Wiki/Blog content with verifiable hashes, switch production without dual writes, and retain a tested 14-day rollback path.

**Architecture:** The existing nqeedlgzaewccqztqvik project remains the control plane. The current empty Mumbai candidate touiyczjvnuaxfzulgeq is replaced only after a read-only emptiness audit and explicit destructive confirmation. The new content project is provisioned from the isolated content migration root, loaded from deterministic manifests, tested in preview, then selected in production during a bounded admin freeze.

**Tech Stack:** Supabase CLI 2.117, repository migration/export/import tools from the companion application plan, Vercel CLI 59, Supabase Dashboard, Vercel Dashboard, browser smoke tests.

**Spec:** docs/superpowers/specs/2026-09-11-supabase-control-content-split-design.md

**Prerequisite Plan:** docs/superpowers/plans/2026-09-11-supabase-control-content-application.md must be complete with a fresh npm run verify.

## Global Constraints

- Use superpowers:verification-before-completion before every cutover or rollback claim.
- Never print, paste into chat, commit, or pass on a command line a database password, service/secret key, Vercel token, OAuth secret, access token, or signed URL.
- Project refs and organization IDs are identifiers, not secrets; keys and passwords remain in password prompts or dashboard secret fields.
- Every command that can mutate remote state starts with a read-only dry run, resolved target name, organization, region, and project ref.
- Deleting touiyczjvnuaxfzulgeq is destructive. Even if the audit says empty, stop and obtain explicit confirmation immediately before the delete command.
- Upgrading the old organization costs money. If nqeedlgzaewccqztqvik still returns 402, stop and let the user choose billing reset versus temporary upgrade; never upgrade automatically.
- Do not configure Auth or Google OAuth in the content project.
- Do not delete old content tables or old objects during this plan. They remain rollback data for at least 14 healthy days.
- Do not dual-write. Use the admin freeze for the final delta.
- Store generated manifests under ignored artifacts/supabase/. Store only non-secret project refs, regions, timestamps, counts, and hashes in the committed runbook.
- Do not run project deletion, creation, migration apply, Vercel env mutation, deployment promotion, or production rollback concurrently.

---

### Task 1: Establish a fresh verified repository release candidate

**Files:**

- Verify: all repository files
- Update only if needed: docs/runbooks/supabase-control-content.md

**Interfaces:**

- Consumes: completed application plan.
- Produces: one exact Git commit SHA eligible for preview and production.
- Gate: no remote mutation starts when the repository gate is red.

- [ ] **Step 1: Confirm the companion plan is complete.**

Run:

~~~bash
git status --short
git log -1 --oneline
rg -n 'NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|supabaseRead|supabaseAdmin|supabaseBrowser' src scripts next.config.ts .env.example package.json
~~~

Expected: the legacy scan is empty. Unrelated local files may remain dirty, but no uncommitted implementation file may be omitted from the release.

- [ ] **Step 2: Run a fresh full gate.**

~~~bash
git diff --check
npm run verify
~~~

Record commit SHA, exit code, test count, and build result in the operator log. Stop on any failure.

- [ ] **Step 3: Verify the egress root fix is present.**

~~~bash
git merge-base --is-ancestor 4464fcc HEAD
rg -n 'storage/v1/object/public/recipes|supabase.co.*/recipes' src public data
~~~

The ancestor command exits zero. The runtime scan must find no Supabase recipe-image URL; data/images.seed.json may contain storage_path metadata only.

---

### Task 2: Audit both current projects without mutation

**Files:**

- Generate, ignored: artifacts/supabase/preflight/
- Update after verification: docs/runbooks/supabase-control-content.md

**Interfaces:**

- Consumes: authenticated Supabase CLI profile and securely configured local target variables.
- Produces: project/org/region, health, schema, row, Storage, Auth-user, and migration-history evidence.
- Gate: candidate deletion is forbidden until every emptiness check is zero.

- [ ] **Step 1: List organizations and projects.**

~~~bash
npx --no-install supabase orgs list --output-format json
npx --no-install supabase projects list --output-format json
~~~

Verify:

- nqeedlgzaewccqztqvik belongs to the existing control organization;
- touiyczjvnuaxfzulgeq belongs to organization alpehrfvkryearajlfnx;
- the candidate region is ap-south-1/Mumbai;
- there are exactly two active Free projects owned/administered by this account.

If any identity, org, region, or count differs, stop and update the design before mutation.

- [ ] **Step 2: Probe the control plane.**

Run without revealing credentials:

~~~bash
npm run supabase:health -- --target control
~~~

Record status for Auth settings, PostgREST, Storage, and these required tables:

~~~text
admin_emails
recipe_comments
recipe_proposals
proposal_votes
community_photos
recipes
recipe_translations
recipe_images
sony_cameras
lab_articles when present
~~~

A 402 exceed_cached_egress_quota is a hard stop for export and admin acceptance, but not for the read-only candidate audit.

- [ ] **Step 3: Prove the candidate is empty.**

Run:

~~~bash
npm run supabase:health -- --target content
npm run content:verify -- --target content --expect-empty
npx --no-install supabase migration list --project-ref touiyczjvnuaxfzulgeq
~~~

The evidence must show:

- zero application tables outside Supabase-managed schemas;
- zero rows in any application table if one exists;
- zero Storage objects in every bucket;
- zero non-system Auth users;
- no applied application migration history;
- no Edge Function or webhook relied on by another app.

If any check is nonzero or cannot be completed, treat the project as non-empty and do not delete it.

- [ ] **Step 4: Record only non-secret audit facts.**

Add the check timestamp, refs, org IDs, regions, counts, and health status to the runbook. Do not add keys, passwords, URLs containing tokens, or raw user records.

---

### Task 3: Restore the control plane before exporting or testing admin

**Files:**

- Update: docs/runbooks/supabase-control-content.md

**Interfaces:**

- Consumes: Task 2 health result.
- Produces: a healthy old Auth/REST/Storage gateway or an explicit wait decision.
- Gate: no content export or production cutover while control still returns 402.

- [ ] **Step 1: Re-run health at the start of the maintenance window.**

~~~bash
npm run supabase:health -- --target control
~~~

If healthy, continue. If restricted, capture the billing-cycle reset date from the dashboard.

- [ ] **Step 2: Stop for the billing decision when still restricted.**

Present exactly two choices to the user:

1. wait until the recorded Free billing reset and retry;
2. approve a temporary paid upgrade of the existing control organization.

Do not interpret approval of this architecture as approval to incur billing.

- [ ] **Step 3: Verify recovery rather than assuming it.**

After reset or user-approved upgrade, run:

~~~bash
npm run supabase:health -- --target control
~~~

Require successful Auth settings, one explicit admin_emails lookup through the server health helper, and reads of each content source table. Record the new egress baseline and billing reset timestamp.

- [ ] **Step 4: Prepare the dormant rollback schema on control.**

Probe lab_articles, lab_assets, buckets, and anon privileges on nqeedlgzaewccqztqvik. If lab_articles is absent, apply 0013, 0014, and 0015 together in one reviewed SQL transaction. If it exists, apply only the unapplied corrective 0014 and compatibility 0015 statements. Use the old project's SQL editor; do not push the full local migration root into an unreconciled history.

Afterward, prove that lab_assets and both buckets exist, lab-drafts is private, published articles remain anonymously readable, updated_by is not readable, and browser INSERT/UPDATE/DELETE are denied. This schema stays dormant until a verified rollback snapshot is loaded; it does not move Auth or community ownership.


---

### Task 4: Replace the verified-empty Mumbai candidate with Singapore

**Files:**

- Update: docs/runbooks/supabase-control-content.md
- Update local/Vercel secrets through dashboard only; no secret file is committed.

**Interfaces:**

- Consumes: Task 2 proof that touiyczjvnuaxfzulgeq is empty.
- Produces: one final content project in alpehrfvkryearajlfnx, region ap-southeast-1.
- Gate: deletion requires immediate explicit confirmation.

- [ ] **Step 1: Restate the exact destructive target and ask for confirmation.**

Show:

~~~text
Delete project ref: touiyczjvnuaxfzulgeq
Organization: alpehrfvkryearajlfnx
Verified app tables: 0
Verified Storage objects: 0
Verified Auth users: 0
Replacement region: ap-southeast-1 (Singapore)
~~~

Wait for explicit approval at this point.

- [ ] **Step 2: Delete only the verified candidate.**

After approval:

~~~bash
npx --no-install supabase projects delete touiyczjvnuaxfzulgeq
~~~

Do not use a variable, wildcard, or --yes. Re-list projects and verify the old control project still exists.

- [ ] **Step 3: Create the replacement interactively.**

Run in a PTY so the database password is entered through the secure prompt and never appears in command history or process arguments:

~~~bash
npx --no-install supabase projects create "3 apps contents" --org-id alpehrfvkryearajlfnx --region ap-southeast-1
~~~

Do not supply --db-password on the command line. Wait until project status is healthy.

- [ ] **Step 4: Record and verify the final ref.**

Re-run:

~~~bash
npx --no-install supabase projects list --output-format json
~~~

Record the new ref and ap-southeast-1 region in the runbook. From this point, never use touiyczjvnuaxfzulgeq in commands or runtime variables.

- [ ] **Step 5: Configure keys without exposing them.**

In the Supabase dashboard, copy the replacement project's public URL, anon/publishable key, and secret key directly into:

- secure local environment storage under the new variable names;
- Vercel Preview environment;
- Vercel Production environment only after preview acceptance.

Do not use projects api-keys --reveal in a captured terminal. Do not configure Google OAuth on the content project.

---

### Task 5: Provision and verify the empty content schema

**Files:**

- Generate, ignored: artifacts/supabase/preflight/content-migration/
- Update: docs/runbooks/supabase-control-content.md

**Interfaces:**

- Consumes: final content project ref and supabase/content/migrations.
- Produces: the exact content-only database and Storage buckets.
- Gate: migration inventory/security checks pass before data import.

- [ ] **Step 1: Dry-run against the resolved final ref.**

~~~bash
npm run supabase:migrations -- --target content --dry-run
~~~

Review that the printed root is supabase/content/migrations, the ref equals the new Singapore ref, and the plan contains only 0001_content_baseline.sql. Stop if it targets nqeedlgzaewccqztqvik or the retired Mumbai ref.

- [ ] **Step 2: Apply once.**

~~~bash
npm run supabase:migrations -- --target content --apply
~~~

Enter the database password through the secure prompt if requested. Do not use a password flag.

- [ ] **Step 3: Verify database inventory and privileges.**

~~~bash
npm run content:verify -- --target content --expect-baseline
~~~

Require the six expected application tables and zero forbidden control tables. Run live anon checks:

- published recipe/product/article rows are selectable;
- draft lab_articles are not selectable;
- lab_articles.updated_by is not selectable;
- lab_assets is not selectable;
- anon cannot insert/update/delete content.

- [ ] **Step 4: Verify Storage policy.**

Require:

- lab-drafts exists and is private;
- lab exists and is public;
- anonymous GET cannot read a lab-drafts object;
- anonymous GET can read a temporary test object in lab;
- browser roles cannot upload/delete in either bucket;
- the temporary test object is removed immediately after the check.

---

### Task 6: Export the authoritative old content and resolve article precedence

**Files:**

- Generate, ignored: artifacts/supabase/content-export/
- Update: docs/runbooks/supabase-control-content.md

**Interfaces:**

- Consumes: healthy old control project.
- Produces: immutable export directory with manifest counts, stable IDs, row hashes, object hashes, and a chosen article source.
- Gate: every conflict is resolved explicitly before import.

- [ ] **Step 1: Export database sources read-only.**

~~~bash
npm run content:export -- --source control --label initial --dry-run
npm run content:export -- --source control --label initial
~~~

The report must include recipes, recipe_translations, recipe_images, sony_cameras, lab_articles if present, and referenced Lab objects. It excludes Auth/control tables and recipe image objects.

- [ ] **Step 2: Compare rows with repository seeds.**

For recipes and products, the old database wins because admin edits may be newer. Record database and seed hashes; do not overwrite the export with seeds.

For articles:

- if lab_articles is absent or has zero authored rows, select the compiled ARTICLES catalogue;
- if lab_articles has rows, compare stable IDs, blocks, status, and timestamps with compiled ARTICLES;
- if they differ, produce a per-article diff and ask the user which representation is authoritative;
- never merge by last-write-wins without that decision.

- [ ] **Step 3: Validate legacy media references.**

Every article Storage URL must map to an object manifest entry and be converted to a processed UUID asset. A missing object, unreferenced public object, GIF, or hash failure stops the import. Do not silently drop a block or copy a raw asset.

- [ ] **Step 4: Seal the export.**

Recompute manifest hashes after article-source resolution. Mark the directory read-only at the operator level and record its path/hash in the runbook. No later task edits this export; the final delta gets a separate directory.

---

### Task 7: Import content and run target acceptance checks

**Files:**

- Generate, ignored: artifacts/supabase/content-import/
- Update: docs/runbooks/supabase-control-content.md

**Interfaces:**

- Consumes: sealed export and empty content baseline.
- Produces: matching content rows and objects in Singapore.
- Gate: counts, IDs, normalized row hashes, and object hashes all match.

- [ ] **Step 1: Run import validation without writing.**

~~~bash
npm run content:import -- --destination content --manifest initial --dry-run
~~~

Confirm the destination ref is the final Singapore ref, source manifest is the sealed export, and ordered row/object counts match the manifest.

- [ ] **Step 2: Import in dependency order.**

~~~bash
npm run content:import -- --destination content --manifest initial --apply
~~~

The implementation imports recipes before children, articles before assets, and private objects before public publication state. It performs no deletes and no writes to control.

- [ ] **Step 3: Verify exact equality.**

~~~bash
npm run content:verify -- --target content --manifest initial
~~~

Require exact equality for:

- per-table row counts;
- stable-ID sets;
- normalized row SHA-256 values;
- referenced object path/size/SHA-256 values;
- article block asset ownership.

- [ ] **Step 4: Exercise live anonymous and privileged paths.**

Use the health/smoke helper to verify one record in each content domain and an authorized write/read-back/delete cycle against a dedicated temporary test record. Delete only that explicitly named test record and its objects. Re-run equality for production IDs afterward.

---

- [ ] **Step 5: Materialize the normalized rollback snapshot on control.**

Run:

~~~bash
npm run content:import -- --destination control --manifest initial --rollback --dry-run
npm run content:import -- --destination control --manifest initial --rollback --apply
npm run content:verify -- --target control --manifest initial --rollback
~~~

This is a maintenance copy from one sealed manifest, not an application dual write. It may touch only the six content tables and their Lab objects. Keep the original pre-normalization export sealed separately.

### Task 8: Deploy a preview and shadow-verify without dual display

**Files:**

- Update only if a defect is found: application files and tests
- Update: docs/runbooks/supabase-control-content.md

**Interfaces:**

- Consumes: verified content target and release candidate SHA.
- Produces: one Vercel preview using control Auth plus Singapore content.
- Gate: full preview smoke passes before production env changes.

- [ ] **Step 1: Configure Preview variables.**

Set all six variables in Vercel Preview. Auth values point to nqeedlgzaewccqztqvik; content values point to the final Singapore ref. Remove the three legacy generic names from Preview only after the new names are present.

- [ ] **Step 2: Validate configuration in Vercel context.**

~~~bash
vercel env run -e preview -- npm run check:supabase-env
~~~

Expected: online, distinct Auth/content origins, complete public/secret pairs. The command prints variable names and project refs only.

- [ ] **Step 3: Deploy the exact candidate.**

~~~bash
vercel deploy
~~~

Record the returned preview URL and deployment ID. Do not promote it.

- [ ] **Step 4: Run the complete preview smoke.**

Verify EN and VI:

- recipe list/detail and local responsive image variants;
- Wiki camera/lens/accessory and audio list/detail;
- predictive search;
- Blog feed/detail, metadata, sitemap, and static params;
- fresh Google login and an existing session through control;
- super, di, and pe category authorization;
- product edit and immediate public read-back;
- article draft save, image upload, publish, immediate public read-back, unpublish, republish, and delete;
- comments, proposals, community photos, and voting remain in control.

Use dedicated temporary content IDs. Remove them through the application UI so lifecycle cleanup is exercised.

- [ ] **Step 5: Shadow-compare old and new reads server-side.**

Run the comparison helper against the sealed manifest and both projects. It may log counts, stable IDs, and hashes only. It must never render both sources to readers or write either source.

Any mismatch returns to the relevant application/data task, adds a regression test, produces a new release SHA, and repeats Tasks 1 and 8.

---

### Task 9: Freeze admin writes, import the final delta, and cut over

**Files:**

- Generate, ignored: artifacts/supabase/final-delta/
- Update: docs/runbooks/supabase-control-content.md

**Interfaces:**

- Consumes: accepted preview, healthy control, verified initial import.
- Produces: production reading and writing content only in Singapore.
- Gate: admin remains frozen until post-deploy smoke succeeds.

- [ ] **Step 1: Announce and enable the bounded admin freeze.**

Set CONTENT_ADMIN_FROZEN=true in Vercel Production and deploy the exact accepted SHA once. Verify product/article/upload mutations return 503 contentAdminFrozen while public reads, comments, proposals, votes, and Auth remain available. Record freeze start time and keep this maintenance deployment active through the delta import.

- [ ] **Step 2: Export and import a separate final delta.**

~~~bash
npm run content:export -- --source control --since-manifest initial --label final-delta
npm run content:import -- --destination content --manifest final-delta --dry-run
npm run content:import -- --destination content --manifest final-delta --apply
npm run content:verify -- --target content --manifest final-delta
~~~

Stop on any count/hash difference.

- [ ] **Step 3: Set Production variables.**

npm run content:import -- --destination control --manifest final-delta --rollback --dry-run
npm run content:import -- --destination control --manifest final-delta --rollback --apply
npm run content:verify -- --target control --manifest final-delta --rollback
In Vercel Production:

- add the six new variables;
- verify Auth variables resolve to nqeedlgzaewccqztqvik;
- verify content variables resolve to the final Singapore ref;
- validate the Production environment with the exact command below;
- remove the three generic legacy variables only after the check passes;
- keep CONTENT_ADMIN_FROZEN=true for the first cutover deployment.


~~~bash
vercel env run -e production -- npm run check:supabase-env
~~~

No secret value is printed during comparison.

- [ ] **Step 4: Deploy and promote the accepted SHA.**

Deploy the exact SHA accepted in preview with the new content target and the freeze still enabled, then promote that deployment to production using the repository's normal Vercel workflow. Do not rebuild a different dirty tree.

- [ ] **Step 5: Run production smoke while writes remain frozen.**

Repeat public EN/VI, search, sitemap, login, role visibility, and community checks. Confirm product/article/upload mutations still return 503 contentAdminFrozen; do not perform production content writes in this step. Confirm network requests:

- Auth/control REST uses nqeedlgzaewccqztqvik;
- content REST/public Lab Storage uses only the new Singapore ref;
- recipe images use same-origin /recipes paths;
- no request uses touiyczjvnuaxfzulgeq;
- no Lab image uses /_next/image or a raw/GIF path.

- [ ] **Step 6: Reopen content-admin writes.**

Set CONTENT_ADMIN_FROZEN=false and deploy the same accepted SHA again. Exercise one dedicated temporary product edit and the full article draft/upload/publish/unpublish/delete lifecycle, then verify public read-back and object cleanup. Re-run the final content hash check after removing those temporary records.

Announce the window closed only after these checks pass. Record freeze end time, both deployment IDs, release SHA, final project ref, and manifest hash.

---

### Task 10: Monitor, retain rollback data, and prove rollback readiness

**Files:**

- Update: docs/runbooks/supabase-control-content.md
- Do not delete old tables/objects in this task.

**Interfaces:**

- Consumes: healthy production cutover.
- Produces: recorded egress/health observations and a tested non-destructive rollback procedure.
- Gate: cleanup is a separate future approval after 14 healthy days and backup.

- [ ] **Step 1: Capture the post-cutover baseline.**

Record cached and uncached egress separately for both organizations, top Storage paths, top PostgREST endpoints, article asset counts/bytes by lifecycle state, and error rate. Set operational review points at 24 hours, 72 hours, 7 days, and before billing reset.

- [ ] **Step 2: Test rollback mechanics without switching production.**

Dry-run:

~~~bash
npm run content:export -- --source content --since-manifest final-delta --label rollback
npm run content:import -- --destination control --manifest rollback --rollback --dry-run
~~~

The rollback manifest may target only legacy content tables/objects. It must not touch Auth, admin_emails, or community rows.

- [ ] **Step 3: Define the actual rollback sequence.**

On a real rollback:

1. freeze only content-admin writes;
2. export the content-project delta since cutover;
3. import it back to old content tables;
4. verify counts/IDs/row hashes/object hashes;
5. set SUPABASE_ROLLBACK_MODE=true, then point content variables to the old project while keeping Auth variables unchanged;
6. validate the shared-origin warning with vercel env run -e production -- npm run check:supabase-env;
7. deploy and smoke-test;
8. reopen writes only when healthy.

Do not skip reverse synchronization after new-project writes begin. Remove SUPABASE_ROLLBACK_MODE when returning to separate healthy projects.

- [ ] **Step 4: Audit at each review point.**

At 50%, 75%, or 90% of either Free egress pool, investigate top paths immediately. orphaned or cleanup_failed asset growth is a defect and must create a tracked repair task; it is not normal housekeeping.

- [ ] **Step 5: Close the rollback window without cleanup.**

After at least 14 healthy days, create a verified backup and report readiness. Deleting old content tables/buckets requires a new explicit cleanup plan and approval. This plan ends with old data still recoverable.
