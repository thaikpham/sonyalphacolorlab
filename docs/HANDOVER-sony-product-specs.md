# Handover — fill core specs for all 93 Sony wiki products

**To:** the agent picking this up (Gemini / Antigravity)
**From:** Claude Opus 5, session of 2026-08-11
**Repo:** Alpha ColorLab · branch `feat/sony-product-specs` · base commit `808b5fa`
**State:** framework built and green; **2 of 93** products have real specs.

Your job: extract and fill the remaining **91**.

---

## 0. The one rule that matters more than finishing

**Never write a spec you did not read on a real Sony page.**

You know a lot about Sony cameras. That knowledge is the single biggest risk in
this task. A spec table is read as authoritative — nobody cross-checks "9
aperture blades" against Sony — so one invented row is indistinguishable from
thirteen sourced ones, and it will ship.

This repo's `AGENTS.md` states the rule twice, in Rule 1 and in the importer
notes:

> If a value seems missing, **re-read the cited source** — never inline a
> literal at the call site. Guessing a plausible-looking value produces recipes
> that silently fail on a real camera.

> A row the source does not fully state is **skipped and reported**, never
> completed with a plausible value.

So: if the page does not state it, the field is `null` and its name goes in
`specsMissing`. An honest gap is a correct result. A plausible guess is a
defect that no test and no reviewer will catch.

**Do not** fill gaps from B&H, DPReview, Wikipedia, your training data, or a
sibling model's spec sheet. Official Sony pages only. If you genuinely cannot
reach a source for a product, leave it without a `specs` block entirely and
list it in your final report — that is a better outcome than a filled-in guess.

---

## 1. What already exists (do not rebuild)

| Thing | Where |
|---|---|
| Product data, 93 items | `data/sony-cameras.seed.json` |
| Types you must satisfy | `src/lib/cameras/types.ts` |
| Rendering template | `src/components/product-detail-modal.tsx` (`SpecTable`) |
| Guard tests | `src/lib/cameras/specs.test.ts` |
| Bilingual labels | `messages/{en,vi}.json` → `cameras.specs.*` (27 keys, already complete) |
| Machine-readable worklist | `docs/sony-specs-worklist.json` |

`docs/sony-specs-worklist.json` is your driver: one row per product with `id`,
`name`, `category`, `sku`, `baseUrl` (query string already stripped), and `done`.

**You only need to edit `data/sony-cameras.seed.json`.** The type, the UI, the
labels and the tests are done. If you find yourself changing the type, stop and
re-read — it probably means you are trying to store something that is not a core
spec.

---

## 2. The data shape

Add a `specs` object to each product in `data/sony-cameras.seed.json`. Three
shapes, keyed by `kind`, which **must equal the product's `category`**.

### `kind: "camera"` (31 products)

```
sensor  effectivePixels  isoRange  lensMount  autofocus  video
stabilization  viewfinder  lcd  mediaSlots  battery  weight  dimensions
```

### `kind: "lens"` (57 products)

```
lensMount  format  focalLength  maxAperture  minAperture  construction
angleOfView  minFocusDistance  maxMagnification  filterDiameter
apertureBlades  stabilization  weight  dimensions
```

### `kind: "accessory"` (5 products)

Accessories share almost no fields — a shotgun mic, a mount adapter, a grip and
a battery have nothing in common. So:

```
keySpecs: [{ label, value }, …]   ← whatever the page actually publishes
compatibility  weight  dimensions
```

`keySpecs` labels are free text and come from the source page. Keep them short
and in Vietnamese, matching the page.

### Bookkeeping, required on all three

```jsonc
"specsSource": "https://…/specifications",  // the exact page you read
"specsMissing": ["viewfinder", "battery"]   // every field you set to null
```

---

## 3. Value formatting — the part most likely to trip you

Values are **language-neutral strings**. Not numbers. Not Sony's prose.

| Do | Don't | Why |
|---|---|---|
| `"679 g"` | `679` | a number forces a unit into the type |
| `"679 g (kèm pin và thẻ)"` | `"Xấp xỉ 679 g"` | `Xấp xỉ`/`Khoảng` is prose; a test rejects it |
| `"100–51200 (mở rộng 50–204800)"` | `"100-51200"` | keep the expanded range the source gives |
| `"F2.8"` | `"2,8"` | render as photographers read it |
| `"17 thành phần / 12 nhóm"` | `"12-17"` | the raw table value is ambiguous |
| `"129,7 x 77,8 x 103,7 mm"` | `"129.7x77.8x103.7"` | keep Sony's decimal comma and spacing |
| `null` | `"N/A"`, `""`, `"—"` | the UI renders the gap; a placeholder hides it |

