# Picture Profile library: colour pass, twenty new recipes, mood names — design

Status: approved in conversation, 2026-10-24 (owner chose the recommended
option on every question except D1, where ids and slugs also change — that is
sub-project 3, a later PR). Amended the same day with D5–D8 at the owner's
request: every recipe photograph removed, a parameter-derived palette as the
thumbnail, a Picture Profile / Creative Look filter, contributed photographs as
the only pictures. · Owner: thaikpham

## Goal

What the owner asked for on 2026-10-24, after the situation browse and the
library refresh went live:

1. **Check and raise the colour quality of the current recipes**, reading the
   Sony Help Guide for Creators pages for Picture Profile and the licensed
   collection the owner bought — the latter for method only.
2. **Add recipes for moods the catalogue does not have yet**, not another
   variation of an existing tone.
3. **Rename and re-code every recipe** as `PP-[number]-[mood]` for Picture
   Profile recipes and `CL-[number]-[mood]` for Creative Look recipes, so the
   name says the tone and mood of the colour.
4. **Delete every recipe illustration.** Pictures come only from readers who
   shoot the recipe, sign in with Google and contribute an image URL; every
   contributed photograph shows in the recipe's grid and lightbox.
5. **Make the thumbnail the recipe's colour palette**, derived from its
   parameters, and make it accurate.
6. **Add a Picture Profile / Creative Look filter.**

## Decisions

| # | Question | Decided |
|---|---|---|
| D1 | Where does the new code apply? | Ids and slugs in the database change too. **Deferred to sub-project 3** (its own PR: content-plane migration for the CHECK constraints, control-plane migration for `recipe_slug` in the four community tables, path redirects for every `/recipe/<old slug>`, the `?id=` map, `nextRecipeId`). This spec changes **names only**; ids and slugs stay. |
| D2 | Language and numbering | English mood words (names are never translated, rule 3); the number is the recipe's existing number, three digits: `PP-048-…`, `CL-013-…`. |
| D3 | Scope | Tune the 23 unpublished originals; add 12 Picture Profiles and 8 Creative Looks, all unpublished; the 10 kept legacy Picture Profiles and the 37 Sony Asia Creative Looks change name only, never settings. |
| D4 | Order | Sub-projects 1 (colour) and 2 (names) together in one PR, now. Sub-project 3 after this is live, with the owner present to apply two migrations. |
| D5 | Recipe photographs | Removed outright, intake included (sub-project 4). No primary photograph, no admin upload panel, no vendoring scripts. The `recipe_images` table and the private `recipe-uploads` bucket stay: migrations are applied history and nothing reads them. |
| D6 | Thumbnail | A nine-swatch palette computed from the recipe's own settings in documented directions (sub-project 5). Accurate in direction and order, estimated in magnitude until the a7 IV ColorChecker shoot refits one weights object; the recipe page says so in one line. |
| D7 | Format filter | A fourth group in the browse row, first in order, `?format=pp|cl` — the same strings the previous catalogue used, so its links keep their meaning (sub-project 6). |
| D8 | Contributed photographs | Already a grid plus lightbox; with no primary photographs they are the gallery. Add a loading state, a decoded-preview gate and a refusal of expiring social-CDN hosts (sub-project 7). Moderation stays P8. |

## What the documents establish

From Sony's Help Guide for Creators (TP0000909106–112, TP0000909614,
TP1000756714), which `constants.ts` already cites:

- Gamma and Color Mode pair: Movie↔Movie, Still↔Still, S-Cinetone↔S-Cinetone,
  Cine1/Cine2↔Cinema, ITU709↔Pro / 709tone / ITU709 Matrix, S-Log2↔S-Gamut,
  S-Log3↔S-Gamut3 / S-Gamut3.Cine, HLG↔BT.2020 / 709. Black & White sets
  saturation to 0.
- Knee Auto works with Movie and ITU709 only; on every other gamma Auto means
  Knee off, Manual turns it on. Slope negative = gentler, more range, less
  gradation; positive = steeper, less range, richer gradation; +5 = off.
  Higher point with gentler slope reads video-like; lower point with steeper
  slope reads film-like.
- Black Level negative emphasises black, positive weakens it (old film, fog).
  Black Gamma Narrow acts near black, Wide reaches into grey; Level negative
  darkens, positive brightens, subtly.
- Saturation is read with contrast: bright + vivid = video, dark + vivid =
  film, bright + light = pastel, dark + light = artistic.
- Color Phase rotates every hue and is meant for matching cameras.
- Color Depth positive lowers luminance and deepens a hue, negative lifts and
  pales it, strongest on saturated colour, near nil on achromatic.
