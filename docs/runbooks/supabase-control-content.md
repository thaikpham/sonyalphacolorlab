# Runbook — Supabase control plane / content plane

**Audience:** whoever is holding the pager, including you in six months.
**Contains no secret values, and must not.** Variable *names* only.

---

## What lives where

| | **Control plane** | **Content plane** |
|---|---|---|
| Project | `nqeedlgzaewccqztqvik` ("web system", ap-northeast-2) | the content-org project |
| Owns | Supabase Auth, `auth.users`, `admin_emails`, `recipe_comments`, `recipe_proposals`, `proposal_votes`, `community_photos` | `recipes`, `recipe_translations`, `recipe_images`, `sony_cameras`, `lab_articles`, `lab_assets`, the `lab` / `lab-drafts` / `recipe-uploads` buckets |
| Migration root | `supabase/migrations` | `supabase/content/migrations` |
| Who talks to it | the browser (Auth only), `controlRead()`, `controlAdmin()` | `contentRead()`, `contentAdmin()` — server-side only |

They are in **separate organisations**, which is the point: a content egress
incident can no longer take sign-in down with it. That is what happened on
2026-09-11, and it is why this split exists.

The browser never holds a content credential and never reaches the content
project's API. Every content write goes through a route handler here, which
verifies the control-plane session and the `admin_emails` row *first*.

### Where an admin save goes

`/admin/wiki` (DI and PE), `/admin/colorlab` and `/admin/blog` write to the
**content** project — the one `NEXT_PUBLIC_CONTENT_SUPABASE_URL` names, in the
content organisation. The save bar says which: "Đã lưu vào Supabase · <ref>".

`nqeedlgzaewccqztqvik` still holds a `sony_cameras`, `recipes` and
`lab_articles`. Those are the frozen pre-cutover rollback copy (94 products, no
audio, last edited 2026-08-19). Nothing writes them while the split is in
force, so a product edit will never appear there — look in the content project.

`.env.local` decides this for `npm run dev` exactly as Vercel does for
production. If a local save does not show on the live site, compare the two
`NEXT_PUBLIC_CONTENT_SUPABASE_URL` values first.

### Seed ⇄ database

The database is the source of truth for the catalogue; the seeds are a Git-time
snapshot the tests and offline mode read.

```bash
npm run pull:supabase -- --target content --dry   # what the admin changed since the seed
npm run pull:supabase -- --target content         # bring it into data/*.seed.json
npm run push:supabase -- --target content         # insert rows the project lacks, keep the rest
npm run push:supabase -- --target content --overwrite   # replace rows WHOLE — pull first
```

`push:supabase` without `--overwrite` is safe to run at any time: it inserts
missing rows (for example the 25 audio products, which the cutover did not
carry because the control copy never had them) and leaves every existing row
as the admin left it.

### The one cross-project reference

Community rows reference a recipe by `recipe_slug`, a plain string. Postgres
cannot enforce that across databases, so:

- **recipe slugs are immutable.** Renaming one orphans every comment on it.
- the server calls `publishedRecipeExists()` against the content plane before
  writing a comment, proposal or photo.
- a recipe may be unpublished; hard deletion is blocked while operational rows
  still name its slug.

---

## Runtime configuration

Six variables. All six, or none — a half-configured boundary fails deployment
verification rather than degrading. None absent is the seed-backed offline mode
local development and the test suite run in.

```
NEXT_PUBLIC_AUTH_SUPABASE_URL
NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY
AUTH_SUPABASE_SECRET_KEY

NEXT_PUBLIC_CONTENT_SUPABASE_URL
CONTENT_SUPABASE_ANON_KEY
CONTENT_SUPABASE_SECRET_KEY
```

Two optional server-only switches, both off by default:

```
CONTENT_ADMIN_FROZEN=true     rejects product/article/upload mutations
SUPABASE_ROLLBACK_MODE=true   the only way the two URLs may name one project
```

Four operations-only names, never read by the application:

```
CONTROL_SUPABASE_PROJECT_REF
CONTENT_SUPABASE_PROJECT_REF
CONTROL_SUPABASE_DB_PASSWORD
CONTENT_SUPABASE_DB_PASSWORD
```

Check a deployment's topology without printing anything secret:

```bash
npm run check:supabase-env
```

It is deliberately **not** part of `npm run verify`: the gate runs
credential-free on purpose, because that is what proves seed mode still works.

