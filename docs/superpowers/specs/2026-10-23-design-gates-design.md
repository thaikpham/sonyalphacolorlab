# Browser gates and the PR checklist — design

Status: approved in conversation, 2026-10-23 (owner chose the recommended
option on D1–D4) · Owner: thaikpham · Sub-project 2 of
`docs/plans/2026-10-22-feestfinder-design-kit-adoption.md`

## Goal

Every pull request that touches the front is measured before it is merged:
nothing scrolls sideways at 390, 768 or 1440; no serious or critical axe
violation; every tap target is 44px; CLS, boot JS and LCP stay under budgets
that only go down; the first screen of the browse page and a recipe page does
not gain controls; the main screens are compared with the base branch as
pictures; the rest of DESIGN.md's audit runs as a test; and the PR carries a
design checklist with every box ticked. Measured first, then ratcheted —
design-kit's first lesson.

ColorLab has none of this in a browser today. Its source-level gates
(`floor.test.ts` with an exact per-file baseline, `token-drift`, `fonts`,
`messages`, the privacy tests) stay and are the pattern the new source rules
follow.

## Decisions (owner, 2026-10-23)

| # | Question | Decided |
|---|---|---|
| D1 | Motion: 18 `duration-N` classes and 5 raw transition times exist although CLAUDE.md allows only `.animate-fade-in` and the launcher glow | **Forbid per-component durations, no new token.** `floor.ts` counts `duration-N` classes and `transition:` with a time outside `globals.css` into the exact baseline; the count only goes down. CLAUDE.md §Motion stands. |
| D2 | Two bare `overflow-x-auto` tables (camera compare, wiki spec table) under an absolute no-sideways-scroll gate | **Declare them with a named class.** The gate exempts `.scroll-silent`, `.filter-scroll`, `.scroll-area` (DESIGN.md §Scrollbars sanctions them) and a new `.scroll-table`, and is absolute for everything else. Folding the tables to cards is sub-project 5. *Corrected after approval:* the owner chose "declare them with `.scroll-area`", but `camera-compare-view.tsx` documents why that class is wrong there — its `overscroll-behavior: contain` would stop the table handing the scroll back to the page at its last row; the tables contain x only. So the declaration is a new class `.scroll-table` (`overflow-x: auto; overscroll-behavior-x: contain`) in `globals.css` §Scrollbars, which is exactly what both tables already do by utilities, now named. |
| D3 | Admin screens | **Signed-out admin shell only.** The production build in seed mode has no signed-in admin (`requireAdmin()` answers null), so the gates walk `/admin` and `/blog/<id>/edit` signed out; the editors are reviewed by hand, as in sub-project 1. No `next dev` project. |
| D4 | Where the browser gates run | **A separate `screens` CI job, parallel to `verify`.** Locally `npm run test:screens` on demand and `npm run verify:screens` before a PR. `verify` stays the two-minute daily gate. |

Defaults I set, not asked: the PR template and the checklist heading are
Vietnamese (`## Thiết kế`), the owner's language; the parser accepts both
`Thiết kế` and `Design`. Branch protection on `main` is a GitHub setting the
owner enables once the checks have run green on a few PRs (listed under
"Hand-off").

## What ships

### 1. `e2e/` — five Playwright specs, copied from design-kit and filled in

All import only from `e2e/setup.ts`. Web server: `npm run build && npx next
start --port 3100`, seed mode (no Supabase variables), `timezoneId: 'UTC'`,
one worker, `fullyParallel: false`, `retries: CI ? 1 : 0`, trace on failure,
`NEXT_TELEMETRY_DISABLED=1`, `NEXT_PUBLIC_SITE_URL=http://localhost:3100`.
`snapshotPathTemplate` from `CL_SNAPSHOT_DIR` when set (the visual workflow).

`setup.ts`:
- `Role = 'visitor'` only (no seedable sign-in: readers use Google, admins
  email + password + TOTP).
- `ROUTES.visitor`, every template once in each locale (`/x` is English,
  `/vi/x` Vietnamese): `/`, `/colorlab`, `/colorlab?format=pp`,
  `/recipe/:recipe`, `/cameras`, `/cameras/:camera`, `/cameras/compare`,
  `/audio`, `/audio/:audio`, `/blog`, `/blog/:article`, `/blog/setup`,
  `/learn`, `/learn/glossary`, `/search?q=sony`, `/admin` (the sign-in
  screen), `/blog/:article/edit` (the gate, signed out). `/learn/:knowledge`
  is listed but skipped with a logged reason when the sitemap has no knowledge
  page (offline it has none; pilot drafts are drafts).
- `resolve()` replaces `:recipe`, `:camera`, `:audio`, `:article`,
  `:knowledge` with the first matching `<loc>` of `/sitemap.xml`, so no slug is
  typed and a renamed seed row cannot silently drop a route.
- `SCREENS = { list: '/colorlab', detail: '/recipe/:recipe', visual: ['/',
  '/colorlab', '/recipe/:recipe', '/cameras', '/cameras/:camera', '/blog',
  '/blog/:article', '/learn', '/vi/colorlab'] }`.
