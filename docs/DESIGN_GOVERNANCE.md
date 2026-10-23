# Design governance — what gates a change, and what a 9 means

## The gates

| Gate | Where it runs | What fails it |
|---|---|---|
| `src/design/floor.test.ts` | `npm test`, `verify` | a count in `floor.baseline.json` went up: type under 13px, a second font, a Tailwind palette colour, a hex in a component, a stroke outside `:focus-visible`, deleted vocabulary, scrollbar CSS outside `globals.css`, an arbitrary `[Npx]`, a duration of its own — nine rules in all |
| `token-drift`, `fonts`, `messages` tests | `npm test` | a generated token copy out of step, a missing Vietnamese subset, a string in one locale only, a namespace shipped unread |
| `e2e/layout.spec.ts` | `test:screens`, CI `screens` | a page wider than 390 / 768 / 1440, or a box scrolling sideways outside `.scroll-silent` / `.filter-scroll` / `.scroll-area` / `.scroll-table` |
| `e2e/wcag.spec.ts` | same | a serious or critical WCAG 2.1 A/AA violation, counted one line per violating node, over the route's count at that width in `e2e/budgets.json` (keyed `<path> · phone` or `<path> · desktop`); an uncaught error, a console error, a 5xx |
| `e2e/targets.spec.ts` | same | a tap target under 44 × 44 px at 390, over the route's count in `e2e/budgets.json` |
| `e2e/perf.spec.ts` | same | CLS > 0.05, LCP > 2.5 s, or boot JS over the screen's budget, on a 4× CPU / 4G phone |
| `e2e/first-screen.spec.ts` | same | more controls in sight at 390×844 on `/colorlab` or a recipe page than that screen's budget, or a recipe page taller than its measured screen count. A recipe's own parameter rows (`<details class="param-row">`) are logged, not budgeted — there is no row ceiling, because bringing more settings onto the first screen is the point, not a regression |
| `Visual (PR vs base)` | every PR touching `src`, `messages`, `public/fonts`, `packages/colorlab-tokens`, `playwright.config.ts` or `e2e/visual.spec.ts` | a screen differs from the base branch and the PR has no `visual-ok` label |
| `Visual (stale label)` | a new push to the same PR | removes a `visual-ok` label that was on the PR, so an old approval never covers new screens |
| `Design checklist` workflow | PRs touching `src`, `messages`, `public/fonts`, `packages/colorlab-tokens` | a box in "## Thiết kế" left unticked, unless "Không đổi giao diện" is ticked |

Budgets only go down. A number in `e2e/budgets.json`, `e2e/perf.spec.ts`,
`e2e/first-screen.spec.ts` or `src/design/floor.baseline.json` is what was
measured on the date beside it; lower it in the same PR as the change that
earns it; never raise it. A gate that blocks a good change is fixed in that
PR, with the reason in the commit.

## What a 9 means

Three columns, none of which replaces another (design-kit, FeestFinder
2026-10-18: 8.5 by the gates became 7 when a newcomer was measured):

1. Every gate above is green.
2. Five real people each do three tasks without help: find a recipe for their
   own body and reach its settings table; compare two cameras in the Wiki and
   say which they would buy; read a learn page and say what the parameter
   does. Timed, on their own phone.
3. Two weeks of real numbers after the change (Vercel Analytics / Web Vitals
   p75: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1) no worse than before.

## A pull request

Branch → code, tests and docs in one commit → `npm run verify`, and
`npm run test:screens` for anything on screen → PR from the template with the
checklist ticked truthfully → `Visual` red is normal for an intended change:
open the `visual-diff` artifact, look, add the `visual-ok` label → merge on
the owner's word → the merge builds production (Vercel) → look at the live
page on a phone.
