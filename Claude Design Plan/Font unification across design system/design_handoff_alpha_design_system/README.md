# Handoff: Alpha design system v2 (Noto Sans, dark glass, no strokes)

## Overview

Three feedback items drove this work: **nội dung chữ quá nhỏ**, **font không đồng đều**,
**giao diện đọc như AI sinh ra**. This bundle is the fix, as a system rather than a
patch: one typeface (Noto Sans, self-hosted), a 13px type floor, a dark blue-black
ground with one blue-purple accent, and depth built from translucency + blur + drop
shadow instead of borders.

It targets the whole ecosystem — **Alpha ColorLab**, **Sony Wiki** (cameras + audio),
**CheeseBooth**, **Live SOP** — because the uneven typography came precisely from the
four apps declaring fonts three different ways.

## About the design files

The `.dc.html` files in `design_refs/` are **design references written in HTML**. They
are prototypes showing intended look, spacing and behaviour — *not* production code to
copy into the app. The task is to **recreate them inside the existing Next.js + Tailwind
v4 codebase**, using its established patterns (App Router, `next-intl`, the
`packages/colorlab-tokens` generator, Tailwind utility classes).

Do not port the inline styles. The inline styling in the references exists only so they
render standalone; in the app the same values arrive as tokens and utilities.

`repo_files/` is different — those **are** production files, hand-written sources meant
to be copied to the paths given below and committed.

## Fidelity

**High fidelity.** Colours, type sizes, weights, radii, blur radii, shadow recipes and
copy are final. Recreate them exactly, using the tokens rather than the literals: every
literal in the references has a token in `repo_files/tokens.ts`, and the token is the
thing to reference.

The content in the references is the repo's **real data** — recipes from
`data/recipes.seed.json`, cameras from `data/sony-cameras.seed.json`, labels from
`messages/vi.json`. Treat it as a fixture check: if a rebuilt screen can't show that
content, the data mapping is wrong.

## The six rules

1. **One family.** `'Noto Sans'`, self-hosted, weights 400/500/600/800. No mono, no
   display face, no second family anywhere.
2. **13px floor.** `--text-meta` (13px) is the smallest type in the ecosystem.
3. **Dark only.** Blue-black ground, one blue-purple accent, three signal hues. No red,
   no yellow, no green — those are Canon, Nikon and Fuji signatures.
4. **No strokes.** Depth = translucency + blur + drop shadow + a 1px specular highlight.
   `border` / `ring` / `outline` are banned except on `:focus-visible`.
5. **Text is always lighter than what it sits on.** No exceptions.
6. **Scrollbars are invisible until hovered**, and never occupy layout.

## Screens

Six screens are specified. Each maps to files that already exist in the repo — this is a
restyle plus a copy/data correction, not new surface area.

| # | Screen | Design ref | Repo files to change |
| --- | --- | --- | --- |
| 01 | ColorLab · Tất cả công thức | `Alpha Screens.dc.html` §01 | recipe gallery under `src/app/[locale]/colorlab/`, recipe card components |
| 02 | ColorLab · Chi tiết công thức | `Alpha Screens.dc.html` §02 | recipe detail route + settings table, photo strip |
| 03 | Sony Wiki · Tra cứu máy ảnh | `Alpha Screens.dc.html` §03 | `src/app/[locale]/cameras/` list + facet sidebar |
| 04 | Sony Wiki · So sánh spec | `Alpha Screens.dc.html` §04 | compare route, `src/lib/cameras/compare-grouping.ts` consumers |
| 05 | Admin · Sửa sản phẩm | `Alpha Screens.dc.html` §05 | `src/components/admin/admin-editor.tsx` |
| 06 | Site header · ba trạng thái | `Alpha Screens.dc.html` §06 | `src/components/site-header.tsx` |
| — | Ecosystem launcher (desktop + mobile) | `Ecosystem Launcher.dc.html` | `src/components/launcher-grid.tsx` |
| — | Token + type spec (reference sheet) | `Alpha Design System.dc.html` | none — read it, don't build it |