- `ready()`: `networkidle` (5 s, swallowed) then `document.fonts.ready`.

Specs, and what changes from the kit:
- `layout.spec.ts`: the page-level rule unchanged; the box-level rule skips an
  element inside `.scroll-silent`, `.filter-scroll`, `.scroll-area` or
  `.scroll-table` (D2).
- `wcag.spec.ts`: unchanged (WCAG 2.1 A/AA, serious + critical, 390 and 1440),
  plus FeestFinder's `watch(page)`: a `pageerror`, a console error, or a ≥ 500
  response on any walked route fails the same test.
- `targets.spec.ts`: unchanged (MIN 44, hit-area pseudo-elements counted, the
  three WCAG exemptions); the reported class filter lists ColorLab prefixes
  (`surface`, `btn-`, `chip`, `label`, `meta`).
- `perf.spec.ts`: CLS ≤ 0.05, gzipped boot JS per screen, plus LCP ≤ 2500 ms
  (`PerformanceObserver` `largest-contentful-paint`, retried once); the three
  product-photo hosts (`static.bhphoto.com`, `sony.scene7.com`,
  `www.sony.com.vn`) are fulfilled from one local fixture via `page.route`, so
  the runner's network does not decide LCP. `SCREENS`: `/`, `/colorlab`,
  `/recipe/:recipe`, `/cameras`, `/cameras/:camera`, `/audio`, `/blog`,
  `/blog/:article`, `/learn`, `/vi/colorlab`. Budgets start at 999, are
  measured once in the plan, and are written in with a dated comment.
- `first-screen.spec.ts`: list `/colorlab`, detail `/recipe/:recipe`; counts
  `details.param-row > summary` (ParamRow, mandated by AGENTS.md) separately
  and reports it as its own number; the "≤ 6 screens tall" assertion is kept
  only if the first measurement passes it, else recorded as a budget.
- `visual.spec.ts`: opt-in `CL_VISUAL=1`, three widths, `animations:
  'disabled'`, `maxDiffPixelRatio: 0.01`, plus two region shots (the site
  header; the recipe page's hero and offers) because 1 % of a full page hides a
  changed hero.

`package.json`: `test:screens` = `playwright test`, `test:visual` =
`CL_VISUAL=1 playwright test e2e/visual.spec.ts`, `verify:screens` = `npm run
verify && npm run test:screens`. Dev dependencies `@playwright/test` 1.64.1
and `@axe-core/playwright` 4.14.0. `.gitignore` adds `/test-results/`,
`/playwright-report/`, `/e2e/**/*-snapshots/` (local baselines are per
machine; CI compares PR with base instead).

### 2. CI

- `ci.yml`: the `verify` job loses its duplicate `npm run build` step
  (`verify` already builds). A new `screens` job runs in parallel: checkout,
  Node 24, `npm ci`, `npx playwright install --with-deps chromium`,
  `actions/cache` on `.next/cache` keyed by lockfile + `src/**`, `npm run
  test:screens`, traces uploaded on failure for 7 days. One shard until a run
  exceeds eight minutes.
- `visual.yml`: design-kit's, with `FRONT_PATHS='src public/fonts messages
  packages/colorlab-tokens e2e/visual.spec.ts playwright.config.ts'`,
  `E2E_DIR='.'`, `WEB_DIR='.'`, `CL_VISUAL` / `CL_SNAPSHOT_DIR`. The
  `visual-ok` label is created in the repository. A new push removes it.
- `design-checklist.yml` + `.github/scripts/design-checklist.mjs`:
  design-kit's, `FRONT_PATHS='src public/fonts messages
  packages/colorlab-tokens'`, heading `/^##\s+(Thiết kế|Design)\s*$/m`,
  "no UI change" `/không đổi giao diện|no (ui|visual) change/i`. Unit-tested
  from `scripts/design-checklist.test.ts` (vitest already includes
  `scripts/**/*.test.ts`).

### 3. The PR template

`.github/pull_request_template.md`, Vietnamese, three sections: `## Thay
đổi`, `## Kiểm tra` (`npm run verify`, `npm run test:screens`), `## Thiết kế`
with these boxes, rewritten to ColorLab's own rules:

1. Không đổi giao diện
2. Một `.btn-accent` mỗi màn hình; màu theo token, không hex, không palette
   Tailwind (`floor.test.ts` xanh)
3. Vừa 390 / 768 / 1440, không cuộn ngang ngoài `.scroll-silent` /
   `.filter-scroll` / `.scroll-area` / `.scroll-table`
4. Không dòng giải thích; mọi chuỗi trong `messages/*.json` ở cả hai ngôn ngữ
5. Không stroke, chữ luôn sáng hơn nền, elevation dùng nguyên khối
6. Ba trạng thái: đang tải đúng kích thước, rỗng có việc để làm, lỗi có thử lại
7. Trợ năng: tên đọc được bắt đầu bằng chữ hiển thị, vùng chạm 44px,
   `:focus-visible` thấy được, sheet trả focus
8. Màn mới có trong `e2e/setup.ts`
9. Màn đầu không tăng số chỗ bấm; không tên nội bộ ở màn đầu
10. Ảnh so sánh: không đổi, hoặc đã xem `visual-diff` và gắn `visual-ok`

### 4. `floor.ts` grows six rules (exact per-file baseline, only down)

| Rule | Matches | Allowlist |
|---|---|---|
| `hex` | `#rgb…#rrggbbaa` not inside a longer word, in `src/components` and `src/app` | files DESIGN.md already names: `icon.tsx`, `opengraph-image.tsx`, `manifest.ts`; a line containing `themeColor`; `GoogleMark` |
| `stroke` | `border(-[trblxy])?-\d`, `border-(solid\|white\|black)`, `ring-\d`, `outline-\d` | a line containing `focus-visible:` |
| `deletedVocab` | DESIGN.md's deleted list (`.glass`, `.glass-flat`, `.eyebrow`, `--font-mono`, `--font-display`, `--color-edge`, `.rule`, `y2k-`, `holo-`, `water-`, `cyber-`, `animate-radar-`, `app-glow`, `rainbow-glow-bar`, `y2k-3d-card-`, `animate-float-gentle`, `vfx.css`) | the survivors CLAUDE.md names: `btn-glass`, `glass-raised`, `bg-glass`, `--color-glass` |
| `scrollbarCss` | `scrollbar` or `::-webkit-scrollbar` in any file but `globals.css` | `scroll-silent`, `scroll-area` class names |
| `arbitraryPx` | `\[-?\d+(\.\d+)?px\]` in `.tsx` | none; the count is the budget |
| `duration` | `duration-\d+` classes in `.tsx`; `transition(-duration)?:` with a `ms`/`s` time in `.css` outside `globals.css` | `.animate-fade-in`'s and the launcher's own declarations in `globals.css` (D1) |

The kit's `tokens-ok` per-line escape is not adopted (CLAUDE.md: do not add
an exception); the filename allowlist is the only one. `Rule` becomes a union
of nine; `floor.baseline.json` is regenerated and read for increases only;
`scripts/design-baseline.ts` prints the nine totals. `floor.test.ts`'s probe
list gains one sample per new rule.

