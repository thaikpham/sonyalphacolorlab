# Picture Profile library: colour, names, palette, photographs — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the spec `docs/superpowers/specs/2026-10-24-pp-library-colour-and-naming-design.md` as one PR: tuned and new originals, `PP-NNN-Mood Words` names, every recipe photograph removed, a parameter-derived palette as the thumbnail, a colour-system filter, contributed photographs as the gallery.

**Architecture:** Four independent tasks run in parallel in their own worktrees and branches (palette module, recipe data and names, photograph removal and gallery, format filter); an integration task merges them on `claude/pp-colour-naming`, wires the palette into the views, writes the content-plane sync script and AGENTS.md; a review pass closes it. Ids and slugs do not change.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Zod 4, Vitest, next-intl, Supabase (no writes from this plan).

## Global Constraints

- Read `CLAUDE.md` and `AGENTS.md` first. Rule 1: never type a camera value from memory — every range comes from `src/lib/camera/constants.ts`.
- One family Noto Sans; 13px floor; dark only; no `border`/`ring`/`outline` outside `:focus-visible`; no raw hex in `src/components/` or `src/app/` except `icon.tsx`, `opengraph-image.tsx`, `manifest.ts`; no Tailwind palette colours (`amber-*`, `sky-*`, …).
- Every user-visible string in `messages/en.json` and `messages/vi.json`, same keys in both. Never translate Sony terms (Picture Profile, Creative Look, gamma names, Look codes) or recipe names.
- No explanatory microcopy. The palette's accuracy line on the recipe page is the one allowed disclaimer.
- The repository is public: nothing from the licensed third-party collection — no value, name or wording, and not its author — is written into any tracked file. Its text extract lives only in the session scratchpad.
- No Supabase reads or writes, no `.env.local` use, no `git push`. Commit on your task's branch only.
- `npm test` and `npm run typecheck` green on your branch before you report; `npm run lint` clean on the files you touched.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: The palette module

**Branch:** `claude/cn-palette` (from `claude/pp-colour-naming`).

**Files:**
- Create: `src/lib/camera/palette.ts`, `src/lib/camera/palette.test.ts`
- Modify: `src/lib/camera/color.ts` (export `oklchToHex`, `CHANNEL_HUE`, `WB_HUE`; `accentHex` becomes `oklchToHex(a)`), `src/lib/camera/effects.ts` (export `fraction`, rewrite `step` on it)

**Interfaces — Produces (exact):**

```ts
// src/lib/camera/palette.ts
export const SWATCH_IDS = ['highlight', 'mid', 'shadow', 'red', 'skin', 'yellow', 'foliage', 'sky', 'blossom'] as const;
export type SwatchId = (typeof SWATCH_IDS)[number];
/** A swatch after every transform and the sRGB gamut map. `css` and `hex` come from the same mapped value. */
export type Swatch = { readonly id: SwatchId; readonly l: number; readonly c: number; readonly h: number; readonly css: string; readonly hex: string };
/** Always nine, in SWATCH_IDS order. Plain data: safe to serialise into a server component's props. */
export type Palette = readonly Swatch[];
export const REFERENCE: Readonly<Record<SwatchId, { l: number; c: number; h: number }>>;
export const PALETTE_WEIGHTS: { /* every magnitude, one object, header "neutral defaults, not measured" */ };
export function paletteFor(recipe: AccentInput): Palette;   // AccentInput from ./color

// src/lib/camera/color.ts (new exports)
export const CHANNEL_HUE: Readonly<Record<'R' | 'G' | 'B' | 'C' | 'M' | 'Y', number>>;
export const WB_HUE: Readonly<{ amber: number; blue: number; green: number; magenta: number }>;
export function oklchToHex(a: { l: number; c: number; h: number }): string;
export function inSrgb(a: { l: number; c: number; h: number }): boolean;
/** Lowers chroma at fixed L and h until the colour is inside sRGB (binary search, 1e-4). */
export function gamutMap(a: { l: number; c: number; h: number }): { l: number; c: number; h: number };

// src/lib/camera/effects.ts (new export)
/** Where a value sits in its range: −1..1 around 0 for a signed range, 0..1 above the minimum otherwise. */
export function fraction(value: number, range: Range): number;
```

