# ADR 0003 — Unified search is lexical, in process, over the published reads

Status: accepted · 2026-10-05

## Context

Search today is `/api/search/predictive`: five suggestions from either the
recipe catalogue or the product catalogue, never both, and never an article.
The brief asks for one search across recipes, products, articles and
reference pages, from the header and from a full results page, that respects
unpublish immediately, shows a failed source as failed rather than as "no
results", and defers vectors until a benchmark justifies them.

The whole searchable corpus is a few hundred entities, and every one of them
is already read through a cached, tagged, published-only function.

## Decision

### One service, five adapters, no index

`src/lib/search/` exposes `searchContent(request)`. It calls five adapters in
parallel — recipes, products (cameras, lenses, accessories), audio, articles,
knowledge (authored pages plus the generated glossary) — and each adapter
reads the **same function the pages read**: `listRecipes`, `getSonyCameras`,
`getSonyAudio`, the published-article read. There is no separate index, so
there is nothing that can go stale: unpublishing calls
`revalidateTag(LAB_TAG, IMMEDIATE)`, and the next search reads the list the
next page render reads.

Adapters run under `Promise.allSettled`. A rejected adapter puts its group in
`unavailable` and the response says so; the UI renders "this source could not
be searched" for that group. It never falls back to a seed and never reports
the group as empty (fail closed, as `contentOrOfflineSeed` already does).

### Ranking

Tiered and explainable, never a percentage:

1. exact id, SKU model code, recipe code or name — `exact`
2. derived alias (`a7cii`, `ILCE-7CM2`, `A7C II`) or full title — `alias`, `title`
3. tags, Look code, headings, concept labels — `tag`, `heading`
4. body text: coverage of the query's meaningful tokens — `body`
5. edit-distance near miss on a single token — `fuzzy`

Each hit carries the `reasonCodes` that placed it. Matching is
accent-insensitive (Vietnamese with or without diacritics, both tone-mark
placements) and ignores a short list of Vietnamese and English function words
for coverage. Ties break on kind order for the scope, then title.

Camera aliases are **derived from the catalogue**, not typed from memory: the
model code before `/` in the SKU (`ILCE-7CM2`), the marketing name (`7C II`),
the name with roman numerals as digits and with `a`/`alpha` prefixes
(`a7cii`, `a7c2`), and the SKU code with `ILCE-` dropped (`7cm2`). A model the
catalogue does not hold has no alias and returns nothing — it is never
guessed.

### Contracts

`GET /api/search?q&locale&scope&limit` is validated with Zod (`q` 1–64
characters after trimming, `limit` 1–20, `scope ∈ all | recipes | products |
articles | knowledge`), answers `Cache-Control: no-store`, and returns
`{ query, scope, hits: SearchHit[], groups, unavailable }` with `SearchHit`
as in the brief plus display fields (`subtitle`, `badge`, `imageUrl`,
`price`). `/api/search/predictive` keeps its response shape for the ColorLab
and Wiki headers and now delegates to the same service.

`/[locale]/search?q&scope` renders server-side from the same service (no
HTTP hop), works without JavaScript, is `noindex, follow`, and is not in the
sitemap. The header's search console runs in an "all" mode on `/blog`,
`/learn` and `/search`, with the existing 120 ms debounce, a request sequence
guard plus `AbortController`, and Enter → `/search?q=`. No language model is
called per keystroke or at all.

### Why not Postgres full-text or pgvector now

The corpus fits in memory and is already in memory. Postgres FTS would need
a Vietnamese-aware configuration (`simple` + unaccent) and a separate index
that must be kept consistent with unpublish; vectors need a model contract and
a benchmark. Both are PR7, gated on the evaluation set below beating this
baseline by the margin the brief sets (nDCG@5 +10% relative).

## Evaluation

`src/lib/search/evaluation/queries.ts` holds ≥ 30 labelled queries — exact
names and ids, SKUs, aliases, typos, Vietnamese with and without diacritics,
problem statements and a no-answer query — each mapped to real ids in the
seed corpus. `evaluation.test.ts` runs them against the offline corpus and
fails if exact-match top-1 drops below 100% or Recall@5 below 0.8.
`npm run search:eval` prints the per-query table; the numbers measured on this
branch are recorded in `docs/evaluations/`.

## Feature flags

The MVP is read-only, additive and unflagged; rollback is a revert (runbook).
Names are reserved for the paid or heavy features that come later and default
to **off** when unset: `SEMANTIC_SEARCH_ENABLED`, `PHOTO_DISCOVERY_ENABLED`,
`ASK_COLORLAB_ENABLED`, `MCP_ENABLED`.
