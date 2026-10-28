# Recipe names computed from the settings; the slug becomes the code — design

Date: 2026-10-28. The owner's request, the same day: rename every recipe and
classify it by format, `PP-001` / `CL-001`; drop every former name (Mojave Sun …)
and every colour name that is a proper noun; name each recipe from the tone and mood
its own White Balance and Picture Profile or Creative Look settings produce.

Two tasks. Task A (N1–N4) computes the names and leaves every slug where it is.
Task B (S1–S5) moves the slug to the code, so a later rename never moves a URL.

## Decisions — names (task A)

| # | Question | Decision |
|---|---|---|
| N1 | Who writes a name | Nobody. `nameFor(recipe, catalogue)` in `src/lib/recipes/names.ts` returns `<PP\|CL>-<NNN>-<Word> <Word> <Word>[ <Word>]`; the number is the id's. `RECIPE_NAMES` and every hand-written name in `src/lib/originals/pp.ts` and `cl.ts` are deleted. `seed:emit` sets `name = nameFor(recipe, seed)`. `names.test.ts` pins every seed name to it. |
| N2 | Where the words come from | Only the recipe's own White Balance and settings, graded with the measures the rest of the app already uses, so a name cannot disagree with the palette, the effect rows or the White Balance summary: `fraction()` and the step grading in `effects.ts`, `gradeWarmth` / `monochromeOf` in `color.ts`, and `paletteFor()` read under the light the recipe is built for (`designedLightFor`). No threshold of its own: every cut is a range in `constants.ts`, the 55% "strong" cut of `step()`, `gradeWarmth`'s mired bands, or a `PALETTE_WEIGHTS` magnitude. No word names a place, a situation, a use, a film stock, a Creative Look code, a brand or a person. |
| N3 | Word order | Temperature, tonality, colour; a fourth word only to break a tie. Below. |
| N4 | What the tests pin | Every seed name equals `nameFor`; the vocabulary is exactly the words `nameFor` can produce and none is a situation synonym, a Creative Look code or label (see "Three Look labels" below) or on a short banned list; the temperature word agrees with the palette lean; mono recipes start Mono or Sepia; the tie-break is deterministic. The temperature word agrees with the taxonomy tone only where `data/recipe-taxonomy.json` does not set the tone; disagreements with the editor's tone are reported, never fixed by editing the manifest. |

### 1. Temperature

Colour recipes: the palette's mid swatch, read under the designed light. Its lean on the
amber axis (hue 65, `WB_HUE.amber`) — `c · cos(h − 65)`, the projection `names.test.ts`
already used — is turned back into mireds through the palette's own cast scale
(`PALETTE_WEIGHTS.cast`: `lean / chroma × miredScale`) and graded by `gradeWarmth`:

| `gradeWarmth` | word |
|---|---|
| strong-warm (≥ 55 mired) | Golden |
| warm | Warm |
| neutral (inside the band below) | Neutral |
| cool | Cool |
| strong-cool (≤ −80 mired) | Icy |

The neutral band is `gradeWarmth`'s 12 mired (`NEUTRAL_MIRED_BAND`), widened to one
shift step (`MIRED_PER_SHIFT_STEP`) while the recipe sets an A/B shift: the White
Balance summary's rule, because a step's mired value is fitted, not published, and a
name inside one step of neutral would be inventing a side (Mojave Sun, 7000K B3, reads
Neutral).

The green–magenta lean is the same projection on the magenta axis (hue 328,
`WB_HUE.magenta`). It takes the slot — Rosy for magenta, Mint for green — when it
"clearly dominates": it is larger than the amber–blue lean by at least its own neutral
band (12 mired, one shift step while a G/M shift is set).

Monochrome recipes (`monochromeOf`): Mono for black and white, Sepia for sepia.

### 2. Tonality

The most salient contrast-axis setting, by absolute fraction of its own range; ties go
to the first listed. Nothing on the contrast axis moving: Even.

Picture Profile:

| setting | salience | word |
|---|---|---|
| Gamma in the S-Log or HLG family (`PP_FLAT_GAMMA`, filtered from `PP_GAMMA`) | 1 — the whole curve | Flat |
| Black Level | \|fraction\| | plus Matte, minus Deep |
| Black Gamma | \|fraction(level)\| × the range's reach (`PALETTE_WEIGHTS.blackGamma.reach`: Narrow 0.6, Middle 1, Wide 1.3) | plus Matte, minus Deep |
| Knee Manual | the palette's compression (`kneeCompression`: how far the point sits below 100% times how gentle the slope is) | Soft |

Creative Look:

