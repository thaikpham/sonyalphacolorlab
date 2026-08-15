<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Alpha ColorLab

Web app for sharing Sony Alpha colour recipes. White Balance Shift is the core;
each recipe pairs it with **either** a Picture Profile **or** a Creative Look.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase · Vercel

```bash
npm run dev            # dev server
npm test               # vitest — MUST pass before any commit
npm run typecheck      # tsc --noEmit
npm run seed:emit      # regenerate data/*.seed.json (merges data/translations.vi.json)
npm run push:supabase  # push the catalogue to Supabase (needs service-role key)
```

Supabase is optional: with no credentials the app reads `data/*.seed.json`, so it
builds, runs and tests offline. Add the env vars and it switches over — see
`.env.example`.

## Rule 1 — Never write a camera value from memory

Every legal enum and numeric range lives in `src/lib/camera/constants.ts`, each
block citing the Sony help-guide URL it came from. Import from there. Do not
retype a range into a component, a prompt, a test, or a migration.

If a value seems missing, **re-read the cited source and update `constants.ts`** —
never inline a literal at the call site. Guessing a plausible-looking value
produces recipes that silently fail on a real camera.

Three traps that have already bitten this dataset:

- `Saturation` means different things per format: **PP is −32…+32, Creative Look is −9…+9.**
- `Fade` (0–9), `Sharpness` (0–9), `Clarity` (0–9), `Sharpness Range` (1–5) are
  **unsigned** — never render or store them with a `+`.
- `V/H Balance` is only −2…+2. The legacy dataset shipped `-22`; see
  `LEGACY_CORRECTIONS` in `src/lib/legacy/migrate.ts`.

## Rule 1b — White Balance has three modes, not two

`kelvin` · `auto` (AWB…) · `preset` (Daylight, Cloudy, Shade, Underwater Auto…).
All three take an optional shift, and both recipe formats share all of it.
Presets are `WB_PRESETS` in `constants.ts`, cited to the a7 IV guide
(`TP1000640840`). `Custom 1-3` are excluded on purpose — they replay a white
card measured in one room and mean nothing to a reader.

`WB_AUTO_MODES` uses the **legacy dataset's** spelling (`AWB (Priority White)`),
not Sony's (`Auto: White`). Do not "fix" it: shipping rows, a CHECK constraint
and the redirect map all carry those exact strings.

Adding an enum value to Postgres needs **its own migration file** — a value
cannot be used in the transaction that created it, which is why `0005` adds
`preset` to `wb_mode` and `0006` is what uses it.

## Rule 2 — A recipe is exactly one format