`specs.test.ts` rejects values matching `/Xấp xỉ|Khoảng |tương đương|loại /i`.
That regex is a tripwire for copy-pasting the page verbatim, not an exhaustive
prose filter — strip qualifiers yourself.

Numbers and units are language-neutral, so they need no translation and must
**not** go into `messages/`. Only the *labels* are translated, and they already
are. This is the same split `constants.ts` uses for camera parameter names.

---

## 4. Getting the source pages

Every product has an official page. Append `/specifications` to the base URL:

```
https://www.sony.com.vn/electronics/ong-kinh-may-anh/sel1655g
                                                            /specifications
```

That page has the full table — sensor, weight, dimensions, everything. The
plain product page does **not**; it has specs scattered in marketing copy and
omits weight and dimensions. Always prefer `/specifications`.

### URL shapes vary — six of them

| Path root | Count | Note |
|---|---|---|
| `/electronics/…` | 51 | `/specifications` works directly |
| `/permalink/product/<sku>` | 15 | **redirects** — resolve first, then append |
| `/interchangeable-lens-cameras/products/…` | 13 | `/specifications` works |
| `/lenses/products/…` | 8 | `/specifications` works |
| `/image/…` | 3 | verify the real product page |
| `/is/…` | 3 | verify the real product page |

For `permalink`, `image` and `is` (21 products), follow the redirect to the
canonical product URL **before** appending `/specifications`. When you land on
the real page, **check the SKU on it matches the row's `sku`** — some Sony
models have near-identical variants (kit vs body, regional suffixes), and the
whole point of this task is the specs belonging to *that* SKU.

### The blocker you will hit

`sony.com.vn` sits behind an edge WAF. After roughly 5–10 rapid requests it
returns:

```
HTTP/2 403 — Access Denied
Reference 0.674a2017.1786419231.7e29e69b
```

No `Retry-After`. It blocks plain `curl` and fetch tools identically, including
URLs that worked minutes earlier. This is why only 2 of 93 are done.

**Do not build a bypass.** Rotating user agents, proxies or header spoofing is
out of bounds — and it also produces data you cannot trust.

What actually works:

1. **A real browser session** (browser automation against a signed-in Chrome).
   Normal browsing traffic, rarely blocked. Slowest but most reliable.
2. **Heavy throttling** — one request per 30–60s. ~1–1.5 h for 91 products, and
   it may re-trigger the block partway.
3. **Sony global** (`sony.com`, Sony Asia Pacific) if VN stays blocked. Specs are
   often *more* complete but in English, and VN SKUs sometimes differ — so map
   by SKU carefully and record the global URL in `specsSource`. Never mix: one
   product's values must all come from the one page named in `specsSource`.

Work in small batches and commit as you go. Losing an hour of extraction to a
mid-run block is the most likely way this task goes wrong.

---

## 5. Two worked examples, already in the seed

Copy their shape exactly.

```jsonc
// sony-ilme-fx2b-q-ap2 — camera
{
  "kind": "camera",
  "sensor": "Full-frame 35 mm (35,9 x 23,9 mm) Exmor R CMOS",
  "effectivePixels": "33,0 MP",
  "isoRange": "100–51200 (mở rộng 50–204800)",
  "lensMount": "Sony E-mount",
  "autofocus": "759 điểm",
  "video": "4K 60p",
  "stabilization": null,
  "viewfinder": null,
  "lcd": "7,5 cm (3,0 inch) TFT, 1,03 triệu điểm",
  "mediaSlots": "CFexpress Type A / SD (UHS-II) x2",
  "battery": null,
  "weight": "679 g (kèm pin và thẻ); 594 g (chỉ thân máy)",
  "dimensions": "129,7 x 77,8 x 103,7 mm",
  "specsSource": "https://www.sony.com.vn/electronics/may-anh-ky-thuat-so-may-anh/ilme-fx2/specifications",
  "specsMissing": ["stabilization", "viewfinder", "battery"]
}
```

