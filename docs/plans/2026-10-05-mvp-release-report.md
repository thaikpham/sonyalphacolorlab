# Knowledge + search MVP — release report

Brief: `Sony_ColorLab_Claude_Code_Handoff.md` (2026-10-05). Branch
`claude/sleepy-fermi-4wk292`, from baseline `9a04713`. Five commits, one per
PR block (PR0–PR4). Not merged, not deployed. One migration applied since:
control 0017 (§3a); content 0003 is still pending and gates the deploy.

## 1. What was done

| PR | Result | Key files |
|---|---|---|
| PR0 | Audit with baseline gate, deltas vs the brief, inventory, touch-map; ADRs 0001–0004 | `docs/plans/2026-10-05-colorlab-knowledge-roadmap.md`, `docs/adr/` |
| PR1 | `kind` + `meta` on `lab_articles` (content 0003 + control 0017, additive); `parseMeta()`; per-kind publish rules; relation resolver; reference check on publish; kind lock; admin editor for links, prerequisites, concepts, sources, author, review date; gated `/api/admin/content-refs`; catalogue-derived camera aliases | `supabase/**/0003*`, `0017*`, `src/lib/lab/{meta,parse,data,admin-store,reference-check}.ts`, `src/lib/content/`, `src/components/lab/admin/meta-editor.tsx` |
| PR2 | `/learn` hub, `/learn/glossary` (generated from `explanations.ts`, both locales), `/learn/<id>`; sources, review date, author, prerequisites, related links on articles; reverse links on recipe, camera and audio pages; 9 pilot drafts (6 reference + 3 experiment frames) that cannot publish until reviewed | `src/app/[locale]/learn/**`, `src/components/content/`, `src/lib/learn/glossary.ts`, `src/lib/lab/pilot-drafts.ts` |
| PR3 | One search service, five adapters, no index; `/api/search`; `/search`; header "all" mode on blog/learn/search; predictive delegates; Wiki grid uses the same ranker; old scorer deleted; 42-query evaluation gate | `src/lib/search/`, `src/app/api/search/route.ts`, `src/app/[locale]/search/page.tsx`, `src/components/site-header.tsx` |
| PR4 | Sitemap adds the camera catalogue and `/learn`, lists Vietnamese-bodied pages once; canonical/hreflang for every index page; article JSON-LD; SearchAction fixed; health probe for the new columns; runbook, editor guide, this report | `src/app/sitemap.ts`, `src/i18n/alternates.ts`, `docs/runbooks/knowledge-search.md`, `docs/guides/editor-knowledge-and-links.md` |

Fixes found on the way, in scope: header no-JS ColorLab form posted to the
launcher; SearchAction pointed at the launcher; header dropdown copy lived in
`locale === 'vi'` ternaries and carried "Press Enter" keyboard hints; the
admin article list drew white text on the paper room's pale selection.

## 2. Test evidence

All commands run on this branch in the session container (Node 22.22, npm 11
for install, offline seed mode — no Supabase credentials).

| Command | Result |
|---|---|
| `npm run verify` (lint → typecheck → test → build) | exit 0; **73 test files, 1721 tests passed** (baseline: 63 / 1557); build generated all routes |
| `npm run tokens:emit` + `git status` | no generated-file drift |
| design audit greps (`CLAUDE.md`) on changed files | no new hit (three pre-existing comment matches) |
| `npm run search:eval` | 42 queries — exact/alias top-1 100%, Recall@5 1.000, MRR 0.979, no-answer queries empty 100% (see caveats in `docs/evaluations/2026-10-05-search-lexical.md`) |
| `/api/search` latency, `next start`, warm, local | n=240, p50 18.0 ms, p95 23.7 ms |
| Initial JS per page vs baseline build | +0.2 to +1.5 KB gzip (budget +30 KB) |
| Playwright, `next start` | `/learn`, `/learn/glossary` (desktop + 390 px), `/search` (all, scoped, empty, Vietnamese), recipe "Learn more", camera "Articles and reference", article with prerequisites/related: 200, no horizontal overflow, no console error except blocked third-party product images |
| Playwright, `next dev` offline admin | opened a pilot knowledge draft; publish refused for undated source; dated it, saved, published; kind select locked; `/vi/learn/white-balance-shift` rendered with breadcrumb, TOC and source; experiment frame publish refused with the placeholder rule |

