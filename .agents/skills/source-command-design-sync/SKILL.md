---
name: "source-command-design-sync"
description: "Re-read the design tokens and audit the working tree against them"
---

# source-command-design-sync

Use this skill when the user asks to run the migrated source command `design-sync`.

## Command Template

Bring this repo back in line with the design system. Do not ask questions
first — run the audit, then report.

## 1. Load the system

Read, in this order, and hold the values in context for the rest of the session:

1. `DESIGN.md` — the rules and the reasoning.
2. `packages/colorlab-tokens/src/tokens.ts` — the values. This file is the only
   source of truth; a generated `dist/` or `vendor/` copy that disagrees with
   it is stale, not authoritative.
3. `public/fonts/noto-sans/noto-sans.css` — confirm the four weights and both
   subsets (latin, vietnamese) are present on disk and committed.

## 2. Audit

Run every command in the **Audit** section of `DESIGN.md` against `src/`.
For each hit, record: file, line, the offending value, and the token that
should replace it.

Then check the five things grep cannot see:

- **Contrast** — any text colour that is not `ink`, `ink-muted`, `ink-faint`,
  pure white on a tinted field, or an `accent-400`+ step. Dark type on a dark
  field is the defect this system exists to remove; it outranks every other
  finding.
- **Hue** — any red, yellow or green in a new value. Those are competitor
  signatures (Canon, Nikon, Fuji) and are out regardless of contrast.
- **Strokes** — a `border`, `ring` or `outline` doing the job elevation should
  do. Only `:focus-visible` may draw a line.
- **Elevation** — a level used in pieces (a level-1 shadow under a level-3
  blur, a film without its specular highlight). Levels are whole recipes.
- **Scroll** — scrollbar CSS anywhere but `globals.css`, a hidden scrollbar
  that also removed keyboard scrolling, or a scroll container missing
  `.scroll-area` and chaining its overscroll to the page.

## 3. Report, then fix

Print a table of violations grouped by file, worst first — contrast failures,
then type below the floor, then second-typeface hits, then everything else.
Give a one-line total: `N violations across M files`.

Then fix them, smallest diff possible:

- Sizes → the nearest token **at or above** the floor, never below.
- `font-mono` → delete the class; add `tabular-nums` only if the value is
  numeric and sits in a column.
- Palette colours → the token whose role matches the meaning, not the one
  whose hue is closest.
- Borders → delete, and let `.surface` / `.surface-raised` carry the edge.
- Deleted vocabulary → remove the class and let elevation carry the structure.

Do not restyle anything that already passes, do not introduce a new token, and
do not touch `dist/` or `vendor/` by hand — run `npm run tokens:emit`.

## 4. Verify

`npm run lint` · `npm test` (the token drift test and `fonts.test.ts` must
pass) · re-run the audit and confirm it comes back empty.
