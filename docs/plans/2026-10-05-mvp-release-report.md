# Knowledge + search MVP — release report

Brief: `Sony_ColorLab_Claude_Code_Handoff.md` (2026-10-05). Branch
`claude/sleepy-fermi-4wk292`, from baseline `9a04713`. Five commits, one per
PR block (PR0–PR4). Not merged, not deployed. Both migrations applied since:
control 0017 (§3a) and content 0003 (by hand in the content SQL editor,
2026-10-05).

## 1. What was done

| PR | Result | Key files |
|---|---|---|
| PR0 | Audit with baseline gate, deltas vs the brief, inventory, touch-map; ADRs 0001–0004 | `docs/plans/2026-10-05-colorlab-knowledge-roadmap.md`, `docs/adr/` |
| PR1 | `kind` + `meta` on `lab_articles` (content 0003 + control 0017, additive); `parseMeta()`; per-kind publish rules; relation resolver; reference check on publish; kind lock; admin editor for links, prerequisites, concepts, sources, author, review date; gated `/api/admin/content-refs`; catalogue-derived camera aliases | `supabase/**/0003*`, `0017*`, `src/lib/lab/{meta,parse,data,admin-store,reference-check}.ts`, `src/lib/content/`, `src/components/lab/admin/meta-editor.tsx` |
| PR2 | `/learn` hub, `/learn/glossary` (generated from `explanations.ts`, both locales), `/learn/<id>`; sources, review date, author, prerequisites, related links on articles; reverse links on recipe, camera and audio pages; 9 pilot drafts (6 reference + 3 experiment frames) that cannot publish until reviewed | `src/app/[locale]/learn/**`, `src/components/content/`, `src/lib/learn/glossary.ts`, `src/lib/lab/pilot-drafts.ts` |
| PR3 | One search service, five adapters, no index; `/api/search`; `/search`; header "all" mode on blog/learn/search; predictive delegates; Wiki grid uses the same ranker; old scorer deleted; 42-query evaluation gate | `src/lib/search/`, `src/app/api/search/route.ts`, `src/app/[locale]/search/page.tsx`, `src/components/site-header.tsx` |
| PR4 | Sitemap adds the camera catalogue and `/learn`, lists Vietnamese-bodied pages once; canonical/hreflang for every index page; article JSON-LD; SearchAction fixed; health probe for the new columns; runbook, editor guide, this report | `src/app/sitemap.ts`, `src/i18n/alternates.ts`, `docs/runbooks/knowledge-search.md`, `docs/guides/editor-knowledge-and-links.md` |
| PR5 | Camera capabilities (ADR 0005): keys derived from `constants.ts`; evidence for ILCE-7M4, ILCE-7CM2, ILCE-6700, ILCE-7M5 quoted from the raw Help Guide topics and confirmed by `npm run capabilities:check`; four-verdict engine with mode, firmware, range and stand-in rules; compatibility on recipe pages, colour settings on camera pages; `resolveCamera` for model codes, marketing and EXIF-style names | `src/lib/cameras/capabilities/`, `scripts/check-camera-evidence.ts`, `data/camera-evidence.checks.json`, `src/components/compat/` |

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

- **Content 0003 not applied from here.** The content project is in a
  Supabase organisation this environment cannot reach. It was applied by hand
  in the content SQL editor on 2026-10-05, and the branch went up as PR #7.
  Sequence: `docs/runbooks/knowledge-search.md`.
- **Pilot content not published.** The six reference drafts now pass the
  publish rules — their sources were re-read and dated on 2026-10-05, once the
  owner opened `helpguide.sony.net` (two claims corrected) — and wait on the
  owner's choice in `/admin/blog`. The three experiment frames need a real
  shoot. Review sheet: `docs/plans/2026-10-05-pilot-content.md`.
- **No authenticated draft preview** of an article as readers would see it;
  editors see the editor and, after publishing, the live page.
- **Search labels not reviewed by a person.** Labels and weights were set in
  the same session; the gate guards regressions, not absolute quality.
- **No online-path measurements** (Supabase cache-miss latency, cold starts,
  egress) — no credentials.
- **PR6–PR9** (photo discovery, hybrid/visual search, Ask ColorLab, MCP) —
  roadmap. PR5 was started at the owner's "tiếp tục thực hiện kế hoạch".
- **PR5 follow-ups**, each a `sync-camera-constants` change: ILCE-7M5's `FL2` /
  `FL3` Looks (needs `constants.ts` and a `creative_look` enum value in both
  migration roots); `BT.2020` / `709` only with HLG gammas, which Sony's generic
  guide states and `recipeSchema` does not enforce (the one HLG recipe
  complies); Black Gamma fixed at 0 under HLG, stated per body and not modelled.
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

## 3b. PR5 — camera capabilities

Checked against the live Help Guide on 2026-10-05 (`npm run capabilities:check`,
12 topics, every literal found). Verdicts for the 83 seed recipes:

| Body | Stills: verified / incompatible / unknown | Movie: verified / incompatible / unknown |
|---|---|---|
| ILCE-7M4 | 18 / 0 / 65 | 3 / 37 / 43 |
| ILCE-7CM2 | 18 / 1 / 64 | 3 / 38 / 42 |
| ILCE-6700 | 18 / 1 / 64 | 3 / 38 / 42 |
| ILCE-7M5 | 15 / 46 / 22 | 0 / 83 / 0 |

What the pages establish, and the engine now says:

- **ILCE-7M5 has no Color Depth item** in Picture Profile — its item list
  goes Color Phase → Detail, and its full guide never names one. Every PP
  recipe sets Color Depth, so every PP recipe is incompatible there.
- **S-Log2, ITU709(800%) and S-Gamut** are on ILCE-7M4 and absent from the
  other three bodies' lists; **709tone** is on none of the four.
- **Sharpness Range "cannot be adjusted" in movie mode** on all four, so every
  Creative Look recipe is incompatible for movies.
- **No Kelvin range and no WB shift limit or step** in any of the four full
  guides — the main reason most recipes stay `unknown`. That is the honest
  state: `constants.ts`' 2500–9900 K and 0.25 step are global and from the
  dataset, not per body.

Evidence: `capabilities` tests (engine, page reader, evidence-vs-checks, real
recipes, feature summary, page pins), `resolveCamera` tests; Playwright on
`next dev`: recipe page (CL and PP, 1400 and 390 px) and camera pages
(ILCE-7M4, ILCE-7M5, 1400 and 390 px), no horizontal overflow, no console
error; a body without evidence (ILCE-7M3) renders no section.

## 4. Decisions for the owner

Settled by the owner on 2026-10-05:

1. `/learn` instead of `/wiki` (ADR 0001) — **confirmed**.
2. Canonical URL of articles is `/vi/blog/<id>` with no hreflang
   (ADR 0004) — **confirmed**.
3. The 42 evaluation labels — **approved**; add real reader queries over time.
4. `/learn` in navigation — **yes**: an Articles / Learn switch on the header
   rail of the blog and `/learn` pages, from `sm` up (the phone rail has no
   room; there the feed heading carries the link).

Still open: which pilot drafts to publish, after their sources are dated.

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
