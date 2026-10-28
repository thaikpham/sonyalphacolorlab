---
name: colorlab-blog-content
description: Turn a document the owner sends (notes, an outline, a handoff, a knowledge base) into Vietnamese /blog articles and /learn knowledge pages for Alpha ColorLab, end to end and without questions back — research against Sony's Help Guide, camera values from constants.ts, verified links and videos, a content pack in the repo that passes packs.test.ts, a PR, and a Vietnamese report with the push command. Use whenever the owner shares a document for the blog or /learn, or asks for articles on a camera or colour topic.
---

# Blog and /learn content from a document

The owner sends a document; you do the rest. Ask only when the document
contradicts itself on something that changes what a page says. Everything else
you decide, and the report says what you decided.

## Where pages live

- Once pushed, `lab_articles` (content plane) is the source of truth. One table,
  two kinds: `article` → `/blog/<id>`, `knowledge` → `/learn/<id>`.
- Before the push, a pack: `src/lib/lab/packs/<name>.ts` exporting its
  `Article[]` (type in `src/lib/lab/types.ts`), listed in `PACKS` in
  `src/lib/lab/packs/index.ts`. Pack name: lower-case letters, digits, dashes.
- `npm run push:lab -- --target content --pack <name>` inserts the pack's pages
  as **drafts** and never overwrites a row (`labCandidates` in
  `scripts/lib/lab-candidates.ts`).
- Never rename a pushed page's id. A correction after the push is made in the
  page's own Sửa (`/blog/<id>/edit`, `/learn/<id>/edit`), not in the pack.

## 1. Plan

- Pillars become knowledge pages, each with a `meta.section`
  (`KnowledgeSection`: `fundamentals` · `sony-color` · `workflows`) and an
  `order`. Clusters become articles with a `topic`, `level` and `archetype`
  (`TopicId`, `LevelId`, `Archetype` in `types.ts`); their
  `meta.prerequisites` name the pillar.
- Ids are Vietnamese slugs without diacritics (`slugify` in `parse.ts`), unique
  across `ARTICLES`, `PILOT_DRAFTS`, every pack and `RESERVED_IDS`.

## 2. Research

- **Camera values only from `src/lib/camera/constants.ts`** (AGENTS.md Rule 1).
  Never a range, enum or default from memory.
- Menu paths and behaviours only from a Sony Help Guide page read today:
  `npx tsx scripts/research/sony-source.ts <url>` prints the `SourceRef`
  (final URL, title, `publisher: 'Sony'`, `checkedAt` today). Paste it as is.
- Every URL you cite: `npx tsx scripts/research/check-urls.ts <url…>` (or one
  per line on stdin). Anything not `200` is fixed or left out.
- Every video: `npx tsx scripts/research/youtube.ts <id…>`. `embeddable: false`
  means no embed. Keep the channel it prints; prefer Sony's own.
- **Never invent** a URL, a video id, a firmware number, a date, a quote or a
  spec. A claim no Sony page backs is cut and listed in the report.

## 3. Write

The block vocabulary is closed — ten types, `Block` in `types.ts`: `tldr`, `h`,
`p`, `menu`, `table`, `callout`, `compare`, `checklist`, `figure`, `embed`.
Never add one; content that fits none is a paragraph.

The publish rules are in `src/lib/lab/parse.ts`: `validateArticleShape`
(articles), `validateKnowledgeShape` (knowledge pages) and `houseRules` (both).
**Read them before writing**; their bounds are not restated here so they cannot
drift. `buildOutline` (`outline.ts`) is where a section's précis comes from.

House style, on top of those rules:

- Body in Vietnamese (ADR 0004). Camera terms as printed on the camera
  (`Creative Look`, `AF w/ Shutter`), never translated.
- An article opens with `tldr`, then a `p` that starts with the definition
  ("X là …"), 40–60 words.
- Every `h` is followed by a block that gives the outline its précis —
  normally a `p`.
- Quick facts as a `table` when the topic has them (the head is three cells).
- FAQ: 3–5 questions people actually search, each an `h` phrased as the
  question, answered by one `p` that stands alone. `h` has no level field, and
  `h` straight after `h` is a `repeatedBlock` with an empty précis — so no
  separate "Câu hỏi thường gặp" heading above them.
  Each question costs two blocks of the article's budget in
  `validateArticleShape`, so put most of them on a knowledge page and keep an
  article to two or three.
- `menu` for an old/new menu pair; both paths start `MENU` and use ` → `.
- An article closes with a `checklist`; a knowledge page needs none.
- No `figure` blocks: a picture is an uploaded asset, added from the page's
  Sửa. The report lists the picture each page needs and where.
- No emoji, no `!`, no `[CẦN BỔ SUNG` marker.
- `meta`: `related` and `prerequisites` by real id (recipes and products from
  `data/*.seed.json`, pages from `ARTICLES`, `PILOT_DRAFTS` and the packs);
  `concepts` are `ConceptKey`s (`src/lib/content/concepts.ts`, generated from
  `explanations.ts`); `sources` dated, at least one per page; `authorName` the
  owner's public name if the document gives one, else `null`; `reviewedAt` null.

## 4. Check before the PR

```bash
npx vitest run src/lib/lab/packs   # packProblems over every pack must be []
npm test
npm run typecheck
npm run lint; echo $?              # must print 0; never pipe it
```

The pack test is the gate. A pack page is not in the offline seed, so the owner
sees it rendered only after the push, as a draft, in its own editor.

## 5. Ship

A branch and a PR using `.github/pull_request_template.md`, in Vietnamese,
ticking "Không đổi giao diện". The owner merges.

## 6. Report (in Vietnamese)

```
## Đã viết
<id> · <article|knowledge> · <tiêu đề>   (one line per page)

## Đã sửa từ tài liệu
<what the document said, what the page says, and the source that decided it>

## Bỏ ra và lý do
<a link that did not answer 200, a video that cannot embed, a claim no Sony page backs>

## Ảnh cần thêm
<id> — <which picture, after which heading>

## Lệnh đẩy bài
npm run push:lab -- --target content --pack <name> --dry-run
npm run push:lab -- --target content --pack <name>
```

Then one line: the pages arrive as drafts under "Bản nháp"; the owner publishes
each from its own Sửa.

## Never

- Run `push:lab` (or any `push:*`) yourself, or touch `.env.local`.
- Publish anything, or ship a pack page as anything but a draft.
- Edit a page someone has edited after the push, or reuse its id.
- Add a block type, or change `validateForPublish` to let a page through.
