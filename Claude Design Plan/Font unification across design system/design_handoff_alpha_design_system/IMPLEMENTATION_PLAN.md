# Implementation plan

Eight phases, in order. Each is one commit (or one PR) that leaves the app running.
Nothing here is a rewrite: the routes, data layer, i18n and state stay exactly as they
are. What changes is the token file, the global stylesheet, and the class lists in the
components.

Read `DESIGN.md` first — it carries the rules and the reasoning. Every phase ends with
its audit grep coming back empty.

## Phase 0 — land the sources

```bash
cp repo_files/tokens.ts          packages/colorlab-tokens/src/tokens.ts
cp repo_files/globals.css        src/app/globals.css
cp repo_files/DESIGN.md          DESIGN.md
cp repo_files/CLAUDE.md          CLAUDE.md          # merge if one already exists
cp repo_files/vendor-fonts.mjs   scripts/vendor-fonts.mjs
cp repo_files/fonts.test.ts      src/app/fonts.test.ts
mkdir -p .claude/commands && cp repo_files/design-sync.md .claude/commands/design-sync.md
```

Add to `package.json`:

```json
"scripts": {
  "fonts:vendor": "node scripts/vendor-fonts.mjs"
}
```

The app will not build yet — `globals.css` imports a font stylesheet that phase 1
creates, and `layout.tsx` still imports the deleted-in-phase-1 `fonts.ts`. That is
expected; phases 1–2 close it.

## Phase 1 — one font, in git

```bash
npm run fonts:vendor      # → public/fonts/noto-sans/*.woff2 + noto-sans.css
git add public/fonts/noto-sans
```

Then:

1. Delete `src/app/fonts.ts`.
2. In `src/app/layout.tsx`, remove the `notoSans` / `notoSansMono` imports and both
   `.variable` classes from `<html>`. The face now comes from `@font-face` in
   `globals.css`, and `--font-sans` is a literal family name.
3. Do the same in the other three apps (CheeseBooth, Live SOP, Sony Wiki): point each at
   the same vendored directory and the same literal `'Noto Sans'`. This is the actual fix
   for "font không đồng đều" — three mechanisms became one.
4. `npm test -- fonts` must pass (four weights, latin + vietnamese, no `latin-ext`, no
   remote `url()`, no mono in tokens).

Vietnamese is not optional: without that subset the browser falls back mid-word on
diacritics, silently, with no build error.

**Audit**

```bash
rg -n 'next/font|font-mono|ui-monospace|Noto Sans Mono|font-display' src/ packages/
```

## Phase 2 — regenerate tokens

```bash
npm run tokens:emit      # dist/tokens.css + dist/theme.css, synced into each app
npm test                 # the drift test must pass
```

Then delete what the new system does not have:

- `packages/colorlab-tokens/src/vfx.css` — the whole effects layer.
- From `primitives.css`: `.glass`, `.glass-flat`, `.eyebrow`, `.tabular`.
- Any `--color-edge` / `--layout-rule-*` consumer (they no longer exist).

Never hand-edit `dist/` or an app's `vendor/` copy — regenerate.

## Phase 3 — the mechanical passes

Five sweeps across `src/`. Do them one commit each; each is large but shallow.

**3a · type floor.** Every size below 13px goes up to the nearest token at or above the
floor. 68 occurrences.

```bash
rg -n 'text-\[(9|10|11|12)px\]|text-\[0\.(5|6|7)[0-9]*rem\]' src/
```

`text-[9px]` / `text-[10px]` / `text-[0.65rem]` → `text-label` (13px, with
`font-semibold tracking-[0.08em] uppercase`) for eyebrows and column heads, or
`text-meta` (13px) for author/timestamp/count. To make something recede further, drop its
weight or step down the ink ramp — never its size.

**3b · one family.** Delete every `font-mono`. Add `tabular-nums` **only** where the
value is numeric and sits in a column (spec tables, price columns, the compare grid).
Body already sets it.

**3c · palette → tokens.** Meaning first, hue second.

```bash
rg -n '(text|bg|border|ring|from|to|via)-(amber|sky|slate|cyan|purple|emerald|gray|zinc|red|yellow|green)-[0-9]' src/
rg -n '#[0-9a-fA-F]{3,8}' src/components/ src/app/
```

`amber-300` on an admin label → `text-ink-faint` (it was a label, not a warning).
`sky-300` on an image-URL field → `text-ink-faint`. `emerald-300` on save-success →
`text-community`. `amber-300` on an error → `text-danger`. `slate-300` placeholders →
`placeholder:text-ink-faint`. `text-white/90` → `text-ink`. Raw hex like `bg-[#0b0d12]`
(in `admin/page.tsx`) → `bg-void`.

**3d · strokes → elevation.** This is the visual heart of the change.

