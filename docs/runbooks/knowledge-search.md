# Runbook — knowledge pages, cross-links and unified search

Covers what the knowledge/search MVP (PR0–PR4, ADRs 0001–0004) adds to
operations. Everything in `supabase-control-content.md` still applies; this
file only adds to it.

## What changed in the data

| Project | Migration | Change |
|---|---|---|
| content | `supabase/content/migrations/0003_lab_article_kind_and_meta.sql` | `lab_articles.kind` (`article` \| `knowledge`, default `article`), `lab_articles.meta` (jsonb object, default `{}`), index on `(kind, status, updated_at)`, additive anon/authenticated column grant on both |
| control | `supabase/migrations/0017_lab_article_kind_and_meta_rollback_compat.sql` | the same columns on the dormant rollback copy, so export/import/verify keep one column list |

Both are additive and idempotent (`if not exists`, guarded constraints). Every
existing row becomes an ordinary article with empty metadata; nothing a reader
sees changes until an editor writes metadata or a knowledge page.

`scripts/supabase/tables.ts` now names `kind` and `meta` for `lab_articles`,
so `content:export`, `content:import` and `content:verify` carry them.

There is **no search index** and no new table. Search reads the same cached,
published reads the pages read (ADR 0003). Nothing to backfill, reindex or
keep in sync.

## No new environment variables

The MVP reads no new variable. The six Supabase variables, `ANTHROPIC_API_KEY`,
`AI_DAILY_CALL_CAP` and `NEXT_PUBLIC_SITE_URL` are unchanged.

Reserved for later releases, **off when unset**, not read by any code yet:
`SEMANTIC_SEARCH_ENABLED`, `PHOTO_DISCOVERY_ENABLED`, `ASK_COLORLAB_ENABLED`,
`MCP_ENABLED`. Do not set them; they do nothing today.

## Release sequence (order matters)

The published-article read selects `kind` and `meta`. Code deployed before the
migration fails that read — loudly, by design (`ContentUnavailableError`, the
locale error page), never by falling back to seeds. So:

1. **Preview first.** Run the whole sequence against a Preview deployment and
   a content project you can afford to touch before production.
2. **Back up** the content plane **from `main`, before switching to this
   branch** — this branch's export names `kind` and `meta`, which do not exist
   until step 3, so it cannot take the pre-migration snapshot:
   ```bash
   git switch main
   npm run content:export -- --target content --label initial   # timestamped, never overwrites
   git switch -   # back to the release branch
   ```
   The project's own scheduled backup is the second line; confirm it exists in
   the Supabase dashboard before step 3.
3. **Plan, then apply the content migration:**
   ```bash
   npm run supabase:migrations -- --target content            # prints the plan
   npm run supabase:migrations -- --target content --apply    # runs 0003
   ```
4. **Verify the columns answer to the anon key** — the go/no-go for step 6:
   ```bash
   npm run supabase:health -- --target content
   # expect: lab_articles kind/meta (anon)  200
   ```
   A post-migration export from this branch now succeeds too, and is the
   snapshot to keep alongside the release:
   ```bash
   npm run content:export -- --target content --label initial
   ```
5. **Apply the control rollback copy** (keeps a rollback import possible):
   ```bash
   npm run supabase:migrations -- --target control
   npm run supabase:migrations -- --target control --apply    # runs 0017
   ```
6. **Deploy** the branch.
7. **Smoke test** (both locales):
   - `/blog`, one `/blog/<id>`, `/learn`, `/learn/glossary`, `/search?q=a7cii`,
     `/search?q=ISO Auto`, one `/recipe/<slug>` (Learn more section), one
     `/cameras/<id>`.
   - `GET /api/search?q=mojave` → 200 JSON, `Cache-Control: no-store`.
   - `GET /api/search?q=x&scope=nope` → 400.
   - `/sitemap.xml` lists `/cameras/…` and `/learn`, and lists each article
     once at `/vi/blog/<id>`.
8. **Optional — pilot drafts.** Only when the owner wants them in the editor:
   ```bash
   npm run push:lab -- --target content --with-pilot-drafts --dry-run
   npm run push:lab -- --target content --with-pilot-drafts
   ```
   They arrive as drafts; existing ids are never touched.

## Rollback

Code first, schema never in a hurry.

- **Revert the deploy** to the previous build. The old code ignores `kind` and
  `meta` (it never selects them), so it runs unchanged on the migrated schema.
  Knowledge pages, if any were published, would then appear on the old blog
  feed as articles — unpublish them first if that matters.
- **Do not drop the columns** to roll back. They are additive and harmless to
  old code. Removing them is a separate, deliberate migration.
- The Data Cache key changed from `lab-articles` to `lab-entries`, so the new
  build never reads an entry the old one wrote, and vice versa.

## Unpublish, delete and caches

- Saving, publishing, unpublishing or deleting an article or knowledge page
  calls `revalidateTag(LAB_TAG, IMMEDIATE)` (unchanged). The blog, `/learn`,
  the sitemap, every related-links section and search all read through that
  one tag, so all of them drop the page on the next request.
- Related links resolve at render against what is published *now*; a link to
  an unpublished or deleted page renders nothing. No stored link can bring a
  page back.
- `/api/search` and `/api/search/predictive` answer `no-store`: no CDN copy
  outlives an unpublish.
- What is **not** promised: a copy a browser or a third party already cached,
  or a search result someone already saw.

## Monitoring

| Signal | Where | Meaning |
|---|---|---|
| `[search] <kind> unavailable:` | function logs | a source threw during a search; that kind was reported unavailable to the reader |
| `[content] articles.published unavailable:` | function logs | the published read failed — blog, `/learn`, search articles all affected |
| `[lab] reference check failed:` | function logs | a save could not verify related ids; publishes are refused (502 `referenceCheckFailed`) until it recovers |
| `/api/search` p95 | Vercel analytics | locally measured p95 24 ms warm (`docs/evaluations/2026-10-05-search-lexical.md`); investigate well before the brief's 500 ms target |

Nothing logs a query string, an editor address or a reader identity.

## Search quality

```bash
npm run search:eval                        # Markdown report
npx vitest run src/lib/search/evaluation   # gate: top-1 100%, Recall@5 ≥ 0.8
```

Add a query to `src/lib/search/evaluation/queries.ts` whenever a real reader
query disappoints: label it from the documents, not from the ranker's output.
A change to `rank.ts`, `text.ts` or `documents.ts` that breaks the gate is a
regression until the new labels are reviewed.

## Cost

No paid service is called by anything in this release. Search is in-process
ranking over cached reads; it adds no Supabase queries beyond the cache misses
the pages already cause, and no model calls.
