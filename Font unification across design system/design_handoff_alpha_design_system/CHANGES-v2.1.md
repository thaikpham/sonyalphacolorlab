# Changes since the first handoff (v2.1)

Two screens were redesigned after the bundle was first packaged. `design_refs/` has been
refreshed, so the HTML references are current. Where this file and
`IMPLEMENTATION_PLAN.md` / `README.md` disagree, **this file wins**.

Nothing in `repo_files/` changed — tokens, `globals.css`, `DESIGN.md` and the six rules
are unchanged. Both redesigns are built entirely from existing tokens.

---

## 1 — Site header: static states → one live navigation bar

Ref `Alpha Screens.dc.html` §06. The old spec described three static states (default,
searching, account menu). It is now **one interactive bar**; the three states are things
it does, not three mockups.

**Shape.** Fully rounded: `border-radius: 999px`, padding `9px 10px 9px 22px`, film white
7.5%, `blur(40px) saturate(1.4)`, elevation 1 + specular highlight, **no border**. The bar
is `flex-wrap: wrap`; when its own width drops below ~1010px the radius animates to 30px
(300ms) and the search row wraps under the nav. Radius is the only thing that changes —
do not swap in a different bar at small widths.

**Sliding indicator.** One absolutely positioned pill inside the `<nav>`, 44px tall,
radius 999px, `linear-gradient(180deg,rgba(255,255,255,.15),rgba(255,255,255,.055))` +
specular. It moves to the hovered item, or to the open item, or rests on the first item.
`transition: transform .44s cubic-bezier(.19,.9,.22,1), width .44s <same>, opacity .24s`.
Position and width are measured from the item's `offsetLeft` / `offsetWidth` — no
hard-coded stops. Nav labels are 15px/600, `ink-muted` at rest, `ink` when active; the
item itself has no background of its own.

**Chevrons.** A 7px CSS square (`border-right` + `border-bottom`, 2px, `currentColor`,
opacity .7) rotated 45° closed → −135° open, `transition: transform .36s
cubic-bezier(.19,.9,.22,1)`.

**Three dropdown panels.** One per nav item, mutually exclusive, click to toggle:

| Nav item | Panel | Columns | Content |
| --- | --- | --- | --- |
| Tất cả công thức | filters | 3 | Loại công thức (Picture Profile 3 / Creative Look 3) · Tag (film-look, golden-hour, serene, faded with the SCL codes they come from) · Sắp xếp (Mới cập nhật / Theo mã SCL / Theo loại look) |
| Tra cứu máy ảnh | catalogue | 3 | Dòng máy (Máy ảnh Alpha 16 · Cinema Line 6 · Vlog 6 · DSC 3) · Cỡ cảm biến (Full Frame 21 · APS-C 5 · 1-Inch 5) · Khoảng giá (8 / 9 / 6 / 8) |
| Tính năng | features | 2 | Đóng góp ảnh · Đề xuất phiên bản · Tweak với AI · So sánh spec |

All counts are real: they are the 31 `category: "camera"` entries of
`data/sony-cameras.seed.json` grouped by `subCategory2`, `subCategory1` and price band
(<30M / 30–60M / 60–100M / >100M). In the app, **derive them from the query** rather than
hard-coding — and if a count isn't available, omit it (rule from the original spec).

Panel chrome: radius 26, film white 8.5% → 3.5% gradient, `blur(40px) saturate(1.45)`,
elevation 2, padding `22px 22px 18px`. It is anchored to the left edge of its own nav
item and clamped so it never leaves the bar; `top` = bar height + 10px. Footer row above
a 1px white-12% seam: a 13px `ink-faint` note left, a 14px accent action right.

Panel rows: 44px min-height, radius 14, a 26px rounded-square swatch (radius 9) tinted
from the accent/signal ramps, label 15px/600, hint 13px `ink-faint` (ellipsised), count
13px/600 `ink-faint`. Hover = white 10% + `translateX(3px)`.

**Motion.** Panel in: `opacity 0→1, translateY(-14px)→0, scale(.985)→1`, 320ms
`cubic-bezier(.19,.9,.22,1)`. Rows stagger in on the same curve, 380ms, delay
`group×40ms + row×30ms`. Account menu identical at 300ms / 34ms.

**Search.** Sunken (`rgba(0,0,0,.35)` + `inset 0 2px 8px rgba(0,0,0,.5)`), radius 999px,
44px, `flex: 1 1 200px; min-width: 0`. Focus grows `max-width` 290 → 420px over 400ms and
lights a ring: `inset 0 0 0 1.5px rgba(138,156,255,.5), 0 0 0 4px rgba(110,91,230,.16)`,
with the 15px circular icon going `accent-400`. (The old "grows to 520px" figure is
superseded.) At narrow widths `max-width: 100%`.

**Avatar & CTA.** 44px avatar, accent gradient; open state adds
`0 0 0 3px rgba(110,91,230,.45)` + a deeper halo, hover `scale(1.06)`. "Đóng góp ảnh" is
now a pill (radius 999px) with `translateY(-1px) + brightness(1.1)` on hover,
`translateY(1px)` active.

**Dismissal.** A transparent full-area scrim behind the bar (`z-index` under it) closes
any open panel on click. Keyboard: Esc must close, focus must stay in the bar — add that
in the app; the reference only shows the pointer path.

**Repo notes.** `src/components/site-header.tsx` already owns the URL params
(`q, format, look, tag, cat, sub1, sub2, sort, view`) — the panels write to exactly those,
so this stays a styling + markup change plus one piece of local state for "which panel is
open". The panel is not a new route or a new store.

---

## 2 — Sony Wiki camera lookup: facet rail → card grid

Ref `Alpha Screens.dc.html` §03. **The 268px facet sidebar is removed.** The default view
is every product in one grid.

- Grid: 3 columns, gap 20, on the page's normal 36/26/40 padding — the same grid as the
  recipe gallery (§01).
- The card is **structurally identical to the recipe card**: radius 26, glass + elevation
  1, `blur(30px) saturate(1.35)`, a 210px image on top, body padding `19px 20px 22px`,
  gap 11.
- Card body, in order: subgroup label 13px/600/0.08em uppercase in its signal colour
  (Máy ảnh Alpha `#8A9CFF` · Cinema Line `#AE8DF5` · Vlog `#5FC7D6` · DSC `ink-muted`),
  product name 21px/600, spec chips 13px/500 on white 8% radius 11
  (`effectivePixels` · `autofocus` · `video`, falling back to `mediaSlots` when video is
  in `specsMissing`), then a row with the price 18px/800 and the compare action.
- Price and action both `white-space: nowrap`; the row is `flex-wrap: wrap` with
  `gap: 10px 12px` so 9-digit prices (153.153.818 đ) never break mid-number.
- Compare action: accent fill + halo when the product is selected ("Đã chọn"), plain text
  `ink-muted` when not ("So sánh"). Still no borders anywhere.
- The old facet groups become a **horizontal chip rail** above the grid — 13px/600, radius
  12, 40px, active = accent fill, `overflow-x: auto` with the scrollbar hidden
  (`.scroll-silent`), exactly like the recipe filter rail. Labels are the catalogue's own
  values: Tất cả máy ảnh · Máy ảnh Alpha · Cinema Line · Vlog · DSC · Full Frame · APS-C ·
  1-Inch.
- Header keeps the compare summary + "Mở bảng so sánh" primary button on the right.

The row-based selected/unselected treatment from the old §03 (accent-tinted row fill) no
longer applies — selection now shows only in the card's action pill. §04 (the compare
table) is unchanged.