### 01 — ColorLab · Tất cả công thức

Sticky glass header (film white 7.5%, `blur(40px) saturate(1.4)`, shadow
`0 14px 34px -18px rgba(0,0,0,.9)`, **no bottom border**) holding: wordmark `α ColorLab`
17px/800, nav pills 15px/600 at 44px min-height, a sunken search field (`rgba(0,0,0,.35)`
+ `inset 0 2px 8px rgba(0,0,0,.5)`, radius 14, width 300px), a text action, and a 40px
circular avatar.

Below: page lede — label 13px/600/0.08em uppercase in `community` cyan, title 38px/800,
lede 18px/400 at `ink-muted`. A segmented control (Grid / Bảng / So sánh) sits in a
sunken rut: `rgba(0,0,0,.3)`, padding 5px, radius 16, each option radius 12; the active
option is the accent fill with `0 6px 16px -6px` halo.

Filter chips: one row, `overflow-x: auto`, **scrollbar never shown** (`.scroll-silent`),
13px/600, radius 12, 40px min-height, inactive = transparent, active = accent fill.

Recipe grid: 3 columns, gap 20. Card = `.surface` (white 5% film, `blur(30px)
saturate(1.35)`, elevation 1, radius 26, **no border**), a 210px image at the top, then
padding 19/20/22 with: kind label 13px in its signal colour, title 21px/600, chip row
13px/500 on white 8% at radius 11, meta 13px at `ink-faint`.

### 02 — ColorLab · Chi tiết công thức

Two columns, 1.35fr / 1fr. Left: 420px hero image, then label / title 36px/800 / lede
18px, an action row (accent fill "Áp dụng Recipe", glass "Lưu", text "Đóng góp ảnh" —
all 44px min-height, radius 14), a `.seam` (1px gradient fading at both ends, **not** a
solid rule), and the contributor: 44px avatar + name 15px/600 + source 13px.

Right column sits on white 2.2% and holds two `.surface` panels: the camera settings
table (rows 14px, alternating `rgba(255,255,255,.04)` at radius 12 — **no dividing
lines**; the two rows that define the look, Creative Look and White Balance, are
`accent-400` 600-weight) and the sample-photo grid (3 × 104px, radius 14).

### 03 — Sony Wiki · Tra cứu máy ảnh

268px facet rail on white 3%: per group a 13px uppercase label then options at 15px,
40px min-height, radius 12, active = accent fill. Facet groups are the catalogue's own
axes (Danh mục / Phân nhóm chính / Phân nhóm phụ) — **do not invent counts**; show a
count only where the query supplies one.

List rows: grid `132px | 1fr | auto`, gap 22, padding 16, radius 24. Unselected = glass
+ elevation 1; **selected = an accent-tinted fill**
(`linear-gradient(180deg,rgba(110,91,230,.20),rgba(110,91,230,.07))` plus a violet-cast
shadow) — never a border. Name 25px/800, category tag 13px/600, spec chips 13px/500 on
white 8%, price 21px/800 right-aligned, action 14px/600 at 44px.

### 04 — Sony Wiki · So sánh spec

One `.surface` panel. Header row: 13px/600/0.06em uppercase `ink-faint`, spec column
left, each product right-aligned. Body rows 14px with `tabular-nums`, alternating white
4% tint at radius 12. The better value is `accent-400` at 600; equal values stay `ink`
(**never green**). A value the catalogue does not publish (`specsMissing`) renders as an
em dash — not a blank cell.

### 05 — Admin · Sửa sản phẩm

Two columns, 1.3fr / 1fr. Left: header (label 13px in `proposal` violet, title 32px,
save state 13px right), then a 2-column field grid. Each field = label 13px/600
uppercase `ink-faint` + a **sunken** control (44px min-height, radius 14,
`rgba(0,0,0,.35)`, `inset 0 2px 8px rgba(0,0,0,.5)`, **no border**) + a 13px hint.
Validation is the hint turning `#E7899A` — never a red border, never a red field.
Field labels must stay the editor's existing strings ("Tên ngắn hiển thị (Name)",
"Mã SKU sản phẩm", "Phân nhóm chính (SubCategory 1)"…).

