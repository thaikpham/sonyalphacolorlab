# Performance, measured first — zod out of the browser (sub-project 4)

Status: approved by the owner 2026-10-28 ("chỉ sửa chỗ số đo chỉ ra", then the
design below, "làm luôn tới merge"). Roadmap:
`docs/plans/2026-10-22-feestfinder-design-kit-adoption.md` §4.

## What the measurements say

Browser gates on main `43d7585` (seed build, phone, 4× CPU, 4G): LCP 0.4–1.4 s
on every screen against 2.5 s, CLS ≤ 0.017. Live (2026-10-26, from Vietnam):
TTFB 0.2–0.4 s; functions run in `sin1`. Boot JS is ~175–190 KB everywhere
except `/cameras`, `/audio` (250 KB) and `/blog`, `/learn` (247 KB).

The difference is one chunk, **zod** (63 KB gz, 283 KB raw), reaching the
browser through two value imports:

- `src/components/camera-wiki-view.tsx` → `MAX_QUERY` from
  `src/lib/search/types.ts`, which also holds the request schema;
- `src/components/lab/feed-admin-row.tsx` → `lab/articles.ts` → `lab/meta.ts`
  → `RECIPE_ID_TRANSITION_RE` from `src/lib/camera/schema.ts`.

## Changes

1. **Zod-free leaf modules.** Constants and regexes client code needs move to
   modules that import no zod; the schema modules re-export them so no server
   caller changes. `RECIPE_ID_RE`, `RECIPE_ID_TRANSITION_RE`, `RECIPE_TAG_RE`
   → `src/lib/camera/ids.ts`; the search limits and kind/scope lists →
   `src/lib/search/limits.ts`. Any further path the guard (2) finds is fixed
   the same way.
2. **Guard.** `src/app/client-bundle.test.ts` walks the static import graph
   (value imports only; `import type` and `export type` erase) from every file
   whose first statement is `'use client'`, resolving `@/` and relative
   specifiers, and fails naming the chain when it reaches `zod`. Probed with a
   fixture so it cannot pass blind.
3. **Budgets.** `e2e/perf.spec.ts` JS budgets for `/cameras`, `/audio`,
   `/blog`, `/learn` are re-measured and lowered in the same PR, dated.
4. **Security headers** in `next.config.ts` `headers()` for every path:
   `Strict-Transport-Security: max-age=63072000; includeSubDomains`,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy:
   strict-origin-when-cross-origin`, `Permissions-Policy: camera=(),
   microphone=(), geolocation=()`, `X-Frame-Options: DENY`. No CSP: a wrong one
   breaks pages silently, and that is its own project. Pinned by a unit test
   on the config.

## Not done, and why

- `/colorlab` and `/colorlab/[situation]` stay dynamic: they read the
  `colorlab-camera` cookie by design (ADR 0006); 0.3 s against 0.2 s cached is
  not worth reversing it. `/blog` (filter in `searchParams`) and `/search` are
  dynamic for the same kind of reason.
- The 1.5 s first answer from `/api/search/predictive` was one cold request;
  the next were 0.25–0.3 s. No change without more evidence.
- The rest of the survey list (lazy header pieces, a search index file,
  preconnects, region, beacon, uptime) has no measurement behind it.

## Success

`npm test` (guard included), typecheck, lint green; `npm run test:screens`
green with the four JS budgets lowered; live headers present after deploy.
