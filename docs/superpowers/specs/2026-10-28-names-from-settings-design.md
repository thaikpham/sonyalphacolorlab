# Recipe names computed from the palette; the slug becomes the code — design

Date: 2026-10-28. The owner's request, the same day: rename every recipe and
classify it by format, `PP-001` / `CL-001`; drop every former name (Mojave Sun …)
and every colour name that is a proper noun; name each recipe from the tone and mood
its own White Balance and Picture Profile or Creative Look settings produce.

Three tasks. Task A (N1–N4) computes the names and leaves every slug where it is.
Task B (S1–S5) moves the slug to the code, so a later rename never moves a URL.
Task C (R1–R5, below) rebuilt the reading on the rendered palette, after task A's
names repeated and ran to four words.

## Why task A's reading was replaced (task C)

Task A read each word off individual dials. Two recipes that differ only by their
Creative Look then read the same, because a Look's own base (`PALETTE_WEIGHTS.looks`:
shadow / mid / highlight lightness, a chroma factor, a cast) and a Picture Profile's
gamma and colour mode moved no dial it read: `Neutral Even Natural` ×5 (CL-003, 007,
011, 033, 034), `Warm Deep Vivid` ×4, `Warm Soft Rich` ×3. The fourth tie-break word
that told them apart pushed the recipe page to 6.2109 screens, over
`e2e/first-screen.spec.ts`'s 6.2 cap.

## Decisions — names (tasks A and C)

| # | Question | Decision |
|---|---|---|
| N1 | Who writes a name | Nobody. `nameFor(recipe, catalogue)` in `src/lib/recipes/names.ts` returns `<PP\|CL>-<NNN>-<Word> <Word> <Word>`; the number is the id's. `RECIPE_NAMES` and every hand-written name in `src/lib/originals/pp.ts` and `cl.ts` are deleted. `seed:emit` sets `name = nameFor(recipe, seed)`; `/admin` sets it on every create and save (R3). `names.test.ts` pins every seed name to it. |
| R1 | Where the words come from | The rendered palette: `paletteFor(recipe, { light: designedLightFor(id) })`, which already combines the White Balance, every dial, the gamma and colour mode, and the Creative Look base. Each word is a change from a reference palette of the same format, graded as a fraction of the largest change the palette can make in that direction for that format, with the 55% strong cut of `effects.ts`. No magnitude lives in `names.ts`. |
| R2 | How many words, and when two recipes clash | Exactly three, always. A clash replaces the later recipe's least salient slot with another honest reading of its own (below); the words are unique across the 90 seed recipes except where two recipes render the same palette with the same detail. |
| R3 | /admin | The name is computed on the server from the validated settings, never read from the body (`computedRecipeName` in `admin-store.ts`); the field is a read-only display with field guidance. It is named among every other readable recipe in the store, drafts included — the set the seed is named across; among the published rows alone, saving 34 of the 90 seed recipes with no dial changed would rename them. The slug is `slugFor(id)` at creation and never changes. |
| R5 | The gate | `npm run test:screens` passes at its existing caps, `e2e/first-screen.spec.ts` included; no budget is raised. |
| R4 | Search | Indexes the current name, the code (and its `SCL-` id alias), the code slug and the taxonomy terms — never an earlier slug or name. Redirects and `slugAliases` for community rows are unchanged. |
| N4 | What the tests pin | Every seed name equals `nameFor`; three words; the vocabulary is exactly what the reading can produce (swept over the range ends) and none is a situation synonym, a Look code or label (see "Three Look labels"), a place, a stock, a brand or a person; every word is supported by its own reading; the words are unique but for recipes that `readsAlike`; the temperature word agrees with the palette lean; the browse-tone agreement of task A. |

### The references

- **Creative Look:** ST with every signed dial at 0 and every unsigned one at its
  minimum (`DEFAULT_CL_SETTINGS`, `src/lib/camera/defaults.ts`).
- **Picture Profile:** `constants.ts` marks no default, and neither does the guide it
  cites: TP0000909109 lists no option as "default", and TP1000649066 calls PP1–PP11
  "example setting[s]". What TP0000909109 does give is the rendering without a Picture
  Profile: Gamma [Still] "Standard gamma curve for still images", Color Mode [Still]
  "standard color reproduction for still images when Picture Profile is not used"
  (re-read 2026-10-28). That pair is `PP_STANDARD_STILL` in `constants.ts`, with every
  dial at zero and Knee Auto (`DEFAULT_PP_SETTINGS` otherwise — the /admin editor's
  starting form, Cine1 / Pro, is only where the editor opens and is not the reference).