Database behaviour is proven against PGlite only (`migration-roots.test.ts`
applies both migration roots from zero and checks grants, defaults and
refusals). **No real Supabase project was touched.**

## 3. Not done, and why

- **Content 0003 not applied, nothing deployed, no PR opened.** The content
  project is in a Supabase organisation this environment cannot reach, and
  the deploy must wait for 0003 (§5). Sequence:
  `docs/runbooks/knowledge-search.md`.
- **Pilot content not published.** Six reference drafts need their sources
  re-read and dated; three experiment frames need a real shoot. Review sheet:
  `docs/plans/2026-10-05-pilot-content.md`.
- **Sony Help Guide not re-verified.** `helpguide.sony.net` is denied by this
  environment's network policy; the drafts restate only what `constants.ts`
  already cites.
- **No authenticated draft preview** of an article as readers would see it;
  editors see the editor and, after publishing, the live page.
- **Search labels not reviewed by a person.** Labels and weights were set in
  the same session; the gate guards regressions, not absolute quality.
- **No online-path measurements** (Supabase cache-miss latency, cold starts,
  egress) — no credentials.
- **PR5–PR9** (camera capabilities, photo discovery, hybrid/visual search, Ask
  ColorLab, MCP) — roadmap only, per the brief.
- `npm audit` reports 10 advisories in the existing dependency tree; not
  triaged here.

## 3a. Applied after the report

**Control 0017, production control project `nqeedlgzaewccqztqvik`,
2026-10-05**, at the owner's request ("thực hiện những điều bị chặn").
Runbook step 5, which does not depend on step 3.

- Applied as one transaction with the file's exact SQL, and recorded in
  `supabase_migrations.schema_migrations` as version `0017`, name
  `lab_article_kind_and_meta_rollback_compat` — the same shape `db push`
  gave 0001–0016, so `npm run supabase:migrations -- --target control --apply`
  sees it as applied and runs nothing.
- Verified afterwards: `kind text default 'article'` and `meta jsonb default
  '{}'` present; both checks and the `(kind, status, updated_at)` index
  present; `anon` and `authenticated` hold `select` on `kind` and `meta`, and
  still not on `updated_by`; the three dormant rows read `article` / `{}`.
- Security advisors after the change list nothing on `lab_articles`. The
  three that remain predate this release: `rls_enabled_no_policy` on
  `admin_emails`, `lab_assets`, `proposal_votes` (service-role-only by design),
  a mutable `search_path` on `touch_updated_at`, and leaked-password
  protection off in Auth.

The application never reads this table on the control project, so nothing a
reader sees changed.

## 4. Decisions for the owner

1. `/learn` instead of `/wiki` (ADR 0001) — confirm the name, or pick another
   before any URL is shared.
2. Canonical URL of articles becomes `/vi/blog/<id>` with no hreflang
   (ADR 0004) — confirm this SEO policy.
3. Review and date each pilot source; decide which pilots to publish.
4. Review the 42 evaluation labels; add real reader queries over time.
5. Whether `/learn` should appear in the launcher or header (today it is
   reached from the blog feed, recipe pages, the glossary links and search).

## 5. Risks that remain

- **Deploy before migration breaks the blog loudly.** The read selects the new
  columns; the runbook's health probe (`lab_articles kind/meta (anon) 200`) is
  the go/no-go. Rollback is a code revert; the schema can stay.
- **Lexical search cannot bridge languages.** English queries do not reach
  Vietnamese article bodies except through shared technical terms.
- **Glossary text inherits `explanations.ts`.** Its Picture Profile prose was
  carried over from the original site, not from Sony; the glossary cites the
  help-guide pages for the ranges, not for every sentence.
- **Relations are authored on the article side only.** A recipe or product
  cannot yet declare a relation; it receives reverse links. ADR 0002 records
  when to introduce a relation table.

## 6. Rollback

Revert the deploy; keep the additive columns (old code never selects them).
Unpublish any knowledge page first if it must not appear on the old blog feed.
Details: `docs/runbooks/knowledge-search.md` § Rollback.