**Model** — implement exactly the spec's "Sub-project 5 — the palette": references (table), pipeline order (WB cast → tone → colour → bounds), the documented directions, Color Depth raw (not centred), Color Phase one uniform rotation (positive turns skin towards red, i.e. hue decreases), Knee Auto only on Movie/ITU709 (`ITU709(800%)` is not ITU709), AWB/presets no Kelvin term, Black & White chroma 0 everywhere including the cast, Sepia (CL `SE`) = chroma 0 then one cast `c 0.035, h 70` (same as `accentFor`), S-Gamut family ×0.70, Cinema/S-Cinetone ×0.92, L clamp [0.14, 0.97], then `gamutMap`. Default magnitudes (put them all in `PALETTE_WEIGHTS`; you may adjust within the documented direction if a band test fails, and must report what you changed):

| Parameter | Default magnitude |
|---|---|
| WB cast | chroma = clamp(|vector mired| / 90 × 0.06, 0, 0.10); warmth along hue 65 (+) / 264 (−), tint along 328 (M) / 142 (G), summed as a vector before scaling |
| Gamma (shadow ΔL, highlight ΔL, chroma ×) | Movie/Still/ITU709 (0, 0, 1) · Cine1 (+0.05, −0.04, 0.97) · Cine2 (+0.05, −0.06, 0.97) · Cine3 (−0.02, −0.04, 1) · Cine4 (−0.05, −0.02, 1) · S-Cinetone (+0.03, −0.05, 0.90) · ITU709(800%) (+0.04, −0.08, 0.90) · S-Log2/3 (+0.14, −0.14, 0.55) · HLG* (+0.06, −0.10, 0.80); mid gets half the mean of the two ends |
| Black Level | shadow +0.008/unit, mid +0.003/unit, red/foliage/sky +0.004/unit |
| Black Gamma | shadow +0.006/unit × reach (Narrow 0.6, Middle 1.0, Wide 1.3); mid +0 / +0.002 / +0.004 per unit; Wide only: red/foliage/sky 0.5 × shadow delta |
| Knee Manual | compression = clamp((100 − point)/25, 0, 1) × (5 − slope)/10; highlight ΔL = −0.08 × compression, yellow −0.04 × compression |
| Knee Auto | Movie or ITU709: highlight −0.02; any other gamma: 0 |
| Saturation (PP and CL, f = fraction) | chroma × (f < 0 ? 1 + 0.9f : 1 + 0.6f), after the cast |
| Color Phase | Δh = −2.5° per unit on chromatic swatches only |
| Color Depth (raw) | weight w = cos(Δhue) for |Δhue| ≤ 60° else 0, × min(1, C_ref/0.15); per channel ΔL = −0.010 × value × w, ΔC = +0.006 × value × w; neutrals untouched |
| CL Look base (shadow, mid, highlight ΔL, chroma ×) | ST (0,0,0,1) · PT (0,0,0,0.95; skin L +0.02, C ×0.92) · NT (+0.03,0,−0.03,0.80) · VV (−0.03,0,+0.02,1.25) · VV2 (−0.02,+0.02,+0.04,1.35) · FL (−0.03,0,−0.03,0.85; sky and foliage L −0.03, C ×1.10) · IN (+0.06,+0.02,−0.02,0.90; cast 0.015 at h 70) · SH (+0.10,+0.06,+0.03,0.90) · BW ×0 · SE ×0 then cast 0.035 at h 70 |
| CL Contrast | shadow −0.012/unit, highlight +0.008/unit; red/foliage 0.5 × shadow delta, yellow/skin/sky 0.5 × highlight delta |
| CL Highlights | highlight +0.008/unit, skin and yellow +0.004/unit |
| CL Shadows | shadow +0.012/unit, red/foliage +0.006/unit |
| CL Fade (f = value/9) | shadow +0.20f, mid +0.04f, highlight −0.04f, chroma × (1 − 0.27f) |
| Detail, Sharpness, Sharpness Range, Clarity | not painted |

`css` is `oklch(L% C H)` in the `accentCss` shape; `hex` is `oklchToHex` of the same mapped value.