Right column on white 2.2%: the review queue, cards radius 20; the active item is
violet-tinted, the rest are plain glass.

### 06 — Site header · ba trạng thái

Default, searching (search field grows to 520px, nav collapses), and account menu open.
The menu is elevation 2 (film white 7.5%, `blur(40px)`, `0 34px 84px -22px`), radius 20,
anchored under the avatar and overlapping the bar's bottom edge, rows at 44px.

### Ecosystem launcher

The **one sanctioned exception** in the system. Tiles are squircles
(`border-radius: 22.4%` — a percentage so the superellipse holds at any size) carrying a
rotating seven-colour spectral glow: two conic-gradient layers behind an opaque icon
face, `blur(26px)` at inset −10% and `blur(8px)` at inset −2%, 18s linear rotation.

- Desktop ≥1024px: 132px tiles, one row, gap 52, labels 15px/600.
- 640–1023px: three columns.
- <640px: two columns, 76px tiles, labels 13px, plus a fixed glass dock (radius 26, film
  white 7.5%, `blur(28px) saturate(1.6)`).

Nowhere else in the ecosystem may use a multi-hue gradient or a rotating animation. If
it gets reused, it stops being the signature — at which point remove it here too.

## Interactions & behaviour

- **Hover** — glass buttons lift film 8% → 13%; accent fills go `brightness(1.12)`;
  launcher tiles `translateY(-4px) scale(1.045)` over 320ms `cubic-bezier(.22,1,.36,1)`.
- **Active** — accent fills `translateY(1px)`; tiles `scale(.97)`.
- **Focus** — `:focus-visible { outline: 2px solid var(--color-accent-400); outline-offset: 3px }`.
  This is the only stroke in the system and must never be removed.
- **Panels appearing in place** — `.animate-fade-in`, 180ms, opacity + 4px translate. No
  scale, no glow. This is the only animation besides the launcher glow.
- **Scrollbars** — hidden at rest; on `:hover`/`:focus-within` a thin overlay thumb at
  white 16% (white 30% while dragging), no track, no arrows. Rails that must never
  advertise overflow use `.scroll-silent`. Scroll containers inside a panel use
  `.scroll-area` (`overscroll-behavior: contain`). Hiding the indicator must never
  remove keyboard or wheel scrolling.
- **Reduced motion** — `prefers-reduced-motion: reduce` kills all animation globally;
  already handled in `repo_files/globals.css`.
- **Responsive** — the existing capability queries in `globals.css` are preserved
  (`display-mode`, `pointer: coarse`, short-landscape, the `.filter-scroll` rail). Adapt
  to viewport and pointer, never to a sniffed user agent.

## State management

No new client state. The screens are restyles of existing routes and components, so
their state stays where it is: URL search params in `site-header.tsx`
(`q`, `format`, `look`, `tag`, `cat`, `sub1`, `sub2`, `sort`, `view`), the editor's local
draft + `status` in `admin-editor.tsx`, the compare selection in the cameras route.

One removal: any state that existed only to drive a deleted effect (Y2K/holo/radar
timers, glow toggles, floating-card transforms) goes with it.

## Design tokens

`repo_files/tokens.ts` is the source of truth and carries the reasoning inline. Summary:

**Surfaces** — `void` #07080B (the only opaque surface) · `glass` white 5% ·
`glass-raised` white 8.5% · `sunken` black 35%. There is no `edge` token: borders are
gone.

**Ink** — `ink` #F4F5F8 (18.4:1) · `ink-muted` #C3C7D2 (11.1:1) · `ink-faint` #969CAA
(6.1:1). No fourth step. On a tinted accent field, body text is pure white and its label
is step 200–300 of that ramp.