Picture Profile and Creative Look are **mutually exclusive on the camera**
("[Creative Look] is fixed to [-] … when [Picture Profile] is set to other than
[Off]"). `recipeSchema` is a discriminated union on `format: 'pp' | 'cl'` and the
settings objects are `strictObject`, so a stray key from the other format is a
validation error, not a silently dropped field. Keep it that way.

## Rule 3 — Translate content, never technical terms

Bilingual EN/VI. Translate **descriptions and UI copy only**.

Never translated: recipe names, parameter labels, Creative Look codes and names,
gamma/colour-mode names, WB values. These live in `constants.ts`, outside the
message catalogues, so they cannot be translated by accident. Do not copy a
technical label into a translation file to "make it easier".

Product marketing bullets (camera & lens features in `data/sony-cameras.seed.json`)
are stored as bilingual `{ en, vi }`. Technical terms (ED Elements, Aspherical Elements,
Optical SteadyShot, Focus Hold Button, Full-Frame, APS-C, EVF, etc.) stay in
their original form, while descriptive phrases follow standard Vietnamese phrasing:
- `f/5.6 to f/8 Variable Aperture` → `Khẩu độ thay đổi từ f/5.6 đến f/8`
- `150-600mm Equivalent on APS-C` → `150-600mm tương đương APS-C`
- `Two ED Elements & Two Aspherical Elements` → `2 ED Elements & 2 Aspherical Elements`
- `Focus Range Limiter & Focus Hold Button` → `Chức năng giới hạn khoảng lấy nét & Nút giữ lấy nét Focus Hold Button`
- `Dust & Moisture-Resistant Design` → `Thiết kế chống bụi và chống ẩm`
- `9-Blade Circular Diaphragm` → `Cấu tạo 9 lá khẩu tròn`

Camera sensor specs (`specs.sensor`) are strictly formatted as `[sensor size] + [sensor model] + [sensor tech]` without physical dimensions in mm (e.g. `Full-Frame Exmor R CMOS BSI`, `APS-C Exmor R CMOS BSI`, `1"-Type Exmor RS Stacked CMOS`, `Full-Frame Exmor RS Global Shutter CMOS`).

**Every user-visible string goes in `messages/*.json`.** Not a literal in JSX,
not a `locale === 'vi' ? … : …` ternary. Both spellings hide copy from the parity
test, and the failure is one-directional and silent: a Vietnamese literal renders
untranslated to English readers and nothing errors. The whole gallery, community
and sign-in chrome was Vietnamese-only on `/en` this way. `messages.test.ts`
pins EN/VI to the same key set, so a string added to one locale fails the build
until the other exists.

Vietnamese needs its own font subset or diacritics fall back mid-word — silently,
with no build error. The faces are vendored, so this is a constant in
`scripts/vendor-fonts.mjs` rather than an argument at each call site:

```js
const SUBSETS = ['latin', 'vietnamese'];
```

## Rule 4 — Two kinds of help text, kept apart

`explanations.ts` says what a parameter *is* — general, one entry per parameter.
`effects.ts` says what **this recipe's value** is doing — it reads the number and
grades it against that parameter's own range, so `Black Level -7` and `+7` read
differently. Both are EN/VI and both are covered by tests that fail if any
parameter loses an entry.

Effect intensity is derived from the range in `constants.ts`, never from a
hardcoded threshold — widen a range and the wording follows. Each effect is
tagged `contrast` / `color` / `detail` so a reader can see where a recipe's
character comes from.

White Balance has a third layer: `wbSummary()` says what the dials do
**together**. Temperature and Shift A/B are one amber–blue axis in different
units, so a warm Kelvin beside a `B` shift is not the mistake it looks like —
31 of 46 recipes are that shape. Keep it out of the rows; a combined cast is
not any single dial's property. Its neutral band is deliberately wider than the
Kelvin row's, because it inherits `MIRED_PER_SHIFT_STEP` — **fitted, not
published**. Never let it name warm or cool inside one shift step of neutral;
"Mojave Sun" lands 0.1 mired either side depending on that estimate.

Parameter rows use the shared `ParamRow` from `settings-table.tsx`, and its
column widths are **fixed, not `auto`**. Each row is its own grid — a `<details>`
cannot share tracks with siblings — so `auto` let every row size to its own
content and the columns came out ragged. Any new parameter table must reuse
`ParamRow`, and must have room for all three tracks: squeezed into a side column
the effect text collapsed to 43px wide.

## Rule 5 — Changing a range means changing one file

`constants.ts` → `schema.ts` derives from it → tests derive from both. Adding a
Creative Look or supporting a new body touches `constants.ts` only. Use the
`sync-camera-constants` skill; do not hand-edit downstream files to match.

## Rule 6 — One app here, one set of design tokens, two readers elsewhere

This repo is Alpha ColorLab and nothing else. **CheeseBooth**
(`cheese-booth.vercel.app`) and **Sony Live SOP** (`sonylivesop.vercel.app`)
are separate projects in separate repos with their own deploys and their own
CI. The ecosystem launcher in `site-header.tsx` links out to them by absolute
URL; there is no copy of their source here and no way to build them from here.
"Fix CheeseBooth" is a task in another repo.

They were workspaces under `apps/` for a while, which is why `npm run verify`
used to gate three apps. It gates one. It is still what CI runs and still what
to run before assuming a change is safe.

Shared surfaces, ink, the accent ramp, signal colours, the type scale, radius,
elevation, breakpoints and spacing are defined **once** in
`packages/colorlab-tokens/src/`. `npm run tokens:emit` generates two flavours —
`theme.css` (`@theme static`, what this app imports) and `tokens.css` (plain
`:root`, for a consumer without Tailwind) — writes both plus `primitives.css`
to `dist/`, and syncs the two this app uses into `src/app/vendor/`.

`vfx.css` is gone. The film/Y2K/holo/radar effects layer was the largest single
thing the "looks AI-generated" feedback was pointing at, and deleting it is the
change, not an optimisation of it. Do not re-add an effects file.

Edit `src/tokens.ts` or `src/primitives.css`, then re-emit. Never hand-edit a
generated file, and never re-declare a shared token in `globals.css` — a local
copy wins the cascade silently. `token-drift.test.ts` fails on both, and it now
exempts nothing: `--font-sans` used to be exempt because `next/font` hashed the
family name per app, which is exactly the unevenness the rebuild removed.

Two things to know before touching the emitter:

- **A destination outside this repo is not a destination.** `emit.ts` writes
  with `mkdirSync(…, { recursive: true })`, so a stale path in `TARGETS` does
  not error — it *creates* the folder. The six `apps/…` entries would have
  grown an untracked `apps/` tree back out of the first emit after the split.
- **`tokens.css` has an empty destination list on purpose.** Its only consumer
  is out of repo. It is still emitted to `dist/`, which is how CheeseBooth takes
  a token change — by hand now. Nothing checks that it did: `token-drift.test.ts`
  asserts only about paths this repo owns, because a guard that names a folder
  which may not exist is the vacuous pass that once let an entire app go missing
  from a green suite.

App-specific by design, and correctly **not** shared: `--accent` (ColorLab
recomputes it per recipe) and the page background. A colour named for what it
means *here* — `community`, `proposal`, `ai` — must not be borrowed elsewhere to
mean something else.

## Layout

```
src/lib/camera/     constants.ts · schema.ts · format.ts   ← source of truth
src/lib/legacy/     one-shot migration from sonycolorlab (delete after cutover)
src/lib/sony-asia/  import.ts — Creative Look library from Sony's Alpha Recipes
src/lib/recipes/    row.ts (Recipe ⇄ DB row) · Supabase data access
supabase/migrations/  SQL; runs for real against PGlite in migration.test.ts
src/app/            App Router routes
data/               recipes.seed.json (generated — never hand-edit)
```

The catalogue is two libraries in one table: Picture Profile recipes migrated
from sonycolorlab, and Creative Look recipes imported from a scrape of Sony's
Alpha Recipes microsite. Both come from **untrusted input parsed against
`constants.ts`** — `LEGACY_CORRECTIONS` and `SCRAPE_CORRECTIONS` record every
fix by name and reason. A row the source does not fully state is **skipped and
reported**, never completed with a plausible value: `Default Settings` has no
published expansion, and a Kelvin *range* is not a Kelvin.

`npm run seed:emit` prints the skips. Read them — they are the to-do list for
whatever the source failed to publish.

The SQL CHECK constraints restate some bounds from `constants.ts`. That is
deliberate defence in depth, and `sql-drift.test.ts` fails if the two disagree —
change the constant, then the SQL, never only one.

Read before touching recipes: `constants.ts`, then `schema.ts`. That is usually
enough — you rarely need the legacy files.

## Next.js 16

Do not write App Router code from memory. Read the relevant file first:

| Task | Doc under `node_modules/next/dist/docs/01-app/` |
|---|---|
| OG images, `generateMetadata` | `01-getting-started/14-metadata-and-og-images.md` |
| Fonts | `01-getting-started/13-fonts.md` |
| Images | `01-getting-started/12-images.md` |
| Data fetching | `01-getting-started/06-fetching-data.md` |
| Caching | `01-getting-started/08-caching.md` |
| Route Handlers | `01-getting-started/15-route-handlers.md` |
| `generateStaticParams` | `03-api-reference/04-functions/generate-static-params.md` |

## Design

Browse page runs full-bleed (`max-w-[160rem]`) at 1 / 2 / 3 / 4 / 5 / 6 columns.
Recipe pages stay at `max-w-[86rem]` — that is a reading layout, and full width
hurts it. Custom breakpoints (`3xl`, `4xl`) are declared in `@theme`; Tailwind v4
generates **no rule** for the inline `min-[2100px]:` form, so the column count
silently never changes.

**`DESIGN.md` is the design system and `CLAUDE.md` restates its six rules.**
Read them before writing UI; this section is only what is specific to *this*
app. One family (Noto Sans, self-hosted, no `next/font`), a 13px floor, dark
only, no strokes, text always lighter than its ground, scrollbars hidden until
hovered. Use `.surface` / `.surface-raised` / `.surface-sunken`; do not
hand-roll `backdrop-filter` per component. Verify text contrast over
photography. Run `/design-sync` to audit the tree.

Colours are OKLCH. **In `next/og` / ImageResponse use `accentHex()`, not
`accentCss()`** — Satori ignores `oklch()` silently and renders a colourless
card rather than erroring. Satori also has no `α` glyph in its default font.
`icon.tsx`, `opengraph-image.tsx` and `manifest.ts` are therefore the only
files allowed a raw hex, and the audit's hex grep excludes them by name.

Interface colour comes from the tokens in `globals.css`, never from Tailwind's
default scales. `community` / `proposal` / `ai` / `danger` / `heart` are named
for meaning, so a reader can tell the three offers on a recipe page apart before
reading a word — reaching for `emerald-500` instead puts an sRGB colour in an
OKLCH interface and drifts a shade per component. They live in **`@theme
static`**: a plain `@theme` only emits a variable Tailwind has seen a utility
use, and one read solely through `var()` is dropped, which is how the proposal
card once rendered with no accent at all.

Three traps, all found on screen rather than by reading:

- **A hand-written surface class beats every Tailwind utility on the same
  element.** `.surface`, `.surface-raised` and `.surface-sunken` are plain
  unlayered CSS written after `@import "tailwindcss"`, and unlayered rules win
  over layered ones whatever the specificity. So `bg-*`, `rounded-*` and
  `shadow-*` on a `.surface` element are silently dead — which is deliberate,
  because an elevation is a whole recipe and overriding one part of it is what
  made the old glass read as arbitrary. Change the level, don't patch it.

  This bit twice under the class's previous name. `hover:border-*` accent rings
  on the action cards never appeared once. And the header profile menu was
  `glass absolute`, so it computed to `position: relative`, stayed in normal
  flow and stretched the bar from 82px to 188px instead of opening over the
  page. **Put positioning and opacity on a plain wrapper and the surface class
  on the panel inside it.** A surface is translucent by construction, so
  `bg-void/95` on it does nothing — paint the opaque colour on the wrapper
  underneath, or text lands over whatever photograph is behind.
- **Do not transition a `box-shadow` whose colour is `color-mix()` over a
  `var()`.** Chrome resolves the target to the *from* value and holds there;
  registering the property with `@property` does not help. Move the motion to
  `transform` — which is what `.btn-accent` and the launcher tiles do.
- **`group-hover:` reaches the nearest `.group` ancestor, not a sibling.** Put
  `group` on the wrapper, and remember a hover-only reveal is invisible on
  touch: gate it with `pointer-fine:`.

`accentFor()` combines White Balance and Picture Profile Color Depth. Its
weights are a neutral default, **not validated** — see the header of
`accent-fidelity.test.ts` for why it is not tuned further. Never present it as a
preview of what the camera will render.

## Display space

Adapt by **capability, never user agent** — UA sniffing gets tablets, foldables
and iPadOS (which reports as macOS) wrong. Use `@media (pointer: coarse)`,
width/height queries, and `(display-mode: standalone)`.

- `100dvh`, never `100vh` — mobile browser chrome makes `vh` overshoot.
- The page paints under the notch (`viewport-fit: cover`), so every edge pays
  back its own `env(safe-area-inset-*)`. Use `.inset-safe` / `.pt-safe` / `.pb-safe`.
- Short landscape (`max-height: 32rem`) collapses the hero — it otherwise costs
  a full screen of scrolling before the first recipe.
- New generated metadata routes (`/icon`, `/opengraph-image`, …) have no file
  extension, so they must be added to the matcher exclusion in `src/proxy.ts`
  or next-intl swallows them and they 404 silently.

## Secrets

`ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only — never
prefix them `NEXT_PUBLIC_`, never import them into a Client Component.
AI output is re-validated with `recipeSchema` after it returns, regardless of
what the tool schema claims.

**The anon key is public** — it ships in the browser bundle, so anyone can call
PostgREST directly. RLS is row-level and cannot hide a column: a table holding
`author_email` needs a column-level `grant select (…) to anon`, not just a
policy. Never `select('*')` in a route that answers an unauthenticated request;
name the columns. `proposal_votes` is emails only and is readable by the service
role alone. Pinned by `no-email-leak.test.ts` and the privilege tests in
`migration.test.ts`.

Every `.sql` in `supabase/migrations/` is executed by `migration.test.ts`
against PGlite. Adding one there is what proves it is valid — and applying it to
Supabase is a separate, manual step that nothing in CI can do for you.

## Who the caller is

Identity comes from `requireUser(request)` — a Supabase JWT verified server-side
— and **never from the request body**. Any route that writes on a reader's
behalf must 401 without it, and must fill author columns from `user.email` /
`user.name`, not from fields the client sent. The earlier stub took a typed-in
address on trust, so an unauthenticated `curl` could comment as anyone and vote
without limit. Pinned by `identity-not-from-body.test.ts`.

Never put an email in a query string — it lands in every access log. Community
writes are rate-limited per verified address via `checkRateLimit`.

## AI ("Tweak with AI")

`claude-sonnet-5` via structured outputs, so the JSON shape is constrained by the
same Zod schema as everything else. But **structured outputs strips numeric
bounds** (`minimum`/`maximum` are not in the JSON Schema subset it supports), so
ranges are stated in the prompt too — generated by `src/lib/ai/constraints.ts`
from `constants.ts`, never hand-written. Zod re-validates the result, then retries
once with the failures fed back. Never trust the model's claim that it stayed in
range.

## Performance — two things are load-bearing

Measured with Lighthouse; both were found that way, not by inspection.

1. **Font subsets are `latin` + `vietnamese` — do not add `latin-ext`.**
   It cost ~330KB of font for languages nothing here is written in, and pushed
   LCP from 3.1s to 5.1s. The subsets are now a constant in
   `scripts/vendor-fonts.mjs`, the eight `.woff2` files are committed under
   `public/fonts/noto-sans/`, and `src/app/fonts.test.ts` fails on a missing
   Vietnamese range, a remote `url()` or a `latin-ext` face. There is no mono
   face to preload any more — Noto Sans has true tabular figures and `body` sets
   `font-variant-numeric: tabular-nums`.
2. **`NextIntlClientProvider` gets an explicit `messages` object.** The default
   ships the whole catalogue to the browser — a recipe page was carrying the
   homepage's headline copy. Adding a `useTranslations` namespace to a *client*
   component means adding it in `[locale]/layout.tsx` too, or its labels render
   as raw keys. `src/app/messages.test.ts` enforces this **both ways**: it also
   fails on a namespace the layout ships that nothing reads. `heroLanding`
   outlived the component it belonged to and kept sending ten strings to every
   visitor, so deleting a component means deleting its namespace.

Also: `<details>` is not valid inside `<dl>`, and heading levels must not skip
(`h1` → `h3` fails axe). Both cost a11y points here before being fixed.

## Legacy URLs

The old site addressed recipes by **query parameter** (`/?id=scl-001`), not by
path — that is the shape of every link already shared in Facebook groups. The
redirect map in `next.config.ts` matches on the query param and is generated from
`legacyId` in the seed. A path-based map would catch nothing, silently.

## Working style

- Prefer editing an existing file over adding one.
- Keep this file short — it is read every session. Long procedures belong in
  `.claude/skills/`, which load only when used.
- Update this file only when a **rule** changes. It is not a changelog.