- [ ] **Step 1: Export `fraction` and rewrite `step` on it.** In `effects.ts`: `export function fraction(value, range) { const pivot = range.min < 0 ? 0 : range.min; ... }` — for a signed range (min < 0) return (value − 0)/(max) when value > 0 else value/|min|; for an unsigned range return (value − min)/(max − min). Keep `step()` returning the same steps it does today (its pivot for an unsigned range is the midpoint; do NOT change `step`'s behaviour — write `fraction` beside it and leave `step` alone if rewriting it would change any output). Run `npx vitest run src/lib/camera` — all green.
- [ ] **Step 2: Generalise the hex emitter.** In `color.ts`: export `CHANNEL_HUE`, `WB_HUE`; add `oklchToHex`, `inSrgb`, `gamutMap`; make `accentHex(a)` return `oklchToHex(a)`. Add to `palette.test.ts` (or `color.test.ts` if one exists) a test that `accentHex(accentFor(r)) === oklchToHex(accentFor(r))` for every recipe in `data/recipes.seed.json`, and that `gamutMap` returns an in-gamut colour with the same L and h for `{ l: 0.58, c: 0.40, h: 28 }`.
- [ ] **Step 3: Write the failing palette tests** in `src/lib/camera/palette.test.ts`, importing ranges from `constants.ts`, never a literal bound. Fixtures: `NEUTRAL_PP` (kelvin 5500, no shift, Movie/Movie, Black Level 0, Black Gamma Middle 0, Knee Manual point 100 slope +5, Saturation 0, Phase 0, Color Depth all 0, Detail 0 Manual 0 Type3 0 0 0) and `NEUTRAL_CL` (ST, all 0, Fade 0, saturation 0, sharpness 0, range 3, clarity 0, kelvin 5500). Cases:
  1. identity: both fixtures return `REFERENCE` (l, c, h) to 1e-6, nine swatches in `SWATCH_IDS` order;
  2. sweeps (each over `range.min..max` by `range.step`, everything else neutral): Black Level ↑ ⇒ shadow L non-decreasing and strictly higher at max than min; Black Gamma level ↑ ⇒ shadow L ↑, and at +7 shadow ΔL Narrow < Middle < Wide; Knee point ↓ ⇒ highlight L ↓ (slope 0), slope +5 ⇒ highlight equals reference; PP and CL Saturation ↑ ⇒ red C non-decreasing, and red C at PP +32 equals red C at CL +9 within 1e-3; Color Phase ↑ ⇒ skin h decreases by a constant per unit, mid unchanged; each Color Depth channel ↑ ⇒ the swatch nearest that channel's hue loses L and gains C, and highlight/mid/shadow bit-identical; CL Contrast ↑ ⇒ shadow ↓ highlight ↑; CL Highlights ↑ ⇒ highlight ↑ shadow unchanged; CL Shadows ↑ ⇒ shadow ↑ highlight unchanged; CL Fade ↑ ⇒ shadow ↑ and red C ↓; Kelvin 5500→9900 ⇒ mid C ↑ with h within 65 ± 20; shift A ⇒ h within 65 ± 20, B ⇒ 264 ± 20, M ⇒ 328 ± 20, G ⇒ 142 ± 20; A7 with 2500K ⇒ mid C smaller than 2500K alone;
  3. Knee Auto: Movie ⇒ highlight lower than reference; Cine1 ⇒ highlight equals the Cine1 manual-off value;
  4. monochrome: every seed recipe with colour mode `Black & White` or Look `BW` has C === 0 on all nine (also with an A7 shift added); every `SE` recipe has all nine within h 70 ± 3 and 0 < C ≤ 0.036;
  5. not painted: changing any Detail field, CL sharpness, sharpness range or clarity leaves `paletteFor` deep-equal;
  6. Look order: mean chromatic C of the bare Look base on `NEUTRAL_CL` is VV2 > VV > ST > NT, SH's shadow is the lightest base, FL's highlight is below ST's;
  7. bands over every recipe in `data/recipes.seed.json`: highlight L ≥ 0.70; shadow L ≤ mid L − 0.06; 0.14 ≤ L ≤ 0.97 on all; at least three swatches with L ≥ 0.5; `inSrgb` on all;
  8. emitters: for every seed recipe and swatch, `css` parses back (regex `^oklch\((\d+(\.\d+)?)% [\d.]+ [\d.]+\)$`) to the swatch's l/c/h, and `hex === oklchToHex({l,c,h})`;
  9. distinct: for every pair of seed recipes whose painted settings differ (compare `JSON.stringify` of the recipe with Detail, sharpness, sharpnessRange, clarity removed and with `whiteBalance` replaced by `wbBalance()`'s warmth/tint), the palettes differ (some swatch differs by > 1e-4 in l, c or h);
  10. source hygiene: `palette.ts` contains no `#` followed by a hex digit.
  Run `npx vitest run src/lib/camera/palette.test.ts` — expect FAIL (module missing).
- [ ] **Step 4: Implement `palette.ts`** per the model above. Header comment: what it is (a reading of the settings in Sony's documented directions), what it is not (a camera preview), what it leaves out (Detail-axis, preset/AWB Kelvin), and that `PALETTE_WEIGHTS` are neutral defaults to be refit from the a7 IV ColorChecker shoot. Run the tests until green.
- [ ] **Step 5: Report the catalogue.** Write a throwaway script in the scratchpad (not the repo) that prints, over every seed recipe: nearest-neighbour RMS distance in OKLab across the nine swatches (median, min, the five closest pairs with ids) and how many swatches hit the L floor or needed gamut mapping. Include the numbers in your final report.
- [ ] **Step 6: Commit** `git add src/lib/camera && git commit` — "Palette: nine swatches graded by a recipe's own settings, in Sony's documented directions".

---

### Task 2: Recipe data and names

**Branch:** `claude/cn-recipes` (from `claude/pp-colour-naming`).

**Files:**
- Modify: `src/lib/originals/pp.ts` (four edits, 12 new, every `name` → new name), `scripts/emit-seed.ts`, `data/recipe-taxonomy.json`, `data/translations.vi.json`, `src/lib/camera/accent-fidelity.test.ts` (look recipes up by id)
- Create: `src/lib/originals/cl.ts`, `src/lib/recipes/names.ts`, `src/lib/recipes/names.test.ts`, `src/lib/originals/originals.test.ts`
- Regenerate: `data/recipes.seed.json`, `data/translations.seed.json`, `data/sony-asia-credits.json` (via `npm run seed:emit`)

**Interfaces — Produces:**

```ts
// src/lib/originals/cl.ts
export const ORIGINAL_CL: readonly OriginalRecipe[];   // OriginalRecipe from ./pp

// src/lib/recipes/names.ts
export const NAME_VOCABULARY: ReadonlySet<string>;     // the spec's closed list, exactly
export const RECIPE_NAME_RE: RegExp;                    // /^(PP|CL)-(\d{3})-([A-Z][a-z]+(?: [A-Z][a-z]+){1,2})$/ (allow 'HLG' as a word)
/** New name for every recipe whose source is not ours: the 10 kept legacy Picture Profiles and the 37 Sony Asia Creative Looks. Keyed by recipe id. */
export const RECIPE_NAMES: Readonly<Record<string, string>>;
export const TONE_WORDS: Readonly<Record<'warm' | 'cool' | 'mono' | 'neutral', readonly string[]>>; // Warm,Golden,Amber · Cool · Mono,Sepia · Neutral
export function parseRecipeName(name: string): { format: 'pp' | 'cl'; number: string; words: string[] } | null;
```

Data: every number, name and taxonomy entry is in the spec ("Sub-project 1a/1b/1c", "Sub-project 2" tables). Ids: new Picture Profiles `SCL-PP-071`…`SCL-PP-082`, new Creative Looks `SCL-CL-038`…`SCL-CL-045`; slugs are the mood words kebab-cased (`silver-hard-muted`); `name` is the new name; `published: false`. White balance as in the tables (`5500K B0.5` → `{ mode: 'kelvin', kelvin: 5500, shift: { ab: { axis: 'B', amount: 0.5 } } }`). Detail column order is Level · V/H · B/W · Limit · Crispening · Hi-Light, Mode `Manual`. Knee "M 92.5% +1" → `{ mode: 'Manual', point: 92.5, slope: 1 }`; "Auto" → `{ mode: 'Auto' }`. Tags: 3–5 lowercase kebab words describing use, never a person. Each new recipe gets an `intent` line and an English description (2–3 sentences, what the settings do in Sony's terms, no promise the numbers cannot keep), and a Vietnamese description in `data/translations.vi.json` in the style of the existing ones (Sony terms stay English). 081 Flat Log Base and 080 Range HLG Daylight say plainly they are for grading / HDR delivery.

- [ ] **Step 1: Write `originals.test.ts`** (fails until data exists): every `ORIGINAL_PP` and `ORIGINAL_CL` entry parses with `recipeSchema`; `published === false`; ids unique and contiguous (PP 048–082, CL 038–045); Knee `Auto` only when gamma is Movie, ITU709, an S-Log or an HLG; |Color Phase| ≤ 2 and Phase 0 on every recipe whose taxonomy situations include `portrait`; no Color Depth at ±7; gamma/colour-mode pairs are one of Movie/Movie, Still/Still, S-Cinetone/S-Cinetone, Cine1|Cine2/Cinema, ITU709/Pro|709tone|ITU709 Matrix, HLG*/BT.2020|709, S-Log3/S-Gamut3|S-Gamut3.Cine, S-Log2/S-Gamut, any/Black & White, Cine3|Cine4/Still (the set's documented exception, stated in `intent`); every original has an EN description and a VI entry in `translations.vi.json`; every original has a manifest entry in `recipe-taxonomy.json`.
- [ ] **Step 2: Write `names.test.ts`** over `data/recipes.seed.json` + `taxonomyFor`: every name matches `RECIPE_NAME_RE`; its number equals the id's number and its prefix the format; every word is in `NAME_VOCABULARY`; names unique; sorted word sets unique; a name containing a `TONE_WORDS` word agrees with `taxonomyFor(recipe).tone`; `RECIPE_NAMES` keys are exactly the seed ids with a legacy id or from Sony Asia (no originals, no missing).
- [ ] **Step 3: Implement** `cl.ts`, the edits and 12 additions in `pp.ts`, `names.ts`, `emit-seed.ts` (read `ORIGINAL_CL` beside `ORIGINAL_PP`, validate, apply `RECIPE_NAMES` to legacy and Sony Asia rows after migration/import — slugs already derived from the source names stay as they are — refuse a duplicate id/slug/name), the taxonomy and Vietnamese entries. `npm run seed:emit`; read its output.
- [ ] **Step 4: Fix tests the rename touches.** `accent-fidelity.test.ts`: find Kyoto Jade and Vintage Slide by id (`SCL-PP-002`, `SCL-PP-015`). Grep `src` for any test asserting an old recipe name and switch it to id or slug. Run `npm test` — green.
- [ ] **Step 5: Distance check** (scratchpad only, never committed): parse the licensed recipes from the private extract and compute, for each of the 12 new Picture Profiles, the distance to its nearest licensed recipe and to its nearest other original, using the metric in the spec's "Validation" (same type colour/mono only; normalised parameter distance with a gamma and a colour-mode mismatch penalty — define it, state it, apply it the same way to the 23 existing originals so the thresholds 25.3 / 15.8 / 12 are comparable). For the 8 Creative Looks: Euclidean over contrast, highlights, shadows, fade, saturation, sharpness, sharpness range, clarity plus WB warmth/17 and tint/17, against every Sony Asia recipe of the same Look ≥ 4. If a new recipe fails, change it minimally within its mood and say what changed. Report the numbers.
- [ ] **Step 6: Commit** — "Originals: four tuned, twenty new, unpublished; every recipe named PP-NNN or CL-NNN by its mood".

---

### Task 3: Photographs removed; contributed photographs are the gallery

**Branch:** `claude/cn-photos` (from `claude/pp-colour-naming`).

**Files:** see the spec's "Sub-project 4" removal list and "Sub-project 7". Delete: `public/recipes/`, `data/images.seed.json`, `src/lib/recipes/{vendored-images,images,image-store,image-dev-store}.ts` and their tests, `src/lib/recipes/ordering.test.ts` (only if it tests `photosFirst` alone — keep any other case it holds by moving it), `src/components/recipe-photo.tsx`, `src/components/colorlab/admin/image-panel.tsx`, `src/app/api/admin/recipes/[id]/images/route.ts`, `src/app/api/admin/recipes/[id]/images/[imageId]/route.ts`, `src/app/api/admin/recipes/recipe-images-route.test.ts`, `scripts/vendor-recipe-images.ts`, `scripts/vendor-recipe-uploads.ts`, `scripts/lib/recipe-image-manifest.ts` (+test), `src/lib/legacy/images.legacy.js`. Modify: `src/lib/recipes/source.ts` (drop `RecipeView.images`, `seedImages`, `imagesFor`, `photosFirst` and their imports; order stays by id), `src/components/recipe-card.tsx` (render `RecipeColorField` unconditionally for now — Task 5 replaces it), `src/components/recipe-gallery.tsx`, `src/app/[locale]/recipe/[slug]/page.tsx` (`<RecipeGallery slug={slug} title={title} />`), `src/lib/search/documents.ts` (no `imageUrl` for recipes), `src/lib/images/catalogue-loader.ts` (drop the `/recipes/` rung), `src/components/colorlab/admin/recipe-admin.tsx` (no `ImagePanel`), `src/lib/recipes/upload-limits.ts` (drop `MAX_ALT_CHARS` if only recipe images use it), `scripts/push-supabase.ts` + `scripts/lib/seed-rows.ts` (no image rows), `scripts/doctor.ts` (no `checkImages`), `package.json` (`vendor:images`, `vendor:uploads`, its `//` note), `.gitignore` (`recipes-dev` entries), `src/lib/community/request.ts`, `src/lib/community/errors.ts`, `src/components/recipe-community-section.tsx`, `messages/en.json` + `messages/vi.json`, and every test listed in the spec's removal paragraph (pipeline, source, dev-store, catalogue-loader, admin-gate, content-write-boundaries, recipe-admin, upload-limits, recipe-gallery, service, messages). Keep every migration, `scripts/supabase/tables.ts`, `lab/image-process.ts`, `sharp`, `data/sony-asia-credits.json`.

**Interfaces — Produces:** `RecipeView` without `images`. `RecipeGallery({ slug, title }: { slug: string; title: string })`. `COMMUNITY_ERRORS.expiringImageHost = 400`. `EXPIRING_IMAGE_HOSTS: readonly string[]` and `isExpiringImageHost(url: string): boolean` exported from `src/lib/community/request.ts` (client-safe: no server imports in that file — if it has some, put the list and the function in a new `src/lib/community/image-hosts.ts` and import it from both).

- [ ] **Step 1: Delete the origin and the intake** (files above) and fix every import. Run `npm run typecheck` until clean.
- [ ] **Step 2: Narrow the tests** that read deleted paths (spec list). Each change keeps what the test still protects: e.g. `admin-gate.test.ts` drops the two routes from `ADMIN_ROUTES`; `recipe-admin.test.ts` drops the deleted emitters and the orphaned `recipeAdmin.errors` keys (`noFile`, `slotsFull`, `recipeNotFound` — and any other key no remaining file emits) from both message files. Run `npm test` — green.
- [ ] **Step 3: Gallery loading state.** In `recipe-gallery.tsx`, track `const [loaded, setLoaded] = useState(false)` set true when the GET settles (ok, error or offline). While `!loaded`, render three placeholder tiles (`bg-glass rounded-sm`, the collage's own grid classes, `aria-hidden`) and no empty-state text. Test (source assertion in `recipe-gallery.test.ts`): the empty state renders only when `loaded && allPhotos.length === 0`.
- [ ] **Step 4: Preview gate.** Preview `<img>` gets `onLoad={(e) => setPreview({ src, ok: e.currentTarget.naturalWidth >= 320 })}` and `onError → { ok: false }`; `handleAddPhoto` refuses before `setSharing(true)` when the preview for the current URL is not `ok`, with `t('errPreviewLoad')` or new `t('errPreviewSmall')` (EN "The photo is smaller than 320 pixels wide." / VI "Ảnh nhỏ hơn 320 pixel chiều ngang."). Keep the statement order `recipe-gallery.test.ts` pins; add an assertion for the new refusal.
- [ ] **Step 5: Expiring hosts.** `EXPIRING_IMAGE_HOSTS = ['fbcdn.net', 'fbsbx.com', 'cdninstagram.com']`; `isExpiringImageHost(url)` matches the hostname or a subdomain of one. `httpsImageUrlSchema` gets `.refine(u => !isExpiringImageHost(u), { message: 'expiringImageHost' })`; the photo route maps that issue to `communityErrorBody('expiringImageHost')`; the gallery's and the proposal form's https checks also call `isExpiringImageHost` and show `community.errors.expiringImageHost` (EN "Facebook and Instagram links expire. Use a link that stays up, such as Flickr or Google Photos." / VI "Liên kết Facebook và Instagram sẽ hết hạn. Hãy dùng liên kết lâu dài như Flickr hoặc Google Photos."). Tests: unit test for `isExpiringImageHost` (`https://scontent.xx.fbcdn.net/a.jpg` true, `https://notfbcdn.net/a.jpg` false, `https://flickr.com/a.jpg` false); `community-routes.test.ts` case — POST with an fbcdn URL answers 400 `expiringImageHost` and inserts nothing; `community-error-codes.test.ts` parity passes.
- [ ] **Step 6: Run** `npm test`, `npm run typecheck`, `npm run lint`, the CLAUDE.md greps. **Commit** — "Recipe photographs removed with their intake; contributed photographs are the gallery, gated on a decoded preview and a host that lasts".

---

### Task 4: Colour-system filter

**Branch:** `claude/cn-format` (from `claude/pp-colour-naming`).

**Files:** Modify `src/lib/camera/constants.ts` (add `export const FORMAT_LABELS: Readonly<Record<'pp' | 'cl', string>> = { pp: 'Picture Profile', cl: 'Creative Look' }` and `export const RECIPE_FORMATS = ['pp', 'cl'] as const` if absent), `src/lib/recipes/browse.ts`, `src/lib/recipes/browse.test.ts`, `src/components/browse/browse-filters.tsx`, `src/components/browse/recipe-browse.tsx`, `src/app/colorlab-page.test.ts`, `src/components/site-header.test.ts`, `messages/en.json` (`browse.system: "Colour system"`), `messages/vi.json` (`browse.system: "Hệ màu"`).

**Interfaces — Produces:** `BrowseFilters.format: 'pp' | 'cl' | null`; `parseFormat(v: unknown)`; `Facets.formats: Record<'pp' | 'cl', number>`; `colorlabSearch` keeps `format` (order q, style, tone, format); `Browsable` gains `format`.

- [ ] **Step 1: Failing tests** in `browse.test.ts`: `browseFilters(null, { format: 'cl' }).format === 'cl'`, `{ format: 'xx' }` → null; `colorlabSearch(new URLSearchParams('format=cl&look=FL&tag=x&q=a'), {})` → `'q=a&format=cl'`; `browseHref({ ...NO_FILTERS, format: 'pp' })` → `'/colorlab?format=pp'`; facets: with `format: 'pp'` selected the `formats` row is counted with format released (both counts present), and the other rows are counted inside `pp`; `matchesBrowse` excludes the other format. Give the fixtures a `format`.
- [ ] **Step 2: Implement** in `browse.ts`; add the group first in `browse-filters.tsx` (`label: t('system')`, `name: (id) => FORMAT_LABELS[id]`); remove `format` from the `legacy` object in `recipe-browse.tsx` (keep `look`, `tag`) and update its comment.
- [ ] **Step 3: Update the source assertions** in `colorlab-page.test.ts` and `site-header.test.ts` (`site-header` hidden inputs now carry `format`: the case `/colorlab?q=a&style=film&tone=warm&format=cl&look=FL&tag=portrait` expects `['style=film','tone=warm','format=cl']`).
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, lint. **Commit** — "Browse: a colour-system group, Picture Profile or Creative Look, first in the row".

---

### Task 5: Integration (on `claude/pp-colour-naming`, after Tasks 1–4)

**Files:** Create `src/components/recipe-palette.tsx`, `scripts/sync-library.ts`; delete `scripts/refresh-pp-library.ts`; modify `src/lib/recipes/source.ts` (`RecipeView.palette` via `paletteFor` in `toView`, `matchesQuery` reads the slug), `src/components/recipe-card.tsx`, `src/app/[locale]/recipe/[slug]/page.tsx`, `src/app/[locale]/recipe/[slug]/opengraph-image.tsx`, `src/lib/search/documents.ts`, `src/lib/search/evaluation/queries.ts`, `messages/*.json` (`palette` namespace), `package.json` (`library:sync`), `AGENTS.md`, `src/components/recipe-color-field.tsx` (delete when unused).

- [ ] **Step 1: Merge** `claude/cn-palette`, `claude/cn-recipes`, `claude/cn-photos`, `claude/cn-format` into `claude/pp-colour-naming`; resolve conflicts (expected: `messages/*.json`, `source.ts`, `recipe-card.tsx`); `npm run seed:emit`; `npm test`.
- [ ] **Step 2: `RecipePalette`** server component, `variant: 'card' | 'page'`. Card: `grid h-full w-full grid-cols-[1fr_3fr]`, left `grid grid-rows-3` highlight/mid/shadow, right `grid grid-cols-6` red/skin/yellow/foliage/sky/blossom, each cell `style={{ background: swatch.css }}`, `role="img"`, `aria-label={t('label', { tone, style })}`. Page: same grid taller (`h-40 sm:h-48`) inside a wrapper with `rounded-[var(--radius-lg)] overflow-hidden`, then a row of nine `.meta` names (`palette.swatches.<id>`), then `.meta` `palette.note`. Messages: `palette.label` EN "{tone}, {style} palette" / VI "Bảng màu {tone}, {style}"; `palette.note` EN "Derived from the settings, not a camera preview." / VI "Suy ra từ thông số, không phải ảnh chụp từ máy."; `palette.swatches` EN highlight "Highlight", mid "Mid", shadow "Shadow", red "Red", skin "Skin", yellow "Yellow", foliage "Foliage", sky "Sky", blossom "Blossom" / VI "Sáng", "Trung", "Tối", "Đỏ", "Da", "Vàng", "Lá", "Trời", "Hồng".
- [ ] **Step 3: Card and page.** Card renders `RecipePalette variant="card"` in the 210px slot. Recipe page: drop the `recipe.id` chip; title is `recipeTitle(recipe.name)`; palette under the description. OG: keep the gradients, add a row of nine `hex` swatches (flex, no gap property — use margins), title from `recipeTitle`.
- [ ] **Step 4: Search.** `recipeDoc`: `exact` adds the code (`PP-048`) squashed; `tags` adds the slug's words; `matchesQuery` haystack adds the slug. Eval: add `{ q: 'PP-009', type: 'exact', top1: 'SCL-PP-009' }`, `{ q: 'teal muted', type: 'mood', relevant: ['SCL-PP-009'] }`, `{ q: 'mojave sun', … top1 'SCL-PP-001' }` stays; run `npm run search:eval` — no query below its previous recall.
- [ ] **Step 5: `scripts/sync-library.ts`** (`npm run library:sync -- --target content [--apply]`), per the spec's "Where things live": plan first, writes only with `--apply`; unpublish `RETIRED_RECIPE_IDS` still published; update `name` where the seed differs; for seed recipes with no legacy id that are unpublished on the project, overwrite settings/white balance/tags/name via `toRow` and upsert their translations; insert seed recipes the project lacks as unpublished with translations; refuse a slug owned by another id; never delete; never change a published recipe's settings. Unit-test the pure planner (`planLibrarySync(seed, existing) → { unpublish, rename, refresh, insert }`) in `scripts/sync-library.test.ts`.
- [ ] **Step 6: AGENTS.md** — names rule (syntax, closed vocabulary, tone-word agreement), photographs come only from readers, the palette contract (never a preview, `PALETTE_WEIGHTS` refit), the colour-system filter in the browse rules, `library:sync`. Update the "three libraries" paragraph's script name.
- [ ] **Step 7: Verify** `npm run verify`, greps, production build served with `next start`, browser at 390px and desktop: `/colorlab`, `/colorlab?format=cl`, a recipe page, `/vi/recipe/hue-silk` 404 (unpublished), the OG image URL. Commit.

### Task 6: Review

- [ ] Run an adversarial review workflow over the full diff (correctness, Sony faithfulness of the palette and the twenty recipes, design rules, i18n, tests that pin nothing); fix what survives; push; PR; CI; merge (owner-authorised); check the live site.