| setting | salience | word |
|---|---|---|
| Contrast | \|fraction\| | plus Punchy, minus Soft |
| Fade | fraction | mild Matte, strong Faded (`stepFromMin`) |
| Highlights, strong plus only | fraction | Airy |
| Shadows, strong minus only | \|fraction\| | Deep |

### 3. Colour

Colour recipes: the Saturation fraction (PP −32…+32, CL −9…+9, from `constants.ts`) plus,
for a Picture Profile, the fraction of the mean Color Depth (−7…+7), clamped to −1…1 and
graded by `step()`'s rule: strong up Vivid, mild up Rich, zero Natural, mild down Muted,
strong down Pale.

Monochrome recipes have no colour to name, so the slot says the detail:

- Picture Profile: Detail Level graded around 0 — Crisp up, Gentle down, Plain at 0.
- Creative Look: the larger of Sharpness and Clarity, graded from the minimum as their
  effect rows are (`stepFromMin`) — strong Crisp, mild Plain, both at 0 Gentle.

### 4. The tie-break

Recipes are named in order, Picture Profile first, then by number. When a recipe's three
words equal an earlier recipe's three, it takes a fourth: the most salient descriptor not
already in its name and whose four words no earlier recipe has. Descriptors, ties to the
first listed:

| descriptor | salience | words |
|---|---|---|
| detail | PP \|fraction(Detail Level)\|; CL the larger fraction of Sharpness and Clarity for Crisp (strong only), 1 for Gentle (both at 0) | Crisp, Gentle |
| key | PP \|fraction(Black Level)\|; CL the larger \|fraction\| of Highlights and Shadows | plus Bright, minus Dark |
| tint | the G/M shift as a fraction of `WB_SHIFT_AXIS` | M Rosy, G Mint |

If no descriptor qualifies, the name keeps its three words: the code is unique.

### Three Look labels

`Neutral`, `Vivid` and `Sepia` are both N3 words and Creative Look labels (NT, VV,
SE). They stay: each is a graded reading here (a temperature band, a saturation step,
`monochromeOf` = sepia), and Sepia can only ever be the SE Look. The vocabulary test
refuses every other Look label and every Look code, and names these three as the only
exceptions so a fourth cannot slip in.

### Vocabulary

Exactly the words above, 27: Golden, Warm, Neutral, Cool, Icy, Rosy, Mint, Mono, Sepia ·
Flat, Matte, Deep, Soft, Punchy, Faded, Airy, Even · Vivid, Rich, Natural, Muted, Pale ·
Crisp, Gentle, Plain · Bright, Dark. `RECIPE_NAME_RE` allows three or four words.

### Slugs in task A

Unchanged. Every seed recipe keeps the slug it moved to on 2026-10-24 (the frozen batch,
`currentSlugOf`), so `seed:emit` writes the same slugs and `former-slugs.json` as today;
a recipe in no batch takes `slugFor(name)`. Task B replaces this with the code.

## Decisions — slugs (task B)

| # | Question | Decision |
|---|---|---|
| S1 | Slug shape | The code, lowercased: `slugFor(id)` → `pp-001`, `cl-045`. A name can change from now on without moving a URL. |
| S2 | The move | A second batch recorded like the first: `data/slug-moves/2026-10-28.json` (each seed recipe's 2026-10-24 slug → its code slug), a `SLUG_MOVES` entry with its own two migrations — content `20261028000000_recipe_code_slugs.sql` (slugs only, idempotent, one transaction, the control-plane guard of `20261024000000`) and control `0021_recipe_slugs_to_code_only.sql` (`recipe_slug` in comments, proposals and photos from both earlier spellings to the code slug, idempotent, a hidden twin kept hidden as in `0020`). `former-slugs.json` maps every earlier spelling to the final code slug, generated from the batches. `migration-roots.test.ts` checks each batch against its own two files and proves `20261028000000` against PGlite, also after `20261024000000`. Batch 1's files are applied in production and are never edited. |
| S3 | Readers | `resolveRecipeSlug` finds a recipe by any spelling: 308 when the requested spelling is older than the stored one, 307 when newer; never a static redirect. `slugAliases(slug)` returns every generation. Search indexes the stored slug and the code. `library:sync` matches and writes whichever spelling the database holds, before or after `20261028000000`, and refuses a project holding two spellings of one recipe. |
| S4 | Legacy links | The `?id=` map and `RETIRED_LEGACY_IDS` point at code slugs, derived through the map. |
| S5 | Docs | AGENTS.md "Names, palette, pictures" says names are computed and the slug is the code. The runbook gets the owner's steps: merge (0021 applies), wait for the deploy, apply `20261028000000` by hand, `library:sync -- --target content --apply` for the names, flush the catalogue cache. |

## Out of scope

Retuning any palette magnitude, changing `data/recipe-taxonomy.json`, and any change to
recipe settings or numbering.