---

## Everyday commands

Every command that touches a project takes an explicit `--target`. There is no
default, and none of them reads `supabase/.temp/linked-project.json`.

```bash
# Is a project actually answering? (The dashboard said ACTIVE_HEALTHY while the
# gateway returned 402 to every request. Ask the gateway.)
npm run supabase:health -- --target control
npm run supabase:health -- --target content

# Migrations. Lists the root's files; --dry-run asks the project what would run;
# --apply runs it. Needs the Supabase CLI, `supabase login` (or
# SUPABASE_ACCESS_TOKEN) with access to that project's organisation, and ideally
# CONTENT_/CONTROL_SUPABASE_DB_PASSWORD — without it the CLI creates a temporary
# login role. A merge to main runs the control root on control — see
# "Migrations, per project".
npm run supabase:migrations -- --target content
npm run supabase:migrations -- --target content --dry-run
npm run supabase:migrations -- --target content --apply

# Snapshot + hashes.
npm run content:export -- --target control --label initial

# Load it. Dry run first, always.
npm run content:import -- --source control --destination content --manifest initial
npm run content:import -- --source control --destination content --manifest initial --apply

# Prove it. Exits nonzero on any difference and names the differing rows.
npm run content:verify -- --target content --manifest initial
```

Export artifacts land under `artifacts/supabase/`, which is gitignored: they are
a full JSON copy of the catalogue and carry `updated_by`, an editor's address.

### Migrations, per project

**Control: a merge to `main` applies it.** Supabase's GitHub integration is
connected to `nqeedlgzaewccqztqvik` with branching on, and its production branch
is git `main`. Every push to `main` posts a `Supabase Preview` check that runs
the equivalent of `supabase db push` for `supabase/migrations` against control.

That push compares the project's recorded versions with the file prefixes and
refuses on any difference ("Remote migration versions not found in local
migrations directory"). The check goes red and the branch shows
`MIGRATIONS_FAILED`. Only the prefix is compared, never the name. A migration
applied through an MCP tool is recorded under a timestamp (`20260814041545`)
rather than its prefix (`0010`); one pasted into the dashboard SQL editor is not
recorded at all. That is how the check sat red on every merge from at least
2026-09-29. On 2026-10-05 the seven timestamped rows were re-recorded as
`0010`–`0016`, matching the files.

Before merging a new control migration, check the history:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Every row must match a file prefix in `supabase/migrations`.
`supabase migration repair` fixes a mismatch without touching any table.

**Content: by hand, before the code that needs it.** The content project must
have no GitHub integration; it was disabled on 2026-10-05. Never connect one.
The integration's "Working directory" is the folder that *contains*
`supabase/`, and it reads `<that folder>/supabase/migrations`. With this
repository's layout the only such folder is the control root, and that is what
a second integration pushed into `touiyczjvnuaxfzulgeq` on every merge until it
was disabled (see "The content project's lineage" below). After a merge to
`main`, exactly one `Supabase Preview` check should appear: control's.

Apply a content migration with `npm run supabase:migrations -- --target content
--apply`, and do it **before** merging the code that reads what it adds. Vercel
prerenders against content while it builds. On 2026-10-05 the production build
of `9a04713` failed at 03:54:17Z with "permission denied for table
sony_cameras", because the grant it needed reached content eight seconds later.

New content migrations are named with a 14-digit timestamp
(`supabase migration new` does this), never a four-digit number: control owns
`0001`–`0017` and up, and the integration compares version prefixes only. A
content version that control's root also has is one a control-root push would
read as its own.

The control check does not gate the Vercel deployment. A failed Vercel build has
its own cause in the build log.

**Pending: `20261007000001_camera_highlights.sql`.** The camera-highlights
branch adds `highlights` to `PRODUCT_COLUMNS` (`src/lib/cameras/row.ts`), so
every catalogue read selects that column by name. Apply this migration to
content by hand — `npm run supabase:migrations -- --target content --apply`,
then confirm `npm run supabase:migrations -- --target content --dry-run` shows
nothing to apply — **before** merging the branch. This is the same ordering
mistake that failed the `9a04713` build above: merged first, the column does
not exist yet and every `select(PRODUCT_COLUMNS)` against content fails with
"column sony_cameras.highlights does not exist". Nothing here should be made
to tolerate the missing column — a read that cannot select a column it names
must fail loudly, not fall back.

### The content project's lineage

`touiyczjvnuaxfzulgeq` was not built from `0001_content_baseline.sql`. Its
integration ran the control root against it. The live buckets were created on
2026-09-16 at 07:28:23Z and 07:28:24Z, in control's order (`lab` from 0013,
`lab-drafts` from 0015). The control-only tables were then dropped by hand, and
the project recorded control's `0001`–`0016` as its own history.

