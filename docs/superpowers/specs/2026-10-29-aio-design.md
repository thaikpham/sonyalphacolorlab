# AIO for ColorLab — JSON-LD, Markdown twins, llms.txt (sub-project 3, second half)

Status: approved by the owner 2026-10-28/29 — `llms.txt` lists the whole site;
JSON-LD gains publisher, concepts, word count and FAQPage; every published
`/blog` and `/learn` page gets a `.md` twin; this PR stops before merge.
Guidance: design-kit `blog-kit/seo-aio.md`. Roadmap:
`docs/plans/2026-10-22-feestfinder-design-kit-adoption.md` §3.

## What exists

`src/components/structured-data.tsx` → `ArticleStructuredData`:
`BlogPosting` / `TechArticle` with headline, description, url,
`mainEntityOfPage`, `inLanguage: 'vi'`, `dateModified` (row `updated_at`, no
`datePublished` — nothing records when a page went public), Person author when
named, `citation` per source, `isPartOf`, plus a `BreadcrumbList`. Articles are
listed once in the sitemap at their canonical Vietnamese URL
(`/vi/blog/<id>`, `/vi/learn/<id>`); `robots.ts` blocks only `/api/`.

## 1. JSON-LD (pure builder, thin component)

The object-building moves to `src/lib/lab/jsonld.ts`:
`articleJsonLd(article, { site, path, learnTitle }) → object[]` (the article
node, the breadcrumb, and a FAQPage when there is one); the component maps
them through the existing `Ld`. Additions:

- `publisher`: `{ '@type': 'Organization', name: 'Alpha ColorLab', url: site, logo: \`${site}/icon\` }`.
- `keywords`: `conceptTitle()` of each `meta.concepts` key, joined by ", ".
- `about`: one `DefinedTerm` per concept — `name` = `conceptTitle(key)`,
  `url` = `${site}/vi/learn/glossary#${conceptAnchor(key)}`,
  `inDefinedTermSet` = `${site}/vi/learn/glossary`. No description (it would
  restate the glossary and could drift from it).
- `wordCount`: words of the visible text of every block (`plainText()`
  below), counted on whitespace.
- `citation[]` gains `publisher: { '@type': 'Organization', name }` when the
  source names one.
- `FAQPage`, as its own node, only when the body holds question pairs: an `h`
  whose text ends in `?` (after trimming) immediately followed by a `p`; each
  becomes a `Question` with `acceptedAnswer.text` = that paragraph, verbatim.
  No pairs → no FAQPage.

Nothing else changes (types, dates, breadcrumb, `<` escaping).

## 2. Markdown twins

URLs mirror the canonical page: `/vi/blog/<id>.md`, `/vi/learn/<id>.md`. A
path with a dot already bypasses the proxy matcher (`.*\\..*`), so
`next.config.ts` adds `rewrites()`:
`/vi/blog/:id([a-z0-9-]+)\\.md` → `/md/article/:id`,
`/vi/learn/:id([a-z0-9-]+)\\.md` → `/md/knowledge/:id`. The handler is
`src/app/md/[kind]/[id]/route.ts`: it reads `getPublishedArticle` /
`getPublishedKnowledgePage`, 404s an unknown kind, an unpublished or unknown
id, and answers `text/markdown; charset=utf-8` with the same revalidation as
the page. `md` joins the proxy matcher's exclusions so `/md/...` hit directly
is not locale-routed (`proxy.test.ts` pins the list).

The body comes from a pure `articleMarkdown(article, { site, path })` in
`src/lib/lab/markdown.ts`, every block type handled by an exhaustive switch
(a new block type fails to compile):

| Block | Markdown |
|---|---|
| `tldr` | `> ` quote, one line per item (three) |
| `h` | `## text` |
| `p` | the paragraph |
| `menu` | `- Cũ: <old>` / `- Mới: <new>` |
| `table` | a GFM table from `head` and `rows`, then `*<caption>*` |
| `callout` | `> **<label>** <text>` |
| `compare` | `*So sánh ảnh: <beforeLabel> / <afterLabel> — <caption>*` (an image slider; the images are not in the text) |
| `checklist` | `**<label>**` then `- [ ] item` per item |
| `figure` | `*Hình: <caption>*` |
| `embed` | `[<caption>](https://www.youtube.com/watch?v=<id>)` / `https://vimeo.com/<id>` |

Head: `# <title>`, the dek, `Nguồn gốc: <canonical URL>`; tail: `## Nguồn`
(each source `- [title](url) — publisher, checkedAt`). Inline text is escaped
only where Markdown would misread it (a leading `#`, `>`, `-`, `|` in table
cells). The pages gain `<link rel="alternate" type="text/markdown" href=…>`
through `generateMetadata` (`alternates.types`).

`plainText(block)` (the words a reader sees) lives beside it and feeds
`wordCount`.

## 3. `/llms.txt`

`src/app/llms.txt/route.ts` (a dotted path, so outside the proxy), the
llmstxt.org shape: `# Alpha ColorLab`, a `> ` one-paragraph summary (English),
then sections, each line `- [name](url): note`:

- **Learn** — every published knowledge page: title, its `.md` URL, dek.
- **Blog** — every published article: title, `.md` URL, dek.
- **Recipes** — every published recipe (`listRecipes('en')`): name,
  `/recipe/<slug>`, the first sentence of its description.
- **Cameras & lenses** (`getSonyCameras`), **Audio** (`getSonyAudio`): name,
  `/cameras/<id>` / `/audio/<id>`.
- **Hubs** — `/colorlab`, `/cameras`, `/audio`, `/learn`, `/learn/glossary`,
  `/blog`, `/search`.

Built by a pure `llmsTxt(input)` in `src/lib/aio/llms.ts`; the route reads the
same cached published functions the sitemap reads, revalidates like it, and
lets a failed online read throw (AGENTS.md — never a seed fallback).
English URLs for recipes and products (the default locale), Vietnamese
canonical URLs for articles.

## Tests

`jsonld.test.ts` (publisher, keywords/about from concepts, wordCount, FAQPage
only from `?`-headings followed by `p`, none otherwise, escaping unchanged);
`markdown.test.ts` (every block type over a fixture article, sources tail,
table escaping); the `.md` route (published → 200 `text/markdown`, draft and
unknown → 404, rewrite source patterns in `next.config.ts`); `llms.test.ts`
(sections in order, one line per published item, counts equal the inputs);
`proxy.test.ts` updated for `md`; `npm run test:screens` green with no count
moved.

## Not done

A `.md` twin for recipes or products; `datePublished`; hreflang for articles
(single-language bodies, ADR 0004); any change to robots.txt.