```bash
rg -n 'border(-[trblxy])?-[0-9]|border-(solid|white|black)|\bring-[0-9]|outline-[0-9]' src/
```

Delete the border. Where it was describing a card, apply `.surface`; a dropdown/dock/
sheet, `.surface-raised`; an input or segmented rut, `.surface-sunken`. Where it was
dividing rows, use `.row-tint` on alternate rows; where it genuinely separated blocks,
`.seam`. `border border-white/20` on the editor's inputs (≈40 call sites in
`admin-editor.tsx` alone) all become `.surface-sunken`.

Keep exactly one stroke: the `:focus-visible` ring.

**3e · radius + deleted vocabulary.**

```bash
rg -n 'rounded-none|radius:\s*0' src/
rg -n 'glass|y2k|holo-|water-|cyber-|radar|app-glow|rainbow-glow|eyebrow|\brule\b' src/
```

`rounded-xl` → `rounded-md` (14) for controls, `rounded-lg` (26) for panels,
`rounded-sm` (12) for tags and rows; `rounded-full` stays only on avatars. Delete every
`.y2k-*`, `.holo-*`, `.water-*`, `.cyber-*`, `.animate-radar-*`, `.app-glow`,
`.rainbow-glow-bar`, `.y2k-3d-card-*`, `.animate-float-gentle` and the state that drove
them.

## Phase 4 — screens, in dependency order

Header first (every screen contains it), launcher second (it is the signature), then the
four content screens. Open the matching section of `design_refs/Alpha Screens.dc.html`
side by side while working.

1. **`src/components/site-header.tsx`** — ref §06. Glass bar, no bottom border, sunken
   search that grows to 520px when open, account menu at elevation 2 anchored under the
   avatar and overlapping the bar edge, rows 44px. 1393 lines; the three states are all
   there already — this is a class-list pass, not a rewrite. Drop emoji from the category
   labels (`📦 📷 🔍 🎙️ 🎧 🔊`) as you touch them.
2. **`src/components/launcher-grid.tsx`** — ref `Ecosystem Launcher.dc.html`. Squircle
   22.4%, the two conic glow layers, 132px desktop tiles in one row, 76px two-column
   mobile with the glass dock. Respect `prefers-reduced-motion` (the global rule already
   stops the rotation).
3. **Recipe gallery + detail** (`src/app/[locale]/colorlab/…`) — refs §01, §02.
   Cards `.surface`, settings table as tinted rows, `.seam` above the contributor block,
   chips 13px on white 8%.
4. **Cameras list + compare** (`src/app/[locale]/cameras/…`) — refs §03, §04. Selected
   row = accent-tinted fill, never a border. `specsMissing` renders an em dash. Better
   value in `accent-400`/600; equal values stay `ink`. Facet counts only where the query
   supplies one.
5. **`src/components/admin/admin-editor.tsx`** — ref §05. Sunken fields at 44px, labels
   at 13px `ink-faint` keeping their existing strings, validation as hint colour
   `text-danger` rather than a red border, queue cards radius 20 with the active item
   violet-tinted.

## Phase 5 — scrollbars

The global rules already ship in `globals.css`. The work is removing the local ones:

```bash
rg -n 'scrollbar|::-webkit-scrollbar' src/ | rg -v 'scroll-silent|scroll-area'
```

Delete per-component scrollbar CSS. Rails that must never advertise overflow get
`.scroll-silent` (filter row, photo strip, launcher rail); scrolling regions inside a
panel get `.scroll-area`. Verify wheel, trackpad, keyboard (`Home`/`End`/arrows) and
touch scrolling all still work — the indicator is what's hidden, not the scrolling.

## Phase 6 — contrast pass

Grep cannot see this one; it is the original defect.

Walk every screen and find text that is not `ink`, `ink-muted`, `ink-faint`, pure white
on a tinted field, or an `accent-400`+ step. Any dark-on-dark pair is a bug, not a mood.
On a tinted accent field: body text pure white, label at step 200–300 of that same ramp.

Check the four signal colours against the glass films they actually sit on, not against
`void`.

## Phase 7 — verify

```bash
npm run lint
npm test                      # token drift + fonts.test.ts
```

Then re-run every command in the **Audit** section of `DESIGN.md` and confirm each comes
back empty. Finally compare each rebuilt screen against its reference: the reference
carries real repo data, so if a screen cannot render that content, the data mapping is
wrong — not the design.

## Keeping it

`/design-sync` (installed in phase 0) re-reads `DESIGN.md` + `tokens.ts`, runs the whole
audit, reports violations worst-first, and fixes them with the smallest diff. Run it
before a release, and after any branch that added UI:

```bash
cd path/to/ColorLab-2.0
claude
› /design-sync
```

`CLAUDE.md` keeps the six rules in context for every session, so new UI lands on the
system instead of drifting off it.
