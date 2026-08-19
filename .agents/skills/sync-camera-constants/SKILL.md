---
name: sync-camera-constants
description: Update Alpha ColorLab's Sony camera constants — ranges, gamma curves, colour modes, Creative Looks — from the official Sony help guide. Use when adding support for a new camera body, when Sony adds or renames a Look or parameter, or when a range in constants.ts is suspected wrong.
---

# Sync camera constants

`src/lib/camera/constants.ts` is the single source of truth. `schema.ts`, the
tests, the UI and the AI prompt all derive from it. Change it here and everything
downstream follows — which is exactly why it must never be edited from memory.

## The rule

**Every number comes from a fetched Sony page, not from recall.** Model knowledge
of these ranges is unreliable and confidently wrong: web-search summaries of these
same pages have reported Creative Look Saturation as both `0…9` and `−9…+9` in one
answer. Fetch the page. Read the raw text. Cite the URL.

## Sources

Picture Profile (generic, applies across bodies):

| Parameters | URL |
|---|---|
| Gamma, Color Mode | `https://helpguide.sony.net/di/pp/v1/en/contents/TP0000909109.html` |
| Black Level, Black Gamma, Knee | `.../TP0000909110.html` |
| Saturation, Color Phase, Color Depth | `.../TP0000909111.html` |
| Detail | `.../TP0000909112.html` |

Creative Look is **per-body** — always use the guide for the specific camera:

- ILCE-7M4: `https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000640837.html`
- Others: search `helpguide.sony.net` for `<model> Creative Look`.

## Extracting reliably

Rendered summaries drop the parenthesised ranges. Pull the raw text instead:

```bash
curl -sL "<url>" | python3 -c "
import sys,re,html
t=sys.stdin.read()
t=re.sub(r'(?s)<(script|style|head).*?</\1>',' ',t)
t=re.sub(r'(?s)<[^>]+>','\n',t); t=html.unescape(t)
o='\n'.join(l.strip() for l in t.split('\n') if l.strip())
i=o.find('Go to Page Top'); print(o[:i] if i>0 else o)"
```

## Applying a change

1. Edit `constants.ts` only. Update the citation comment in the same edit.
2. Do **not** touch `schema.ts` — it derives from constants. If it needs a manual
   change to match, that is a bug in the derivation; fix the derivation.
3. Widening a range? Check `LEGACY_CORRECTIONS` in `src/lib/legacy/migrate.ts` —
   a value corrected as impossible may now be legal for the new body.
4. Adding a Creative Look? Update `CREATIVE_LOOKS`, and check whether it is
   monochrome (`CL_MONOCHROME_LOOKS` gates the Saturation rule).
5. `npm test` — the count assertions and negative cases will catch a typo'd enum.

## Bodies differ

Ranges are not universal: `Sharpness Range` exists on the a7 IV but not every
body, and the guide notes it "cannot be adjusted" in movie mode. If support
diverges enough to matter, model it explicitly per body rather than quietly
widening a shared range — a range that is too wide lets through recipes that a
user's camera will reject.
