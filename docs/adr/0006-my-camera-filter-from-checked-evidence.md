# ADR 0006 — "My camera" filter from checked Help Guide evidence

Status: accepted · 2026-10-24

## Context

A reader with an older body — an a7 III, an a6400, a ZV-1 — opens the
catalogue and half of it is Creative Look recipes their camera has no menu
for. Another reader picks an S-Cinetone Picture Profile and finds no
S-Cinetone on their Gamma list. P4 of the 2026-10-23 handoff asks for
"My camera": the reader names their camera once, and the catalogue stops
showing recipes that camera cannot install.

A wrong "cannot install" is worse than none. It hides a recipe that would
have worked, and nothing tells the reader it was hidden. So the filter needs
facts about each body that are as trustworthy as `constants.ts` — and the
repository already built a way to get exactly those.

ADR 0005 restricted per-body claims to Sony's own words, checked by a
program against the live Help Guide page. It was **withdrawn on 2026-10-07**
because the camera page's "Colour settings" section it fed was judged
unnecessary — not because the method was wrong. ADR 0005 stays withdrawn
for that purpose: no camera-page section and no recipe × body verdict table
come back with this ADR.

## Decision

**Reuse the evidence, for a new purpose.** `src/lib/cameras/capabilities/`
(`evidence.ts`, `checks.ts`, `page-text.ts`, `keys.ts`, `features.ts` —
since deleted, see Consequences — and `index.ts`),
`data/camera-evidence.checks.json` and
`npm run capabilities:check` are restored from `ced75a9^` unchanged in
method:

- each claim quotes literal text from that body's own Help Guide topic;
- `npm run capabilities:check` fetches the live page, reads only the topic
  (never the navigation tree), and is the only writer of the checks file;
- a claim counts only when its last check found its literals as the claim
  quotes them now, and `evidence.test.ts` fails on any claim that does not;
- an absence is read only from the body's **complete** list, bounded by the
  text before and after it (`GAMMA_LIST`, `COLOR_MODE_LIST`). An unbounded or
  unreadable list proves nothing.

Per body, the filter needs four facts: whether the style menu is Creative
Look or Creative Style, whether it has Picture Profile, and its complete
Gamma and Color Mode lists. Added on 2026-10-24 for the bodies that came
before Creative Look — ILCE-7M3, ILCE-6400, ILCE-7C, ILCE-7RM3A, ILCE-7RM4A,
ZV-E10, DSC-RX100M7, ZV-1 — beside the four bodies already evidenced
(ILCE-7M4, ILCE-7CM2, ILCE-6700, ILCE-7M5). Bodies are keyed by the model code
the catalogue SKU starts with; the a7R III and a7R IV in the catalogue are the
`A` revisions, which have Help Guides of their own.

**The rules** (`installable.ts`, `installability(recipe, caps)`):

| Recipe | Hidden only when |
|---|---|
| Creative Look | the camera is **confirmed** to lack Creative Look |
| Picture Profile | the camera is **confirmed** to lack Picture Profile, or the recipe's Gamma or Color Mode is outside the camera's **confirmed** complete list |
| any | never, when the camera has no checked data — it shows everything |

Unknown is never "no". A list with one option unsettled is unknown as a
whole, never read as the options it happens to hold.

**Creative Style means no Creative Look.** No topic says in words that a
body lacks Creative Look, and none prints a menu list it would be absent
from. What the older bodies' pages do say is that their style menu is
`[Creative Style]`, the menu Creative Look replaced. By the owner's rule, a
body confirmed to be on Creative Style is treated as confirmed to lack
Creative Look. The inference lives in `installable.ts` only; the evidence
records what the page says and nothing more.

**Two generic choices.** "Older camera, Creative Style menu" hides Creative
Look by the same rule and knows nothing else. It warns — never hides — about
options that **every** checked Creative Style body's list lacks (today the
S-Cinetone gamma and colour mode, and the 709tone colour mode), derived from
the evidence rather than typed: eight bodies do not prove it of every older
body. "Unknown / skip" knows nothing and shows
everything.

**One accuracy line.** A hidden or doubtful recipe carries structured
reasons (`{ setting, label, confirmed }`). The recipe page renders one line
through `messages/` — "a7 III has no Creative Look", "a6400 has no
S-Cinetone". `label` is Sony's own name and is never translated (Rule 3).
CLAUDE.md keeps accuracy disclaimers on purpose; this is one.

**Cookie, not URL.** The chosen camera is stored in a cookie, never in the
query string or the path. A shared link must not carry the sender's camera
onto the recipient's catalogue. Filtering runs in the page, after one
unfiltered `listRecipes(locale)`, exactly as `?q=` does; nothing is added to
the `catalogueCache` key.

## Consequences

- Still no table, no migration, no admin screen: the evidence ships with the
  code and reads the same online and offline.
- Adding a body is a code change: find its Creative Look or Creative Style
  topic and its Picture Profile topic, add the sources, run
  `npm run capabilities:check`, read the diff. A body not added is unknown and
  loses nothing.
- Re-run the check when Sony edits a guide. A literal that stops matching
  drops its claim, the list falls to unknown, and the recipes it hid come
  back — the failure mode is showing too much, never too little.
- A firmware update that adds an option is invisible until the guide says
  so; the Help Guide is the source, not release notes.
- `features.ts` (the old camera-page summary) came back with the mechanism,
  found no use and was deleted again with its test and the two label helpers
  in `keys.ts` only it read.
- The recipe page stays prerendered. Reading `cookies()` there would render
  every recipe per request, so the page computes, at build, what every choice
  has to say about its recipe (`cameraWarnings`) and a client island looks the
  browser's cookie up in that map. That is why the cookie is not `httpOnly`;
  it holds a model code, not a credential. The browse pages already render
  per request (`searchParams`) and read it with `cookies()`.
