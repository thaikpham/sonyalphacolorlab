# Knowledge + search roadmap — PR0 audit and MVP plan

Brief: `Sony_ColorLab_Claude_Code_Handoff.md` (2026-10-05, owner Thái Phạm).
Scope of this branch: **PR0–PR4** (audit, content foundation, knowledge pilot
and cross-links, unified lexical search, SEO and release documents). PR5–PR9
(camera capabilities, photo discovery, hybrid/visual search, Ask ColorLab, MCP)
are roadmap only and are not started here.

Decisions are recorded as ADRs under `docs/adr/`. Where this document and an
ADR disagree, the ADR wins.

## 1. Baseline

| Item | Value |
|---|---|
| HEAD at start | `9a0471375258e301141718dce94141176cf0cecf` — identical to the brief's baseline SHA |
| Branch | `claude/sleepy-fermi-4wk292`, working tree clean, nothing uncommitted from anyone else |
| Node / npm locally | 22.22.0 / 10.9.4 (CI runs Node 24) |
| `npm ci` with npm 10 | **fails**: `Missing: @swc/helpers@0.5.23 from lock file`. `npx npm@11 ci` installs cleanly from the same lockfile, which is what CI's Node 24 ships. The lockfile was not regenerated. |
| `npm audit` | 10 advisories reported by npm 11 (2 moderate, 7 high, 1 critical). Not triaged here — outside this brief. |
| Next / React / TS | `next ^16.3.0`, `react 19.2.4`, `typescript ^6.0.3`, `next-intl ^4.13.4`, `zod ^4.4.3` |
| Cache model | Previous model (`unstable_cache` + `revalidateTag`); `cacheComponents` is **not** enabled |

### Baseline gate (credential-free, seed mode)

| Step | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 63 files, **1557 / 1557** passed |
| `npm run build` | exit 0 — `check:supabase-env` reports offline (valid outside production); 463 pages generated |

No pre-existing failures. Anything red after this branch is this branch's.

## 2. Delta against the brief's snapshot

| Brief said | Found on HEAD | Consequence |
|---|---|---|
| `/wiki`, `/wiki/[...slug]` "if no conflict" | **Conflict.** "Sony Wiki" is the shipped name of the camera/audio catalogue: the launcher tile `wiki` → `/cameras` (`src/lib/ecosystem.ts`), the product editor is `/admin/wiki`, `WIKI_DIVISIONS`, and `isWiki` in `site-header.tsx` means "catalogue". A second thing called wiki makes "the wiki" ambiguous in UI, support and code. | Knowledge hub ships at **`/learn`** — see ADR 0001. |
| Public feed shows 2 articles | The compiled seed (`src/lib/lab/articles.ts`) has 3; production reads `lab_articles` | Nothing hardcodes a count. |
| 83 recipes on the public site | `data/recipes.seed.json` has 83 | Same. |
| `sitemap.ts` lacks the camera catalogue | Confirmed: no `/cameras`, no `/cameras/<id>` | Fixed in PR4. |
| — | `SiteStructuredData` declares `SearchAction` at `/?q=` — the root is the launcher and does not search | Fixed in PR4 → `/search?q=`. |
| — | Header no-JS search form posts ColorLab queries to `/` (the launcher) | Fixed in PR3 → `/colorlab`. |
| — | Header predictive dropdown renders copy through `locale === 'vi' ? … : …` ternaries (Rule 3 violation, invisible to the parity test) | Moved into `messages/*.json` in PR3. |
| — | `/blog/[id]` has no canonical; the sitemap lists `/blog/x` and `/vi/blog/x` as language alternates although the body is Vietnamese in both | Policy in ADR 0004, applied in PR4. |
| — | No authenticated draft preview for articles (editor only) | Not added in the MVP; recorded as outstanding. |
| Sony Help Guide is the evidence for claims | `helpguide.sony.net` is **denied by this environment's network policy** (curl: CONNECT 403; fetch: egress blocked) | Pilot drafts only restate claims already cited in `src/lib/camera/constants.ts`; every pilot is a draft with a "verify before publishing" list. |

## 3. Inventory

### 3.1 Data sources

| Surface | Reader | Online source | Offline source | Cache |
|---|---|---|---|---|
| Recipes | `src/lib/recipes/source.ts` | content `recipes` + `recipe_translations` (anon) | `data/recipes.seed.json`, `translations.seed.json`; dev store in development | `catalogueCache` (60s, tag `catalogue`) |
| Recipe photos | `imagesFor()` | `public/recipes/` (vendored) | same | static CDN |
| Cameras / lenses / accessories | `src/lib/cameras/data.ts` | content `sony_cameras` (`category <> 'audio'`) | `data/sony-cameras.seed.json` | `catalogueCache` |
| Audio | `src/lib/audio/data.ts` | content `sony_cameras` (`category = 'audio'`) | `data/sony-audio.seed.json` | `catalogueCache` |
| Articles | `src/lib/lab/data.ts` | content `lab_articles`, `status = 'published'` (anon, named columns) | `ARTICLES` (compiled) or `data/lab-articles.dev.json` in development | `unstable_cache` 3600s, tag `lab-articles` |
| Article media | `src/lib/lab/media.ts` | public `lab` bucket, 3 WebP rungs | — | CDN |

