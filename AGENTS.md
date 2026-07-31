<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
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

Vietnamese needs the `vietnamese` subset explicitly on every `next/font` call, or
diacritics fall back and break:

```ts
Noto_Sans({ subsets: ['latin', 'vietnamese'] })
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

## Layout

```
src/lib/camera/     constants.ts · schema.ts · format.ts   ← source of truth
src/lib/legacy/     one-shot migration from sonycolorlab (delete after cutover)
src/lib/recipes/    row.ts (Recipe ⇄ DB row) · Supabase data access
supabase/migrations/  SQL; runs for real against PGlite in migration.test.ts
src/app/            App Router routes
data/               recipes.seed.json (generated — never hand-edit)
```

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

Dark theme only. Glassmorphism — layered blur + grain + a 1px specular edge.
Minimalist, futuristic, colour-pop accents, ASCII decorative marks.
Noto Sans throughout. Use the shared glass primitive; do not hand-roll
`backdrop-filter` per component. Verify text contrast over photography.

Colours are OKLCH. **In `next/og` / ImageResponse use `accentHex()`, not
`accentCss()`** — Satori ignores `oklch()` silently and renders a colourless
card rather than erroring. Satori also has no `α` glyph in its default font.

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

1. **Font subsets are `['latin', 'vietnamese']` — do not add `latin-ext`.**
   It cost ~330KB of font for languages nothing here is written in, and pushed
   LCP from 3.1s to 5.1s. Noto Sans Mono is `preload: false` for the same reason.
2. **`NextIntlClientProvider` gets an explicit `messages` object.** The default
   ships the whole catalogue to the browser — a recipe page was carrying the
   homepage's headline copy. Adding a `useTranslations` namespace to a *client*
   component means adding it in `[locale]/layout.tsx` too, or its labels render
   as raw keys. `src/app/messages.test.ts` enforces this.

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