**Accent (blue)** — 100 #EEF1FF · 200 #D6DDFF · 300 #B3C0FF · **400 #8A9CFF (text/icon
on dark)** · **500 #5C74F0 (fill)** · 600 (pressed) · 700 · 800 · 900 (tinted field).
The screens use a violet-leaning fill `#6E5BE6` with `#8C7BEC` as its gradient top.

**Signals** — `community` #5FC7D6 cyan · `proposal` #AE8DF5 violet · `ai` #D48FE6 orchid
· `danger` #E7899A rose. Classification only, never decoration, never more than two in a
row.

**Type** — 56 / 42 / 32 / 25 / 21 / 18 / **15 (body default)** / 14 / 13 (label,
600/0.08em uppercase) / 13 (meta). Tracking: −0.02em at 21px+, 0 for body, 0.08em for
labels. `tabular-nums` on body.

**Radius** — sm 12 · md 14 · lg 26 · xl 32 · squircle 22.4% (launcher only).

**Elevation** — `blur` = `blur(30px) saturate(1.35)`, `blur-strong` = `blur(40px)
saturate(1.4)`, `spec` = `inset 0 1px 0 rgba(255,255,255,.11)`, `inset` = `inset 0 2px
8px rgba(0,0,0,.5)`, level 1 = `0 2px 6px rgba(0,0,0,.5), 0 18px 44px -14px
rgba(0,0,0,.7)`, level 2 = `0 4px 12px rgba(0,0,0,.55), 0 34px 84px -22px
rgba(0,0,0,.85)`, level 3, `halo` = `0 12px 28px -8px var(--accent-halo)`. **Use a level
whole** — a level-1 shadow under a level-3 blur is what made the old glass look
arbitrary.

**Spacing** — 4px grid: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Touch target 44px.

**Ground wash** — three wide low-chroma radial gradients on `body`, fixed. Without
something to refract, glass over flat black is just grey.

## Assets

- **Fonts** — Noto Sans 400/500/600/800, latin + vietnamese, vendored into
  `public/fonts/noto-sans/` by `repo_files/vendor-fonts.mjs`. Committed, no CDN, no
  `next/font`.
- **Launcher icons** — `design_refs/assets/*.png`, copied from the repo's own
  `public/` (`colorlab-icon.png`, `sony-wiki-icon.png`, `cheesebooth-icon.png`,
  `livesop-icon.png`). Keep using the repo copies.
- **Photography** — the references use drag-and-drop placeholders
  (`design_refs/image-slot.js`). In the app, images come from the existing data
  (`imageUrl` / `galleryUrls`, `data/images.seed.json`).
- **Icons** — no icon set is specified by this system; keep whatever the app already
  uses, sized ≥16px and coloured from the ink or accent ramp. The emoji currently inside
  some `messages/*.json` strings should be dropped as those strings are touched.

## Files

`IMPLEMENTATION_PLAN.md` — the ordered work plan. **Start there.**

`repo_files/` — copy these into the repo and commit:

| File | Destination | Note |
| --- | --- | --- |
| `tokens.ts` | `packages/colorlab-tokens/src/tokens.ts` | replaces the file |
| `globals.css` | `src/app/globals.css` | replaces 819 lines with ~430 |
| `DESIGN.md` | `DESIGN.md` (repo root) | new — the rules, with the audit |
| `design-sync.md` | `.claude/commands/design-sync.md` | new — enables `/design-sync` |
| `CLAUDE.md` | `CLAUDE.md` (repo root, merge if one exists) | new — the always-on rules |
| `vendor-fonts.mjs` | `scripts/vendor-fonts.mjs` | new |
| `fonts.test.ts` | `src/app/fonts.test.ts` | replaces the file |

`design_refs/` — open in a browser, don't port:

- `Alpha Screens.dc.html` — the six screens
- `Ecosystem Launcher.dc.html` — launcher, desktop + mobile
- `Alpha Design System.dc.html` — token / type / contrast reference sheet
- `support.js`, `image-slot.js`, `assets/` — what those three need to render