Every online read goes through `contentOrOfflineSeed()`: configuration decides
the source; an online failure throws `ContentUnavailableError`.

### 3.2 Tables touched by this work (content plane)

`lab_articles(id, status, topic, level, archetype, read, title, dek, blocks,
created_at, updated_at, updated_by)` — RLS `status = 'published'` for anon and
authenticated; table-level `revoke all` then a column grant that excludes
`updated_by`. `lab_assets` has `on delete restrict` to `lab_articles` and no
browser grant at all. The control root carries a dormant copy of both
(`0013`–`0015`) for rollback; `scripts/supabase/tables.ts` is the column list
export/import/verify share.

### 3.3 Write paths and roles

- Articles: `/api/admin/articles` (`GET`, `POST`) and `/api/admin/articles/[id]`
  (`GET`, `PATCH`, `DELETE`), all behind `adminGate()` (control plane,
  `requireAdmin`, MFA ratchet) and `contentAdminWritesFrozen()`. Any role
  (`super`, `di`, `pe`) may edit articles; products split by category.
- Publish validation: `validateArticleShape()` only on `published`.
- Every write calls `revalidateTag(LAB_TAG, IMMEDIATE)`.
- Asset lifecycle: publish copies variants to the public bucket *before* the
  row turns visible; unpublish flips the row first, then removes public copies.

### 3.4 Route render modes (baseline build)

Dynamic (`ƒ`): `/[locale]/blog`, `/[locale]/colorlab`, `/[locale]/cameras/compare`,
every admin route, every API route. Prerendered with `generateStaticParams`:
`/[locale]/recipe/[slug]`, `/[locale]/cameras/[id]`, `/[locale]/audio/[id]`,
`/[locale]/blog/[id]` (`dynamicParams = true`, `revalidate = 3600`).
`/sitemap.xml` revalidates every 60s.

### 3.5 Search (before)

`/api/search/predictive?q&mode=wiki|colorlab&locale` — scores the whole
catalogue with `calculateMatchScore()` (accent-insensitive, Levenshtein ≤ 2,
a hand-written alias table) and returns 5 suggestions, `Cache-Control:
no-store`. Articles are not searchable anywhere; the blog renders no header
search on purpose (a box there would have searched recipes).

## 4. MVP plan and touch-map

| PR | What lands | Main files |
|---|---|---|
| PR0 | This audit, ADRs 0001–0004 | `docs/plans/…`, `docs/adr/…` |
| PR1 | `kind` + `meta` on `lab_articles` (additive, both roots); typed, parsed metadata (sources, related entities, prerequisites, concepts, public author, reviewed date, knowledge section); kind-aware publish validation; relation resolver that hides unpublished/unknown targets; admin fields | `supabase/content/migrations/0003_…`, `supabase/migrations/0017_…`, `src/lib/lab/{types,meta,parse,data,admin-store,dev-store,articles}.ts`, `src/lib/content/*`, `src/components/lab/admin/*`, `scripts/supabase/tables.ts`, `scripts/push-lab-articles.ts`, `messages/*.json` |
| PR2 | `/learn`, `/learn/glossary` (generated from `explanations.ts`), `/learn/[id]`; sources, review date, prerequisites and related sections on blog and learn pages; reverse links on recipe and camera pages; 6 reference drafts + 3 experiment frames (drafts only) | `src/app/[locale]/learn/**`, `src/components/content/*`, `src/lib/learn/*`, `src/lib/lab/pilot-drafts.ts` |
| PR3 | One search service with five adapters (recipes, products, audio, articles, knowledge + glossary); `/api/search`; `/search` page; header search in "all" mode on blog/learn/search; predictive route delegates to the service; 30+ query evaluation set and a regression test on its metrics; unpublish regression | `src/lib/search/**`, `src/app/api/search/route.ts`, `src/app/[locale]/search/page.tsx`, `src/components/site-header.tsx` |
| PR4 | Sitemap (cameras, learn, glossary), canonical/hreflang per ADR 0004, JSON-LD (BlogPosting/TechArticle/BreadcrumbList), `noindex` on `/search`, fixed `SearchAction`; runbook, editor guide, release checklist, final report | `src/app/sitemap.ts`, `src/components/structured-data.tsx`, page `generateMetadata`s, `docs/runbooks/knowledge-search.md`, `docs/guides/…`, `docs/evaluations/…` |

## 5. What this branch will not do

- Apply any migration to a real project, publish draft content, enable a paid
  service, merge, or deploy.
- Add Fumadocs, Keystatic, Payload, Tina, Giscus, MDX or a second compare
  slider (ADR 0001).
- Add vectors, embeddings, RAG, photo upload or MCP endpoints.
- Re-verify Sony Help Guide pages (network policy, §2).