- Detail: V/H lower favours vertical detail (faces); B/W Balance Type1 is
  black detail (power, hardness, wrinkles), Type5 white detail (clean,
  glossy, glass); Limit 0 = strongly restricted … 7 = none; Crispening 0 =
  none … 7 = strongly restricted (hides noise); Hi-Light Detail 0–4.
- Cine1: 460% range, soft darks, emphasised light gradation, subdued; Cine2
  the same within 100%; Cine3 more contrast and black gradation; Cine4 more
  dark contrast still. S-Cinetone: soft colour, portraits.

From the licensed third-party collection the owner bought, **method only, no
values**: every recipe is placed on a chart of tonality (hard ↔ soft) against
saturation (low ↔ high), monochrome on tonality against chroma depth; a recipe
page is a reference frame, four hue swatches (reds, yellows, greens, blues),
the settings, the white balance with its filter, and sometimes a day and a
night white balance. Its recurring signatures — one Detail block shared across
the set, Black Gamma and Saturation pushed to the ends of their ranges, a low
knee with a steep slope — are what the originals avoid, and what the distance
check measures. Neither the collection nor its author is named in this
repository.

Nothing from that collection is copied into the tree, the spec or the
descriptions. The repository is public.

## Sub-project 1a — the 23 originals, reviewed

Read against the rules above, the set is consistent. Four changes:

| Recipe | Change | Why |
|---|---|---|
| 051 Sa Pa Morning | Black Gamma Wide −2 → **Wide +2**; Black Level −3 → **−1** | The brief is "hold sky and shadow out of camera". Level −2 darkens the shadows; +2 opens them, which is what a range recipe does. |
| 052 Mekong Noon | Color Phase +1 → **0** | Phase rotates every hue, skin included; Sony reserves it for matching. The warm turn stays in A1 and Color Depth. |
| 057 Tết Blossom | Color Phase +1 → **0** | Same; a portrait recipe keeps skin hue untouched. The rosy cast is M0.75 and M +2. |
| 066 Hồ Tây Golden | Color Phase +1 → **0** | Same; the glow is 6000K A1 and R −2 Y −2. |

