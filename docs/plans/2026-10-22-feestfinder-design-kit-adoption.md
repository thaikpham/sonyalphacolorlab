# What ColorLab takes from FeestFinder and design-kit — survey and roadmap

Status: survey done; owner decided 2026-10-22: sub-project 1 as specified
(editor at `/blog/<id>/edit` in the site chrome, `/admin/blog` redirects to
`/blog`, one block opens at a time), then sub-project 2 next · Owner: thaikpham

Sources: `~/Desktop/design-kit` (the toolkit distilled from the FeestFinder
redesign, 06–20 Oct 2026) and `~/Desktop/FeestFinder` (festfinder-web, Next 16,
plus its Fastify API). Seven read-only surveys, one per area, each cited to
files; this document keeps the conclusions. Sub-project 1 has its own spec:
`docs/superpowers/specs/2026-10-22-edit-in-place-design.md`.

## What the two repos do that ColorLab does not

| Area | FeestFinder / design-kit | ColorLab today |
|---|---|---|
| Admin on the page | A client-only `EditLink` on the public post (`kd/web/blog/edit-link.tsx`), a per-post editor at `/blog/<slug>/edit` in the site chrome (`editor.tsx`), the console only reviews. No in-place text editing anywhere for articles. | Editing only in `/admin/blog`, a list-then-form screen; no link from a page to its editor; `/api/admin/session`, `PATCH /api/admin/articles/[id]` and immediate `revalidateTag` already exist. |
| Measuring | Playwright gates in CI: no sideways scroll at 390/768/1440, axe serious/critical, 44 px targets, CLS ≤ 0.05 and gzipped boot JS per screen with budgets that only go down, first-screen control counts, PR-vs-base screenshots with a `visual-ok` label, a parsed design checklist in the PR body. Measured 2026-10-21: CLS ≤ 0.015, home LCP ≤ 568 ms, 171–210 KB boot JS. | Zero browser gates. Strong source gates instead: `floor.test.ts` (13 px floor, exact per-file baseline), `token-drift`, `fonts`, `messages` parity, privacy tests. No CLS, INP, LCP or bundle number exists in the repo except one (latin-ext removal, LCP 5.1 s → 3.1 s). |
| Loading | `next/dynamic` for every sheet, picker, player and discussion; one `fetchPriority=high` image per page; per-page copy files; fonts < 60 KB; security headers; `vercel.json` region beside the database; RUM vitals + error beacon; uptime workflow; per-build service worker. | No `next/dynamic` at all. `site-header.tsx` (1,764 lines) on every page, importing the whole token source and the `cameras` namespace; six `priority` header marks, no priority on the LCP photograph. Fonts ~50 KB self-hosted (good). `/colorlab`, `/search`, `/blog` dynamic because they read `searchParams`; predictive search is a Function call per keystroke. No headers, region, vitals or uptime check. |
| Reading pages | One column on every public page, article centred at 760 px, facts and FAQ beside the intro, tables fold to cards under 560 px. | Article has a sticky rail (outline, read-first) that flips above the body on phones; `/blog` has a path rail; the recipe page is two columns and on a phone the settings come after the gallery, AI panel and comments; the internal `SCL-…` id is the first chip in the hero. |
| Copy | Titles are nouns with data, buttons verb + object, empty state = one sentence + one action, no "All X" filters, no zero counts. | Rule already in CLAUDE.md; still present: "All" filters, `error.body` two sentences, three-fragment empty state, offer descriptions as tooltips, "Comments (0)". |
| Writing content | A skill that turns a document into researched posts: definition first, 5 facts, 5 FAQ, verified sources (HTTP 200), CC-licensed pictures with credit, official videos checked by oEmbed, JSON-LD graph, content packs in the repo imported without overwriting a human edit, a `blog_check` scorer. | A stricter editorial contract already (ten typed blocks, per-kind publish rules, dated sources, relations by id) but no pipeline: no research scripts, no pack format, no scorer beyond `validateForPublish`, no `.md` twin or `llms.txt`. |
| Process | Measure before drawing (count controls, concepts, taps on a 390 px first screen); two scales (gates = correct, newcomers = understood); owner decisions asked as 2–4 options with consequences and recorded with a date; phase ≤ 1 day = one PR; production checked on an emulated phone after each merge. | `/design-sync` is a grep audit with no numbers; no decision log; no PR template. |

## What is deliberately not taken

- The "Kính đêm" look: 1 px strokes, 11 px uppercase labels, radii 4/8/16,
  turquoise→lime gradient, green/amber status, glow animations, Phosphor icons.
  Each breaks a CLAUDE.md rule (2, 3, 4, motion). Structure transfers, hues do not.
- Markdown bodies and `{en, vi}` pairs in one row. ColorLab's typed blocks
  carry the derived outline, checklist persistence and compare labels; ADR 0004
  fixes bodies to Vietnamese with one canonical URL.
