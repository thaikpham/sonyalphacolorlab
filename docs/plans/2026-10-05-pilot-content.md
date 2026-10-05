# Pilot content — review sheet

Nine drafts live in `src/lib/lab/pilot-drafts.ts`: six knowledge pages
(`/learn/<id>`) and three experiment frames (`/blog/<id>`). **None is
published by any code path.** Locally they appear as drafts in `/admin/blog`
the first time the development store is created; on the content project they
arrive only via:

```bash
npm run push:lab -- --target content --with-pilot-drafts --dry-run   # plan
npm run push:lab -- --target content --with-pilot-drafts             # insert as drafts
```

The push inserts missing ids only, always with `status = 'draft'`, and never
overwrites an existing row.

## Why every knowledge page is blocked at publish

The session that wrote these could not reach `helpguide.sony.net` (the
environment's network policy denied the host). So:

- every claim is restated from `src/lib/camera/constants.ts` (each block of
  which cites a Help Guide page) or `src/lib/camera/explanations.ts` — nothing
  was added from memory;
- no source carries a `checkedAt` date, and publishing a knowledge page
  requires one on every source (`sourceNeedsDate`). Entering the date is the
  record that a person re-read the page.

Review procedure for each page: open every source URL, confirm each claim in
the table below against it **for the body named in Scope**, correct the page in
the editor if needed, set "Ngày kiểm tra" on each source, set "Ngày rà soát",
then publish.

## Knowledge pages

| Id | Section | Claims to confirm | Source(s) attached | Blocked by |
|---|---|---|---|---|
| `picture-profile-va-creative-look` | Màu Sony #1 | PP set ≠ Off fixes Creative Look to `[-]`; PP has 9 items; 10 Looks; 8 CL adjustments; Saturation PP −32…+32 vs CL −9…+9; Detail Limit/Crispening 0…7, Hi-Light Detail 0…4; Fade/Sharpness/Clarity 0…9, Sharpness Range 1…5; BW/SE cannot adjust Saturation | ILCE-7M4 Creative Look (TP1000640837); PP Saturation/Color Phase/Color Depth (TP0000909111) | `sourceNeedsDate` |
| `white-balance-shift` | Màu Sony #2 | Three WB modes; Auto names as Sony prints them; preset list; Custom 1–3 excluded (editorial); higher Kelvin → warmer output; shift up to 7 each way; **0.25 step is from the recipe corpus, not Sony** (page says so — confirm on a body and edit if the guide states it) | ILCE-7M4 White Balance (TP1000640840) | `sourceNeedsDate` |
| `color-depth` | Màu Sony #3 | Six channels R G B C M Y; −7…+7; + deepens and darkens, − lightens; Saturation −32…+32; Color Phase −7…+7, − toward green, + toward red/magenta; Creative Look has no Color Depth | PP (TP0000909111) | `sourceNeedsDate` |
| `gamma-va-color-mode` | Nền tảng #1 | Gamma and Color Mode option lists (match the body); S-Log/HLG are for grading | PP Gamma/Color Mode (TP0000909109); Black Level/Black Gamma/Knee (TP0000909110) | `sourceNeedsDate` |
| `raw-jpeg-va-cai-dat-mau` | Nền tảng #2 | In-camera colour applies to the files the camera processes (JPEG); for RAW it depends on the converter | **none** — add a Sony page on file format / RAW, or rewrite | `knowledgeNeedsSource` |
| `chon-cong-thuc-theo-may` | Quy trình #1 | PP and CL are not on every body; ranges may differ per body; CL ranges checked only against ILCE-7M4 | ILCE-7M4 Creative Look; PP (TP0000909111) | `sourceNeedsDate` |

## Experiment frames

| Id | What is missing | Blocked by |
|---|---|---|
| `thu-nghiem-white-balance-duoi-den-led` | A real shoot under one LED source: four JPEGs (AWB, AWB (Priority White), Kelvin from the lamp's spec, Daylight), the body/lens/lamp/exposure caption, a compare pair uploaded through the editor, the TL;DR, dek and conclusion | `placeholder` |
| `thu-nghiem-mot-cong-thuc-ba-loai-anh-sang` | Pick one recipe and add it under Liên kết liên quan; three JPEGs (direct sun, shade, indoor), captions with real exposure values, compare pair, conclusion | `placeholder` |
| `so-sanh-hai-cau-hinh-cung-canh` | Pick one PP and one CL recipe and link both; one scene shot with each; compare pair labelled with the recipe names; table cells; conclusion | `placeholder` |

Every measured cell, label and image in these frames is empty or marked
`[CẦN BỔ SUNG: …]`; publishing refuses any page that still contains the
marker. `pilot-drafts.test.ts` fails if a frame gains a filled table cell or an
asset without the marker being removed — i.e. it is a reminder, not a gate on
the real shoot: replace the frame's content in the editor, not in this file.

## What the drafts do not do

- No photograph, EXIF value, measurement or first-person "I tried" anywhere.
- No claim about which bodies support Creative Look or Picture Profile.
  Per-body support is PR5 (`camera_capabilities`), and until then the answer is
  "check your body's Help Guide", which is what the workflow page says.
- No score, percentage or ranking of looks.
