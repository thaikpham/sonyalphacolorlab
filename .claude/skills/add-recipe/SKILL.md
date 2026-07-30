---
name: add-recipe
description: Add a new colour recipe to Alpha ColorLab — either WB + Picture Profile or WB + Creative Look. Use when the user wants to add, publish, or draft a recipe, supplies camera settings to turn into a recipe, or says "new recipe" / "thêm công thức". Handles ID assignment, validation, bilingual descriptions, and image upload.
---

# Add a recipe

## Before anything else

Read `src/lib/camera/constants.ts`. Do not proceed from memory — the legal ranges
differ between the two formats and are easy to get plausibly wrong.

## 1. Establish the format

A recipe is **either** Picture Profile **or** Creative Look, never both — the
camera disables Creative Look whenever Picture Profile is on. If the user supplies
settings for both, stop and ask which one they actually shot with.

| Signal | Format |
|---|---|
| Gamma, Black Gamma, Knee, Color Depth, Detail | `pp` |
| A Look code (ST/PT/NT/VV/VV2/FL/IN/SH/BW/SE), Fade, Clarity | `cl` |

## 2. Collect the settings

Ask only for what is missing. Values the user gives in the camera's own notation
(`"+25"`, `"Wide +5"`, `"Manual 92.5% +3"`, `"7000K, B3-M1.5"`) are fine — convert
them to the structured form yourself.

**Do not invent a value the user did not give.** If Detail settings were never
mentioned, ask; do not fill in defaults that will end up on someone's camera.

Watch for these, which are wrong more often than not when supplied by hand:

- `Fade`, `Sharpness`, `Clarity`, `Sharpness Range` are unsigned. If the user
  writes `"+3"` for Sharpness Range, store `3`.
- Creative Look `Saturation` is −9…+9, not the −32…+32 of Picture Profile.
- `BW` and `SE` Looks have **no** Saturation at all — omit the field.

## 3. Assign the ID

Sequential within the format, zero-padded to three digits:

```bash
node -e "const r=require('./data/recipes.seed.json');const f='PP';\
const n=r.filter(x=>x.id.includes('-'+f+'-')).map(x=>+x.id.slice(-3));\
console.log('next: SCL-'+f+'-'+String(Math.max(0,...n)+1).padStart(3,'0'))"
```

- `name` is `"<ID>: <Title>"`, e.g. `SCL-CL-001: Saigon Dusk`.
- `slug` is the title in kebab-case, no ID prefix. Must be unique.

## 4. Validate before writing anything

Never insert first and check later.

```ts
import { recipeSchema } from '@/lib/camera/schema';
const parsed = recipeSchema.safeParse(candidate);
if (!parsed.success) console.error(parsed.error.issues);
```

If it fails, fix the **data** — never widen the schema to accommodate a value.
The schema reflects what the camera physically accepts; a failure means the recipe
cannot be shot as written. Report the specific field back to the user.

## 5. Descriptions

Write the English description first: 2–3 sentences on the mood and what it suits.
Concrete and evocative, no marketing filler.

Then Vietnamese — **the description only.** Recipe name, parameter labels, Look
codes, gamma names and WB values all stay in English. Descriptions live in
`recipe_translations`, keyed by `(recipe_id, locale)`.

## 6. Images

Upload to Supabase Storage, never hotlink. The original site hotlinked Google
Photos URLs and they expire — that is why this rule exists.

Order matters: the first image is the grid thumbnail and the OG share card.

## 7. Finish

```bash
npm test        # must pass
npm run dev     # check the card and the detail page render
```

Confirm the new recipe appears in the grid, its filters match, and the detail page
shows every parameter with the correct sign.
