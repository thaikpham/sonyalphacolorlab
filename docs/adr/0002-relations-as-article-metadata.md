# ADR 0002 — Cross-links live in article metadata, resolved at read time

Status: accepted · 2026-10-05

## Context

The reader journeys in the brief cross four kinds of entity — blog article,
knowledge page, recipe, Sony product — and expect links in both directions:
an article names the recipes it uses and the body it was tested on, and the
recipe and the camera page show the articles that mention them. The brief
proposes a `content_nodes` registry and a `content_relations` table, and
allows a smaller first step if the ADR records how to grow out of it.

The corpus is small: tens of articles, 83 recipes, under a hundred products.
Every relation is authored by an editor in one place, the article editor.

## Decision

Relations, sources and the other editorial facts are one validated jsonb
column, `lab_articles.meta`, beside the body:

| Field | Shape | Rule |
|---|---|---|
| `related` | `{ kind: 'recipe' \| 'product' \| 'article' \| 'knowledge', id }[]` ≤ 24 | Real primary keys: `SCL-PP-001`, `sony-ilce-7m4-bq-ap2`, an article id. Never a title, never a URL. |
| `prerequisites` | article/knowledge ids ≤ 6 | "Read first". |
| `concepts` | closed keys, e.g. `pp.colorDepth`, `wb.shiftAb`, `cl.look` ≤ 16 | Generated from the `explanations.ts` tables, so the vocabulary cannot drift from the parameters that exist. |
| `sources` | `{ url, title, publisher?, section?, checkedAt?, scope? }[]` ≤ 16 | `https:` only, no credentials, no fragment-only links; `checkedAt` is `YYYY-MM-DD`. |
| `authorName` | string ≤ 80 or null | A public display name. Refused if it contains `@` — the editor's address lives in `updated_by` and is never public. |
| `reviewedAt` | `YYYY-MM-DD` or null | Shown as "reviewed", never used as a published or modified date. |
| `section`, `order` | knowledge only | ADR 0001. |

`parseMeta()` rebuilds the object entry by entry, drops what does not
validate and reports the count, exactly as `parseBlocks()` does for blocks.
A stray key is never carried through.

### Resolution

- **Forward links** (`related`, `prerequisites`) are resolved when a page
  renders, against the same cached reads the rest of the site uses:
  published articles and knowledge pages, published recipes, the product
  catalogue. A reference whose target is not currently there renders nothing.
  Unpublishing or deleting a target therefore hides every link to it on the
  next request — the write route already invalidates the tag those reads sit
  behind — and no stored link can resurrect it.
- **Reverse links** (recipe page → articles that name it; camera page →
  articles tested on it; recipe parameter → knowledge pages for that concept)
  are computed from the published set at read time. With tens of rows this is
  a filter over a list already in memory.
- **Publish validation** reports `relatedUnknown` for a recipe, product or
  article id that does not exist at all, so a typo is caught by the editor
  rather than silently rendering nothing. A reference to an existing but
  unpublished page is allowed; it appears when that page is published.

### Public payload

`meta` is added to the anon column grant. It contains nothing private by
construction: the parser refuses an address-shaped author name, and admin-only
facts (who saved, when, which assets are missing) are not fields of it.

## Consequences

- No registry to keep in step with three source tables; nothing to backfill.
- Relations can be authored only from the article editor. A recipe or product
  cannot yet declare a relation on its own side; it gets reverse links.
- Read cost is linear in the number of published articles per render, which is
  fine at this size and is the trigger for the upgrade below.

## Upgrade path

Introduce `content_nodes(kind, source_id, canonical_path, is_published)` and
`content_relations(from_node, to_node, relation_type, origin, sort_order)` when
any of these holds: relations must be authored from the recipe or product
editors; reverse lookups need an index (hundreds of articles); or the search
index (ADR 0003, PR7) needs a durable node id per chunk. `meta.related`
converts row-for-row into `content_relations` with `origin = 'editor'`.
