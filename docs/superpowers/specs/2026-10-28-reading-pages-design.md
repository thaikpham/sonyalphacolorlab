# Reading pages and copy (sub-project 5)

Status: approved by the owner 2026-10-28 — recipe page phone order fixed with
desktop kept; article outline folded under the dek on phones only; copy items
1–5 all; stop before merge. Roadmap:
`docs/plans/2026-10-22-feestfinder-design-kit-adoption.md` §5.

## What a phone shows today (live, 375 px, 2026-10-28)

- `/recipe/<slug>`: hero (screen 0) → three offers and "Comments (0)"
  (screen 1) → White Balance (2) → camera settings (3) → same situation (4–6).
  The settings — the reason to open a recipe — come after the community.
  Desktop is right: settings are the sticky right column.
- `/vi/blog/<id>`: the rail ("Trong bài viết" with a précis per section) sits
  above the title, so a reader meets the outline before the h1. Desktop's
  sticky right rail is right.

## 1. Recipe page — settings straight after the hero on phones

`src/app/[locale]/recipe/[slug]/page.tsx`. The left column splits into two
grid children: **hero** (back link through the taxonomy links) and
**participation** (`RecipeGallery`, `TweakPanel`, `RecipeCommunitySection`).
DOM order: hero → settings column (WB card, settings tables, learn more) →
participation, so phones and screen readers read settings second.

At `lg` the grid gets `lg:grid-rows-[auto_1fr]`: hero `lg:col-start-1
lg:row-start-1`, participation `lg:col-start-1 lg:row-start-2`, settings
`lg:col-start-…` (the second track) `lg:row-start-1 lg:row-span-2`, still
`lg:sticky lg:top-24`. Column spans stay exactly as today (`lg:col-span-6
xl:col-span-7` / `lg:col-span-6 xl:col-span-5`, pinned by
`recipe-page.test.ts`). The `1fr` second row takes any height the spanning
settings column adds, so no gap opens between hero and participation. Desktop
should be visually unchanged; the PR's visual comparison decides, and any
desktop difference is a defect, not something to accept.

The `gap-8` stack between the left column's children is restated so hero →
participation spacing is what it was. "More for <situation>" stays below the
grid.

## 2. Article page — outline folded under the dek on phones

`src/components/lab/article-view.tsx`, for both `/blog/<id>` and
`/learn/<id>`. Below `lg` the rail `<nav>` is `hidden`; after the dek (before
the seam) a phone-only block (`lg:hidden`) renders:

- the prerequisites `RelatedLinks` ("Đọc trước"), open, when there are any;
- the outline in a `<details>` closed by default, its `<summary>` the same
  label (`inThisArticle` / `inThisPage`), 44 px tall, the list the rail's.

The outline markup is one component used by both places, so they cannot
drift. Server-rendered; no client JS. At `lg` and up nothing changes.

## 3. Copy (EN and VI, `messages/*.json`)

| Key | Now | After |
|---|---|---|
| `home.emptyTitle` / `emptyAction` / `emptyTail` | three fragments around a link | `emptyTitle` one sentence (vi "Không có công thức nào khớp bộ lọc.", en "No recipes match these filters."), then `emptyAction` as a `.btn-glass` link to `/colorlab`; `emptyTail` deleted |
| `error.body` | two sentences | vi "Lỗi từ phía chúng tôi, không phải bạn.", en "That’s on us, not you." |
| `community.tabComments` / `tabProposals` | "(0)" shown | the `…Plain` label when the count is 0 |
| `lab.emptyBody` | restates the title | deleted; title + `emptyCta` |
| `lab.stageEmptyBody` | two explanatory sentences | deleted; title + `emptyCta` |

The search-elsewhere escape under the `/colorlab` empty state (when `q` is
set) stays. Deleted keys leave both locales (`messages.test.ts` parity) and
any client namespace list that ships them.

## Not done

The "16 AI smells" `/design-sync` step and a written "three states" rule —
the latter is a CLAUDE.md rule, which only the owner edits.

## Success

Unit tests pin the recipe DOM order and grid placement, the article's phone
block and `details`, and the copy; `npm test`, typecheck, lint green;
`npm run test:screens` green with every count that dropped lowered and dated
(the article first screen is not a gate today; the recipe detail first screen
stays 9); the visual comparison shows only phone/tablet changes on the recipe
and article screens, which are then accepted with `visual-ok`.