- A review queue, "My posts", any-signed-in-user authorship, "View as"
  impersonation (FeestFinder's own audit marks it broken).
- Cookie sessions on the server (`@supabase/ssr`): would make every public page
  dynamic and widen the control-plane boundary. Admin-ness is decided in the
  browser, which is also FeestFinder's choice.
- A service worker: tag-based freshness with `expire: 0` would be undone by a
  page cache; the 2026-08-17 perf spec already rejected it.
- A 10-minute content-import cron: no job runner here; `push:lab` by hand is
  the operating model.
- `?lang=` routing and per-language route folders: the legacy URL shape and
  next-intl prefixes are load-bearing.

## Sub-projects

### 1. Edit in place — spec written, decisions pending

A "Sửa" link on every content page, the page as its own editor. See the spec.
Phase 1 articles + knowledge; phase 2 recipes (needs a `recipe_translations`
write path first, none exists); phase 3 products (`admin-editor.tsx`, 1,477
lines, and `canManageCategory` per role).

### 2. Browser gates and the PR checklist

Copy design-kit's five specs into `e2e/` with a ColorLab `setup.ts` (routes
derived from the sitemap, visitor role only, `timezoneId: 'UTC'`, web server =
`next build && next start` in seed mode); exempt `.scroll-silent` /
`.scroll-area` in the layout gate; count ParamRow `<summary>` separately in the
first-screen gate; run once with budget 999, commit the measured numbers, only
down from there. Fold the remaining DESIGN.md greps (hex, strokes, deleted
vocabulary, scrollbar CSS, `[Npx]`, `duration-N`) into `src/design/floor.ts`
rules under the existing exact baseline. Add the PR template and the checklist
action (`.github/scripts/design-checklist.mjs`), a `screens` CI job in parallel
with `verify`, `visual.yml` with the `visual-ok` label.

Decisions: motion tokens (three durations in `tokens.ts`) or forbid every
per-component duration outright (recommended, no token); a second Playwright
project against `next dev` to walk `/admin`; which sideways-scroll containers
are sanctioned (compare table, wiki spec table).

### 3. A ColorLab blog-content skill

`.claude/skills/colorlab-blog-content/` targeting the block model: plan
(pillar knowledge page + clusters), research (`check_urls.py`, `commons.py`,
`yt.py` copied from the kit; a `sony_page.py` wrapper so every Help Guide read
yields a dated `SourceRef`), write `Article` objects (not Markdown; TL;DR →
definition-first paragraph; tables 3 × 3–6; menu pairs; no camera value from
memory), meta by real ids, a `src/lib/lab/packs/` layer with a `packs.test.ts`
running `validateForPublish` on every page, `push:lab --pack <name>` inserting
drafts and never overwriting, a Vietnamese report. Plus the AIO half with no
schema change: richer `ArticleStructuredData` (publisher, keywords from
concepts, DefinedTerm per concept on knowledge pages, breadcrumbs), a `.md` twin
per article and `llms.txt` (routes excluded in `proxy.ts`).

Decisions: add `faq` and `facts` blocks to the closed union (needs the same
written justification `embed` carries) or express them with existing blocks;
English bodies stay out (ADR 0004) unless the owner reopens it.

### 4. Performance, measured first

Order of payoff from the survey, all unverified until sub-project 2's perf gate
prints the first table: `next/dynamic` for the header's launcher, account menu,
predictive dropdown and language toggle, and for the recipe page's TweakPanel,
community forms and lightbox; `priority` on the first recipe photograph and the
first gallery image instead of the six header marks; `/colorlab` static with
filtering in a client island (the 2026-08-17 spec's own design); a per-locale
search index fetched once instead of a Function call per keystroke (an ADR, it
touches "one search engine"); route-aware preconnects; security headers in
`next.config.ts`; `vercel.json` region beside the Supabase projects; check
whether `sitemap.ts` is frozen at build; an uptime workflow.

Decisions: a web-vitals beacon (the 2026-08-17 spec lists "no new analytics
product" as a non-goal); Vercel region (which region are the two Supabase
projects in).

### 5. Reading pages and copy

Fold the article rail into the column (read-first under the dek, the outline as
a collapsed "In this article"), one column at the 46 rem measure; decision-order
the recipe page on phones (hero → WB → settings → gallery → offers → community)
and move the `SCL-…` chip out of the hero's first position; the copy fixes
listed above; the sixteen AI smells as a `/design-sync` step with ColorLab's
verdict on each; a dated owner-decision line in CLAUDE.md; the "three states"
rule (loading at final size, empty with an action, error with retry).

Decisions: fold the rail always / on phones only / keep; recipe page one column
or desktop two columns with the phone order fixed; which copy items.

## Suggested order

1 (edit in place) → 2 (gates, so 4 and 5 are measured, and so 1's new pages are
gated) → 4 (performance, numbers in hand) → 5 (reading pages) → 3 (the blog
skill is self-contained and can be slotted anywhere; it needs no gate).