### 5. Documents

- `docs/DESIGN_GOVERNANCE.md` (new, short): the gate table (which file
  checks what, where it runs), what a 9 means (gates green · five real people
  do the three tasks · two weeks of real numbers), the PR flow (checklist,
  `visual-ok`, merge on the owner's word), and the only-down budget rule.
- `DESIGN.md` §Audit: each grep that became a `floor.ts` rule says so; the two
  that stay greps (none, after this) are removed.
- `.claude/commands/design-sync.md`: step 2 runs `npx vitest run
  src/design` instead of the greps, and adds a step 0 "measure" (`npm run
  test:screens` prints the first-screen and perf tables).
- `docs/design-tooling.md` "The gate, unchanged" → the three commands.
- `AGENTS.md`: the command block gains `test:screens` and `verify:screens`;
  §Working style gains the tool-discipline bullets that cost FeestFinder a CI
  round each (check `$?` after lint, no pipe in `&&` chains, pin the time
  zone, rebuild before trusting a screenshot, run the whole e2e suite when one
  gate fails).
- `globals.css` §Scrollbars gains `.scroll-table` (D2) and DESIGN.md
  §Scrollbars lists it beside `.scroll-silent` and `.scroll-area`; the two
  tables use it in place of their `overflow-x-auto overscroll-x-contain`
  utilities, their comments kept.

## Not in this sub-project

- Fixing what the gates find beyond what blocks them from going green
  (targets, axe and layout failures get a per-route baseline of their own if
  the first run reports many; the ratchet is the rule, the fix is sub-project
  5). Budgets are measured, not chosen.
- Folding tables to cards, one-column reading pages, copy fixes (sub-project 5).
- RUM web vitals, uptime workflow, security headers (sub-project 4).
- A `/kit` page, the usertest HTML, the design-kit MCP.

## Testing the gates themselves

- `scripts/design-checklist.test.ts`: the parser against a ticked body, an
  untick, the "no UI change" box, a missing section, an English heading.
- `floor.test.ts` probes: one sample per new rule, and one allowlisted sample
  per rule that must not count.
- `src/app/ci.test.ts` (source assertions): `ci.yml` has a `screens` job that
  runs `test:screens` and no second `npm run build` in `verify`;
  `visual.yml` and `design-checklist.yml` name `FRONT_PATHS` that include
  `src`; `playwright.config.ts` pins `timezoneId: 'UTC'`, `workers: 1`, a
  production web server, and no `WEB_SKIP_BUILD`-style cache reuse.
- The first `npm run test:screens` run is the measurement: its printed tables
  become the budgets, in the same PR, with the date.

## Hand-off

After the PR merges and two or three later PRs have run the checks green, the
owner enables branch protection on `main` requiring `verify`, `screens`,
`Design checklist` and `Visual (PR vs base)`, and the `visual-ok` label becomes
the way a visual change is accepted.