- Both references carry no cast (AWB, no shift). The colour reading compares against
  the reference **under the recipe's own White Balance and light**: a cast lengthens
  some hues and shortens others, and against a reference without it a Kelvin alone read
  Rich or Muted. The cast is the temperature word's to name.
- **The reach** of each metric, up and down, is the largest change from the reference
  over every palette at the range ends: every gamma × both ends of Black Level, every
  Black Gamma range × both ends of its level, Knee Auto and Manual at both corners;
  every gamma × every colour mode but Black & White × both ends of Saturation, Color Depth and
  Color Phase; every colour Look × both ends of Contrast, Highlights, Shadows, Fade and
  Saturation. A change is graded `d / reach` in its own direction. Changes finer than
  the swatches' rounding are float noise, not a reading.

### 1. Temperature (unchanged from task A)

The palette's mid swatch, read under the designed light. Its lean on the amber axis
(hue 65, `WB_HUE.amber`), `c · cos(h − 65)`, turned back into mireds through the
palette's own cast scale (`PALETTE_WEIGHTS.cast`) and graded by `gradeWarmth`:
strong-warm Golden, warm Warm, neutral Neutral, cool Cool, strong-cool Icy. The
neutral band is `NEUTRAL_MIRED_BAND`, widened to one shift step
(`MIRED_PER_SHIFT_STEP`) while the recipe sets an A/B shift. The green–magenta lean
(hue 328) takes the slot — Rosy, Mint — when it is larger than the amber–blue lean by
its own band. Monochrome (`monochromeOf`): Mono or Sepia.

### 2. Tonality — the neutral ramp

| reading | word | salience |
|---|---|---|
| shadow lifted | Matte; strong Faded | lift / reach |
| shadow crushed | Deep | crush / reach |
| highlight-minus-shadow spread widened | Punchy | widening / reach |
| spread narrowed | Soft; strong Flat | narrowing / reach |
| highlight lifted while the spread did not widen | Airy | lift / reach |
| none of the above moves | Even | 0 |

The most salient reading is the word; ties go to the first listed. The others stay
as honest alternatives for a clash.

### 3. Colour — the hues' chroma

The mean chroma of the six hue swatches against the cast-matched reference: strong up
Vivid, mild up Rich, none Natural, mild down Muted, strong down Pale — 0 only at 0, as
`step()` grades a dial. Monochrome recipes have no colour, so the slot says the detail,
which the palette does not paint: Picture Profile Detail Level graded around 0 (Crisp,
Plain, Gentle); Creative Look the larger of Sharpness and Clarity from the minimum
(strong Crisp, mild Plain, both at 0 Gentle).

### 4. A clash

