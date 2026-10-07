# ADR 0005 — Camera capabilities from checked Help Guide evidence

Status: withdrawn · 2026-10-07 (accepted 2026-10-05, amended 2026-10-06)

> **Withdrawn 2026-10-07.** The camera page's "Colour settings" section was
> judged unnecessary and removed, and with it everything below: the evidence,
> its checks file, `npm run capabilities:check` and `src/lib/cameras/capabilities/`.
> Kept as the record of what was tried.

> **Amended 2026-10-06.** The compatibility engine and its four verdicts are
> removed: the recipe-page "Camera compatibility" section and the camera
> page's list of verified recipes were judged not useful. The checked
> evidence stays, and now only lists what a body's colour menus hold on its
> camera page ("Colour settings"). The verdict sections below are history.

## Context

Brief §5.2 asks for a `camera_capabilities` model — supported / unsupported /
unknown per body, mode scope, firmware, ranges, Sony source and check date —
and a compatibility engine with four verdicts (`verified`, `partial`,
`incompatible`, `unknown`). It places the table on the content plane.

Three facts shaped the decision:

1. **The evidence is engineering data, not editorial content.** It is the
   same kind of fact as `constants.ts` — a value Sony's manual states — and
   the repository already has a discipline for that: cite the page, never
   write from memory, change it in review. `sync-camera-constants` forbids
   web-search summaries as a source because they have reported one range two
   ways in one answer.
2. **Sony's pages differ per body in ways no global enum shows.** Read on
   2026-10-05: ILCE-7M5's Picture Profile has no Color Depth item at all;
   ILCE-7CM2, ILCE-6700 and ILCE-7M5 list no `S-Log2`, `ITU709(800%)` or
   `S-Gamut`; no pilot body lists `709tone`; ILCE-7M5 has `FL2` and `FL3`
   Looks that `constants.ts` does not; every body refuses Sharpness Range in
   movie mode; and **no** Help Guide read — the full print editions of all
   four bodies — states a Kelvin range or a White Balance shift limit or step.
3. A claim copied by a person is only as good as the copying. A literal that
   a program finds on the live page is reviewable in a diff.

## Decision

**Evidence lives in the repository**, in `src/lib/cameras/capabilities/`:

- `keys.ts` — capability keys derived from `constants.ts` (`pp.gamma:S-Log3`,
  `cl.adjust:sharpnessRange`, `wb.preset:Flash`, …) and `requirementsFor(recipe)`
  (removed 2026-10-06).
- `evidence.ts` — per body, per Help Guide topic: claims, each quoting a short
  literal from the raw page.
- `checks.ts` + `data/camera-evidence.checks.json` — written only by
  `npm run capabilities:check`, which fetches each topic, reads its heading
  and body (never the navigation tree), and records every literal found, with
  its surrounding sentence, and every literal missing. **A claim counts only
  when its last check found its literals as the claim quotes them now.**
- `engine.ts` — `assess(requirements, body, { mode, firmware? })` (removed 2026-10-06).

Rules the engine and the evidence follow:

| Rule | Why |
|---|---|
| No confirmed claim → `unknown` | A legal enum value proves nothing about a body |
| `unsupported` needs Sony's words, or a whole list without the option, bounded by literals on both sides | Absence from a page is not evidence; absence from that body's complete list is. An unreadable list is never read as absence |
| A support with a known exception states its own mode | If the exception's literal stops matching, the other mode falls to `unknown`, never to supported |
| A value needs a range with min, max and step quoted on the page | Kelvin and shift values are therefore `unknown` on every body today |
| `incompatible` > `unknown` > `partial` > `verified` | One setting the body refuses is enough to know |
| Firmware is a condition when the reader gave none | It is a known requirement, not an unknown |

`evidence.test.ts` fails if any committed claim is unconfirmed by the committed
checks file, so evidence edited without re-checking cannot ship silently.

**UI.** The recipe page lists every evidenced body with a stills and a movie
verdict and the settings in the way; the camera page lists the body's
confirmed menus, what it lacks, the recipes verified for stills, and the
pages with their check dates. Neither renders for a body without evidence.
Verified is the accent, incompatible the `danger` signal, unknown carries no
tick. A disclaimer says `verified` is about settings, not rendering.

**Aliases.** `resolveCamera(text, products)` resolves a model code, marketing
name or EXIF-style string to exactly one catalogue product, from the aliases
search already derives; ambiguity is `null`. What a body writes into EXIF is
not asserted — photo discovery (PR6) must prove it with real files.

## Consequences

- No migration, no table, no admin screen: the pilot ships with the code and
  reads identically online and offline.
- Adding a body is a code change: read its three topics in raw text, add a
  source per topic, run `npm run capabilities:check`, read the diff.
- Re-checking is cheap and should be routine: `npm run capabilities:check`
  rewrites every check; a page Sony edits shows up as a missing literal.

**Upgrade path.** Move to a content-plane `camera_capabilities` table when
either an editor must change evidence without a deploy, or the evidence
outgrows review in a diff (roughly beyond 15 bodies). Keep the same shape —
source, claim, literal, check — with the repository file as its seed, and keep
the check as the only writer of "confirmed".

## Not decided here

- Cross-setting rules (Black Gamma fixed at 0 under HLG; BT.2020 and 709 only
  with HLG) are not modelled per body. The second is global in Sony's generic
  guide and belongs in `recipeSchema` via `sync-camera-constants`.
- `FL2` / `FL3` need `constants.ts` and a `creative_look` enum value in both
  migration roots (each in its own file, Rule 1b) before any body can claim them.
