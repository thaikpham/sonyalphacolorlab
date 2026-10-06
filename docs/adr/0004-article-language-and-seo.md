# ADR 0004 — Article bodies are Vietnamese on every locale; canonicals say so

Status: accepted · 2026-10-05 · owner confirmed the `/vi/…` canonical on 2026-10-05

## Context

`types.ts` states the contract: article bodies are authored in Vietnamese and
stay Vietnamese on `/en/...` as well; only the chrome around them is
translated, and the English page says "This article is written in
Vietnamese." The same holds for knowledge pages (ADR 0001).

The sitemap nevertheless lists `/blog/<id>` and `/vi/blog/<id>` as language
alternates of each other, which tells a search engine the English URL is an
English translation. It is not, and `/blog/<id>` carries no canonical at all.

Two concepts are being conflated: the **UI locale** (`en` | `vi`, chosen by
the URL) and the **content language** of an authored body (`vi`, today always).

## Decision

For pages whose main content is an authored body — `/blog/<id>` and
`/learn/<id>`:

- The canonical URL on **both** locales is the Vietnamese one
  (`/vi/blog/<id>`). Both URLs keep working; nothing redirects.
- No `hreflang` alternates are declared for them, in metadata or in the
  sitemap, and the sitemap lists only the canonical URL.
- JSON-LD declares `inLanguage: "vi"` (`BlogPosting` for articles,
  `TechArticle` for knowledge pages) with a `BreadcrumbList`.
- `dateModified` is the row's `updated_at`. There is no `datePublished`: the
  store does not record a publication date, and `created_at` is when a draft
  was started, not when readers could see it. The reviewed date is shown as
  "reviewed" and is never written into either field.
- No author credentials, ratings or invented dates.

For pages whose content is genuinely bilingual — the feed, `/learn`,
`/learn/glossary`, recipes, products — the existing pattern stays: each locale
is canonical for itself and the two are declared as alternates.

`/search` is `noindex, follow` and absent from the sitemap; so are admin
routes, drafts and filtered catalogue URLs.

## Consequences

- A reader who shares the English URL still lands on a working page; search
  engines consolidate both onto the Vietnamese one, which is what the body is.
- The content language stays a constant (`ARTICLE_LANG = 'vi'`). The first
  body written in another language is the trigger to make it a column and to
  reintroduce alternates for that article.