Recipes are named Picture Profile first, then by number. Three words clash when an
earlier recipe holds the same three in any order ("Neutral Deep Punchy" and "Neutral
Punchy Deep" read as one). A recipe's options, in order: its own three words; then
each honest alternative in its least salient slot (tonality or colour — never the
temperature), most salient first; then the same in the other slot. Honest
alternatives, each a reading of its own:

| reading | words | salience |
|---|---|---|
| the tonality readings slot 2 did not take | as above | as above |
| key: the mid swatch against the reference | Bright, Dark | change / reach |
| detail (colour recipes: not painted, so never a slot word on its own) | Crisp, Gentle | as in §3 |
| tint: a G/M shift the recipe sets, where the palette leans its way past its band | Rosy, Mint | lean / the lean of a full shift |

The tint needs the shift: the amber and blue hues are not opposite magenta, so a
strong amber–blue cast alone projects onto that axis.

A recipe takes its first option nobody holds. When every option is held, an earlier
holder moves to a free option of its own, or one it can free the same way — the
shortest honest re-route, searched in the later recipe's order — so a recipe whose
readings allow few names is not left without one because an earlier recipe with more
to choose from took them. With no re-route either, the recipe keeps its own words and
the result names the recipe it ties with; `seed:emit` fails unless the two `readsAlike`
(the same nine swatches and the same detail reading).

The one tie in the seed: CL-033 and CL-034, Film at every default under Daylight and
under AWB. Neither publishes a Kelvin, so both palettes are the same nine swatches, and
both carry Sharpness 4, Clarity 1. They read `Neutral Deep Muted` because they look
the same.

### Three Look labels

`Neutral`, `Vivid` and `Sepia` are vocabulary words and Creative Look labels (NT, VV,
SE). They stay: each is a graded reading here (a temperature band, a chroma grade,
`monochromeOf` = sepia), and Sepia can only ever be the SE Look. The vocabulary test
refuses every other Look label and every Look code, and names these three as the only
exceptions so a fourth cannot slip in.

### Vocabulary

Exactly the words above, 27: Golden, Warm, Neutral, Cool, Icy, Rosy, Mint, Mono, Sepia ·
Matte, Faded, Deep, Punchy, Soft, Flat, Airy, Even · Vivid, Rich, Natural, Muted, Pale ·
Crisp, Gentle, Plain · Bright, Dark. `RECIPE_NAME_RE` allows exactly three words.

### Slugs in task A

Unchanged. Every seed recipe keeps the slug it moved to on 2026-10-24 (the frozen batch,
`currentSlugOf`), so `seed:emit` writes the same slugs and `former-slugs.json` as today;
a recipe in no batch takes `slugFor(name)`. Task B replaces this with the code.

## Decisions — slugs (task B)

| # | Question | Decision |
|---|---|---|
| S1 | Slug shape | The code, lowercased: `slugFor(id)` → `pp-001`, `cl-045`. A name can change from now on without moving a URL. |
| S2 | The move | A second batch recorded like the first: `data/slug-moves/2026-10-28.json` (each seed recipe's 2026-10-24 slug → its code slug), a `SLUG_MOVES` entry with its own two migrations — content `20261028000000_recipe_code_slugs.sql` (slugs only, idempotent, one transaction, the control-plane guard of `20261024000000`) and control `0021_recipe_slugs_to_code_only.sql` (`recipe_slug` in comments, proposals and photos from both earlier spellings to the code slug, idempotent, a hidden twin kept hidden as in `0020`). `former-slugs.json` maps every earlier spelling to the final code slug, generated from the batches. `migration-roots.test.ts` checks each batch against its own two files and proves `20261028000000` against PGlite, also after `20261024000000`. Batch 1's files are applied in production and are never edited. |
| S3 | Readers | `resolveRecipeSlug` finds a recipe by any spelling: 308 when the requested spelling is older than the stored one, 307 when newer; never a static redirect. `slugAliases(slug)` returns every generation. Search indexed the stored slug and the code; R4 narrowed it to the code. `library:sync` matches and writes whichever spelling the database holds, before or after `20261028000000`, and refuses a project holding two spellings of one recipe. |
| S4 | Legacy links | The `?id=` map and `RETIRED_LEGACY_IDS` point at code slugs, derived through the map. |
| S5 | Docs | AGENTS.md "Names, palette, pictures" says names are computed and the slug is the code. The runbook gets the owner's steps: merge (0021 applies), wait for the deploy, apply `20261028000000` by hand, `library:sync -- --target content --apply` for the names, flush the catalogue cache. |

## How task B carries it out

- **Histories, not pairs.** `slugHistories()` (`slug-moves.ts`) chains the frozen
  batches into each recipe's spellings, oldest first, each with the database
  state it is held from (batches applied: 0 `hue-silk`, 1
  `pp-048-soft-clean-portrait`, 2 `pp-048`). `slugAliases`, `isPermanentMove`
  and `library:sync` all read it, so a third move would need no reader changed.
- **`library:sync` reads a slug state as well as an id shape.**
  `storedSlugState` takes the newest state every row the seed's own ids hold
  agrees with, writes each seed recipe at `slugAtState(slug, state)`, and
  refuses a project holding two spellings of one recipe, or recipes at
  different states.
- **0021 composes two lists.** Its `former-slugs` block is the 2026-10-28 batch,
  pair for pair; an `earlier-slugs` block is the 2026-10-24 batch, joined in SQL
  so first-slug rows reach the code too. The 2026-10-24 spelling moves first,
  so where both earlier spellings hold one photo URL, the older row stays.
- **20261028000000 refuses `SCL-` ids**, on top of the control-plane guard: run
  before 20261024000000 it would match nothing, be recorded as applied, and
  leave the slugs behind for good.

## Out of scope

Retuning any palette magnitude, changing `data/recipe-taxonomy.json`, and any change to
recipe settings or numbering.
