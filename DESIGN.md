# DESIGN.md — Sony Alpha ecosystem

Read this before writing UI. It applies to Alpha ColorLab, Sony Wiki (cameras +
audio), CheeseBooth and Live SOP. The values live in
`packages/colorlab-tokens/src/tokens.ts`; this file is why they are what they
are, and what to do when you are tempted otherwise.

The design was rebuilt after one piece of feedback: *the text is too small, the
fonts don't match, the whole thing looks AI-generated and unprofessional.* Every
rule below is the fix for something that was actually in this repo.

## The six sentences

1. **One family.** `'Noto Sans'`, self-hosted, four weights. No mono, no
   display face, no second family anywhere.
2. **13px floor.** `--text-meta` is the smallest type in the ecosystem.
3. **Dark only.** Blue-black ground, one blue-purple accent, three signal hues.
   No red, no yellow, no green — those are Canon, Nikon and Fuji.
4. **No strokes.** Depth is translucency + blur + drop shadow + a 1px specular
   highlight. A border makes a component read as boxed in.
5. **Text is always lighter than what it sits on.** No exceptions, ever.
6. **Scrollbars are invisible until hovered**, and never occupy layout.

## Type

| Token | Size | Weight | Use |
| --- | --- | --- | --- |
| `text-display-xl` | 56 | 800 | one hero per app |
| `text-display` | 42 | 800 | page title |
| `text-title-1` | 32 | 800 | recipe name, camera name |
| `text-title-2` | 25 | 800 | section heading |
| `text-title-3` | 21 | 600 | card title |
| `text-body-lg` | 18 | 400 | lede |
| `text-body` | 15 | 400 | **default — all reading content** |
| `text-body-sm` | 14 | 400 | table cell, spec value, form hint |
| `text-label` | 13 | 600 | eyebrow, badge, column head (`.label`) |
| `text-meta` | 13 | 400 | author, timestamp, count (`.meta`) |

- Numbers are `tabular-nums` on `body` already — never reach for a mono face.
- Uppercase only in `.label`, never over three words. Vietnamese diacritics
  need the ascender room.
- Letter-spacing: `-0.02em` at 21px and above, `0` for body, `0.08em` for
  `.label`. Nothing else.
- To make something recede: drop the weight, then step down the ink ramp. Never
  the size (13 is the floor) and never the contrast (`ink-faint` is the floor).

## Colour

Ground `void` #07080B is the **only opaque surface**. Above it:
`glass` (white 5%) for a panel, `glass-raised` (white 8.5%) for anything that
floats over one, `sunken` (black 35%) for an input.

Text `ink` #F4F5F8 (18.4:1) · `ink-muted` #C3C7D2 (11.1:1) ·
`ink-faint` #969CAA (6.1:1). There is no fourth step.

Accent is a ramp, and the step matters on a dark ground:

- `accent-400` #8A9CFF — links, icons, an emphasised number. **Text uses 400.**
- `accent-500` — solid fill of the primary action, current selection.
- `accent-600` — pressed.
- `accent-900` — a tinted field behind accent text.

Signals classify content and nothing else: `community` cyan, `proposal`
violet, `ai` orchid, `danger` rose. Never more than two in one row. Never as
decoration.

### Contrast — the actual defect

On a tinted accent field, body text is **pure white** and its label is step
200–300 of that same ramp. Never an ink step, and never a darker step of the
field's own colour. Dark type on a dark field is what this rebuild removed;
it is a bug, not a mood.

Forbidden, and the audit greps for them: `amber-*`, `sky-*`, `slate-*`,
`cyan-*`, `purple-*`, `emerald-*`, `gray-*`, any `#` literal in a component,
and any red / yellow / green hue.

## Surfaces — liquid glass, no borders

Use an elevation **whole**. Mixing a level-1 shadow with a level-3 blur is what
made the old glass cards read as arbitrary.

| Class | Film | Blur | Shadow | For |
| --- | --- | --- | --- | --- |
| `.surface` | white 5% | 30px | `--elevation-1` | panel, card |
| `.surface-raised` | white 8.5% | 40px | `--elevation-2` | dropdown, dock, sheet |
| `.surface-sunken` | black 35% | — | `--elevation-inset` | input, segmented rut |

- Every one carries `--elevation-spec`: a 1px specular highlight along the top
  edge. That highlight **is** the border; do not add another.
- `border`, `outline` and `ring` are banned except on `:focus-visible`.
- Rows separate with `.row-tint` (white 4% on alternate rows), not lines. Where
  a divider genuinely helps, `.seam` is light that fades out at both ends.
- Radii are soft: `sm` 12 (tag, row) · `md` 14 (button, input) · `lg` 26
  (panel) · `xl` 32 (largest slab). A 4px corner on a borderless translucent
  panel reads as a rendering artefact.
- Coloured light only under a filled accent control (`--elevation-halo`, same
  hue as the fill, thrown downward).
- The ground carries three wide low-chroma washes. Without something to
  refract, glass over flat black is just grey.

## Scrollbars

Hidden at rest, hinted on hover, never part of layout.