A read-only diagnostic on 2026-10-05 found the tables, columns, enums and
function the same as the content root, and every constraint and index
byte-identical by md5. Five things differed, and
`content/migrations/20261006000000_reconcile_control_lineage.sql` fixes them:

- two read policies under control's names;
- no `lab_assets_touch` trigger;
- table-level ALL for anon and authenticated on the three recipe tables;
- no `recipe-uploads` bucket (created by hand on 2026-10-05);
- possibly no column comments.

It refuses a database holding control-plane tables, and one whose recipe tables
have a column its read grant does not cover. `migration-roots.test.ts` runs it
on a simulation of the live lineage (control `0001`–`0016`, the control tables
dropped, content `0003`) and asserts the result is exactly the content root, and
that it changes nothing on a database the content root built.

**Adopting the content root (one-off).** After this, content's history is
`0001`, `0002`, `0003`, `20261006000000`, and the control root can never be
pushed into it: `20261006000000` is not a control file, so such a push refuses.

1. Confirm the content integration is disabled: content project → Project
   Settings → Integrations → GitHub Integration. Leave the Supabase GitHub App
   and the account-level GitHub connection alone; control uses both.
2. In the content project's SQL editor (check the project name first), run as
   one execution:

   ```sql
   begin;
   set local lock_timeout = '3s';

   -- paste supabase/content/migrations/20261006000000_reconcile_control_lineage.sql here

   do $$ begin
     if not exists (select 1 from pg_trigger where tgname = 'lab_assets_touch') then
       raise exception 'the reconcile migration was not pasted above';
     end if;
   end $$;

   delete from supabase_migrations.schema_migrations
    where version not in ('0001', '0002', '0003', '20261006000000');
   insert into supabase_migrations.schema_migrations (version, name, statements) values
     ('0001', 'content_baseline', null),
     ('0002', 'recipe_upload_bucket', null),
     ('0003', 'lab_article_kind_and_meta', null),
     ('20261006000000', 'reconcile_control_lineage', null)
   on conflict (version) do update set name = excluded.name, statements = excluded.statements;
   commit;
   ```

   If it errors, nothing was applied. Run `rollback;` on its own before
   anything else, then fix and rerun the whole block. A lock timeout means a
   long-running read held the catalogue; retry. The editor may warn about the
   `delete`; that is expected.
3. Check `select version, name from supabase_migrations.schema_migrations order
   by version;` returns exactly those four rows, that
   `npm run supabase:health -- --target content` is clean, and that the site's
   recipe, Wiki and blog pages load.

---

## Freezing administrator writes

Set `CONTENT_ADMIN_FROZEN=true` on the deployment before taking the final delta.

It rejects product saves, article saves and media uploads with `503
contentAdminFrozen`, *before* the request body is parsed. It does not touch
Auth, the community routes, or any public read — a reader cannot tell it is on.
An editor sees:

> **EN** — Saving is paused while the content database is being moved. Nothing was changed — try again shortly.
> **VI** — Việc lưu đang tạm dừng trong lúc chuyển cơ sở dữ liệu nội dung. Chưa có gì thay đổi — hãy thử lại sau ít phút.

Unset it once verification passes. A freeze left on looks exactly like a broken
editor.

---

## Rollback

**The old content tables stay for at least 14 days.** Read-only, no dual writes.
They are not dropped at cutover, and cleanup is a separate, approved change —
the cheapest possible mistake at that point is a migration that tidies away the
only recoverable copy.

To roll back after new writes have begun:

1. `CONTENT_ADMIN_FROZEN=true`.
2. `npm run content:export -- --target content --label rollback`
3. `npm run content:import -- --source content --destination control --manifest rollback --rollback`
   (dry run first; `--destination control` is refused without `--rollback`)
