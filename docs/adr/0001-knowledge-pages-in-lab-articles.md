# ADR 0001 — Knowledge pages are `lab_articles` rows, served at `/learn`

Status: accepted · 2026-10-05 · baseline `9a04713`

## Context

The brief asks for evergreen reference pages ("knowledge") beside the blog:
Picture Profile vs Creative Look, White Balance Shift, Color Depth, a glossary
the recipe tables can link to. It proposes a `knowledge_pages` table and a
`/wiki` route, and asks the audit to confirm both before code is written.

What already exists is a complete structured-content system for the blog:
a closed `Block` union (`src/lib/lab/types.ts`), a runtime parser that rebuilds
every block from validated pieces (`parse.ts`), a derived table of contents
(`outline.ts`), an editor with draft/publish (`/admin/blog`), an asset ledger
with a restrictive foreign key to `lab_articles` (`lab_assets`), a publish
lifecycle that moves image variants between a private and a public bucket,
cache invalidation on every write, export/import/verify scripts with a named
column list, and RLS plus column grants that keep the editor's address out of
the anon API.

## Options

1. **A new `knowledge_pages` table.** A second body store needs a second asset
   ledger (or a polymorphic foreign key, which Postgres cannot make
   restrictive), a second editor or a mode switch in the first, a second
   parser entry point, a second cache tag, two more export specs and two more
   sets of grants — all to hold the same ten block types.
2. **A `kind` column on `lab_articles`.** One store, one editor, one asset
   lifecycle; readers filter by kind.
3. **Fumadocs (MDX in Git).** Brings its own MDX pipeline, navigation, search
   and theme. It moves the source of truth for reference pages into Git while
   articles stay in Supabase, and its theme and typography contradict
   `DESIGN.md` (one family, no second theme). The one thing it would add — a
   TOC — `buildOutline()` already derives from headings.
4. **Keystatic / Payload / Tina.** A second CMS for a single operator who
   already has an editor. Rejected for the same reason as 3.

## Decision

Option 2.

- `lab_articles.kind text not null default 'article' check (kind in
  ('article','knowledge'))`, added by an additive migration on the content
  root and mirrored on the control root's dormant rollback copy.
- Every reading path filters on kind. The blog feed, `/blog/<id>`, the blog
  sitemap entries and the learning path read `kind = 'article'`; `/learn`
  reads `kind = 'knowledge'`. An id is unique across both, so a knowledge page
  is a 404 under `/blog/` and vice versa.
- Hierarchy is deliberately flat: a knowledge page carries `meta.section` from
  a closed list (`fundamentals`, `sony-color`, `workflows`) and `meta.order`.
  Breadcrumbs are `Learn → section → page`. The glossary is its own fourth
  section and is generated (below), not authored.
- Publish validation is per kind. `parseBlocks()` stays the one block-level
  safety parser for both. `validateArticleShape()` keeps the blog's editorial
  contract (TL;DR first, 8–16 blocks, closes on a checklist or figure);
  `validateKnowledgeShape()` asks what a reference page needs instead — at
  least one heading, at least one source with a checked date, a section — and
  shares the house rules (no emoji, no exclamation marks, menu pairs use `→`).
- The glossary at `/learn/glossary` is generated from
  `src/lib/camera/explanations.ts`, which is already bilingual and already
  test-covered. It introduces no new claim; the help-guide pages cited in
  `constants.ts` are listed as its references.

### Route: `/learn`, not `/wiki`

"Sony Wiki" is the shipped name of the camera and audio catalogue: the
launcher's `wiki` tile opens `/cameras`, its editor is `/admin/wiki`, and
`isWiki` in `site-header.tsx` means "a catalogue page". A second thing called
wiki would make the word ambiguous in the interface, in support conversations
and in the code. `/learn` names what the pages are for. URLs follow the
`as-needed` scheme: `/learn/...` in English, `/vi/learn/...` in Vietnamese.

### Theme

`/learn` is long-form study material like `/blog`, so it uses the same
`.theme-paper` room. `CLAUDE.md` and `DESIGN.md` list the paper exceptions and
are updated to name `/learn`. Related recipes on paper pages render as text
links (name, format, White Balance label) — never photographs or accent
swatches — which keeps the reason the paper room was allowed at all: no
recipe colour is judged on a light ground.

## Consequences

- Reusing the editor means a knowledge page can embed the same figures,
  comparisons and videos, with the same egress policy.
- `RESERVED_IDS` grows by the static siblings `/learn` now has (`glossary`)
  and the new top-level `search`, so an id can never shadow a route.
- `push:lab` learns to insert the pilot drafts **as drafts**, never published,
  and never overwrites a row that exists.
- Nothing in the reading path may forget the kind filter. A test pins that the
  blog's public query names it.

## Upgrade path

Move to a dedicated table only when one of these becomes true: knowledge pages
need nesting deeper than section → page; they need per-locale bodies (today
every body is Vietnamese, ADR 0004); or a field set diverges enough that a
shared editor costs more than it saves. The migration is mechanical — rows
with `kind = 'knowledge'` move with their `lab_assets`.