- Global rules live in `globals.css`. Do not write per-component scrollbar CSS
  and do not add `scrollbar-hide` variants at call sites.
- At rest: `scrollbar-width: none`, transparent WebKit thumb.
- On `:hover` / `:focus-within`: a `thin` overlay thumb at white 16%, no track,
  no arrows, no corner. White 30% while dragging.
- `.scroll-silent` for a rail that must never advertise overflow at all (filter
  row, photo strip, launcher rail).
- `.scroll-area` for a scrolling region inside a panel — it sets
  `overscroll-behavior: contain` so an inner scroll never chains out to the
  page.
- Never hide overflow by clipping content, and never remove keyboard scroll.
  The indicator is what's hidden, not the scrolling.

## Structure

- Spacing on a 4px grid: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- Labels are flush left, including inside a button wider than its label.
- Touch targets ≥ 44px (`--layout-touch-target`).
- Launcher tiles: 132px desktop, 76px mobile (`--layout-tile-*`).

## Motion

One animation exists: `.animate-fade-in`, 180ms, for panels that appear in
place. Plus the launcher's 18s glow rotation. Everything else was deleted — Y2K
badges, holo lens, laser grid, radar sweep, glitch text, floating cards, water
ripples. `prefers-reduced-motion` is respected globally.

## The one sanctioned exception

The ecosystem launcher's squircle tiles carry a rotating seven-colour spectral
glow (`LAUNCHER_GLOW` in tokens.ts). It is the only place that may use a
multi-hue gradient, a rotating animation, or a radius outside the scale
(`--radius-squircle`, 22.4%) — and the only place the competitor-hue rule is
relaxed, because a full spectrum belongs to no brand.

It stays an exception by being rare. Reuse it on a card, a badge or a header and
the launcher stops being the signature — at which point delete it there too.

## Deleted — do not reintroduce

`.glass` · `.glass-flat` · `.eyebrow` (now `.label`) · `--font-mono` ·
`--font-display` · `--color-edge` · `.rule` · `.y2k-*` · `.holo-*` ·
`.water-*` · `.cyber-*` · `.animate-radar-*` · `.app-glow` ·
`.rainbow-glow-bar` · `.y2k-3d-card-*` · `.animate-float-gentle`.

## Audit — run before every commit

```bash
# 1. Type below the floor (was 68 occurrences)
rg -n 'text-\[(9|10|11|12)px\]|text-\[0\.(5|6|7)[0-9]*rem\]' src/

# 2. A second typeface
rg -n 'font-mono|ui-monospace|Noto Sans Mono|font-display' src/ packages/

# 3. Tailwind palette instead of tokens
rg -n '(text|bg|border|ring|from|to|via)-(amber|sky|slate|cyan|purple|emerald|gray|zinc|red|yellow|green)-[0-9]' src/

# 4. Raw hex in a component.
#    icon.tsx, opengraph-image.tsx, manifest.ts and the `themeColor` viewport
#    export are exempt and are excluded by name: Satori and the OS browser
#    chrome both ignore `oklch()` silently, so a token there renders nothing
#    rather than erroring. `GoogleMark` is Google's trademark reproduced to
#    their sign-in branding guidelines — recolouring it to tokens would make it
#    a different mark, and a third party's logo is not a colour this interface
#    chooses.
rg -n '#[0-9a-fA-F]{3,8}' src/components/ src/app/ \
  | rg -v 'icon\.tsx|opengraph-image\.tsx|manifest\.ts|themeColor|GoogleMark'

# 5. Strokes — allowed only on :focus-visible
rg -n 'border(-[trblxy])?-[0-9]|border-(solid|white|black)|\bring-[0-9]|outline-[0-9]' src/

# 6. Deleted vocabulary.
#    `.btn-glass` and the `glass` / `glass-raised` surface TOKENS survive and
#    are filtered out — what was deleted is the `.glass` / `.glass-flat`
#    primitive, which is why the filter names the survivors rather than
#    narrowing the pattern. The deleted divider is matched as `\.rule` and not
#    `\brule\b`: the bare word matched the English noun in forty comments,
#    including every one explaining a rule of this design system.
rg -n 'glass|y2k|holo-|water-|cyber-|radar|app-glow|rainbow-glow|eyebrow|\.rule\b' src/ \
  | rg -v 'btn-glass|glass-raised|bg-glass|--color-glass'

# 7. Per-component scrollbar CSS (belongs in globals.css only)
rg -n 'scrollbar|::-webkit-scrollbar' src/ | rg -v 'scroll-silent|scroll-area'

# 8. Hard corners
rg -n 'rounded-none|radius:\s*0' src/
```

Every hit is a defect. Fix it or delete it; do not add an exception.

## Fonts

`npm run fonts:vendor` downloads Noto Sans (400/500/600/800, latin +
vietnamese) into `public/fonts/noto-sans/` and writes the `@font-face` block
next to it. The files are committed. Nothing loads from a CDN and nothing uses
`next/font`: that indirection is why the four apps could not name the same
face, which is what the feedback called uneven fonts.