4. `npm run content:verify -- --target control --manifest rollback --rollback`
5. Point `NEXT_PUBLIC_CONTENT_SUPABASE_URL` and the content keys at the control
   project and set `SUPABASE_ROLLBACK_MODE=true` — the only situation in which
   the two URLs may name one project.
6. Smoke-test, then unset `CONTENT_ADMIN_FROZEN`.

Unset `SUPABASE_ROLLBACK_MODE` the moment the content project is serving again.
While it is on, the check that keeps the two planes apart is suspended, and the
next content incident takes Auth down with it.

---

## Egress monitoring

Review **cached and uncached egress separately, per organisation**, at:

- 24 hours after cutover
- 72 hours
- 7 days
- immediately before each billing reset

Alert at **50%, 75% and 90%** of either Free allowance. Track the top Storage
paths and PostgREST endpoints, not only aggregate bytes — the 2026-09-11
incident was 90% grid thumbnails from one bucket, which an aggregate number
would not have told anyone.

Also record, per week: `lab_assets` count and total `byte_size` by `state`.
Growth in `orphaned` or `cleanup_failed` is a defect, not routine cleanup.

### What must produce zero image egress

- Recipe photography — vendored into `public/recipes` at three WebP widths.
- Article media — three immutable WebP variants, one-year cache lifetime, picked
  directly by the custom image loader. No `/_next/image`, no Supabase transform.

If either starts appearing in Storage egress, something has regressed to serving
originals.

### Admin sign-in, and getting locked out

Administrators sign in at `/admin` with an email, a password and a TOTP code.
Readers still use Google. Both are Supabase Auth on the **control** project.

First-time setup, per administrator, in this order:

1. Sign in once by whatever means already works for that account.
2. `/admin/security` → set a password. An account created by Google sign-in has
   none, and the admin form asks for one.
3. `/admin/security` → set up the authenticator, scan, and enter a code to
   confirm. Nothing is enrolled until a code is accepted.

`requireAdmin()` requires the second factor only once a **verified** factor
exists, so step 2 and step 3 are reachable with one factor and the order above
cannot strand anyone.

**Project settings this depends on.** Email/password sign-in must be enabled on
the control project, and so must MFA (TOTP). If password sign-in is disabled the
form answers "that email and password do not match an account" — which is also
what a wrong password looks like, deliberately, so check the setting before
concluding the password is wrong.

**If an operator loses their phone.** There is no recovery code path in the
application. Recover from the Supabase dashboard on the control project: find
the user under Authentication, delete their MFA factor, and they are back to one
factor until they enrol again. That is a deliberate consequence of not storing
the seed here — the dashboard is the recovery path, and it needs project access
rather than anything this deployment holds.

**Revoking an administrator** is still a row: delete them from `admin_emails`
and the next request refuses, with no redeploy. The second factor is
authentication; `admin_emails` is authorisation; they are kept apart so a single
compromised credential is not sufficient on its own.

### Publishing a recipe photograph

`/admin/colorlab` uploads into the PRIVATE `recipe-uploads` bucket. That is the
intake, not the origin: no reader is ever served from it, and the editor sees
its own uploads through signed URLs that expire. A photograph reaches the site
only when someone runs the vendor step and deploys the result.

```bash
npm run vendor:uploads -- --target content --dry-run   # what would change
npm run vendor:uploads -- --target content             # pull + rewrite manifest
git add public/recipes data/images.seed.json
git commit -m "content(recipes): add <what> photographs"
```

The script rebuilds `data/images.seed.json` from `recipe_images`, so ORDER and
ALT come across in the same pass — reordering photographs in the admin reaches
readers the same way adding one does.

It **refuses to shrink the manifest** unless given `--allow-removals`. A shrink
means either a deliberate removal or something worse — the wrong project, a
half-finished import, `0002` not applied — and the resulting commit would look
like a routine manifest update while dropping photographs from the live site.
Read the list it prints before reaching for the flag.

The admin screen shows `CHỜ DEPLOY` / `AWAITING DEPLOY` on every photograph that
is not yet in the manifest, and a banner with this command while any are
pending. If an editor reports that a photograph "did not upload", check that
banner first: it almost certainly uploaded and is waiting for this step.

**`recipe-uploads` must never become public.** `migration-roots.test.ts` asserts
it across every migration in the content root, because a public intake bucket
re-creates the 2026-09-11 incident exactly — the recipe grid is still the
highest-traffic image surface on the site.
