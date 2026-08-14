@AGENTS.md

# CLAUDE.md — Sony Alpha ecosystem

Applies to Alpha ColorLab, Sony Wiki (cameras + audio), CheeseBooth and Live SOP.
Read `DESIGN.md` for the reasoning; `packages/colorlab-tokens/src/tokens.ts` holds the
values and is the only source of truth. Run `/design-sync` to audit the tree.

## The six rules

1. **One family.** `'Noto Sans'`, self-hosted from `public/fonts/noto-sans/`, weights
   400/500/600/800. No mono, no display face, no `next/font`, no CDN. Numbers get
   `tabular-nums`, never a second typeface.
2. **13px floor.** `--text-meta` is the smallest type in the ecosystem. Never write
   `text-[9px]`, `text-[10px]`, `text-[0.65rem]`. To make something recede, drop its
   weight or step down the ink ramp — never its size.
3. **Dark only.** Ground `void` #07080B. One blue-purple accent. No red, no yellow, no
   green in any new value: those are Canon, Nikon and Fuji signatures.
4. **No strokes.** Depth is translucency + blur + drop shadow + the 1px specular
   highlight (`--elevation-spec`). `border`, `ring` and `outline` are banned except on
   `:focus-visible`.
5. **Text is always lighter than what it sits on.** On a tinted accent field, body text
   is pure white and its label is step 200–300 of that ramp. Dark type on a dark field is
   a bug.
6. **Scrollbars are invisible until hovered** and never occupy layout. The rules live in
   `globals.css` only — never write per-component scrollbar CSS.

## Type scale — a size outside it is a bug

`text-display-xl` 56/800 · `text-display` 42/800 · `text-title-1` 32/800 ·
`text-title-2` 25/800 · `text-title-3` 21/600 · `text-body-lg` 18/400 ·
**`text-body` 15/400 — the default for all reading content** · `text-body-sm` 14/400 ·
`text-label` 13/600/0.08em uppercase (`.label`) · `text-meta` 13/400 (`.meta`).

Tracking: −0.02em at 21px and above, 0 for body, 0.08em for labels. Uppercase only in
`.label`, never over three words — Vietnamese diacritics need the ascender room.

## Colour

Surfaces: `void` #07080B (the only opaque one) · `glass` white 5% · `glass-raised`
white 8.5% · `sunken` black 35%. There is no `edge` token.

Ink: `ink` #F4F5F8 · `ink-muted` #C3C7D2 · `ink-faint` #969CAA. No fourth step.

Accent: **400 #8A9CFF for text and icons**, 500 #5C74F0 for a fill, 600 pressed, 900 a
tinted field. Prefer a ramp step over an ad-hoc `color-mix()`.

Signals classify content only, never decoration, never more than two in a row:
`community` cyan, `proposal` violet, `ai` orchid, `danger` rose.

Never use `amber-*`, `sky-*`, `slate-*`, `cyan-*`, `purple-*`, `emerald-*`, `gray-*`,
`zinc-*`, or a raw hex in a component.

## Surfaces

Use an elevation **whole** — a level-1 shadow under a level-3 blur is what made the old
glass read as arbitrary.

- `.surface` — panel, card. White 5%, `blur(30px) saturate(1.35)`, elevation 1, radius 26.
- `.surface-raised` — dropdown, dock, sheet. White 8.5%, `blur(40px)`, elevation 2.
- `.surface-sunken` — input, segmented rut. Black 35%, inset shadow, radius 14.
- `.row-tint` — alternate table/list rows at white 4%. No dividing lines.
- `.seam` — where a divider genuinely helps: 1px of light fading out at both ends.
- `.btn-accent` / `.btn-glass` — the two button treatments, both 44px min-height.

Radii: sm 12 (tag, row) · md 14 (button, input) · lg 26 (panel) · xl 32 (largest slab).
`rounded-full` only on avatars. Spacing on a 4px grid. Touch targets ≥ 44px.

## Motion

`.animate-fade-in` (180ms) for panels that appear in place, plus the launcher's 18s glow
rotation. Nothing else. `prefers-reduced-motion` is handled globally — don't re-handle it
per component.

## The one exception

The ecosystem launcher's squircle tiles (`--radius-squircle`, 22.4%) carry the rotating
seven-colour spectral glow (`LAUNCHER_GLOW`). It is the only multi-hue gradient, the only
rotating animation, and the only off-scale radius in the ecosystem. Do not reuse it
anywhere else — a spectrum applied twice is decoration.

## Deleted — do not reintroduce

`.glass` · `.glass-flat` · `.eyebrow` (now `.label`) · `--font-mono` · `--font-display` ·
`--color-edge` · `.rule` · `.y2k-*` · `.holo-*` · `.water-*` · `.cyber-*` ·
`.animate-radar-*` · `.app-glow` · `.rainbow-glow-bar` · `.y2k-3d-card-*` ·
`.animate-float-gentle` · `vfx.css`.

## Before committing UI

```bash
rg -n 'text-\[(9|10|11|12)px\]|text-\[0\.(5|6|7)[0-9]*rem\]' src/
rg -n 'font-mono|ui-monospace|Noto Sans Mono|font-display' src/ packages/
rg -n '(text|bg|border|ring|from|to|via)-(amber|sky|slate|cyan|purple|emerald|gray|zinc|red|yellow|green)-[0-9]' src/
rg -n '#[0-9a-fA-F]{3,8}' src/components/ src/app/
rg -n 'border(-[trblxy])?-[0-9]|border-(solid|white|black)|\bring-[0-9]|outline-[0-9]' src/
rg -n 'glass|y2k|holo-|water-|cyber-|radar|app-glow|rainbow-glow|eyebrow' src/
rg -n 'scrollbar|::-webkit-scrollbar' src/ | rg -v 'scroll-silent|scroll-area'
```

Every hit is a defect. Fix it or delete it; do not add an exception. Never hand-edit
`dist/` or an app's `vendor/` copy — run `npm run tokens:emit`.
