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

## Source check — done 2026-10-05

The drafts were written while `helpguide.sony.net` was denied by the
environment's network policy, restating only what `constants.ts` cites. Once
the owner opened the host, every cited page was re-read in raw text (the
`sync-camera-constants` extraction — never a search summary), plus the
ILCE-7M4 Picture Profile and File Format pages and the complete ILCE-7M4
guide in its print edition. Result:

- **Two claims were wrong and are fixed.** `gamma-va-color-mode` called Color
  Mode `Pro` a cinematic look; Sony describes it as the tones of Sony
  professional cameras, used with the ITU709 gamma. It also grouped HLG with
  S-Log2/S-Log3 as curves "for grading"; HLG is HDR recording to ITU-R
  BT.2100, and only the log curves assume processing after shooting.
- **Smaller corrections:** Color Phase + is "reddish" (not red and magenta);
  Picture Profile's nine items are now stated for ILCE-7M4, with Sony's note
  that items vary per body; the Saturation comparison now says what fraction
  of what.
- **Added from the pages:** the Color Mode ↔ Gamma pairings; BT.2020 and 709
  only with HLG; ILCE-7M4's Color Mode list has no `709tone`; Color Depth
  barely moves achromatic colour; RAW developed "with shooting settings"
  drops Black Level, Black Gamma, Knee and Color Depth (ILCE-7M4).
- **Not on any Sony page read:** the Kelvin range (2500–9900) and the WB
  shift limit and 0.25 step. The full ILCE-7M4 guide names [C.Temp./Filter]
  and a fine-adjustment screen and gives no numbers. `white-balance-shift`
  now says so; `constants.ts` already flagged both as "confirm against your
  body".
- Every source now carries `checkedAt: 2026-10-05`, read from
  `HELP_GUIDE_SOURCES` (or `PILOT_EXTRA_SOURCES` for the File Format page) —
  the one place that records the reading.

All six knowledge pages now **pass the publish rules**. They are still drafts:
which go live is the owner's call in `/admin/blog`. Before publishing, set
"Ngày rà soát" and the public author name.

## Knowledge pages

| Id | Section | Claims (all checked 2026-10-05) | Source(s) |
|---|---|---|---|
| `picture-profile-va-creative-look` | Màu Sony #1 | PP ≠ Off fixes Creative Look to `[-]`; nine PP items (ILCE-7M4); 10 Looks; 8 CL adjustments; Saturation PP −32…+32 vs CL −9…+9; Detail Limit/Crispening 0…7, Hi-Light Detail 0…4; Fade/Sharpness/Clarity 0…9, Sharpness Range 1…5; BW/SE cannot adjust Saturation | ILCE-7M4 Creative Look; ILCE-7M4 Picture Profile; PP Saturation/Color Phase/Color Depth |
| `white-balance-shift` | Màu Sony #2 | Three WB modes; Auto names as Sony prints them; presets; Custom 1–3 excluded (editorial); higher Kelvin → warmer output (ColorLab's explanation); shift limit and step are ColorLab's data, not Sony's | ILCE-7M4 White Balance |
| `color-depth` | Màu Sony #3 | R G B C M Y, −7…+7; + deepens and darkens, − lightens; achromatic barely changes; Saturation −32…+32; Color Phase −7 greenish … +7 reddish; Creative Look has no Color Depth | PP Saturation/Color Phase/Color Depth; ILCE-7M4 Picture Profile |
| `gamma-va-color-mode` | Nền tảng #1 | Gamma and Color Mode lists; pairings; BT.2020/709 only with HLG; no `709tone` on ILCE-7M4; log curves assume grading, HLG is HDR | PP Gamma/Color Mode; Black Level/Black Gamma/Knee; ILCE-7M4 Picture Profile |
| `raw-jpeg-va-cai-dat-mau` | Nền tảng #2 | RAW is not processed in camera; four PP items not reflected when RAW is developed with shooting settings | ILCE-7M4 File Format; ILCE-7M4 Picture Profile |
| `chon-cong-thuc-theo-may` | Quy trình #1 | PP and CL are not on every body; items and ranges vary per body; CL ranges checked against ILCE-7M4 | ILCE-7M4 Creative Look; PP Saturation/Color Phase/Color Depth |

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
