# Handover — fill core specs for all 93 Sony wiki products

**To:** the agent picking this up (Gemini / Antigravity)
**From:** Claude Opus 5, session of 2026-08-11
**Repo:** Alpha ColorLab · branch `feat/sony-product-specs` · base commit `808b5fa`
**State:** framework built and green; **2 of 93** products have real specs.

Your job: extract and fill the remaining **91**.

> **Result (2026-08-11, second pass):** 88 of 93 extracted from official pages;
> the 5 accessories are unreachable and left without a `specs` block. See
> §9 at the end for what happened, including the earlier pass that had to be
> discarded. The brief below stands unchanged — it is what §9 was measured against.

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

Values are **strings in the source page's own wording**. Not numbers. Not
Sony's marketing prose.

They are *not* language-neutral, and the table below is why: `"17 thành phần /
12 nhóm"` is the Do column because the compact `"12-17"` loses which number is
which. The extraction source is Sony **Vietnam**, so a compact value carries
Vietnamese unit words, and Vietnamese is the canonical form of a spec value.
English readers get them through `data/spec-values.en.json` — see §3b.

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

## 3b. The words inside a value

A value's numbers pass through untouched; its *words* do not. `data/spec-
values.en.json` maps them for `en`, and `translateSpecValue()` applies it at
render. Two things to know before adding to it:

- **It is keyed by field, and must stay that way.** `điểm` is autofocus
  *points* under `autofocus` and screen *dots* under `lcd` and `viewfinder`. A
  global dictionary mistranslates one of them and nothing on screen says so.
- **`replace` is ordered, longest first.** `triệu điểm` has to be spent before
  `điểm` can match inside it.

Adding a field with new Vietnamese wording means adding its rule in the same
commit. `spec-values.test.ts` walks all 93 products and fails on any value that
still reads as Vietnamese after translation, so a missing rule is a red suite
rather than a Vietnamese word shown to an English reader.

Its `EXTRACTION_BUGS` list is the exception, and it is for **wrong data, not
missing rules** — a frame rate in `lensMount`, power draw in `lcd`. Translating
those would make a bad row look answered. Shrink that list by re-extracting from
`specsSource`; never grow it to quiet a failure.

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

---

## 9. Result

**88 of 93** products carry specs read from an official Sony page. The other 5
are accessories and are deliberately left **without a `specs` block**.

| | camera | lens | accessory |
|---|---|---|---|
| extracted | 31 / 31 | 57 / 57 | 0 / 5 |

Sources: 79 from `sony.com.vn`, 9 from `sony-asia.com` (used only where VN does
not publish the product or its spec table). 133 fields came back `null`; every
one is named in its product's `specsMissing`. 21 products have no gaps at all.

Most-missing fields — all of them genuine silences in the source, not skipped work:

| field | null | why |
|---|---|---|
| `stabilization` | 46 | mostly lenses with no OSS; the page prints `- (body-integrated)` |
| `battery` | 21 | the newer `/spec` fragment omits the CIPA figure |
| `isoRange` | 12 | same — the a7 IV and a1 spec tabs state no ISO range at all |
| `viewfinder` | 11 | ZV / FX / RX bodies that have no EVF |
| `video` | 10 | no row stating a resolution beside its own frame rate |

### The first pass was discarded

The seed arrived with all 93 filled and `specsMissing: []` everywhere. That data
did not come from the pages it cited and has been replaced wholesale:

- **FX2 carried the FX30's specs** (26 MP APS-C, 495-point AF) under an FX2
  `specsSource`. The two products had byte-identical spec blocks at different
  prices. The live FX2 page states full-frame 35 mm, 33,0 MP.
- **Zero values used Sony's decimal comma** across 93 products, though 82 cited
  `sony.com.vn`. The rebuilt data has 229.
- **No product declared a single gap**, against a schema built around declaring
  them.
- 88 products carried English `keyFeatures` marketing bullets inside `specs`,
  excluded from the guard test and rendered nowhere.

The lesson is the one in §0: a spec table that invents a row is indistinguishable
from one that does not, so the *shape* of the data is the only tell. Uniform
completeness against a WAF-blocked source was the tell.

### How the extraction works

Three stages, re-runnable, in the session scratchpad — fetch → parse → map:

- sony.com.vn serves **three** spec templates: `.spec-item-cell`,
  `section.spec-product > dl`, and a `tr.SpecificationsTable__TableRow` fragment
  at `/spec?sku=…` that newer product pages load client-side. Sony Asia serves
  the third one server-rendered at `/spec`, which is how the ZV compacts and
  SEL50F14GM were reached after VN 404'd or blocked.
- The WAF still blocks bulk fetching. Serial requests with exponential backoff
  got 88; no user-agent rotation, proxy, or cookie reuse was used.
- Two traps worth keeping in mind if this is ever re-run:
  `ĐỘ PHÂN GIẢI VIDEO` is the **USB-streaming** resolution (4K 15p on a body that
  records 4K 60p), and a single recording-format cell lists every mode at once —
  pairing the best resolution with the best frame rate independently yields
  "4K 120p" for the ZV-1, which records 4K 30p. Frame rate is now taken only
  from beside its own resolution token.

### Still open

1. **The 5 accessories** — `ECM-M1`, `ECM-B10`, `NP-FZ100`, `GP-VPT2BT`,
   `LA-EA5`. Sony publishes no spec table for them on either VN or Asia: the
   pages render marketing sections only, and the Asia `/spec` route 404s. Tried
   both sites, several URL shapes, and a real rendered browser session. They need
   a source that actually states the values — Sony global, or the printed
   manual — not a filled-in guess.
2. **`sony-sel85f14gm-qsyx-mysonycarelens6mpackb` is named "FE 85mm f/1.4 GM II"
   but its SKU is `SEL85F14GM/QSYX+MYSONYCARELENS6MPACKB`** — the mark I plus a
   care pack. The real GM II is `SEL85F14GM2`, a separate product with its own
   page. Its specs were read from the mark I page, matching the SKU. Either the
   name or the SKU/price is wrong; that is a catalogue decision, not an
   extraction one, so nothing was renamed.
3. **`getIdealUseCases()`** still guesses from substring matches on the product
   name, as §8 noted. Unchanged and still worth replacing.
