# A ColorLab blog-content skill (sub-project 3, first half)

Status: approved by the owner 2026-10-28 — skill + packs now, the AIO half
(JSON-LD, `.md` twins, `llms.txt`) as its own PR later; FAQ and facts from the
existing blocks, no new block type; the owner runs the push command; this PR
stops before merge. Roadmap:
`docs/plans/2026-10-22-feestfinder-design-kit-adoption.md` §3.

## What exists

`lab_articles` holds both kinds (`article` → `/blog/<id>`, `knowledge` →
`/learn/<id>`), ten closed block types (`src/lib/lab/types.ts`), per-kind
publish rules (`validateForPublish` in `parse.ts`), relations by real id and
dated sources in `meta` (`parseMeta`). `push:lab` inserts
`ARTICLES` (published) and, with `--with-pilot-drafts`, the nine
`PILOT_DRAFTS` (draft) — insert-only, never an upsert. A figure is an
uploaded asset by UUID, never a URL.

## 1. The skill — `.claude/skills/colorlab-blog-content/SKILL.md`

Used when the owner sends a document (notes, an outline, a handoff) for the
blog or `/learn`, or asks for articles on a topic. The owner's standing
request, as at FeestFinder: they send the document, the skill does the rest
without questions unless the document contradicts itself on something that
matters. Steps:

1. **Plan.** Pillars become knowledge pages (a `KnowledgeSection`), clusters
   become articles (`topic`, `level`, `archetype`) whose `prerequisites` name
   the pillar. Ids are Vietnamese slugs without diacritics, unique across
   `ARTICLES`, `PILOT_DRAFTS`, every pack and `RESERVED_IDS`.
2. **Research.** Camera values only from `src/lib/camera/constants.ts`
   (AGENTS.md Rule 1) — never from memory; menu paths and behaviours from a
   Sony Help Guide page read today, recorded by `sony-source.ts` as a
   `SourceRef` with `checkedAt`. Every cited URL through `check-urls.ts`
   (must answer 200); every video through `youtube.ts` (oEmbed answers =
   embeddable; keep the channel, prefer Sony's own). Never invent a URL, a
   video id, a firmware number, a date or a quote.
3. **Write** `Article` objects in Vietnamese in a pack file. Body shape (what
   `validateForPublish` already demands, plus house style):
   - `tldr` first, then a `p` that opens with the definition ("X là …") in
     40–60 words;
   - every section a `h` whose following block gives the outline its précis;
   - quick facts as a `table` (its head is three cells, `TableBlock`) when the
     topic has them;
   - FAQ: 3–5 questions people search, each its own `h` phrased as the
     question and answered by one `p` that stands alone — no separate FAQ
     heading (`h` has no level, and `h` after `h` is a `repeatedBlock`); most
     of them on knowledge pages, two or three in an article, whose block
     budget is `validateArticleShape`'s;
   - `menu` blocks for old/new menu pairs, terms as printed on the camera;
   - an article closes with a `checklist` (a knowledge page needs none);
   - `meta`: `related` and `prerequisites` by real id, `concepts` from
     `explanations.ts`, `sources` dated, `authorName` the owner's public name
     if the document gives one, else null.
   No figure blocks: a picture is an upload. The report lists, per page, the
   picture it needs and where, for the owner to add from the page's Sửa.
4. **Test.** `npx vitest run src/lib/lab/packs` and the full `npm test`,
   typecheck, lint. The pack test is the gate; a pack page is not in the
   offline seed, so the owner sees it rendered only after the push, as a
   draft, in its own editor.
5. **Ship.** A branch and a PR with the Vietnamese template (no UI change);
   the owner merges.
6. **Report** in Vietnamese: pages written (id, kind, title), what was
   corrected in the document and why, what was left out (an unverifiable link,
   a claim no Sony page backs), the pictures wanted, and the two commands:
   `npm run push:lab -- --target content --pack <name> --dry-run`, then
   without `--dry-run`. Pages arrive as drafts under "Bản nháp"; the owner
   publishes each from its own Sửa.

## 2. Research scripts — `scripts/research/`

TypeScript run with `npx tsx`, like the rest of `scripts/`, so their parsing
is unit-tested and typechecked. Read-only, public pages, no credentials.

- `check-urls.ts <url…>` (or one per line on stdin): GET each with a
  browser-like `User-Agent`, follow redirects, print `200 url` or
  `<status> url → final`; exit 1 if any is not 200.
- `youtube.ts <id…>`: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`;
  print `{ id, title, channel, channelUrl }` or `{ id, embeddable: false }`;
  exit 1 if any is not embeddable.
- `sony-source.ts <url>`: fetch, print a `SourceRef` JSON — `url` (final),
  `title` (the page's `<h1>`, else `<title>` minus the site suffix),
  `publisher: 'Sony'`, `checkedAt` today (UTC `YYYY-MM-DD`). Refuses a host
  that is not Sony's.

Pure parts (`sourceFromHtml`, `parseOembed`, `readUrls`) live in
`scripts/research/lib.ts` with `scripts/research/lib.test.ts` over fixtures.

## 3. Packs — `src/lib/lab/packs/`

- `index.ts`: `export const PACKS: Readonly<Record<string, readonly Article[]>>`,
  empty today; a pack is `packs/<name>.ts` exporting its `Article[]`, added
  here. Names match `^[a-z0-9-]+$`.
- `check.ts`: `packProblems(name, pages, known)` → `string[]`, pure: every
  page passes `validateForPublish` (problems prefixed with the page id); ids
  unique within the pack and absent from `known.ids` (ARTICLES, PILOT_DRAFTS,
  other packs, RESERVED_IDS); every `related` ref and every `prerequisites`
  id exists in `known` (recipes and products from `data/*.seed.json`,
  articles/knowledge from ARTICLES, PILOT_DRAFTS and all packs); every page
  cites at least one source and every source has `checkedAt`; no figure block.
- `packs.test.ts`: `packProblems` over every entry of `PACKS` is `[]`; and
  probes over a fixture pack prove each rule fires (a page failing publish
  rules, a duplicate id, an unknown ref, an undated source, a figure).

## 4. `push:lab --pack <name>`

`scripts/supabase/args.ts` gains a value flag `--pack` (`pack?: string`,
name must match `^[a-z0-9-]+$`, given at most once). The candidate list moves
into a pure `labCandidates({ withPilotDrafts, pack })` in
`scripts/lib/lab-candidates.ts` — `ARTICLES` as `published`, pilot drafts and
`PACKS[pack]` as `draft`; an unknown pack throws, listing the packs — and
`push-lab-articles.ts` calls it before it opens a client. Same insert-only
path, same `--dry-run`. Without `--pack` the candidates are exactly today's.

## Not in this PR

JSON-LD, `.md` twins, `llms.txt`; new block types; any article content (the
first pack is the skill's first real use, its own PR).

## Success

`npm test` (packs probes, research lib, args), typecheck, lint green; the
skill file readable on its own; `labCandidates` is tested for today's list
unchanged, a pack's pages as drafts, and an unknown pack refused.