Note the three nulls. The FX2 certainly *has* stabilisation behaviour and a
battery rating — but the page section I read did not state them, so they are
`null` and declared. **If you find them on the specifications page, fill them
in and shorten `specsMissing` accordingly.** That is an improvement, not a
contradiction. What you must not do is fill them from knowledge.

```jsonc
// sel1655g — lens
{
  "kind": "lens",
  "lensMount": "Sony E-mount",
  "format": "APS-C",
  "focalLength": "16–55 mm",
  "maxAperture": "F2.8",
  "minAperture": "F22",
  "construction": "17 thành phần / 12 nhóm",
  "angleOfView": "83°–29°",
  "minFocusDistance": "0,33 m",
  "maxMagnification": "0,2x",
  "filterDiameter": "67 mm",
  "apertureBlades": "9 (khẩu tròn)",
  "stabilization": null,
  "weight": "494 g",
  "dimensions": "73 x 100 mm",
  "specsSource": "https://www.sony.com.vn/electronics/ong-kinh-may-anh/sel1655g/specifications",
  "specsMissing": ["stabilization"]
}
```

---

## 6. Verification — the gate is not optional

```bash
npm run verify        # eslint + tsc --noEmit + vitest — must exit 0
```

Baseline before you start: **21 files / 278 tests passing.**

`src/lib/cameras/specs.test.ts` runs per product and will fail the build on:

1. `kind` not matching the product's `category`
2. `specsSource` missing or not `https://`
3. **a `null` field not listed in `specsMissing`** ← the load-bearing one
4. a `specsMissing` entry that actually holds a value
5. a non-string or blank value
6. Sony's prose left in a value

All six were mutation-tested when written; they genuinely fail. If one fires,
fix the data — do not weaken the test.

Also useful while working:

```bash
npm run dev           # then open http://localhost:3000/cameras
```

Click a product to open the modal and read the spec table. Unstated fields
render as a dimmed "Nguồn không công bố" — that is correct and intended, not a
bug to eliminate.

### Progress check

```bash
python3 -c "
import json
d=json.load(open('data/sony-cameras.seed.json'))
done=[x for x in d if 'specs' in x]
print(f'{len(done)}/{len(d)} done')
import collections
print(collections.Counter(x['category'] for x in d if 'specs' not in x))
"
```

---

## 7. Definition of done

- [ ] All 93 products have a `specs` block, **or** are listed in the final report as unreachable with the reason
- [ ] Every `specs.kind` equals its product's `category`
- [ ] Every `specsSource` is a real page you actually loaded for that SKU
- [ ] Every `null` appears in `specsMissing`, and nothing else does
- [ ] No value contains `Xấp xỉ`, `Khoảng`, `tương đương`, or a bare unitless number
- [ ] `npm run verify` exits 0
- [ ] The modal renders correctly for one camera, one lens and one accessory (check in a browser, not just tests)
- [ ] A short report: how many filled, how many fields came back `null` and which are most commonly missing, and any product whose page contradicted its seed `sku`

---

## 8. Things that will confuse you

- **Broken product images** on `/cameras` are the same WAF block — `next/image`
  optimises by fetching `sony.com.vn` server-side. Not a code bug; it resolves
  when the block lifts. See `docs/vercel-image-quota.md` for the related quota
  issue.
- **`getIdealUseCases()`** in `product-detail-modal.tsx` derives "ideal use
  cases" from substring matches on the product name (`includes('FX')`,
  `includes('GM')`). It is a guess presented as information and predates this
  work. Out of scope here, but worth replacing with sourced data later — do not
  extend it.
- **`src/lib/camera/` (singular)** is recipe camera constants — the source of
  truth for White Balance and Picture Profile ranges, governed by Rule 1 and its
  own sync skill. **`src/lib/cameras/` (plural)** is this product catalogue.
  They are unrelated. Do not edit the singular one.
- **`data/recipes.seed.json` is generated** (`npm run seed:emit`) and must never
  be hand-edited. `data/sony-cameras.seed.json` — the file you are editing — is
  **not** generated and is safe to edit directly.
- **`AGENTS.md` is the standing instruction file**, read every session; `CLAUDE.md`
  just points at it. Read it before your first edit.
- The seed feeds `src/app/api/cameras/ai-specialist/route.ts`, which sends
  product data to an LLM. Filling specs improves that endpoint's answers — and
  means a fabricated spec would be repeated by the assistant as fact. One more
  reason for rule 0.