Left as they are, with a note in the recipe's `intent`: 048 Huế Silk's Knee
90% −1 is nearly inert and could become 85% +1 (Sony's film-like pair) after
the shoot; 069 Hẻm Noir's 7500K-as-orange-filter stays a hypothesis; 045
ClearCast Pro (kept legacy, photographed) pairs S-Cinetone with Knee Auto,
which Sony says is Knee off on most bodies — the a7 IV page lists S-Cinetone
outside the Auto-off list, so it holds there. No settings change on any of the
ten kept recipes (D3).

Descriptions do not change: none of the four edits alters what the prose
promises.

## Sub-project 1b — twelve Picture Profiles for empty moods

Every recipe in the catalogue was placed on tonality × saturation ×
temperature (`scratchpad`, from the settings). Cells with nothing, or with a
Creative Look only, are the brief. Each new recipe fills one. Ids continue the
sequence (071–082); slugs are the mood words; all `published: false` (handoff
D8: unpublished until shot on the a7 IV).

| Id · name | Mood cell | WB | BL | Gamma / Mode | Black Gamma | Knee | Sat | Phase | Color Depth R G B C M Y | Detail L · V/H · B/W · Lim · Crisp · HL | Situations · style · tone |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 071 Silver Hard Muted | hard · low · neutral (bleach bypass) | 5500K B0.5 | −6 | Cine4 / Still | Narrow −3 | M 92.5% +1 | −14 | 0 | +1 0 +1 0 0 +1 | +2 · 0 · Type2 · 6 · 3 · 2 | street, fashion · film · neutral |
| 072 Teal Orange Cinema | warm skin, teal shadows | 5600K A1.5 | −3 | Cine2 / Cinema | Middle −1 | M 85% −1 | +12 | 0 | −2 +2 +4 +5 +1 −2 | −1 · −1 · Type3 · 4 · 5 · 1 | portrait, street, night · film · warm |
| 073 Bright Airy Studio | soft · low · neutral (high key) | 5500K | +4 | Cine2 / Cinema | Middle +3 | M 80% +2 | +2 | 0 | −2 −1 −1 −1 −1 −2 | −3 · −1 · Type4 · 4 · 4 · 2 | fashion, portrait, lifestyle · natural · neutral |
| 074 Dark Rich Velvet | hard · mid · warm (low key) | 5800K A1 | −8 | Cine4 / Still | Narrow −5 | M 95% +1 | +8 | 0 | −1 +3 +3 +2 +2 −1 | −1 · −1 · Type2 · 4 · 5 · 1 | portrait, lifestyle · film · warm |
| 075 Warm Pastel Cream | soft · low · warm (pastel) | 6200K A0.5 | +4 | Cine1 / Cinema | Wide +3 | M 85% −1 | −6 | 0 | −2 −1 −1 0 −2 −2 | −2 · −1 · Type3 · 4 · 5 · 1 | lifestyle, portrait, fashion · film · warm |
| 076 Violet Cool Dusk | mid · high · cool (blue hour) | 4200K M1.5 | −3 | Still / Still | Middle 0 | M 90% −1 | +12 | 0 | 0 +1 +4 +2 +3 −1 | 0 · 0 · Type3 · 4 · 6 · 2 | night, landscape, street · vivid · cool |
| 077 Cool Muted Overcast | soft · low · cool | 5000K B1 | +2 | Movie / Movie | Wide +2 | Auto | −8 | 0 | 0 +1 +1 +1 0 0 | 0 · 0 · Type3 · 5 · 4 · 2 | daily, street, landscape · natural · cool |
| 078 Amber Vivid Autumn | mid · high · warm, not film | 6000K A1.5 | −3 | Still / Still | Narrow −1 | M 92% +1 | +14 | 0 | +2 −1 +2 +1 0 +2 | +1 · 0 · Type3 · 5 · 3 · 3 | landscape, travel · vivid · warm |
| 079 Warm Rich Table | daylight food | 5800K A1 | −2 | S-Cinetone / S-Cinetone | Middle +1 | M 88% −1 | +10 | 0 | +1 +1 0 0 0 −1 | +1 · 0 · Type4 · 5 · 4 · 2 | lifestyle, daily · vivid · warm |
| 080 Range HLG Daylight | HDR range | 5500K | 0 | HLG2 / 709 | Middle 0 | M 95% 0 | +8 | 0 | 0 +1 +1 +1 0 0 | 0 · 0 · Type3 · 5 · 4 · 3 | landscape, travel · range · neutral |
| 081 Flat Log Base | grade later (Sony's PP8 pairing) | 5500K | 0 | S-Log3 / S-Gamut3.Cine | Middle 0 | Auto (off on S-Log) | 0 | 0 | 0 0 0 0 0 0 | −7 · 0 · Type3 · 4 · 4 · 2 | — · range · neutral |
| 082 Cyan Vivid Monsoon | mid · high · cool | 4800K B1 | −1 | Movie / Movie | Wide +1 | Auto | +10 | 0 | 0 +1 +2 +4 0 −1 | 0 · 0 · Type3 · 5 · 5 · 2 | street, travel, daily · vivid · cool |

Notes the descriptions carry: 080 is for HDR delivery and grading and looks
flat on an SDR screen straight out of camera; 081 is Sony's documented
S-Log3 + S-Gamut3.Cine + Detail −7 base and is not a look; 071's low
saturation is the look, not a fault. Each `intent` is one line.

## Sub-project 1c — eight Creative Looks

No Creative Look recipe uses BW, NT or a cool SH yet; PT has one. Ids 038–045,
unpublished, Creative Look parameters only (`clSettingsSchema`).

| Id · name | Look | Contrast · Highlights · Shadows · Fade | Sat | Sharp · Range · Clarity | WB | Situations · style · tone |
|---|---|---|---|---|---|---|---|
| 038 Mono Deep Noir | BW | +6 · −2 · −4 · 0 | — | 6 · 3 · 5 | 5500K | street, night · film · mono |
| 039 Mono Airy Portrait | BW | −3 · −4 · +3 · 2 | — | 2 · 2 · 0 | 5500K | portrait · natural · mono |
| 040 Neutral Clean Product | NT | +1 · −2 · 0 · 0 | 0 | 5 · 3 · 2 | 5500K | fashion, lifestyle · natural · neutral |
| 041 Portrait Golden Soft | PT | −1 · −4 · +2 · 1 | +1 | 2 · 2 · 0 | 5600K A2-M0.5 | portrait, lifestyle · natural · warm |
| 042 Airy Cool Pastel | SH | −3 · −2 · +3 · 3 | −2 | 2 · 2 · 0 | 5200K B1 | portrait, fashion, lifestyle · natural · cool |
| 043 Film Matte Cool | FL | +3 · −4 · +2 · 6 | −3 | 3 · 3 · 2 | 5200K B1 | street, daily · film · cool |
| 044 Instant Amber Soft | IN | −1 · −3 · +2 · 3 | +2 | 2 · 2 · 0 | 5800K A2 | lifestyle, daily · film · warm |
| 045 Vivid Tropical Punchy | VV2 | +2 · −3 · −1 · 0 | +3 | 4 · 3 · 4 | 5800K A1 | travel, landscape · vivid · warm |

## Sub-project 2 — names

### Syntax

`PP-NNN-Word Word` or `PP-NNN-Word Word Word` (same for `CL-`): the format
code, the recipe's three-digit number, a hyphen, then two or three Title Case
English words from the vocabulary below. No diacritics, no place names, no
photographer. The whole string is the `name` column and is never translated.

Vocabulary (closed; adding a word is a change to `names.ts` and its test):

- Temperature and hue: Warm, Cool, Neutral, Golden, Amber, Orange, Teal, Cyan,
  Violet, Jade, Green, Rosy, Silver, Sepia, Mono
- Tonality: Soft, Hard, Matte, Deep, Punchy, Airy, Crisp, Flat, Faded, Dense,
  Bright, Dark
- Saturation: Vivid, Muted, Pastel, Rich, Clean, Natural
- Subject, time, process: Portrait, Street, Night, Film, Cinema, Noir,
  Daylight, Dusk, Tungsten, Indoor, Range, Log, HLG, Pop, Studio, Table,
  Coast, Nature, Festival, Autumn, Monsoon, Overcast, Velvet, Cream, Slide,
  Standard, Instant, Product, Stream, Landscape, Nostalgia, Tropical

Every name is unique, and so is its set of mood words across the catalogue, so
two recipes never read as the same thing with a different number (which is why
the Creative Look monos are "Mono Deep Noir" and "Mono Airy Portrait" beside
the Picture Profile "Mono Hard Noir" and "Mono Soft Portrait").

### The full table

Kept legacy Picture Profiles (settings untouched):

| Id | Today | New name |
|---|---|---|
| SCL-PP-001 | Mojave Sun | PP-001-Vivid Nostalgia Film |
| SCL-PP-002 | Kyoto Jade | PP-002-Jade Soft Film |
| SCL-PP-009 | Urban Teal | PP-009-Teal Muted Street |
| SCL-PP-015 | Vintage Slide | PP-015-Warm Faded Slide |
| SCL-PP-025 | Saturated Cinema | PP-025-Vivid Deep Cinema |
| SCL-PP-027 | Daylight Cinema | PP-027-Vivid Daylight Cinema |
| SCL-PP-044 | Filmic FJ C200 | PP-044-Matte Vivid Film |
| SCL-PP-045 | ClearCast Pro | PP-045-Clean Neutral Stream |
| SCL-PP-046 | ClearCast Pro 2 | PP-046-Clean Soft Stream |
| SCL-PP-047 | EXTRA DR Stream 109 | PP-047-Range Neutral Stream |

Originals (23 existing, 12 new):

| Id | Today | New name |
|---|---|---|
| 048 | Huế Silk | PP-048-Soft Clean Portrait |
| 049 | Clear Day | PP-049-Clean Natural Daylight |
| 050 | Linen Editorial | PP-050-Neutral Crisp Studio |
| 051 | Sa Pa Morning | PP-051-Range Soft Landscape |
| 052 | Mekong Noon | PP-052-Range Bright Daylight |
| 053 | Mũi Né Dusk | PP-053-Range Warm Dusk |
| 054 | Phú Quốc Blue | PP-054-Cyan Vivid Coast |
| 055 | Tam Cốc Green | PP-055-Green Vivid Nature |
| 056 | Hội An Lantern | PP-056-Warm Vivid Festival |
| 057 | Tết Blossom | PP-057-Rosy Bright Portrait |
| 058 | Đà Lạt Mist | PP-058-Cool Pastel Matte |
| 059 | Hà Nội Winter | PP-059-Warm Muted Nostalgia |
| 060 | Chợ Lớn Slide | PP-060-Warm Dense Slide |
| 061 | Sài Gòn Café | PP-061-Tungsten Soft Indoor |
| 062 | Neon Night | PP-062-Cyan Deep Night |
| 063 | Bến Thành Night | PP-063-Warm Vivid Night |
| 064 | Old Quarter Mono | PP-064-Mono Crisp Street |
| 065 | Pearl Mono | PP-065-Mono Soft Portrait |
| 066 | Hồ Tây Golden | PP-066-Golden Soft Portrait |
| 067 | Mộc Châu Frost | PP-067-Cool Crisp Airy |
| 068 | Vũng Tàu Pop | PP-068-Punchy Vivid Pop |
| 069 | Hẻm Noir | PP-069-Mono Hard Noir |
| 070 | Late Night Mono | PP-070-Mono Soft Night |
| 071–082 | new | as in the table above |

The place each original was imagined for, and every recipe's former name,
stay findable through the slug, which does not change and which search now
reads (`hue-silk`, `da-lat-mist`, `mojave-sun`, `fl-raoul-rutnam`). The name
itself is a mood.

A name's temperature word must agree with the recipe's tone: Warm, Golden,
Amber ⇒ warm; Cool ⇒ cool; Mono, Sepia ⇒ mono; Neutral ⇒ neutral. That is
why Daylight Cinema is "Vivid", not "Warm": 3700K with A5 nets out neutral;
and why Dark Rich Velvet, Warm Rich Table and Vivid Tropical Punchy sit at
5800K A1 rather than 5600K A1, which nets inside one shift step of neutral.

The palette holds names to the same rule (`names.test.ts`): a name's
temperature word must also match the cast of the palette's mid swatch. Mojave
Sun's photographs read warm, but its settings (7000K, B3, M1.5) net slightly
cool and magenta under the fitted shift estimate, so its name carries no
temperature word ("Vivid Nostalgia Film") until the a7 IV shoot refits the
estimate. A recipe built for a light other than daylight states it in the
manifest (`light`, in Kelvin: Sài Gòn Café 3000K, Bến Thành Night 3200K, Neon
Night 4000K); the palette is read under that light and the recipe page says
so in one line.

Sony Asia Creative Looks (settings untouched; the photographer stays in the
gallery's credit line, `sony-asia-credits.json`):

| Id | Today | New name |
|---|---|---|
| CL-001 | Film · Raoul Rutnam | CL-001-Film Hard Faded |
| CL-002 | Film · Arantha Sirimanne | CL-002-Film Warm Muted |
| CL-003 | Vivid 2 · Ravi Ranasinghe | CL-003-Vivid Crisp Neutral |
| CL-004 | Vivid 2 · Sony Asia | CL-004-Vivid Soft Faded |
| CL-005 | Vivid 2 · Jonpoon.jpg | CL-005-Vivid Warm Crisp |
| CL-006 | Vivid 2 · Jonpoon.jpg 2 | CL-006-Vivid Bright Crisp |
| CL-007 | Vivid · Khong | CL-007-Vivid Natural Daylight |
| CL-008 | Vivid · Filmreel | CL-008-Vivid Cool Natural |
| CL-009 | Standard · Sandeeshwara Perera | CL-009-Flat Cool Standard |
| CL-010 | Standard · Ravi Ranasinghe | CL-010-Soft Natural Standard |
| CL-011 | Standard · Khong | CL-011-Natural Standard Daylight |
| CL-012 | Standard · Filmreel | CL-012-Soft Warm Rich |
| CL-013 | Soft Highkey · Sony Asia | CL-013-Airy Warm Pastel |
| CL-014 | Soft Highkey · Jonpoon.jpg | CL-014-Airy Warm Rich |
| CL-015 | Soft Highkey · Puy | CL-015-Airy Faded Soft |
| CL-016 | Soft Highkey · Jomnot | CL-016-Airy Matte Natural |
| CL-017 | Sepia · Satheeshan Thiyagaraja | CL-017-Sepia Soft Deep |
| CL-018 | Sepia · Ravi Ranasinghe | CL-018-Sepia Flat Crisp |
| CL-019 | Portrait · Sandeeshwara Perera | CL-019-Portrait Soft Warm |
| CL-020 | Instant · Eranga Siriwardhana | CL-020-Instant Faded Natural |
| CL-021 | Instant · Sony Asia | CL-021-Instant Soft Violet |
| CL-022 | Instant · Sony Asia 2 | CL-022-Instant Cool Soft |
| CL-023 | Instant · Jonpoon.jpg | CL-023-Instant Warm Faded |
| CL-024 | Instant · Check In Siemreap | CL-024-Instant Warm Punchy |
| CL-025 | Film · Sandeeshwara Perera | CL-025-Film Warm Bright |
| CL-026 | Film · Sandeeshwara Perera 2 | CL-026-Film Warm Soft |
| CL-027 | Film · Sandeeshwara Perera 3 | CL-027-Film Deep Muted |
| CL-028 | Film · Lahiru Rumesh | CL-028-Film Warm Deep |
| CL-029 | Film · Isuru Mudalige | CL-029-Film Flat Rich |
| CL-030 | Film · Sony Asia | CL-030-Film Soft Faded |
| CL-031 | Film · Sony Asia 2 | CL-031-Film Hard Muted |
| CL-032 | Film · Jonpoon.jpg | CL-032-Film Warm Faded |
| CL-033 | Film · Mardy Suong | CL-033-Film Natural Daylight |
| CL-034 | Film · Mardy Suong 2 | CL-034-Film Natural Neutral |
| CL-035 | Film · Khong | CL-035-Film Deep Crisp |
| CL-036 | Film · Hea Kimhong | CL-036-Film Warm Natural |
| CL-037 | Film · Filmreel | CL-037-Film Soft Rich |
| CL-038–045 | new | as in the Creative Look table above |

## Sub-project 4 — every recipe photograph removed

Today 47 recipes (all published ones) show vendored photographs: 540 WebP
files, 18.4 MiB, under `public/recipes/`, listed in `data/images.seed.json`,
plus an admin intake (`/admin/colorlab` image panel → private bucket →
`npm run vendor:uploads` → manifest). The owner's rule: pictures come from
readers only. So the origin and the intake go together — leaving the intake
would leave a panel whose banner tells an editor to run the command that
rebuilds `public/recipes`.

Removed: `public/recipes/`, `data/images.seed.json`,
`src/lib/recipes/{vendored-images,images,image-store,image-dev-store}.ts`,
`src/components/recipe-photo.tsx`, `src/components/recipe-color-field.tsx`,
`src/components/colorlab/admin/image-panel.tsx`, the two
`/api/admin/recipes/[id]/images` routes, `scripts/vendor-recipe-images.ts`,
`scripts/vendor-recipe-uploads.ts`, `scripts/lib/recipe-image-manifest.ts`,
`src/lib/legacy/images.legacy.js`, their tests, the `vendor:*` scripts, the
panel's message keys and error codes, `RecipeView.images`, `photosFirst()`,
the catalogue loader's `/recipes/` rung, `imageRow` in `push:supabase`, and
`checkImages` in `doctor`.

Kept: every migration (applied history, PGlite-tested), the `recipe_images`
table and the private `recipe-uploads` bucket (no reader touches them; rows
can be cleared later by a new 14-digit content migration), `sharp`,
`lab/image-process.ts`, `MAX_UPLOAD_BYTES` (the article editor uses them),
and `data/sony-asia-credits.json` (photographer credit, not a link the site
follows). Git history keeps the 18.4 MiB; rewriting it is out of scope (Q3).

## Sub-project 5 — the palette

`src/lib/camera/palette.ts`: `paletteFor(recipe) → Palette`, nine swatches
graded by the recipe's white balance and either its Picture Profile or its
Creative Look. It is a reading of the settings in Sony's documented
directions, never a preview of what the camera records (AGENTS.md says the
same of `accentFor`); the function and type are named `paletteFor` /
`Palette`, never "preview" or "render".

**Swatches** (reference OKLCH, the no-op every transform starts from):

| Id | Reference | What it carries |
|---|---|---|
| highlight | L 0.92, C 0 | Knee, CL Highlights, high-key Looks, the bright end of each gamma |
| mid | L 0.60, C 0 | White balance cast, purest on an achromatic; Black Gamma Wide |
| shadow | L 0.30, C 0 | Black Level, Black Gamma, Cine curves, CL Shadows and Fade |
| red | L 0.58, C 0.19, h 28 | Color Depth R, Saturation reads loudest here |
| skin | L 0.75, C 0.09, h 55 | between R and Y; Color Phase shows on skin first |
| yellow | L 0.86, C 0.15, h 100 | Color Depth Y; an amber cast adds, a blue one cancels |
| foliage | L 0.60, C 0.13, h 140 | Color Depth G, the G/M axis |
| sky | L 0.66, C 0.11, h 245 | between C and B; teal and blue recipes part here |
| blossom | L 0.68, C 0.13, h 340 | Color Depth M, magenta tint |

**Pipeline, in camera order**, every signed parameter reduced to a fraction
of its own range in `constants.ts` (`fraction(value, range)`, exported from
`effects.ts` beside `step()`, so words and colour read one definition — Rule 4):

1. *White balance* → one cast vector in OKLab a/b on every swatch: warmth
   (Kelvin term + A/B shift, from `wbBalance()`) along hue 65 / 264, tint
   (G/M) along 142 / 328. AWB modes and presets carry no Kelvin term (Sony
   publishes none; Rule 1) — only their shift paints.
2. *Tone* — PP: gamma family preset (shadow/highlight ΔL, chroma ×), Black
   Level (shadow, a little mid, half on dark chromatics), Black Gamma (level ×
   reach: Narrow touches shadow only, Middle shadow and some mid, Wide mid and
   dark chromatics too), Knee (Manual: more compression from a lower point and
   a gentler slope, none at slope +5; Auto: a light roll-off on Movie and
   ITU709 only, nothing on any other gamma). CL: Look base preset, then
   Contrast (ramp spreads), Highlights, Shadows, Fade (lifts blacks, dims
   whites a little, lowers chroma).
3. *Colour* — Color Mode (Black & White → chroma 0 everywhere, cast
   included; S-Gamut family ×0.70, shown flat as before grading; Cinema and
   S-Cinetone ×0.92; the rest ×1). Saturation scales chroma after the cast, so
   a desaturated recipe also shows a weaker cast; PP ±32 and CL ±9 meet at the
   same endpoints because both are fractions of their range. Color Phase is
   one uniform hue rotation of the chromatic swatches (positive towards red on
   skin). Color Depth, **raw, not centred**, per channel weighted by hue
   proximity and the swatch's chroma: positive lowers L and raises C, negative
   lifts and pales; the neutral ramp is untouched by construction. (The
   accent keeps its centring; it answers "which hue", the palette "how each
   hue moves".) Detail, Sharpness, Sharpness Range and Clarity are not
   painted: a flat patch has no edge.
4. *Bounds* — L clamped to [0.14, 0.97] (the shadow floor keeps it visible on
   the void ground), then each swatch gamut-mapped into sRGB by lowering
   chroma at fixed L and h. CSS `oklch()` and the hex twin for Satori are
   emitted from the **same mapped value**, so the grid and the share card
   agree.

Every magnitude lives in one exported `PALETTE_WEIGHTS` object headed
"neutral defaults, not measured". The a7 IV ColorChecker shoot (P6) refits
that object; the tests pin direction, order and bands, not numbers, so a refit
does not fight them.

**Where it shows**

- *Card* (`RecipePalette`, server component) in the existing 210px slot:
  a grid `1fr 3fr` — the neutral ramp stacked highlight / mid / shadow on the
  left, six vertical bars red · skin · yellow · foliage · sky · blossom on the
  right, fixed order so a column means the same thing on every card. No
  gaps, no strokes, nothing written on it. `role="img"` with a short
  `aria-label` from messages: the tone and style words.
- *Recipe page*: the same palette, larger, under the heading, each swatch
  named in `.meta` (`palette.swatches.*`, one word per locale), and one
  accuracy line in `.meta`: EN "Derived from the settings, not a camera
  preview." / VI "Suy ra từ thông số, không phải ảnh chụp từ máy."
- *OG image*: the two accent gradients stay; a row of nine hex swatches is
  added. No copy on it.
- *Situation tiles*: the accent band stays (one stripe per recipe).

**Tests** (`palette.test.ts`): identity (a neutral PP and a neutral ST
recipe return the references); one-dial sweeps over each parameter's
`range.step` are monotone in the documented direction; Black & White is
achromatic on all nine even with a shift; Sepia is one warm hue; Detail and
CL sharpness/clarity leave the palette deep-equal; PP +32 and CL +9
saturation reach the same red chroma; every seed recipe sits in the
legibility band (highlight L ≥ 0.70, shadow ≤ mid − 0.06, at least three
swatches with L ≥ 0.5, all in sRGB); `oklch()` and hex agree to ΔE_OK ≤ 0.01;
no `#` literal in `palette.ts` outside the hex emitter; two seed recipes whose
painted settings differ never share a palette. The PR reports the
nearest-neighbour distances over the seed.

## Sub-project 6 — Picture Profile / Creative Look filter

A fourth group in the browse row, placed first, label EN "Colour system" /
VI "Hệ màu" (`browse.system`); chips "Picture Profile" and "Creative Look",
which are Sony menu names and never translated (`FORMAT_LABELS` in
`constants.ts`). `?format=pp|cl`, read by `browseFilters`, kept by
`colorlabSearch` (so the header's search and the no-JS form carry it), counted
by `facetCounts` like the other groups. `format` leaves the legacy object in
`loadBrowse`; `look` and `tag` stay legacy for their one release.

## Sub-project 7 — contributed photographs are the gallery

`RecipeGallery` loses its `images` prop: the grid and the lightbox are the
approved contributed photographs, newest first, the first one the large tile —
which is how they already render. Three changes:

- *Loading state*: until the first answer from `/api/community-photos`, the
  grid shows neutral placeholder tiles, not "No photos yet", so a
  photographed recipe never flashes empty.
- *Preview gate*: Submit is refused until the preview image has decoded
  (`onLoad`) at a usable size (natural width ≥ 320px); a failed or tiny
  preview shows the existing error line and new `errPreviewSmall`.
- *Expiring hosts*: `httpsImageUrlSchema` refuses hosts ending in
  `fbcdn.net`, `fbsbx.com` and `cdninstagram.com` — signed links that expire
  and leave a dead tile — with a new error code `expiringImageHost` (400) and
  its copy in both locales; the gallery and the proposal form check the same
  list before the round trip.

Sign-in stays Google (Supabase Auth, control plane); the author is the
verified session name, never the body (`identity-not-from-body.test.ts`).
Moderation (hiding a photograph) stays P8.

## Where things live

- `src/lib/originals/pp.ts` — the 35 Picture Profile originals (23 tuned,
  12 new), each `{ recipe, intent, description }` with the new name in
  `recipe.name`.
- `src/lib/originals/cl.ts` — the 8 Creative Look originals, same shape,
  validated by `clSettingsSchema` through `recipeSchema`.
- `src/lib/recipes/names.ts` — `RECIPE_NAMES`: the new name for every recipe
  whose source is not ours (the 10 kept legacy ids, the 37 Sony Asia ids),
  plus `NAME_VOCABULARY` and `RECIPE_NAME_RE`. `emit-seed.ts` applies the map
  after migration and import; slugs are still derived from the **source**
  name, so no slug changes.
- `data/recipe-taxonomy.json` — 20 new entries. `data/translations.vi.json` —
  20 new Vietnamese descriptions.
- `scripts/emit-seed.ts` — reads both originals files, applies the names,
  refuses a name outside the syntax or a duplicate.
- `scripts/sync-library.ts` (replaces `refresh-pp-library.ts`, script
  `library:sync`) — against the content project, plan then `--apply`:
  unpublish `RETIRED_RECIPE_IDS` still published; **update `name`** where the
  seed's differs; **overwrite settings, white balance, tags and translations**
  of seed rows that are `published: false` with no legacy id (the originals
  follow the seed until the owner publishes them); insert seed recipes the
  project lacks, unpublished, with their translations. Never a delete, never a
  change to a published recipe's settings.
- Recipe page — the `SCL-PP-048` chip goes: the name now carries the code.
  The format chip stays. `recipeTitle()` returns the whole name when there is
  no `: `, which is the new shape; the card shows it.
- Search — `recipeDoc` adds the code (`PP-048`) to `exact` and the slug's
  words to `tags`, and `matchesQuery` reads the slug, so the code, the mood
  words and the former name all find a recipe. Eval queries that named a
  recipe by its old name keep working through the slug; new ones cover the
  code and the mood words.
- `src/lib/camera/palette.ts` (+ test), `RecipeView.palette`,
  `src/components/recipe-palette.tsx` — sub-project 5.
- `src/lib/recipes/browse.ts`, `browse-filters.tsx`, `recipe-browse.tsx` —
  sub-project 6.
- `recipe-gallery.tsx`, `src/lib/community/request.ts`, `errors.ts` —
  sub-project 7.
- `AGENTS.md` — the naming rule joins "Rule 2" territory: names are
  `PP-NNN-Mood Words`, the vocabulary is closed, the number is the id's.

## Validation

- `originals.test.ts` (new): every original parses; the cook rules hold —
  Knee Auto only with Movie or ITU709 or on S-Log/HLG where it is documented
  off; |Color Phase| ≤ 2 and 0 on any recipe tagged `portrait`; no Color Depth
  at ±7; Gamma and Color Mode are a documented pair or the recipe states why
  (`intent`); every original is `published: false`; Vietnamese and English
  descriptions exist; every situation listed is a taxonomy id.
- `names.test.ts` (new): every seed recipe's name matches `RECIPE_NAME_RE`,
  the number equals the id's, every word is in the vocabulary, names and
  mood-word sets are unique; every kept legacy and Sony Asia id has an entry
  in `RECIPE_NAMES` and nothing else does.
- Distance (session script over the private extract, never committed): each
  new Picture Profile's nearest licensed recipe, same metric as the handoff
  (same type only, gamma/colour-mode penalty), must be ≥ the smallest distance
  among the 23 (25.3 colour, 15.8 mono); mutual distance between any two of
  the 35 originals ≥ 12. Creative Looks: Euclidean over the eight parameters
  plus WB mired/17 to every Sony Asia recipe of the same Look ≥ 4. Results are
  recorded as numbers in the PR.
- `names.test.ts` also pins that a name's temperature word agrees with the
  recipe's tone.
- Palette, filter and gallery tests as in sub-projects 5–7; the photo-removal
  tests are deleted or narrowed with the code they read.
- Browser check on a production build at 390px and desktop: cards show
  palettes, no photograph anywhere, the filter row, a recipe page's palette
  strip and an empty gallery with the contribute action.
- `npm run verify`, the CLAUDE.md greps, `npm run search:eval` (no query
  below its current recall).

## Production

Owner-run, since the classifier denies this session a content-plane write:

```
npm run library:sync -- --target content           # plan
npm run library:sync -- --target content --apply   # names, unpublished originals, inserts
```

After `--apply`: 47 published (same recipes, new names), 43 unpublished
originals waiting for the a7 IV shoot. Publishing stays an editor's act in
`/admin/colorlab`.

Until the owner runs it, production shows the old names (the card and page
read either shape) and already shows palettes and no photographs, because
those come from the code, not the database.

## Out of scope

- Ids and slugs (sub-project 3). Card and recipe page show the code from the
  name; `SCL-` stays in the database and the URL until then.
- Publishing, the test shoot (P6), My Camera (P4), moderation of
  contributed photographs (P8).
- Clearing `recipe_images` rows and the private bucket on production.
- Tuning the 10 kept recipes.
