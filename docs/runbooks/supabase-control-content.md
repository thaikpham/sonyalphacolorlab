# Runbook — Supabase control plane / content plane

**Audience:** whoever is holding the pager, including you in six months.
**Contains no secret values, and must not.** Variable *names* only.

---

## What lives where

| | **Control plane** | **Content plane** |
|---|---|---|
| Project | `nqeedlgzaewccqztqvik` ("web system", ap-northeast-2) | the content-org project |
| Owns | Supabase Auth, `auth.users`, `admin_emails`, `recipe_comments`, `recipe_proposals`, `proposal_votes`, `community_photos` | `recipes`, `recipe_translations`, `recipe_images`, `sony_cameras`, `lab_articles`, `lab_assets`, the `lab` / `lab-drafts` buckets |
| Migration root | `supabase/migrations` | `supabase/content/migrations` |
| Who talks to it | the browser (Auth only), `controlRead()`, `controlAdmin()` | `contentRead()`, `contentAdmin()` — server-side only |

They are in **separate organisations**, which is the point: a content egress
incident can no longer take sign-in down with it. That is what happened on
2026-09-11, and it is why this split exists.

The browser never holds a content credential and never reaches the content
project's API. Every content write goes through a route handler here, which
verifies the control-plane session and the `admin_emails` row *first*.

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

# Migrations. Prints the plan; --apply is the only thing that runs it.
npm run supabase:migrations -- --target content
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
